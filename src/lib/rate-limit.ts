import { prisma } from "./prisma";
import { hashIp } from "./utils";

/**
 * Database-backed fixed-window rate limiter.
 * Survives restarts and works with multiple instances (single-row UPDATE).
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.rateLimitEntry.upsert({
      where: { key },
      update: { updatedAt: now },
      create: { key, hits: 0, windowStart: now },
    });
    await tx.$queryRaw`SELECT "key" FROM "RateLimitEntry" WHERE "key" = ${key} FOR UPDATE`;
    const entry = await tx.rateLimitEntry.findUniqueOrThrow({ where: { key } });

    if (now.getTime() - entry.windowStart.getTime() >= windowSeconds * 1000) {
      await tx.rateLimitEntry.update({ where: { key }, data: { hits: 1, windowStart: now, updatedAt: now } });
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
    }

    const hits = entry.hits + 1;
    await tx.rateLimitEntry.update({ where: { key }, data: { hits, updatedAt: now } });
    if (hits > limit) {
      const retryAfter = Math.ceil((entry.windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfter) };
    }
    return { allowed: true, remaining: limit - hits, retryAfterSeconds: 0 };
  });
}

export async function rateLimitRequest(
  purpose: "login" | "mobile-login" | "mobile-refresh" | "password-reset" | "registration" | "form" | "newsletter",
  identifiers: string[],
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const ids = [purpose, ...identifiers.map((i) => i.trim().toLowerCase())].join(":");
  return rateLimit(`rl:${ids}`, limit, windowSeconds);
}

export async function ipHashOf(headers: Headers | Record<string, string | string[] | undefined>): Promise<string | null> {
  const fwd =
    headers instanceof Headers
      ? headers.get("x-forwarded-for")
      : headers["x-forwarded-for"] ?? headers["X-Forwarded-For"];
  const forwarded = Array.isArray(fwd) ? fwd[0] : fwd;
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
  return hashIp(ip);
}
