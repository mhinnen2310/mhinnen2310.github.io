import { prisma } from "./prisma";
import type { InvoiceStatus, Order } from "@prisma/client";
import { nextInvoiceNumberInTx } from "./numbers";
import { getSettings } from "./settings";
import { storage } from "./storage";
import { formatPrice, formatDate } from "./utils";
import { audit } from "./audit";
import { emailInvoice } from "./email";

/**
 * Invoices (spec 24).
 *
 * - Sequential per-year numbering (DF-F-2026-00001), issued atomically.
 * - IMMUTABLE snapshots: customer, company, lines and totals are copied
 *   from the order + site settings at issue time. Changing the product,
 *   customer or company data later NEVER rewrites an issued invoice
 *   (Invariant 8).
 * - One ISSUED invoice per order (idempotent); credit notes are additional
 *   documents on the same order when a refund is processed.
 */

export class InvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceError";
  }
}

interface InvoiceLineSnapshot {
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  taxRate: number;
  taxCents: number;
}

export interface InvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    issuedAt: Date;
    pdfKey: string | null;
    order: Order;
    customer: object;
    company: object;
    lines: object;
    totals: object;
    tax: object;
    notes: string | null;
  };
  pdfKey: string | null;
}

function buildSnapshots(order: Order & { lines: { name: string; quantity: number; unitPriceCents: number; lineTotalCents: number; taxRate: number; taxCents: number; identifier: string | null }[] }) {
  const lines: InvoiceLineSnapshot[] = order.lines.map((l) => ({
    description: l.identifier ? `${l.name} (${l.identifier})` : l.name,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    lineTotalCents: l.lineTotalCents,
    taxRate: l.taxRate,
    taxCents: l.taxCents,
  }));

  const customer = {
    name: order.customerName,
    company: order.customerCompany,
    email: order.customerEmail,
    phone: order.customerPhone,
    line1: order.billingLine1,
    line2: order.billingLine2,
    city: order.billingCity,
    postcode: order.billingPostcode,
    country: order.billingCountry,
  };

  const totals = {
    subtotalCents: order.subtotalCents,
    deliveryCostCents: order.deliveryCostCents,
    taxTotalCents: order.taxTotalCents,
    totalCents: order.totalCents,
    currency: order.currency,
    orderNumber: order.orderNumber,
    placedAt: order.placedAt,
  };

  const tax = (order.taxBasis ?? {}) as Record<string, unknown>;

  return { lines, customer, totals, tax };
}

async function companySnapshot() {
  const s = await getSettings();
  return {
    name: s.companyName,
    addressLine: s.addressLine,
    postcode: s.postcode,
    city: s.city,
    kvkNumber: s.kvkNumber,
    vatId: s.vatId,
    iban: s.iban,
    email: s.email,
    phone: s.phone,
  };
}

/**
 * Issue the invoice for a PAID order (idempotent: returns the existing
 * ISSUED invoice when present).
 */
export async function issueInvoice(orderId: string, actorId: string | null = null): Promise<InvoiceData> {
  const existing = await prisma.invoice.findFirst({
    where: { orderId, status: "ISSUED" },
    include: { order: true },
  });
  if (existing) {
    return { invoice: existing as never, pdfKey: existing.pdfKey };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order) throw new InvoiceError("Bestelling niet gevonden.");
  if (order.paymentStatus !== "PAID") {
    throw new InvoiceError("Een factuur kan alleen worden geïssueerd op een betaalde bestelling.");
  }

  const { lines, customer, totals, tax } = buildSnapshots(order);
  const company = await companySnapshot();

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumberInTx(tx);
    return tx.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        status: "ISSUED",
        customer: customer as object,
        company: company as object,
        lines: lines as object,
        totals: totals as object,
        tax: tax as object,
        notes: "Factuur gegenereerd door Demi Fietsen webshop.",
      },
      include: { order: true },
    });
  });

  // PDF (best effort: invoice exists even if generation fails; can retry).
  const pdfKey = await generateInvoicePdf(invoice).catch((err) => {
    console.error(`invoice pdf failed for ${invoice.invoiceNumber}`, err);
    return null;
  });

  await audit("invoice.issued", "Invoice", invoice.id, { invoiceNumber: invoice.invoiceNumber }, null, actorId ? undefined : null);

  return { invoice: invoice as never, pdfKey };
}

