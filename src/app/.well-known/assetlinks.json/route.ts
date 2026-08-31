import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const FINGERPRINT = /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/;

export function GET() {
  const fingerprints = (env.androidAppCertSha256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => FINGERPRINT.test(value));
  if (!fingerprints.length) {
    return NextResponse.json({ error: "Android App Link-certificaat is niet geconfigureerd." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "nl.demifietsen.staff",
      sha256_cert_fingerprints: fingerprints,
    },
  }], { headers: { "cache-control": "public, max-age=3600" } });
}
