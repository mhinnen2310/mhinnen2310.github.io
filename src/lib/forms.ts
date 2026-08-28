import { prisma } from "./prisma";
import type { ServiceRequestType } from "@prisma/client";
import { rateLimitRequest, ipHashOf } from "./rate-limit";
import { emailAdminAppointment, emailAdminContact, emailAdminServiceRequest } from "./email";
import { processImageUpload } from "./images";
import { getSettings } from "./settings";
import { randomToken } from "./utils";

/**
 * Customer-initiated workflow forms (specs 17, 18, 19, 39).
 *
 * Every form:
 * - validates server-side (the client is never trusted);
 * - is rate-limited (spam protection);
 * - stores only the fields that are needed (GDPR minimisation);
 * - notifies the business by e-mail (best effort — the record in the DB is
 *   the source of truth, the e-mail is a convenience).
 */

export class FormError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "FormError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(v: unknown): v is string {
  return typeof v === "string" && EMAIL_RE.test(v.trim()) && v.trim().length <= 254;
}

function clean(v: unknown, max: number): string {
  if (typeof v !== "string") throw new FormError("Ongeldige invoer.");
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length < 2) throw new FormError("Dit veld is te kort.");
  if (s.length > max) throw new FormError("Dit veld is te lang.");
  return s;
}

function optional(v: unknown, max: number): string | null {
  if (v == null) return null;
  if (typeof v !== "string") throw new FormError("Ongeldige invoer.");
  const s = v.trim();
  if (!s) return null;
  if (s.length > max) throw new FormError("Dit veld is te lang.");
  return s;
}

function parseDate(v: unknown): Date {
  if (typeof v !== "string" || !v) throw new FormError("Kies een datum.");
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new FormError("Ongeldige datum.");
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  if (d.getTime() < day.getTime()) throw new FormError("De gekozen datum ligt in het verleden.");
  const max = new Date();
  max.setDate(max.getDate() + 90);
  if (d.getTime() > max.getTime()) throw new FormError("Kies een datum binnen de komende 90 dagen.");
  return d;
}

export const TIME_BLOCKS = ["'s ochtends (09:00–12:00)", "'s middags (12:00–15:00)", "'s avonds (15:00–18:00)"] as const;

function parseTimeBlock(v: unknown): string {
  if (typeof v !== "string" || !TIME_BLOCKS.includes(v as (typeof TIME_BLOCKS)[number])) {
    throw new FormError("Kies een tijdstip.");
  }
  return v;
}

async function guard(headers: Headers, email: string, purpose: "form" | "newsletter", limit = 5, windowSeconds = 600) {
  const ip = await ipHashOf(headers);
  const rl = await rateLimitRequest(purpose, [email, ip ?? "no-ip"], limit, windowSeconds);
  if (!rl.allowed) {
    throw new FormError("Je hebt te veel aanvragen verzonden. Probeer het over enkele minuten opnieuw.");
  }
}

// --- Appointment (proefrit / afspraak) --------------------------------------

export interface AppointmentInput {
  name: unknown;
  email: unknown;
  phone?: unknown;
  bikeId?: unknown;
  locationId?: unknown;
  preferredDate: unknown;
  timeBlock: unknown;
  message?: unknown;
}

export async function createAppointment(headers: Headers, input: AppointmentInput): Promise<{ id: string; code: string }> {
  const name = clean(input.name, 120);
  if (!isEmail(input.email)) throw new FormError("Vul een geldig e-mailadres in.", "email");
  const email = input.email.trim().toLowerCase();
  const phone = optional(input.phone, 30);
  const preferredDate = parseDate(input.preferredDate);
  const timeBlock = parseTimeBlock(input.timeBlock);
  const message = optional(input.message, 2000);

  let bikeId: string | null = null;
  if (typeof input.bikeId === "string" && input.bikeId.trim()) {
    const bike = await prisma.bike.findUnique({ where: { id: input.bikeId.trim() } });
    if (!bike) throw new FormError("De fiets is niet gevonden.");
    bikeId = bike.id;
  }

  await guard(headers, email, "form");

  const code = `AF-${randomToken(4).toUpperCase()}`;
  const appointment = await prisma.appointment.create({
    data: {
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      bikeId,
      locationId: typeof input.locationId === "string" ? input.locationId.slice(0, 60) : null,
      preferredDate,
      timeBlock,
      message,
      status: "NEW",
    },
  });

  const bike = bikeId ? await prisma.bike.findUnique({ where: { id: bikeId } }) : null;
  await emailAdminAppointment({
    name,
    email,
    phone,
    date: preferredDate.toISOString(),
    timeBlock,
    bikeTitle: bike ? `${bike.brand} ${bike.model} (${bike.inventoryCode})` : null,
    message,
  }).catch((err) => console.error("emailAdminAppointment failed", err));

  return { id: appointment.id, code };
}

