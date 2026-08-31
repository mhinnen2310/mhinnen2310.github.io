import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser();
  if (!actor || !roleAtLeast(actor.role, "ADMIN"))
    return NextResponse.json(
      { error: "Alleen een beheerder kan een klant koppelen." },
      { status: 403 },
    );
  const { id } = await ctx.params;
  let body: { userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (body.userId !== null && typeof body.userId !== "string")
    return NextResponse.json(
      { error: "Klantkeuze is ongeldig." },
      { status: 400 },
    );
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!order)
    return NextResponse.json(
      { error: "Bestelling niet gevonden." },
      { status: 404 },
    );
  const userId =
    typeof body.userId === "string" && body.userId ? body.userId : null;
  if (userId) {
    const customer = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!customer || customer.role !== "CUSTOMER" || !customer.isActive)
      return NextResponse.json(
        { error: "Kies een actieve klantaccount." },
        { status: 400 },
      );
  }
  await prisma.order.update({ where: { id }, data: { userId } });
  await audit("admin.order_customer_linked", "Order", id, { userId }, actor);
  return NextResponse.json({ ok: true });
}
