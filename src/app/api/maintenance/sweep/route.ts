import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sweepExpiredOrders } from "@/lib/orders";

function hasValidCronSecret(req: Request): boolean {
  if (!env.cronSecret) return false;
  const authorization = req.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : req.headers.get("x-cron-secret");
  if (!supplied) return false;
  const expectedBuffer = Buffer.from(env.cronSecret);
  const suppliedBuffer = Buffer.from(supplied);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

async function runSweep(req: Request) {
  if (!hasValidCronSecret(req)) {
    // Do not reveal that a maintenance endpoint exists or which mechanism it
    // uses to callers without the deployment secret.
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }
  const result = await sweepExpiredOrders();
  return NextResponse.json({ ok: true, ...result, time: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}

export const GET = runSweep;
export const POST = runSweep;
