import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const ROLES = ["OWNER", "ADMIN", "STAFF", "CUSTOMER"] as const;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser();
  if (!actor || !roleAtLeast(actor.role, "ADMIN"))
    return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 403 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, isActive: true },
  });
  if (!target)
    return NextResponse.json(
      { error: "Account niet gevonden." },
      { status: 404 },
    );
  const data: {
    name?: string | null;
    email?: string;
    emailVerified?: null;
    sessionVersion?: { increment: number };
    isActive?: boolean;
    role?: never;
  } = {};
  if ("email" in body) {
    if (
      typeof body.email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(body.email.trim()) ||
      body.email.trim().length > 254
    )
      return NextResponse.json(
        { error: "E-mailadres is ongeldig." },
        { status: 400 },
      );
    const email = body.email.trim().toLowerCase();
    if (email !== target.email) {
      const exists = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (exists && exists.id !== id)
        return NextResponse.json(
          { error: "Dit e-mailadres bestaat al." },
          { status: 409 },
        );
      data.email = email;
      data.emailVerified = null;
      data.sessionVersion = { increment: 1 };
    }
  }
  if ("name" in body) {
    if (body.name !== null && typeof body.name !== "string")
      return NextResponse.json({ error: "Naam is ongeldig." }, { status: 400 });
    if (typeof body.name === "string" && body.name.trim().length > 160)
      return NextResponse.json({ error: "Naam is te lang." }, { status: 400 });
    data.name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : null;
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean")
      return NextResponse.json(
        { error: "Actief-status is ongeldig." },
        { status: 400 },
      );
    if (id === actor.id && body.isActive === false)
      return NextResponse.json(
        { error: "Je kunt je eigen account niet uitschakelen." },
        { status: 400 },
      );
    if (target.role === "OWNER" && actor.role !== "OWNER")
      return NextResponse.json(
        { error: "Alleen de eigenaar mag een eigenaar uitschakelen." },
        { status: 403 },
      );
    if (target.role === "OWNER" && body.isActive === false) {
      const ownerCount = await prisma.user.count({
        where: { role: "OWNER", isActive: true },
      });
      if (ownerCount <= 1)
        return NextResponse.json(
          { error: "Er moet minimaal één actieve eigenaar overblijven." },
          { status: 400 },
        );
    }
    data.isActive = body.isActive;
  }
  if ("role" in body) {
    if (actor.role !== "OWNER")
      return NextResponse.json(
        { error: "Alleen de eigenaar mag rollen wijzigen." },
        { status: 403 },
      );
    if (
      typeof body.role !== "string" ||
      !ROLES.includes(body.role as (typeof ROLES)[number])
    )
      return NextResponse.json({ error: "Ongeldige rol." }, { status: 400 });
    if (target.role === "OWNER" && body.role !== "OWNER") {
      const ownerCount = await prisma.user.count({
        where: { role: "OWNER", isActive: true },
      });
      if (ownerCount <= 1)
        return NextResponse.json(
          { error: "Er moet minimaal één actieve eigenaar overblijven." },
          { status: 400 },
        );
    }
    (data as unknown as { role: (typeof ROLES)[number] }).role =
      body.role as (typeof ROLES)[number];
  }
  if (!Object.keys(data).length)
    return NextResponse.json(
      { error: "Geen wijzigingen opgegeven." },
      { status: 400 },
    );
  const updated = await prisma.user.update({
    where: { id },
    data: data as never,
    select: { id: true, name: true, role: true, isActive: true },
  });
  await audit(
    "admin.user_updated",
    "User",
    id,
    {
      fields: Object.keys(data),
      role: updated.role,
      isActive: updated.isActive,
    },
    actor,
  );
  return NextResponse.json({ ok: true, user: updated });
}
