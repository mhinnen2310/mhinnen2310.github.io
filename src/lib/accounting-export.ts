import type { BikeStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { audit } from "./audit";
import { formatDate, formatDateTime, formatPrice } from "./utils";
import { marginVatCents } from "./tax";
import type { SessionUser } from "./auth";

/**
 * A read-only accounting hand-off assembled from immutable order/invoice
 * snapshots and the current audit trail.  This is deliberately a PDF export,
 * not a second ledger: the accounting package remains the statutory source of
 * truth.  Every amount is an integer number of cents in the database.
 */
export interface AccountingExportPeriod {
  from: Date;
  to: Date;
}

const COMPLETED_ORDER_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;
const INVENTORY_STATUSES: BikeStatus[] = ["INTAKE", "WORKSHOP", "READY", "AVAILABLE", "RESERVED", "SALE_PENDING"];

function safeText(value: unknown, fallback = "—", max = 56): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) return fallback;
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

function cents(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : 0;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function lineMargin(line: {
  lineTotalCents: number;
  acquisitionCostCents: number | null;
  marginCents: number | null;
  marginVatCents: number | null;
  taxScheme: string | null;
  taxRate: number;
  bike: { acquisitionCostCents: number | null; partsCostCents: number; repairCostCents: number; otherCostCents: number } | null;
}) {
  const acquisition = line.acquisitionCostCents ?? line.bike?.acquisitionCostCents ?? null;
  const workshop = (line.bike?.partsCostCents ?? 0) + (line.bike?.repairCostCents ?? 0) + (line.bike?.otherCostCents ?? 0);
  const marginBeforeWorkshop = line.marginCents ?? (acquisition == null ? null : line.lineTotalCents - acquisition);
  const realisedMargin = marginBeforeWorkshop == null ? null : marginBeforeWorkshop - workshop;
  const marginVat = line.marginVatCents ?? (line.taxScheme === "MARGIN" && acquisition != null
    ? marginVatCents(line.lineTotalCents, acquisition, line.taxRate || 21)
    : null);
  return { acquisition, workshop, marginBeforeWorkshop, realisedMargin, marginVat };
}

/** Generate the owner-only accounting PDF for a closed-open date period. */
export async function generateAccountingExportPdf(period: AccountingExportPeriod, actor: SessionUser): Promise<{ filename: string; data: Buffer }> {
  const { from, to } = period;
  if (!(from instanceof Date) || Number.isNaN(from.getTime()) || !(to instanceof Date) || Number.isNaN(to.getTime()) || from >= to) {
    throw new Error("Ongeldige exportperiode.");
  }

  const [orders, allOrders, payments, invoices, stockMovements, inventory, auditLogs] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: { in: [...COMPLETED_ORDER_STATUSES] }, paidAt: { gte: from, lt: to } },
      orderBy: [{ paidAt: "asc" }, { orderNumber: "asc" }],
      include: {
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            bike: { select: { inventoryCode: true, acquisitionCostCents: true, partsCostCents: true, repairCostCents: true, otherCostCents: true } },
            product: { select: { sku: true, title: true } },
          },
        },
        payments: { orderBy: { createdAt: "asc" }, include: { confirmedBy: { select: { name: true, email: true } } } },
        invoices: { orderBy: { issuedAt: "asc" }, select: { invoiceNumber: true, status: true, issuedAt: true, totals: true } },
      },
    }),
    prisma.order.findMany({
      where: { placedAt: { gte: from, lt: to } },
      orderBy: [{ placedAt: "asc" }, { orderNumber: "asc" }],
      select: { orderNumber: true, placedAt: true, paidAt: true, paymentStatus: true, fulfilmentStatus: true, subtotalCents: true, taxTotalCents: true, totalCents: true, refundedCents: true, customerName: true },
    }),
    prisma.payment.findMany({
      where: {
        OR: [
          { createdAt: { gte: from, lt: to } },
          { capturedAt: { gte: from, lt: to } },
          { confirmedAt: { gte: from, lt: to } },
          { refundedAt: { gte: from, lt: to } },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: { order: { select: { orderNumber: true, customerName: true } }, confirmedBy: { select: { name: true, email: true } } },
    }),
    prisma.invoice.findMany({
      where: { issuedAt: { gte: from, lt: to } },
      orderBy: { issuedAt: "asc" },
      include: { order: { select: { orderNumber: true, customerName: true, paymentStatus: true } } },
    }),
    prisma.stockMovement.findMany({
      where: { createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: "asc" },
      include: { product: { select: { sku: true, title: true } } },
    }),
    prisma.bike.findMany({
      where: { status: { in: INVENTORY_STATUSES } },
      orderBy: { inventoryCode: "asc" },
      select: { inventoryCode: true, title: true, status: true, acquisitionCostCents: true, priceCents: true, acquisitionDate: true },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const { default: PDFDocument } = await import("pdfkit");
  const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, autoFirstPage: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpace = (height = 22) => {
    if (doc.y + height > pageBottom()) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  };
  const title = (text: string) => {
    ensureSpace(34);
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#14532d").text(text);
    doc.moveDown(0.35);
  };
  const text = (value: string, size = 8.5, color = "#333333") => {
    ensureSpace(size + 8);
    doc.font("Helvetica").fontSize(size).fillColor(color).text(value, { lineGap: 1 });
  };
  const rule = () => {
    ensureSpace(8);
    const y = doc.y;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).lineWidth(0.35).strokeColor("#cbd5e1").stroke();
    doc.y = y + 7;
  };
  const row = (columns: string[], widths: number[], options: { header?: boolean } = {}) => {
    const lineHeight = options.header ? 15 : 13;
    ensureSpace(lineHeight + 3);
    let x = doc.page.margins.left;
    doc.font(options.header ? "Helvetica-Bold" : "Helvetica").fontSize(options.header ? 7.4 : 7.2).fillColor(options.header ? "#111111" : "#333333");
    columns.forEach((column, index) => {
      const width = widths[index] ?? 60;
      doc.text(safeText(column, "", Math.max(8, Math.floor(width / 4.1))), x, doc.y, { width, height: lineHeight, ellipsis: true, lineBreak: false });
      x += width;
    });
    doc.y += lineHeight;
  };
  const sectionTable = (heading: string, headers: string[], widths: number[], rows: string[][]) => {
    title(heading);
    if (!rows.length) {
      text("Geen gegevens in deze periode.", 8.5, "#64748b");
      doc.moveDown(0.4);
      return;
    }
    row(headers, widths, { header: true });
    rule();
    rows.forEach((values) => row(values, widths));
    doc.moveDown(0.45);
  };

  // Cover and summary.
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#14532d").text("Demi Fietsen");
  doc.font("Helvetica-Bold").fontSize(17).fillColor("#111111").text("Administratie-export");
  doc.moveDown(0.4);
  text(`Periode: ${formatDate(from)} t/m ${formatDate(new Date(to.getTime() - 1))}`);
  text(`Gegenereerd: ${formatDateTime(new Date())} door ${safeText(actor.name ?? actor.email)}`);
  doc.moveDown(0.8);
  rule();
  text("Deze export is een gecontroleerde overdracht van de centrale Demi Fietsen-administratie. Bedragen zijn integer eurocenten uit de order-, betaal- en factuursnapshots.", 8.5);
  text("Fietsen zijn standaard als MARGIN (margeregeling) vastgelegd wanneer de order-snapshot dat vermeldt. De btw over de positieve marge wordt intern getoond en niet als afzonderlijke btw-regel op de klantfactuur.", 8.5);
  doc.moveDown(0.8);

  const paidTotal = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const refundedTotal = orders.reduce((sum, order) => sum + order.refundedCents, 0);
  const saleLines = orders.flatMap((order) => order.lines.filter((line) => line.kind === "UNIQUE_BIKE"));
  const marginRows = saleLines.map((line) => lineMargin(line));
  const marginTotal = marginRows.reduce((sum, value) => sum + (value.realisedMargin ?? 0), 0);
  const marginVatTotal = marginRows.reduce((sum, value) => sum + (value.marginVat ?? 0), 0);
  const stockValue = inventory.reduce((sum, bike) => sum + (bike.acquisitionCostCents ?? 0), 0);
  title("Samenvatting");
  const summaryRows: Array<[string, string]> = [
    ["Afgeronde orders", String(orders.length)],
    ["Omzet (order totalen)", formatPrice(paidTotal)],
    ["Terugbetaald", formatPrice(refundedTotal)],
    ["Fietsregels", String(saleLines.length)],
    ["Gerealiseerde marge na werkplaatskosten", formatPrice(marginTotal)],
    ["Btw over positieve fietsmarge", formatPrice(marginVatTotal)],
    ["Nieuwe orders in periode", String(allOrders.length)],
    ["Voorraadwaarde op exportmoment", formatPrice(stockValue)],
    ["Betalingsrecords", String(payments.length)],
    ["Facturen/creditnota's", String(invoices.length)],
  ];
  summaryRows.forEach(([label, value]) => {
    ensureSpace(16);
    doc.font("Helvetica").fontSize(9).fillColor("#333333").text(label, 52, doc.y, { width: 275 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(value, 340, doc.y, { width: 190, align: "right" });
    doc.y += 15;
  });
  doc.moveDown(0.7);

  sectionTable("Verkooptransacties", ["Order", "Betaald", "Klant", "Status", "Subtotaal", "Btw", "Totaal", "Terug"], [57, 54, 106, 58, 57, 45, 57, 45], orders.map((order) => [
    order.orderNumber,
    formatDate(order.paidAt),
    order.customerName,
    order.paymentStatus,
    formatPrice(order.subtotalCents),
    formatPrice(order.taxTotalCents),
    formatPrice(order.totalCents),
    formatPrice(order.refundedCents),
  ]));

  sectionTable("Fietsmarges en margeregeling", ["Order / fiets", "Verkoop", "Inkoop", "Werkplaats", "Marge", "Marge-btw", "Regime"], [126, 65, 65, 70, 68, 68, 66], orders.flatMap((order) => order.lines.filter((line) => line.kind === "UNIQUE_BIKE").map((line) => {
    const margin = lineMargin(line);
    const scheme = line.taxScheme ?? "ONBEKEND";
    return [
      `${order.orderNumber} / ${line.bike?.inventoryCode ?? line.identifier ?? line.name}`,
      formatPrice(line.lineTotalCents),
      margin.acquisition == null ? "REVIEW" : formatPrice(margin.acquisition),
      formatPrice(margin.workshop),
      margin.realisedMargin == null ? "REVIEW" : formatPrice(margin.realisedMargin),
      margin.marginVat == null ? "—" : formatPrice(margin.marginVat),
      margin.acquisition == null ? `${scheme} · REVIEW` : scheme,
    ];
  })));
  text("REVIEW betekent dat de historische order geen vastgelegde inkoopbasis bevatte; corrigeer dit in de boekhouding voordat de marge-aangifte wordt opgesteld.", 7.8, "#92400e");
  doc.moveDown(0.4);

  sectionTable("Betalingen", ["Order", "Aangemaakt", "Methode", "Provider", "Status", "Bedrag", "Bevestigd door"], [70, 59, 60, 58, 74, 62, 135], payments.map((payment) => [
    payment.order.orderNumber,
    formatDate(payment.createdAt),
    payment.method,
    safeText(payment.provider),
    payment.status,
    formatPrice(payment.amountCents),
    payment.confirmedBy ? `${payment.confirmedBy.name ?? payment.confirmedBy.email} ${payment.confirmedAt ? `(${formatDate(payment.confirmedAt)})` : ""}` : "—",
  ]));

  sectionTable("Facturen en creditnota's", ["Nummer", "Datum", "Order", "Klant", "Type", "Totaal", "Betaalstatus"], [82, 55, 70, 110, 64, 65, 107], invoices.map((invoice) => {
    const totals = jsonRecord(invoice.totals);
    return [
      invoice.invoiceNumber,
      formatDate(invoice.issuedAt),
      invoice.order.orderNumber,
      invoice.order.customerName,
      invoice.status,
      formatPrice(cents(totals.totalCents)),
      invoice.order.paymentStatus,
    ];
  }));

  sectionTable("Accessoire-voorraadmutaties", ["Datum", "SKU", "Product", "Mutatie", "Reden", "Referentie"], [60, 70, 150, 55, 100, 118], stockMovements.map((movement) => [
    formatDate(movement.createdAt),
    movement.product.sku,
    movement.product.title,
    movement.change > 0 ? `+${movement.change}` : String(movement.change),
    movement.reason,
    movement.reference ?? "—",
  ]));

  sectionTable("Orderregister (alle statussen)", ["Order", "Geplaatst", "Betaald", "Klant", "Betaalstatus", "Fulfilment", "Totaal"], [70, 58, 58, 128, 81, 78, 80], allOrders.map((order) => [
    order.orderNumber,
    formatDate(order.placedAt),
    formatDate(order.paidAt),
    order.customerName,
    order.paymentStatus,
    order.fulfilmentStatus,
    formatPrice(order.totalCents),
  ]));

  sectionTable("Huidige unieke fietsvoorraad", ["Code", "Fiets", "Status", "Inkoop", "Vraagprijs", "Inkoopdatum"], [63, 155, 78, 66, 70, 103], inventory.map((bike) => [
    bike.inventoryCode,
    bike.title,
    bike.status,
    bike.acquisitionCostCents == null ? "REVIEW" : formatPrice(bike.acquisitionCostCents),
    formatPrice(bike.priceCents),
    formatDate(bike.acquisitionDate),
  ]));

  sectionTable("Audit trail", ["Datum/tijd", "Actie", "Object", "Actor", "ID"], [83, 126, 94, 145, 116], auditLogs.map((entry) => [
    formatDateTime(entry.createdAt),
    entry.action,
    `${entry.entityType}${entry.entityId ? ` / ${entry.entityId}` : ""}`,
    entry.user ? (entry.user.name ?? entry.user.email) : entry.actorType,
    entry.entityId ?? "—",
  ]));

  doc.moveDown(0.4);
  rule();
  text("Einde export. Controleer de PDF op volledigheid en laat de definitieve aangifte/boekingen uitvoeren in het boekhoudpakket van de onderneming.", 8, "#64748b");
  doc.end();

  const data = await done;
  await audit("accounting.exported", "AccountingExport", null, {
    from: from.toISOString(),
    to: to.toISOString(),
    orderCount: orders.length,
    invoiceCount: invoices.length,
  }, actor);
  const datePart = from.toISOString().slice(0, 10);
  const endPart = new Date(to.getTime() - 1).toISOString().slice(0, 10);
  return { filename: `demifietsen-administratie-${datePart}-${endPart}.pdf`, data };
}
