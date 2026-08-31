import { env } from "./env";
import { prisma } from "./prisma";
import { formatPrice, formatDateTime } from "./utils";

/**
 * Transactional email abstraction.
 * - "console": logs email to stdout (development / tests)
 * - "smtp": via nodemailer using SMTP_URL
 *
 * An external provider (Resend, Postmark, ...) can be added behind this
 * interface without changing call sites.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendEmail(msg: EmailMessage): Promise<void> {
  if (env.emailTransport === "smtp" && env.smtpUrl) {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport(env.smtpUrl);
    await transport.sendMail({
      from: env.emailFrom,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return;
  }
  // Console transport (default for dev)
  console.info(`[email:${env.emailTransport}] to=${msg.to} subject="${msg.subject}"`);
  console.info(`[email] text:\n${msg.text}`);
}

function wrapHtml(title: string, bodyHtml: string): { html: string } {
  return {
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;padding:24px;background:#f5f4f0;font-family:Arial,Helvetica,sans-serif;color:#1c2321;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e2da;border-radius:10px;padding:28px;">
<div style="font-size:18px;font-weight:bold;color:#14532d;margin-bottom:16px;">Demi Fietsen</div>
${bodyHtml}
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;color:#6b7280;font-size:12px;">
Demi Fietsen · tweedehands e-bikes</div>
</div></body></html>`,
  };
}

// --- Templates ---------------------------------------------------------------

export async function emailAdminAppointment(appointment: {
  name: string;
  email: string;
  phone: string | null;
  date: string;
  timeBlock: string;
  bikeTitle: string | null;
  message: string | null;
}) {
  const lines = [
    "Nieuwe proefrit/afspraak aanvraag:",
    `Naam: ${appointment.name}`,
    `E-mail: ${appointment.email}`,
    appointment.phone ? `Telefoon: ${appointment.phone}` : null,
    `Gewenste datum: ${appointment.date}`,
    `Tijdslot: ${appointment.timeBlock}`,
    appointment.bikeTitle ? `Fiets: ${appointment.bikeTitle}` : null,
    appointment.message ? `Bericht: ${appointment.message}` : null,
  ].filter(Boolean);
  await sendEmail({
    to: await settingsEmail(),
    subject: "Nieuwe proefrit/afspraak aanvraag",
    html: wrapHtml("Afspraak", `<p>${lines.join("<br>")}</p>`).html,
    text: lines.join("\n"),
  });
}

export async function emailAdminContact(msg: {
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
}) {
  const lines = [
    "Nieuw contactbericht:",
    `Naam: ${msg.name}`,
    `E-mail: ${msg.email}`,
    msg.phone ? `Telefoon: ${msg.phone}` : null,
    msg.subject ? `Onderwerp: ${msg.subject}` : null,
    "",
    msg.message,
  ].filter(Boolean);
  await sendEmail({
    to: await settingsEmail(),
    subject: `Contactbericht van ${msg.name}`,
    html: wrapHtml("Contact", `<p>${lines.join("<br>")}</p>`).html,
    text: lines.join("\n"),
  });
}

export async function emailAdminServiceRequest(req: {
  type: string;
  name: string;
  email: string;
  orderNumber: string | null;
  description: string;
}) {
  const lines = [
    `Nieuwe service/retour aanvraag (${req.type}):`,
    `Naam: ${req.name}`,
    `E-mail: ${req.email}`,
    req.orderNumber ? `Bestelnr: ${req.orderNumber}` : null,
    "",
    req.description,
  ].filter(Boolean);
  await sendEmail({
    to: await settingsEmail(),
    subject: `Service/retour aanvraag van ${req.name}`,
    html: wrapHtml("Service", `<p>${lines.join("<br>")}</p>`).html,
    text: lines.join("\n"),
  });
}

export async function emailOrderConfirmation(order: {
  orderNumber: string;
  email: string;
  name: string;
  totalCents: number;
  lines: { name: string; quantity: number }[];
  paid: boolean;
  paymentUrl: string | null;
  deliveryMethodLabel: string | null;
}) {
  const bodyLines = [
    `Bestelnummer: ${order.orderNumber}`,
    "",
    ...order.lines.map((l) => `${l.quantity}× ${l.name}`),
    "",
    `Totaal: ${formatPrice(order.totalCents)}`,
    order.deliveryMethodLabel ? `Levering: ${order.deliveryMethodLabel}` : null,
    "",
    order.paid
      ? "Je betaling is verwerkt. We nemen contact op voor ophaling/levering."
      : order.paymentUrl
        ? `Nog te betalen via: ${order.paymentUrl}`
        : "Je betaling wordt nog verwerkt.",
  ].filter((l): l is string => l !== null);
  await sendEmail({
    to: order.email,
    subject: order.paid ? `Bevestiging bestelling ${order.orderNumber}` : `Bestelling ${order.orderNumber}`,
    html: wrapHtml("Bestelling", `<p>${bodyLines.join("<br>")}</p>`).html,
    text: bodyLines.join("\n"),
  });
}

export async function emailInvoice(
  to: string,
  name: string,
  invoice: {
    invoiceNumber: string;
    issuedAt: Date;
    totalCents: number;
    pdfUrl: string;
  },
) {
  const lines = [
    `Factuur ${invoice.invoiceNumber}`,
    `Datum: ${formatDateTime(invoice.issuedAt)}`,
    `Totaal: ${formatPrice(invoice.totalCents)}`,
    "",
    `Downloaden: ${invoice.pdfUrl}`,
  ];
  await sendEmail({
    to,
    subject: `Factuur ${invoice.invoiceNumber} — Demi Fietsen`,
    html: wrapHtml("Factuur", `<p>${lines.join("<br>")}</p>`).html,
    text: lines.join("\n"),
  });
}

export async function emailPasswordReset(to: string, name: string | null, url: string) {
  await sendEmail({
    to,
    subject: "Wachtwoord opnieuw instellen",
    html: wrapHtml("Wachtwoord", `<p>Hallo${name ? " " + name : ""},</p><p>Klik hier om je wachtwoord opnieuw in te stellen: ${url}<br>Deze link is 1 uur geldig.</p>`).html,
    text: `Hallo${name ? " " + name : ""},\n\nKlik hier om je wachtwoord opnieuw in te stellen: ${url}\nDeze link is 1 uur geldig.`,
  });
}

export async function emailEmailVerify(to: string, url: string) {
  await sendEmail({
    to,
    subject: "Bevestig je e-mailadres",
    html: wrapHtml("Bevestiging", `<p>Bevestig je e-mailadres: ${url}</p>`).html,
    text: `Bevestig je e-mailadres: ${url}`,
  });
}

export async function emailAccountCreated(to: string, name: string | null) {
  await sendEmail({
    to,
    subject: "Welkom bij Demi Fietsen",
    html: wrapHtml("Welkom", `<p>Hallo${name ? " " + name : ""},</p><p>Je account is aangemaakt. Je vindt hier je bestellingen, facturen en garantie-informatie.</p>`).html,
    text: `Hallo${name ? " " + name : ""}, je account is aangemaakt.`,
  });
}

async function settingsEmail(): Promise<string> {
  try {
    const s = await prisma.siteSettings.findFirst();
    return s?.email || "admin@demifietsen.nl";
  } catch {
    return "admin@demifietsen.nl";
  }
}
