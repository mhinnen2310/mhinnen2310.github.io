import { NextResponse } from "next/server";
import { verifyEmailWithToken } from "@/lib/account";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const ok = await verifyEmailWithToken(token);
  return NextResponse.redirect(
    new URL(ok ? "/inloggen?verified=1" : "/inloggen?verified=0", req.url),
  );
}
