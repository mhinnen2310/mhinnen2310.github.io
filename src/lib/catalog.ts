import { prisma } from "./prisma";
import type { Prisma, Bike, BikeImage, Product, ProductImage } from "@prisma/client";
import { isPublicBikeStatus, toPublicBike, type BikePublic } from "@/lib/bikes";
import { sweepExpiredOrdersIfDue } from "./orders";
import { numericValue } from "./utils";

/**
 * Catalogue queries (spec 11).
 *
 * Bicycles are listed AVAILABLE-first (spec 4). Filters only offer values
 * that actually exist in the current inventory (no empty filter groups).
 */

export interface CatalogParams {
  q?: string | null;
  merk?: string[];
  type?: string[];
  frame?: string[];
  electric?: "ja" | "nee" | null;
  wiel?: string[];
  motor?: string[];
  conditie?: string[];
  prijsmin?: number | null;
  prijsmax?: number | null;
  sort?: string | null;
  page?: number;
  pageSize?: number;
}

export interface FilterOptions {
  merken: string[];
  types: string[];
  frames: number[];
  wielen: number[];
  motoren: string[];
  condities: string[];
}

export interface CatalogResult {
  bikes: BikePublic[];
  total: number;
  page: number;
  totalPages: number;
  options: FilterOptions;
}

type CoverImage = { storageKey: string; altText: string | null };
type BikeRow = Omit<Bike, "images"> & { images: CoverImage[]; _count: { images: number } };

function toPublic(row: BikeRow): BikePublic {
  return toPublicBike({
    ...row,
    coverImage: row.images[0] ?? null,
  } as Bike & { coverImage?: { storageKey: string } | null });
}

function stockScope(includeSold: boolean): Prisma.BikeWhereInput {
  return includeSold ? { status: { in: ["SOLD", "ARCHIVED"] } } : { status: "AVAILABLE" };
}

export function buildCatalogWhere(p: CatalogParams, includeSold = false): Prisma.BikeWhereInput {
  const and: Prisma.BikeWhereInput[] = [stockScope(includeSold)];

  if (p.q && p.q.trim().length >= 2) {
    const q = p.q.trim();
    and.push({
      OR: [
        { inventoryCode: { contains: q } },
        { brand: { contains: q } },
        { model: { contains: q } },
        { title: { contains: q } },
        { bikeType: { contains: q } },
        { description: { contains: q } },
      ],
    });
  }
  if (p.merk?.length) and.push({ brand: { in: p.merk } });
  if (p.type?.length) and.push({ bikeType: { in: p.type } });
  if (p.frame?.length) and.push({ frameSizeCm: { in: p.frame.map(Number) } });
  if (p.wiel?.length) and.push({ wheelSizeInches: { in: p.wiel.map(Number) } });
  if (p.motor?.length) and.push({ motorPosition: { in: p.motor } });
  if (p.conditie?.length) and.push({ conditionGrade: { in: p.conditie } });
  if (p.electric === "ja") and.push({ isElectric: true });
  if (p.electric === "nee") and.push({ isElectric: false });
  if (p.prijsmin != null) and.push({ priceCents: { gte: p.prijsmin * 100 } });
  if (p.prijsmax != null) and.push({ priceCents: { lte: p.prijsmax * 100 } });
  return { AND: and };
}

function sortFor(p: CatalogParams): Prisma.BikeOrderByWithRelationInput[] {
  switch (p.sort) {
    case "prijs-asc":
      return [{ priceCents: "asc" }];
    case "prijs-desc":
      return [{ priceCents: "desc" }];
    case "frame":
      return [{ frameSizeCm: "asc" }];
    case "nieuw":
    default:
      return [{ publishedAt: "desc" }];
  }
}

