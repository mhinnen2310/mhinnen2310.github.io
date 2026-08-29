import QRCode from "qrcode";
import { prisma } from "./prisma";
import { qrUrl, QrTagError } from "./qr-tags";

export function qrPdfPageCount(quantity: number, labelsPerPage: number) { return Math.ceil(quantity / labelsPerPage); }

/** Deterministic A4 label sheet: 3×5 for 15 labels, 2×5 for 10 labels. */
export async function generateQrBatchPdf(batchId: string): Promise<{ filename: string; data: Buffer }> {
  const batch = await prisma.qrBatch.findUnique({ where: { id: batchId }, include: { tags: { orderBy: { serialNumber: "asc" }, select: { displayCode: true, secureToken: true } } } });
  if (!batch) throw new QrTagError("QR-batch niet gevonden.");
  const { default: PDFDocument } = await import("pdfkit");
  const columns = batch.labelsPerPage === 10 ? 2 : 3;
  const rows = 5; const perPage = columns * rows;
  const margin = 30; const pageW = 595.28; const pageH = 841.89;
  const cellW = (pageW - margin * 2) / columns; const cellH = (pageH - margin * 2) / rows;
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
  const chunks: Buffer[] = []; doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  for (let start = 0; start < batch.tags.length; start += perPage) {
    doc.addPage();
    const page = batch.tags.slice(start, start + perPage);
    for (let index = 0; index < page.length; index++) {
      const tag = page[index]!; const col = index % columns; const row = Math.floor(index / columns);
      const x = margin + col * cellW; const y = margin + row * cellH;
      const qrSize = Math.min(cellW - 28, cellH - 55, 118);
      const png = await QRCode.toBuffer(qrUrl(tag.secureToken), { errorCorrectionLevel: "M", type: "png", margin: 4, width: 512 });
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#14532d").text("DEMI FIETSEN", x, y + 8, { width: cellW, align: "center" });
      doc.image(png, x + (cellW - qrSize) / 2, y + 25, { width: qrSize, height: qrSize });
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111").text(tag.displayCode, x, y + 30 + qrSize, { width: cellW, align: "center" });
    }
  }
  doc.end();
  return { filename: `${batch.batchNumber}.pdf`, data: await done };
}