/**
 * Create a credit note for a (partially) refunded order.
 */
export async function issueCreditNote(orderId: string, amountCents: number, reason: string | null, actorId: string | null = null): Promise<string> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
  if (!order) throw new InvoiceError("Bestelling niet gevonden.");
  const { lines, customer, totals, tax } = buildSnapshots(order);
  const company = await companySnapshot();

  const credit = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumberInTx(tx);
    return tx.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        status: "CREDIT_NOTE",
        customer: customer as object,
        company: company as object,
        lines: (lines.map((l) => ({ ...l, quantity: 1, unitPriceCents: Math.round((-amountCents * l.unitPriceCents) / Math.max(1, order.totalCents)) }))) as object,
        totals: { ...totals, totalCents: -amountCents, creditForOrderNumber: order.orderNumber } as object,
        tax: tax as object,
        notes: reason ? `Creditnote: ${reason}` : "Creditnote voor terugbetaling.",
      },
    });
  });

  await audit("invoice.credit_note", "Invoice", credit.id, { invoiceNumber: credit.invoiceNumber, amountCents }, null);
  return credit.invoiceNumber;
}

// --- PDF generation (pdfkit, A4) --------------------------------------------

interface PdfInvoice {
  invoiceNumber: string;
  status: string;
  issuedAt: Date;
  customer: Record<string, unknown>;
  company: Record<string, unknown>;
  lines: InvoiceLineSnapshot[];
  totals: Record<string, unknown>;
  notes: string | null;
  order: { orderNumber: string; placedAt: Date; paymentStatus: string; customerName: string };
}

