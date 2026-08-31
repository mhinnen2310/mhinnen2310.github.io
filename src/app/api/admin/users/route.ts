import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const ROLES = ["OWNER", "ADMIN", "STAFF", "CUSTOMER"] as const;

export async function POST(req: Request) {
  const actor = await getStaffUser();
  if (!actor || !roleAtLeast(actor.role, "OWNER"))
    return NextResponse.json(
      { error: "Alleen de eigenaar kan accounts aanmaken." },
      { status: 403 },
    );
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" ? body.role : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)
    return NextResponse.json(
      { error: "E-mailadres is ongeldig." },
      { status: 400 },
    );
  if (name.length > 160)
    return NextResponse.json({ error: "Naam is te lang." }, { status: 400 });
  if (password.length < 10 || password.length > 200)
    return NextResponse.json(
      { error: "Gebruik een wachtwoord van 10 tot 200 tekens." },
      { status: 400 },
    );
  if (!ROLES.includes(role as (typeof ROLES)[number]))
    return NextResponse.json({ error: "Ongeldige rol." }, { status: 400 });
  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash: await hashPassword(password),
        role: role as never,
      },
    });
    await audit(
      "admin.user_created",
      "User",
      user.id,
      { role: user.role },
      actor,
    );
    return NextResponse.json({ ok: true, id: user.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint"))
      return NextResponse.json(
        { error: "Dit e-mailadres bestaat al." },
        { status: 409 },
      );
    console.error("admin user create failed", error);
    return NextResponse.json(
      { error: "Account aanmaken is niet gelukt." },
      { status: 500 },
    );
  }
}
