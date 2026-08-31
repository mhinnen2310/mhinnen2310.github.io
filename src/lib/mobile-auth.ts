import { createHmac, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "./prisma";
import { env } from "./env";
import { roleAtLeast, type SessionUser } from "./auth";

const ACCESS_MS = 15 * 60_000; const REFRESH_MS = 90 * 24 * 60 * 60_000;
export class MobileAuthError extends Error { constructor(message: string) { super(message); this.name = "MobileAuthError"; } }
function secretHash(value: string) { if (!env.authSecret) throw new MobileAuthError("Mobiele authenticatie is niet geconfigureerd."); return createHmac("sha256", env.authSecret).update(`mobile-v1:${value}`).digest("hex"); }
function token() { return randomBytes(32).toString("base64url"); }
function bundle() { const accessToken = token(), refreshToken = token(), now = new Date(); return { accessToken, refreshToken, accessExpiresAt: new Date(now.getTime() + ACCESS_MS), refreshExpiresAt: new Date(now.getTime() + REFRESH_MS) }; }
export type MobileTokenBundle = ReturnType<typeof bundle>;
export interface MobileStaffSession { id: string; user: SessionUser; }

export async function loginMobile(email: string, password: string, deviceId: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.passwordHash || user.isActive === false || !roleAtLeast(user.role, "STAFF") || !(await argon2.verify(user.passwordHash, password))) throw new MobileAuthError("Inloggen mislukt.");
  const tokens = bundle(); await prisma.$transaction([
    prisma.mobileSession.create({ data: { userId: user.id, deviceIdHash: secretHash(deviceId), accessTokenHash: secretHash(tokens.accessToken), refreshTokenHash: secretHash(tokens.refreshToken), accessExpiresAt: tokens.accessExpiresAt, refreshExpiresAt: tokens.refreshExpiresAt } }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);
  return { ...tokens, user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified } };
}
export async function refreshMobile(refreshToken: string, deviceId: string) {
  const current = await prisma.mobileSession.findUnique({ where: { refreshTokenHash: secretHash(refreshToken) } }); const now = new Date();
  if (!current || current.revokedAt || current.refreshExpiresAt <= now || current.deviceIdHash !== secretHash(deviceId)) { if (current && !current.revokedAt) await prisma.mobileSession.update({ where: { id: current.id }, data: { revokedAt: now, revokedReason: "refresh_replay_or_device_mismatch" } }); throw new MobileAuthError("Sessie verlopen; log opnieuw in."); }
  const tokens = bundle(); const rotated = await prisma.mobileSession.updateMany({ where: { id: current.id, refreshTokenHash: secretHash(refreshToken), revokedAt: null }, data: { accessTokenHash: secretHash(tokens.accessToken), refreshTokenHash: secretHash(tokens.refreshToken), accessExpiresAt: tokens.accessExpiresAt, refreshExpiresAt: tokens.refreshExpiresAt, lastUsedAt: now } });
  if (rotated.count !== 1) throw new MobileAuthError("Sessie is al vernieuwd; log opnieuw in."); return tokens;
}
function bearerToken(authHeader: string | null) {
  const raw = authHeader?.match(/^Bearer\s+([A-Za-z0-9_-]{32,128})$/)?.[1]; if (!raw) throw new MobileAuthError("Mobiele sessie vereist.");
  return raw;
}

export async function requireMobileStaffSession(authHeader: string | null): Promise<MobileStaffSession> {
  const raw = bearerToken(authHeader);
  const session = await prisma.mobileSession.findUnique({ where: { accessTokenHash: secretHash(raw) }, include: { user: true } });
  if (!session || session.revokedAt || session.accessExpiresAt <= new Date() || session.user.isActive === false || !roleAtLeast(session.user.role, "STAFF")) throw new MobileAuthError("Mobiele sessie verlopen.");
  await prisma.mobileSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { lastUsedAt: new Date() } });
  return { id: session.id, user: { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role, emailVerified: session.user.emailVerified } };
}

export async function requireMobileStaff(authHeader: string | null): Promise<SessionUser> {
  return (await requireMobileStaffSession(authHeader)).user;
}

/** Device-local logout. A revoked token can never be refreshed or used again. */
export async function revokeMobileSession(authHeader: string | null, reason = "logged_out") {
  const raw = bearerToken(authHeader);
  const current = await prisma.mobileSession.findUnique({ where: { accessTokenHash: secretHash(raw) }, include: { user: true } });
  if (!current || current.revokedAt) throw new MobileAuthError("Mobiele sessie verlopen.");
  const revoked = await prisma.mobileSession.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
  if (revoked.count !== 1) throw new MobileAuthError("Mobiele sessie verlopen.");
  return { id: current.id, user: { id: current.user.id, email: current.user.email, name: current.user.name, role: current.user.role, emailVerified: current.user.emailVerified } satisfies SessionUser };
}
