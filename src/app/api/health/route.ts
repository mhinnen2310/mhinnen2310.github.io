import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Liveness + database health (spec 43).
 * No secrets, no stack traces.
 */
export async function GET() {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  const status = db === "ok" ? 200 : 503;
  return NextResponse.json(
    { status: db === "ok" ? "ok" : "degraded", db, time: new Date().toISOString() },
    { status },
  );
}
