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
  const entry = await prisma.rateLimitEntry.upsert({
    where: { key },
    update: { hits: { increment: 1 }, updatedAt: now },
    create: { key, hits: 1, windowStart: now },
  });

  // Window reset check (single reader assumption is fine: window is coarse)
  if (now.getTime() - entry.windowStart.getTime() > windowSeconds * 1000) {
    const reset = await prisma.rateLimitEntry.update({
      where: { key },
      data: { hits: 1, windowStart: now, updatedAt: now },
    });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (entry.hits > limit) {
    const retryAfter = Math.ceil(
      (entry.windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000,
    );
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfter) };
  }
  return { allowed: true, remaining: limit - entry.hits, retryAfterSeconds: 0 };
}

export async function rateLimitRequest(
  purpose: "login" | "password-reset" | "registration" | "form" | "newsletter",
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
