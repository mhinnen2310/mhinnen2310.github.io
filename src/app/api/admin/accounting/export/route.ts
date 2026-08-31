import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { generateAccountingExportPdf } from "@/lib/accounting-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateParam(value: string | null, fallback: Date): Date | null {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText ?? NaN);
  const month = Number(monthText ?? NaN);
  const day = Number(dayText ?? NaN);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export async function GET(req: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Inloggen als medewerker is vereist." }, { status: 401 });
  if (!roleAtLeast(actor.role, "OWNER")) return NextResponse.json({ error: "Alleen de eigenaar kan de administratie exporteren." }, { status: 403 });

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  const params = new URL(req.url).searchParams;
  const from = dateParam(params.get("from"), defaultFrom);
  const inclusiveTo = dateParam(params.get("to"), new Date(defaultTo.getTime() - 86_400_000));
  if (!from || !inclusiveTo) return NextResponse.json({ error: "Gebruik geldige datums in het formaat JJJJ-MM-DD." }, { status: 400 });
  const to = new Date(inclusiveTo.getTime() + 86_400_000);
  if (from >= to) return NextResponse.json({ error: "De startdatum moet vóór de einddatum liggen." }, { status: 400 });

  try {
    const pdf = await generateAccountingExportPdf({ from, to }, actor);
    return new NextResponse(new Uint8Array(pdf.data), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdf.filename}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Accounting PDF export failed", error);
    return NextResponse.json({ error: "De administratie-PDF kon niet worden gemaakt." }, { status: 500 });
  }
}
