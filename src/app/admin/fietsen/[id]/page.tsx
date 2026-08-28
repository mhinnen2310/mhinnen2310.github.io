import { notFound } from "next/navigation";
import { AdminBikeEditor } from "@/components/admin-bike-forms";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminBikePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const bike = await prisma.bike.findUnique({
    where: { id },
    select: {
      id: true,
      inventoryCode: true,
      slug: true,
      title: true,
      brand: true,
      model: true,
      priceCents: true,
      status: true,
      bikeType: true,
      colour: true,
      conditionGrade: true,
      conditionDescription: true,
      repairSummary: true,
      description: true,
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, storageKey: true, width: true, height: true, isCover: true } },
    },
  });
  if (!bike) notFound();

  return <AdminBikeEditor bike={bike} />;
}
