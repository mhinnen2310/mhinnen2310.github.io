import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Small signed capabilities for guest-only order actions.
 *
 * Order numbers are sequential and therefore are identifiers, not secrets.
 * These tokens let a newly checked-out guest poll their payment result (and
 * later download an invoice after a verified lookup) without exposing every
 * order to enumeration. They contain no customer data and are verified with
 * a constant-time comparison.
 */

function signingSecret(override?: string): string | null {
  if (override) return override;
  if (env.authSecret) return env.authSecret;
  // A missing production secret must make capabilities unusable, even on a
  // status endpoint that is reached before any checkout configuration check.
  return env.isProduction ? null : "demifietsen-development-order-access-secret";
}

function sign(parts: string[], secret?: string): string {
  const key = signingSecret(secret);
  if (!key) throw new Error("AUTH_SECRET is required to sign order access tokens.");
  return createHmac("sha256", key).update(parts.join("\u0000")).digest("hex");
}

function matches(token: string | null | undefined, expected: string): boolean {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const actual = Buffer.from(token, "hex");
  const comparison = Buffer.from(expected, "hex");
  return actual.length === comparison.length && timingSafeEqual(actual, comparison);
}

export function createPaymentStatusToken(orderNumber: string, secret?: string): string {
  return sign(["payment-status", orderNumber.trim().toUpperCase()], secret);
}

export function verifyPaymentStatusToken(orderNumber: string, token: string | null | undefined, secret?: string): boolean {
  try {
    return matches(token, createPaymentStatusToken(orderNumber, secret));
  } catch {
    return false;
  }
}

export function createGuestInvoiceToken(orderNumber: string, email: string, secret?: string): string {
  return sign(["guest-invoice", orderNumber.trim().toUpperCase(), email.trim().toLowerCase()], secret);
}

export function verifyGuestInvoiceToken(
  orderNumber: string,
  email: string,
  token: string | null | undefined,
  secret?: string,
): boolean {
  try {
    return matches(token, createGuestInvoiceToken(orderNumber, email, secret));
  } catch {
    return false;
  }
}
