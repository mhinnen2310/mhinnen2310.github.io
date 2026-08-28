import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const STATUS_OPTIONS = {
  appointment: ["NEW", "CONTACTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  serviceRequest: ["NEW", "IN_PROGRESS", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED", "CANCELLED"],
  contactMessage: ["NEW", "CONTACTED", "RESOLVED"],
  orderFulfilment: ["UNFULFILLED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "FULFILLED", "CANCELLED"],
} as const;

type Entity = keyof typeof STATUS_OPTIONS;

export async function PATCH(req: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });

  let body: { entity?: unknown; id?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (typeof body.entity !== "string" || !(body.entity in STATUS_OPTIONS) || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Onbekende beheeractie." }, { status: 400 });
  }
  const entity = body.entity as Entity;
  if (typeof body.status !== "string" || !(STATUS_OPTIONS[entity] as readonly string[]).includes(body.status)) {
    return NextResponse.json({ error: "Ongeldige status." }, { status: 400 });
  }

  try {
    if (entity === "appointment") {
      await prisma.appointment.update({ where: { id: body.id }, data: { status: body.status as never } });
    } else if (entity === "serviceRequest") {
      await prisma.serviceRequest.update({ where: { id: body.id }, data: { status: body.status as never } });
    } else if (entity === "contactMessage") {
      await prisma.contactMessage.update({ where: { id: body.id }, data: { status: body.status as never } });
    } else {
      await prisma.order.update({
        where: { id: body.id },
        data: {
          fulfilmentStatus: body.status as never,
          fulfilledAt: body.status === "FULFILLED" ? new Date() : null,
        },
      });
    }
    await audit("admin.status_changed", entity, body.id, { status: body.status }, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin status update failed", error);
    return NextResponse.json({ error: "De status kon niet worden opgeslagen." }, { status: 500 });
  }
}
