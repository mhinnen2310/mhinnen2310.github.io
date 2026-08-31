import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron";
import { sweepExpiredOrders } from "@/lib/orders";
import { dispatchOperationalPushes } from "@/lib/push";

async function runSweep(req: Request) {
  if (!hasValidCronSecret(req)) {
    // Do not reveal that a maintenance endpoint exists or which mechanism it
    // uses to callers without the deployment secret.
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }
  // Dispatch before sweeping so an expired checkout reservation can still be
  // surfaced as an actionable alert. The dedicated push endpoint can also be
  // scheduled independently when a deployment has a separate cron job.
  const pushes = await dispatchOperationalPushes();
  const result = await sweepExpiredOrders();
  return NextResponse.json({ ok: true, ...result, pushes, time: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}

export const GET = runSweep;
export const POST = runSweep;