async function generateInvoicePdf(invoice: {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedAt: Date;
  notes: string | null;
  customer: unknown;
  company: unknown;
  lines: unknown;
  totals: unknown;
  order: Order;
}): Promise<string> {
  const { default: PDFDocument } = await import("pdfkit");
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const c = (invoice.company ?? {}) as Record<string, unknown>;
  const cust = (invoice.customer ?? {}) as Record<string, unknown>;
  const lines = (invoice.lines ?? []) as InvoiceLineSnapshot[];
  const totals = (invoice.totals ?? {}) as Record<string, unknown>;
  const isCredit = invoice.status === "CREDIT_NOTE";

  // Header
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#14532d").text("Demi Fietsen", { align: "left" });
  doc.font("Helvetica").fontSize(9).fillColor("#444444");
  [c.addressLine, [c.postcode, c.city].filter(Boolean).join(" "), c.kvkNumber ? `KvK: ${c.kvkNumber}` : null, c.vatId ? `Btw: ${c.vatId}` : null, c.iban ? `IBAN: ${c.iban}` : null, [c.email, c.phone].filter(Boolean).join("  ·  ")]
    .filter((l): l is string => typeof l === "string" && l.length > 0)
    .forEach((l) => doc.text(l));

  doc.moveDown(1.2);
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111").text(isCredit ? "Creditnote" : "Factuur");
  doc.font("Helvetica").fontSize(10).fillColor("#333333");
  doc.text(`Factuurnummer: ${invoice.invoiceNumber}`);
  doc.text(`Datum: ${formatDate(invoice.issuedAt)}`);
  doc.text(`Bestelnummer: ${invoice.order.orderNumber}`);
  doc.text(`Besteldatum: ${formatDate(invoice.order.placedAt)}`);

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text("Factuuradres");
  doc.font("Helvetica").fontSize(10).fillColor("#333333");
  [cust.name, cust.company, cust.line1, cust.line2, [cust.postcode, cust.city].filter(Boolean).join("  "), cust.country]
    .filter((l): l is string => typeof l === "string" && l.length > 0)
    .forEach((l) => doc.text(l, { continued: false }));

  doc.moveDown(1);

  // Table (explicit y tracking — deterministic layout)
  const colQty = 330;
  const colPrice = 400;
  const colTotal = 500;
  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text("Omschrijving", 60, y, { width: 250 });
  doc.text("Aantal", colQty, y, { width: 50, align: "right" });
  doc.text("Prijs", colPrice, y, { width: 80, align: "right" });
  doc.text("Totaal", colTotal, y, { width: 90, align: "right" });
  y += 20;

  doc.font("Helvetica").fontSize(9).fillColor("#333333");
  for (const l of lines) {
    const descHeight = doc.heightOfString(l.description, { width: 250 });
    const rowH = Math.max(12, descHeight + 4);
    doc.text(l.description, 60, y, { width: 250 });
    doc.text(String(l.quantity), colQty, y, { width: 50, align: "right" });
    doc.text(formatPrice(l.unitPriceCents), colPrice, y, { width: 80, align: "right" });
    doc.text(formatPrice(l.lineTotalCents), colTotal, y, { width: 90, align: "right" });
    y += rowH + 5;
  }
  doc.y = y + 4;

  const taxCfg = (invoice as unknown as { tax?: Record<string, unknown> }).tax;
  const basis = taxCfg?.basis === "excl" ? "excl. btw" : "incl. btw";

  const line = (label: string, value: string, bold = false) => {
    const ly = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5).fillColor(bold ? "#111111" : "#333333");
    doc.text(label, 400, ly, { width: 190, align: "right" });
    doc.text(value, 540, ly, { width: 90, align: "right" });
    doc.y = ly + 16;
  };
  line("Subtotaal", formatPrice(Number(totals.subtotalCents) || 0));
  line("Verzending/levering", formatPrice(Number(totals.deliveryCostCents) || 0));
  if (Number(totals.taxTotalCents) > 0) line(`Verkoopbelasting (${basis})`, formatPrice(Number(totals.taxTotalCents)));
  doc.y += 4;
  line(isCredit ? "Terug te betalen" : "Totaal", formatPrice(isCredit ? -Number(totals.totalCents) : Number(totals.totalCents) || 0), true);

  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(8.5).fillColor("#666666");
  doc.text(`Betalen op: ${String(c.iban ?? "zie factuur")} — vermeld factuurnummer ${invoice.invoiceNumber}`, { width: 480 });
  if (invoice.notes) {
    doc.moveDown(0.4);
    doc.text(invoice.notes, { width: 480 });
  }
  doc.moveDown(0.8);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#999999");
  doc.text("Dit document is digitaal gegenereerd. Bedragen zijn in EUR.", { width: 480 });

  doc.end();
  const pdf = await done;

  const key = `invoices/${invoice.invoiceNumber}.pdf`;
  await storage.put(key, pdf, "application/pdf");
  await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfKey: key } });
  return key;
}

export async function getInvoicePdf(invoiceId: string): Promise<{ data: Buffer; invoiceNumber: string } | null> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice?.pdfKey) return null;
  const stored = await storage.get(invoice.pdfKey);
  if (!stored) return null;
  return { data: stored.data, invoiceNumber: invoice.invoiceNumber };
}

export async function emailInvoiceForOrder(orderId: string, actorId: string | null = null): Promise<{ invoiceNumber: string; sent: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new InvoiceError("Bestelling niet gevonden.");
  const { invoice, pdfKey } = await issueInvoice(orderId, actorId);
  const sent = await emailInvoice(order.customerEmail, order.customerName, {
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    totalCents: Number((invoice.totals as Record<string, unknown>)?.totalCents ?? order.totalCents),
    pdfUrl: `${envBaseUrl()}/api/invoices/${invoice.id}/pdf`,
  }).then(() => true).catch((err) => {
    console.error("emailInvoice failed", err);
    return false;
  });
  return { invoiceNumber: invoice.invoiceNumber, sent, pdfKey } as { invoiceNumber: string; sent: boolean };
}

function envBaseUrl(): string {
  return process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