export async function listBikes(p: CatalogParams, includeSold = false): Promise<CatalogResult> {
  if (!includeSold) await sweepExpiredOrdersIfDue();
  const pageSize = Math.min(Math.max(p.pageSize ?? 12, 1), 48);
  const page = Math.max(p.page ?? 1, 1);

  const where = buildCatalogWhere(p, includeSold);
  const [total, bikes] = await Promise.all([
    prisma.bike.count({ where }),
    prisma.bike.findMany({
      where,
      include: {
        _count: { select: { images: { where: { isInternal: false } } } },
        images: {
          where: { isInternal: false },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: { storageKey: true, altText: true },
        },
      },
      orderBy: sortFor(p),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Distinct values that actually exist in the relevant stock (spec 11).
  const scope = stockScope(includeSold);
  const [merken, types, frames, wielen, motoren, condities] = await Promise.all([
    prisma.bike.findMany({ where: scope, distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" }, take: 40 }),
    prisma.bike.findMany({ where: { ...scope, bikeType: { not: null } }, distinct: ["bikeType"], select: { bikeType: true }, orderBy: { bikeType: "asc" }, take: 40 }),
    prisma.bike.findMany({ where: { ...scope, frameSizeCm: { not: null } }, distinct: ["frameSizeCm"], select: { frameSizeCm: true }, orderBy: { frameSizeCm: "asc" }, take: 40 }),
    prisma.bike.findMany({ where: { ...scope, wheelSizeInches: { not: null } }, distinct: ["wheelSizeInches"], select: { wheelSizeInches: true }, orderBy: { wheelSizeInches: "asc" }, take: 40 }),
    prisma.bike.findMany({ where: { ...scope, motorPosition: { not: null } }, distinct: ["motorPosition"], select: { motorPosition: true }, orderBy: { motorPosition: "asc" }, take: 40 }),
    prisma.bike.findMany({ where: { ...scope, conditionGrade: { not: null } }, distinct: ["conditionGrade"], select: { conditionGrade: true }, orderBy: { conditionGrade: "asc" }, take: 40 }),
  ]);

  return {
    bikes: bikes.map(toPublic),
    total,
    page,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    options: {
      merken: merken.map((r) => r.brand as string),
      types: types.map((r) => r.bikeType as string),
      frames: frames.map((r) => r.frameSizeCm as number),
      wielen: wielen.map((r) => numericValue(r.wheelSizeInches)).filter((value): value is number => value != null),
      motoren: motoren.map((r) => r.motorPosition as string),
      condities: condities.map((r) => r.conditionGrade as string),
    },
  };
}

/** "Recently added" for the homepage: newest AVAILABLE first. */
export async function latestAvailableBikes(limit = 4): Promise<BikePublic[]> {
  await sweepExpiredOrdersIfDue();
  const bikes: BikeRow[] = await prisma.bike.findMany({
    where: { status: "AVAILABLE" },
    include: {
      _count: { select: { images: { where: { isInternal: false } } } },
      images: { where: { isInternal: false }, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { storageKey: true, altText: true } },
    },
    orderBy: [{ publishedAt: "desc" }],
    take: limit,
  });
  return bikes.map(toPublic);
}

export async function findPublicBikeBySlug(slug: string) {
  const bike = await prisma.bike.findUnique({
    where: { slug },
    include: {
      _count: { select: { images: { where: { isInternal: false } } } },
      images: { where: { isInternal: false }, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
    },
  });
  if (!bike || !isPublicBikeStatus(bike.status)) return null;
  return {
    public: toPublicBike({
      ...bike,
      coverImage: bike.images[0] ?? null,
    } as Bike & { coverImage?: { storageKey: string } | null }),
    images: bike.images.map((i) => ({ key: i.storageKey, alt: i.altText })),
    full: bike,
  };
}

export async function findProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: { images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] } },
  });
}

/**
 * STOCK_ITEM catalogue (spec 28).
 *
 * Accessories behave like normal stock products: quantity, stock levels,
 * category filters. Only ACTIVE products are listed publicly; stock is
 * shown but never authoritative (the server re-checks at cart/checkout time).
 */
export interface ProductListParams {
  q?: string | null;
  category?: string[];
  sort?: string | null; // nieuw | prijs-asc | prijs-desc | titel
  page?: number;
  pageSize?: number;
}

export interface ProductListResult {
  products: (Product & { images: Pick<ProductImage, "storageKey" | "altText">[] })[];
  total: number;
  page: number;
  totalPages: number;
  categories: string[];
}

export async function listProducts(p: ProductListParams): Promise<ProductListResult> {
  const pageSize = Math.min(Math.max(p.pageSize ?? 12, 1), 48);
  const page = Math.max(p.page ?? 1, 1);

  const where: Prisma.ProductWhereInput = { active: true };
  if (p.q && p.q.trim().length >= 2) {
    const q = p.q.trim();
    where.OR = [{ title: { contains: q } }, { sku: { contains: q } }, { description: { contains: q } }];
  }
  if (p.category?.length) where.category = { in: p.category };

  const orderBy: Prisma.ProductOrderByWithRelationInput = (() => {
    switch (p.sort) {
      case "prijs-asc":
        return { salePriceCents: "asc" };
      case "prijs-desc":
        return { salePriceCents: "desc" };
      case "titel":
        return { title: "asc" };
      case "nieuw":
      default:
        return { createdAt: "desc" };
    }
  })();

  const [total, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        images: {
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: { storageKey: true, altText: true },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.findMany({
      where: { active: true, category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
      take: 40,
    }),
  ]);

  return {
    products,
    total,
    page,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    categories: categories.map((c) => c.category as string),
  };
}
