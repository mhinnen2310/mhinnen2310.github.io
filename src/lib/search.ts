import { prisma } from "./prisma";
import type { Prisma, Bike, Product, ProductImage } from "@prisma/client";
import { toPublicBike, type BikePublic } from "@/lib/bikes";

/**
 * Public search (spec 30).
 *
 * Scale is small (tens of bikes, hundreds of accessories), so ILIKE over
 * the relevant columns is sufficient — no Elasticsearch.
 * Bikes are matched on inventory code, brand, model, type and description;
 * products on title, SKU and category.
 */

export interface ProductWithCover extends Omit<Product, "images"> {
  images: Pick<ProductImage, "storageKey" | "altText">[];
}

export interface SearchResults {
  bikes: BikePublic[];
  products: ProductWithCover[];
}

export async function searchStorefront(query: string, includeSoldBikes = false): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return { bikes: [], products: [] };

  const bikeOr: Prisma.BikeWhereInput[] = [
    { inventoryCode: { contains: q } },
    { brand: { contains: q } },
    { model: { contains: q } },
    { title: { contains: q } },
    { bikeType: { contains: q } },
    { description: { contains: q } },
  ];
  const bikeWhere: Prisma.BikeWhereInput = includeSoldBikes
    ? { OR: bikeOr }
    : { status: "AVAILABLE", OR: bikeOr };

  const [bikes, products] = await Promise.all([
    prisma.bike.findMany({
      where: bikeWhere,
      include: {
        _count: { select: { images: true } },
        images: {
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: { storageKey: true, altText: true },
        },
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 30,
    }),
    prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { title: { contains: q } },
          { sku: { contains: q } },
          { category: { contains: q } },
          { description: { contains: q } },
        ],
      },
      include: {
        _count: { select: { images: true } },
        images: {
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: { storageKey: true, altText: true },
        },
      },
      orderBy: { title: "asc" },
      take: 30,
    }),
  ]);

  const bikesPublic: BikePublic[] = bikes.map((b) =>
    toPublicBike({ ...b, coverImage: b.images[0] ?? null } as Bike & { coverImage?: { storageKey: string } | null }),
  );

  return {
    bikes: bikesPublic,
    products: products.map((p) => ({ ...p, images: p.images as ProductWithCover["images"] })),
  };
}
