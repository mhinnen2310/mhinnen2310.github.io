import { NextResponse } from "next/server";
import { createServiceRequest, FormError, type ServiceRequestInput } from "@/lib/forms";

/**
 * Accepts JSON or multipart/form-data (for optional photos, field "photos").
 */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  let photos: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    body = {};
    for (const [k, v] of fd.entries()) {
      if (v instanceof File) continue;
      body[k] = v;
    }
    const files = fd.getAll("photos").filter((f): f is File => f instanceof File);
    photos = files;
  } else {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
    }
  }

  try {
    await createServiceRequest(req.headers, { ...body, photos } as unknown as ServiceRequestInput);
    return NextResponse.json(
      {
        ok: true,
        message:
          "Je verzoek is ontvangen. We beoordelen het en nemen contact met je op — een verzoek is nog geen garantie op uitkering of reparatie.",
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof FormError) {
      return NextResponse.json({ error: err.message, field: err.field ?? undefined }, { status: 400 });
    }
    console.error("service request failed", err);
    return NextResponse.json({ error: "Er ging iets mis. Probeer het over enkele minuten opnieuw." }, { status: 500 });
  }
}
