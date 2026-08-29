/** Small shared helpers (no business logic). */

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const eur = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

/** Format integer cents as a euro string. */
export function formatPrice(cents: number): string {
  return eur.format(cents / 100);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function daysBetween(from: Date, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(Number.isFinite(value) ? value : min)));
}

export function parsePositiveInt(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseCentInput(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const cleaned = raw.replace(/\s/g, "").replace("€", "");
  // Accept "1.234,56" (NL) and "1234.56"
  const m = cleaned.match(/^(\d+)([.,](\d{1,2}))?$/);
  if (m) {
    const whole = Number(m[1]);
    const frac = m[3] ? Number(m[3].padEnd(2, "0")) : 0;
    return whole * 100 + frac;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function toDatetimeLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Safely turn a Prisma Decimal (or a normal numeric value) into a number. */
export function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const toNumber = (value as { toNumber?: unknown }).toNumber;
    if (typeof toNumber === "function") {
      const parsed = toNumber.call(value);
      return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

/**
 * Privacy-preserving IP fingerprint for abuse controls. Unlike the previous
 * Base64 encoding this is non-reversible without the deployment secret.
 */
export function hashIp(
  ip: string | null | undefined,
  secret: string | null | undefined = process.env.IP_HASH_SECRET ?? process.env.AUTH_SECRET,
): string | null {
  const normalized = ip?.trim();
  if (!normalized || !secret) return null;
  const { createHmac } = require("crypto") as typeof import("crypto");
  return `ip-hmac-v1-${createHmac("sha256", secret).update(normalized).digest("hex")}`;
}

export function sha256Hex(input: string): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(bytes).toString("hex");
}