// --- Contact -----------------------------------------------------------------

export interface ContactInput {
  name: unknown;
  email: unknown;
  phone?: unknown;
  subject?: unknown;
  message: unknown;
}

export async function createContactMessage(headers: Headers, input: ContactInput): Promise<{ id: string }> {
  const name = clean(input.name, 120);
  if (!isEmail(input.email)) throw new FormError("Vul een geldig e-mailadres in.", "email");
  const email = input.email.trim().toLowerCase();
  const phone = optional(input.phone, 30);
  const subject = optional(input.subject, 140);
  const message = clean(input.message, 4000);

  await guard(headers, email, "form");

  const ip = await ipHashOf(headers);
  const msg = await prisma.contactMessage.create({
    data: { name, email, phone, subject, message, status: "NEW", ipHash: ip },
  });

  await emailAdminContact({ name, email, phone, subject, message }).catch((err) =>
    console.error("emailAdminContact failed", err),
  );
  return { id: msg.id };
}

// --- Service / return / warranty ----------------------------------------------

const SERVICE_TYPES: ServiceRequestType[] = ["RETURN", "WARRANTY", "SERVICE", "DAMAGE", "OTHER"];

export interface ServiceRequestInput {
  type: unknown;
  orderNumber?: unknown;
  name: unknown;
  email: unknown;
  phone?: unknown;
  product?: unknown; // bike or product title (informational)
  description: unknown;
  photos?: File[];
}

export async function createServiceRequest(
  headers: Headers,
  input: ServiceRequestInput,
): Promise<{ id: string }> {
  if (typeof input.type !== "string" || !SERVICE_TYPES.includes(input.type as ServiceRequestType)) {
    throw new FormError("Kies een type verzoek.");
  }
  const type = input.type as ServiceRequestType;
  const name = clean(input.name, 120);
  if (!isEmail(input.email)) throw new FormError("Vul een geldig e-mailadres in.", "email");
  const email = input.email.trim().toLowerCase();
  const phone = optional(input.phone, 30);
  const orderNumber =
    typeof input.orderNumber === "string" && input.orderNumber.trim()
      ? input.orderNumber.trim().toUpperCase()
      : null;
  const description = clean(input.description, 6000);

  // If an order number is given it must exist (helps us route the request).
  let orderId: string | null = null;
  let orderEmail: string | null = null;
  if (orderNumber) {
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) throw new FormError("We kennen dit bestelnummer niet. Controleer de speling.", "orderNumber");
    orderId = order.id;
    orderEmail = order.customerEmail;
  }

  await guard(headers, email, "form");

  // Optional photos (max 4, each ≤ 10 MB) — processed through the standard
  // pipeline (EXIF stripped, resized, stored in object storage).
  const photos = Array.isArray(input.photos) ? input.photos.slice(0, 4) : [];
  const photoKeys: string[] = [];
  for (const file of photos) {
    if (file.size > 10 * 1024 * 1024) {
      throw new FormError("Een foto is te groot (max. 10 MB per foto).");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processImageUpload(buffer, file.type || "image/jpeg", "service");
    photoKeys.push(processed.key);
  }

  const req = await prisma.serviceRequest.create({
    data: {
      type,
      orderNumber,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      description,
      photoKeys,
      status: "NEW",
    },
  });

  await emailAdminServiceRequest({
    type,
    name,
    email,
    orderNumber,
    description,
  }).catch((err) => console.error("emailAdminServiceRequest failed", err));

  // If the e-mail matches the order owner we can link the request to the
  // order for the admin (best effort, never blocks the submission).
  if (orderId && email === orderEmail) {
    await prisma.serviceRequest.update({ where: { id: req.id }, data: { internalNotes: "E-mail komt overeen met besteller." } });
  }

  return { id: req.id };
}

// --- Newsletter ----------------------------------------------------------------

export async function subscribeNewsletter(headers: Headers, email: unknown, source: string | null = null): Promise<{ created: boolean }> {
  if (!isEmail(email)) throw new FormError("Vul een geldig e-mailadres in.", "email");
  const normalized = email.trim().toLowerCase();
  await guard(headers, normalized, "newsletter", 5, 600);

  const s = await getSettings();
  if (!s.newsletterEnabled) throw new FormError("De nieuwsbrief is momenteel niet open.");

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: normalized } });
  if (existing) {
    if (!existing.active) {
      await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { active: true, consentedAt: new Date(), consentSource: source ?? existing.consentSource },
      });
    }
    return { created: false };
  }
  await prisma.newsletterSubscriber.create({
    data: { email: normalized, consentSource: source, consentedAt: new Date(), active: true },
  });
  return { created: true };
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (typeof token !== "string" || token.length < 10) return false;
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!sub) return false;
  await prisma.newsletterSubscriber.update({ where: { id: sub.id }, data: { active: false } });
  return true;
}
