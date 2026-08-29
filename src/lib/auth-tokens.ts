import { prisma } from "./prisma";
import { randomToken, sha256Hex } from "./utils";

/**
 * One-time auth tokens (email verification, password reset).
 * Raw tokens are returned to the user exactly once; only a SHA-256 hash is
 * stored, so a DB leak does not leak usable tokens.
 */
export type AuthTokenPurpose = "email-verify" | "password-reset";

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

export async function issueAuthToken(
  userId: string,
  purpose: AuthTokenPurpose,
  ttlHours: number,
): Promise<IssuedToken> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
  await prisma.$transaction(async (tx) => {
    // Invalidate previously issued (still unconsumed) tokens of the same purpose
    await tx.authToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.authToken.create({
      data: { userId, purpose, tokenHash: sha256Hex(token), expiresAt },
    });
  });
  return { token, expiresAt };
}

export async function consumeAuthToken(
  token: string,
  purpose: AuthTokenPurpose,
): Promise<string | null> {
  const tokenHash = sha256Hex(token);
  const now = new Date();
  const record = await prisma.authToken.findFirst({
    where: { tokenHash, purpose, consumedAt: null, expiresAt: { gt: now } },
  });
  if (!record) return null;
  // Claim in the UPDATE predicate itself. Two concurrent reset/verify
  // requests can both read the token, but only one may consume it.
  const claimed = await prisma.authToken.updateMany({
    where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  });
  return claimed.count === 1 ? record.userId : null;
}
