import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { createQrBatch, QrTagError } from "@/lib/qr-tags";

export async function POST(req: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  try {
    const body = await req.json() as { quantity?: unknown; labelsPerPage?: unknown };
    if (!Number.isSafeInteger(body.quantity) || !Number.isSafeInteger(body.labelsPerPage)) return NextResponse.json({ error: "Ongeldige QR-batch." }, { status: 400 });
    const batch = await createQrBatch(body.quantity as number, body.labelsPerPage as number, actor);
    return NextResponse.json({ id: batch.id, batchNumber: batch.batchNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof QrTagError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("QR batch create failed", error);
    return NextResponse.json({ error: "De QR-batch kon niet worden aangemaakt." }, { status: 500 });
  }
}
