import { NextResponse } from "next/server";
import type { BikeStatus } from "@prisma/client";
import { BikeAdminError, createBikeDossier } from "@/lib/bike-admin";
import { BikeInputError } from "@/lib/bike-input";
import { BIKE_STATUSES } from "@/lib/bikes";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

const inventorySelect = {
  id: true, inventoryCode: true, title: true, brand: true, model: true, variant: true,
  status: true, priceCents: true, isElectric: true, storageLocation: true, updatedAt: true,
  images: { where: { isCover: true }, take: 1, select: { storageKey: true } },
} as const;

/** Staff inventory view. It deliberately returns persisted price/status only. */
export async function GET(req: Request) {
  const { actor, response } = await mobileActor(req);
  if (!actor) return response!;
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const view = searchParams.get("view")?.trim() || "active";
  if (view !== "active" && view !== "sold" && view !== "all") {
    return NextResponse.json({ error: "Ongeldige voorraadweergave." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const statusFilter = status ? BIKE_STATUSES.find((candidate) => candidate === status) : undefined;
  if (status && !statusFilter) return NextResponse.json({ error: "Ongeldige fietsstatus." }, { status: 400, headers: { "cache-control": "no-store" } });
  const soldStatuses: BikeStatus[] = ["SOLD", "ARCHIVED"];
  const activeStatuses: BikeStatus[] = BIKE_STATUSES.filter((candidate) => !soldStatuses.includes(candidate));
  if (statusFilter && view === "active" && !activeStatuses.includes(statusFilter)) {
    return NextResponse.json({ error: "Deze status hoort niet bij de actieve voorraadweergave." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  if (statusFilter && view === "sold" && !soldStatuses.includes(statusFilter)) {
    return NextResponse.json({ error: "Deze status hoort niet bij de verkochte voorraadweergave." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const bikes = await prisma.bike.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : view === "sold" ? { status: { in: soldStatuses } } : view === "active" ? { status: { in: activeStatuses } } : {}),
      ...(query ? { OR: [
        { inventoryCode: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { model: { contains: query, mode: "insensitive" } },
        { frameSerialRef: { contains: query, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: inventorySelect,
  });
  return mobileOk({ bikes: bikes.map((bike) => ({ ...bike, coverImage: bike.images[0]?.storageKey ?? null, images: undefined })) });
}

/** Initial intake creation. The server assigns code, status and all money rules. */
export async function POST(req: Request) {
  const { actor, response } = await mobileActor(req);
  if (!actor) return response!;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    return mobileOk(await createBikeDossier(body, actor), 201);
  } catch (error) {
    if (error instanceof BikeAdminError || error instanceof BikeInputError) return mobileError(error, "Fiets kon niet worden aangemaakt.");
    console.error("mobile bike create failed", error);
    return NextResponse.json({ error: "De fiets kon niet worden aangemaakt." }, { status: 500 });
  }
}
