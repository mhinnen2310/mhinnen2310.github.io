import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./auth";
import { issueAuthToken, consumeAuthToken } from "./auth-tokens";
import { rateLimitRequest, ipHashOf } from "./rate-limit";
import { emailPasswordReset, emailEmailVerify, emailAccountCreated } from "./email";
import { isEmail } from "./forms";

/**
 * Customer account lifecycle (spec 20).
 *
 * - argon2id password hashing (mature library, never home-rolled);
 * - hashed one-time tokens for email verification / password reset;
 * - rate limiting on reset requests;
 * - account deletion = anonymisation (financial records are kept for the
 *   business's legal retention duties, personal data is removed).
 */

export class AccountError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

function validatePassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < 10) {
    throw new AccountError("Wachtwoord moet minimaal 10 tekens bevatten.", "password");
  }
  if (pw.length > 200) throw new AccountError("Wachtwoord is te lang.", "password");
  return pw;
}

export async function registerUser(input: {
  name: unknown;
  email: unknown;
  password: unknown;
}, ip: string | null = null): Promise<{ userId: string }> {
  if (typeof input.name !== "string" || input.name.trim().length < 2) {
    throw new AccountError("Vul je naam in.", "name");
  }
  if (!isEmail(input.email)) throw new AccountError("Vul een geldig e-mailadres in.", "email");
  const email = input.email.trim().toLowerCase();
  const password = validatePassword(input.password);

  const rateLimit = await rateLimitRequest("registration", [email, ip ?? "no-ip"], 5, 60 * 60);
  if (!rateLimit.allowed) {
    throw new AccountError("Te veel accountaanvragen. Probeer het later opnieuw.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AccountError("Er bestaat al een account met dit e-mailadres. Log in of gebruik ‘wachtwoord vergeten’.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name: input.name.trim(), passwordHash, role: "CUSTOMER" },
  });

  // Best effort: verification e-mail (not required to buy — spec 15).
  const issued = await issueAuthToken(user.id, "email-verify", 72);
  const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(issued.token)}`;
  await emailEmailVerify(email, url).catch((err) => console.error("emailEmailVerify failed", err));
  await emailAccountCreated(email, input.name.trim()).catch((err) =>
    console.error("emailAccountCreated failed", err),
  );

  return { userId: user.id };
}

export async function verifyEmailWithToken(token: string): Promise<boolean> {
  const userId = await consumeAuthToken(token, "email-verify");
  if (!userId) return false;
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return true;
}

export async function requestPasswordReset(email: unknown, ip: string | null): Promise<void> {
  if (!isEmail(email)) return; // never reveal whether the address exists
  const normalized = email.trim().toLowerCase();
  const rl = await rateLimitRequest("password-reset", [normalized, ip ?? "no-ip"], 3, 3600);
  if (!rl.allowed) return;

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return;

  const issued = await issueAuthToken(user.id, "password-reset", 1);
  const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/wachtwoord-resetten?token=${encodeURIComponent(issued.token)}`;
  await emailPasswordReset(normalized, user.name, url).catch((err) =>
    console.error("emailPasswordReset failed", err),
  );
}

export async function resetPasswordWithToken(token: string, newPassword: unknown): Promise<boolean> {
  const password = validatePassword(newPassword);
  const userId = await consumeAuthToken(token, "password-reset");
  if (!userId) return false;
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return true;
}

export async function changePassword(userId: string, current: unknown, next: unknown): Promise<void> {
  const nextPw = validatePassword(next);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) throw new AccountError("Dit account heeft geen wachtwoord ingesteld.");
  const ok = await verifyPassword(user.passwordHash, typeof current === "string" ? current : "");
  if (!ok) throw new AccountError("Huidig wachtwoord is onjuist.", "current");
  const passwordHash = await hashPassword(nextPw);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function updateProfile(userId: string, input: { name: unknown; email: unknown }): Promise<void> {
  const data: { name?: string; email?: string } = {};
  if (input.name != null) {
    if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 120) {
      throw new AccountError("Ongeldige naam.", "name");
    }
    data.name = input.name.trim();
  }
  if (input.email != null) {
    if (!isEmail(input.email)) throw new AccountError("Ongeldig e-mailadres.", "email");
    data.email = input.email.trim().toLowerCase();
  }
  if (Object.keys(data).length === 0) return;
  await prisma.user.update({ where: { id: userId }, data });
}

/**
 * GDPR deletion (spec 20/38): the account and its directly-owned personal
 * data are removed; order/invoice financial records are kept but
 * anonymised (the business must retain them for tax/accounting).
 */
export async function deleteAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { userId },
      data: {
        userId: null,
        customerName: "Anoniem (account verwijderd)",
        customerEmail: "verwijderd@voorbeeld.nl",
        customerPhone: null,
        customerCompany: null,
        internalNotes:
          `Account door klant verwijderd (GDPR): persoonsgegevens geanonimiseerd op ${new Date().toISOString()}.`,
      },
    });
    await tx.user.delete({ where: { id: userId } });
  });
}
