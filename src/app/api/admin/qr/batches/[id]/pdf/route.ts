import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { generateQrBatchPdf } from "@/lib/qr-pdf";
import { QrTagError } from "@/lib/qr-tags";

export const runtime = "nodejs";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!await getStaffUser()) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  try {
    const { id } = await ctx.params; const pdf = await generateQrBatchPdf(id);
    return new NextResponse(new Uint8Array(pdf.data), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${pdf.filename}"`, "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof QrTagError) return NextResponse.json({ error: error.message }, { status: 404 });
    console.error("QR PDF failed", error); return NextResponse.json({ error: "PDF kon niet worden gemaakt." }, { status: 500 });
  }
}
