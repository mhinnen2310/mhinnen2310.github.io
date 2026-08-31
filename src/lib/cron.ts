import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function hasValidCronSecret(req: Request): boolean {
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
