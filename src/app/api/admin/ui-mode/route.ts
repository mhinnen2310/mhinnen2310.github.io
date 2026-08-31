import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { UI_MODE_COOKIE } from "@/lib/ui-mode-cookie";

export async function POST(request: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  if (!roleAtLeast(actor.role, "STAFF")) return NextResponse.json({ error: "Alleen medewerkers mogen de weergave wijzigen." }, { status: 403 });
  let mode: unknown;
  try { mode = (await request.json()).mode; } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (mode !== "initial" && mode !== "redesign") return NextResponse.json({ error: "Ongeldige weergave." }, { status: 400 });
  const response = NextResponse.json({ ok: true, mode });
  response.cookies.set(UI_MODE_COOKIE, mode, { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  await audit("ui-mode.updated", "SiteSettings", "1", { mode }, actor);
  return response;
}
