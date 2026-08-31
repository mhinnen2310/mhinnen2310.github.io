import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron";
import { dispatchOperationalPushes } from "@/lib/push";

export const dynamic = "force-dynamic";

async function run(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  const result = await dispatchOperationalPushes();
  return NextResponse.json({ ok: true, ...result, time: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}

export const GET = run;
export const POST = run;
