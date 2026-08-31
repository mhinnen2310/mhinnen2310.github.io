import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { restoreSettingsRevision } from "@/lib/settings";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser();
  if (!actor)
    return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  if (!roleAtLeast(actor.role, "ADMIN"))
    return NextResponse.json({ error: "Alleen een beheerder mag websiteversies terugzetten." }, { status: 403 });
  const { id } = await ctx.params;
  if (!id || id.length > 80)
    return NextResponse.json({ error: "Ongeldige versie." }, { status: 400 });
  try {
    const restored = await restoreSettingsRevision(id, actor.id);
    if (!restored)
      return NextResponse.json(
        { error: "Versie niet gevonden." },
        { status: 404 },
      );
    await audit(
      "settings.restored",
      "SiteSettingsRevision",
      id,
      { version: "restored" },
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("settings revision restore failed", error);
    return NextResponse.json(
      { error: "Versie terugzetten is niet gelukt." },
      { status: 500 },
    );
  }
}
