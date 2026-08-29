/**
 * DEMI FIETSEN — development seed.
 *
 * IMPORTANT: this seeds DEMO DATA ONLY (clearly fictitious customers,
 * placeholder company details, generated placeholder photos). It exists so
 * the storefront, admin and tests have representative data. It is NOT a
 * production data source and must never run against production credentials.
 *
 * What is seeded (spec 45):
 *  - SiteSettings (delivery/warranty/tax/legal config, all flagged for review)
 *  - 4 legal pages (placeholders, requiresLegalReview = true)
 *  - admin user (from ADMIN_EMAIL/ADMIN_PASSWORD) + one demo customer
 *  - 3 AVAILABLE unique e-bikes, 1 RESERVED, 1 SOLD, 1 WORKSHOP, 1 INTAKE
 *  - 6 STOCK_ITEM accessories with stock + movement history
 *  - a sample SOLD order created through the REAL business pipeline:
 *    order -> mock "paid" webhook (deduped, verified) -> bike SOLD +
 *    warranty records -> invoice + PDF
 *  - a sample appointment (linked to the reserved bike + reservation)
 *  - workshop service tasks on the WORKSHOP bike
 *  - a sample contact message
 *  - Shopify URL redirect rows (migration demo)
 *
 * Run: npm run db:seed   (or: prisma migrate reset --force)
 */
import "dotenv/config";
import type { Prisma } from "@prisma/client";
import sharp from "sharp";

import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { processImageUpload } from "../src/lib/images";
import { generateBikeDescription, defaultDescriptionContext } from "../src/lib/descriptions";
import { processProviderWebhook } from "../src/lib/checkout";
import { nextOrderNumberInTx } from "../src/lib/numbers";
import { DEFAULT_DELIVERY } from "../src/lib/delivery";
import { DEFAULT_WARRANTY_CONFIG } from "../src/lib/warranty";
import { DEFAULT_TAX_CONFIG } from "../src/lib/tax";
import { DEFAULT_MARKTPLAATS_TEMPLATE } from "../src/lib/marktplaats";

const isRemoteDeployment = process.env.DEPLOYMENT_MODE === "preview" || process.env.NODE_ENV === "production";

function deploymentSecret(name: "ADMIN_EMAIL" | "ADMIN_PASSWORD", developmentFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isRemoteDeployment) throw new Error(`${name} is required when seeding a remote deployment`);
  return developmentFallback;
}

const ADMIN_EMAIL = deploymentSecret("ADMIN_EMAIL", "admin@demifietsen.nl");
const ADMIN_PASSWORD = deploymentSecret("ADMIN_PASSWORD", "dev-only-admin-pw-2026");
const CUSTOMER_EMAIL = "jan@voorbeeld.nl";
const CUSTOMER_PASSWORD = "dev-only-customer-pw-2026";

// ---------------------------------------------------------------------------
// Placeholder imagery (generated, clearly not real product photos)
// ---------------------------------------------------------------------------

interface Placeholder {
  bg: string;
  label: string;
  sub?: string;
}

function bikeSvg({ bg, label, sub }: Placeholder, code: string): string {
  // A simple side-view e-bike silhouette on a muted background.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect width="1200" height="900" fill="${bg}"/>
  <g transform="translate(210,120) scale(1.35)" fill="none" stroke="#26303b" stroke-linecap="round">
    <circle cx="150" cy="320" r="95" stroke-width="12"/>
    <circle cx="470" cy="320" r="95" stroke-width="12"/>
    <circle cx="150" cy="320" r="10" fill="#26303b" stroke="none"/>
    <circle cx="470" cy="320" r="10" fill="#26303b" stroke="none"/>
    <g stroke-width="14">
      <path d="M150 320 L320 310"/>
      <path d="M150 320 L250 160"/>
      <path d="M320 310 L250 160"/>
      <path d="M320 310 L440 190"/>
      <path d="M250 160 L430 150"/>
      <path d="M440 190 L470 320"/>
    </g>
    <path d="M430 150 L415 110 M395 112 L440 108" stroke-width="10"/>
    <ellipse cx="238" cy="142" rx="34" ry="12" fill="#26303b" stroke="none"/>
    <circle cx="320" cy="310" r="26" stroke-width="9"/>
    <path d="M320 310 L352 342" stroke-width="9"/>
    <rect x="300" y="208" width="118" height="26" rx="10" fill="#26303b" stroke="none" transform="rotate(40 320 310)"/>
  </g>
  <rect x="56" y="56" rx="14" width="${code.length * 26 + 44}" height="64" fill="#14532d"/>
  <text x="80" y="100" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#ffffff">${code}</text>
  <text x="600" y="790" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#26303b">${label}</text>
  ${sub ? `<text x="600" y="845" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#5b6672">${sub}</text>` : ""}
</svg>`;
}

function productSvg({ bg, label, sub }: Placeholder): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect width="1200" height="900" fill="${bg}"/>
  <rect x="380" y="240" width="440" height="360" rx="28" fill="none" stroke="#26303b" stroke-width="14"/>
  <path d="M380 380 L820 380" stroke="#26303b" stroke-width="10"/>
  <rect x="560" y="180" width="80" height="60" rx="10" fill="#26303b"/>
  <text x="600" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#26303b">${label}</text>
  ${sub ? `<text x="600" y="755" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#5b6672">${sub}</text>` : ""}
</svg>`;
}

async function putPlaceholderImage(svg: string, scope: "bikes" | "products") {
  const buffer = Buffer.from(svg);
  await sharp(buffer).jpeg({ quality: 82 }).toFile("/tmp/df-seed-src.jpg").catch(() => undefined);
  // Run through the SAME pipeline production uses (EXIF strip, responsive set).
  return processImageUpload(buffer, "image/svg+xml", scope);
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

type BikeSeedData = Omit<
  Prisma.BikeUncheckedCreateInput,
  "inventoryCode" | "slug" | "brand" | "model" | "title" | "status"
> & { title?: string };

interface BikeSeed {
  code: string;
  slug: string;
  brand: string;
  model: string;
  status: "INTAKE" | "WORKSHOP" | "READY" | "AVAILABLE" | "RESERVED" | "SOLD" | "ARCHIVED";
  images: { bg: string; label: string; sub?: string }[];
  data: BikeSeedData;
}

const BIKES: BikeSeed[] = [
  {
    code: "2455",
    slug: "sparta-c2-2455",
    brand: "Sparta",
    model: "C2",
    status: "AVAILABLE",
    images: [
      { bg: "#e8ede9", label: "Sparta C2", sub: "Tweedehands elektrische trekkingfiets" },
      { bg: "#e2e8ee", label: "Sparta C2", sub: "Gereviseerde accu · 36V 10Ah" },
    ],
    data: {
      title: "Sparta C2 elektrische trekkingfiets",
      bikeType: "trekking",
      isElectric: true,
      frameStyle: "deurvrije",
      genderStyle: "unisex",
      colour: "zwart",
      frameSizeCm: 52,
      wheelSizeInches: 28,
      gears: 7,
      assistanceLevels: 4,
      brakeInfo: "Hydraulische schijfremmen voor en achter",
      drivetrainInfo: "Niet-trap cassette met 7-voudige ketting",
      motorManufacturer: "Bosch",
      motorModel: "Active Line Plus",
      motorPosition: "middenbuis",
      nominalVoltage: 36,
      batteryType: "Li-ion",
      batteryVoltage: 36,
      batteryAh: 10,
      batteryWh: 360,
      batteryCondition: "Goede staat, volledig gereviseerd",
      batteryReconditioned: true,
      batteryRevisionDate: new Date(Date.now() - 21 * 86400000),
      rangeMinKm: 40,
      rangeMaxKm: 70,
      batteryWarrantyMonths: 6,
      batteryNotes: "Cells gezet 14-03, interne code ACC-2455-B",
      conditionGrade: "Zeer goede staat",
      conditionDescription:
        "Een nette, volledig gecontroleerde tweedehands trekkingfiets. De accu is door onze werkplaats gereviseerd en de fiets is klaar voor dagelijks gebruik.",
      cosmeticDefects: "Enkele kleine krasjes op het frame, geen deuken.",
      repairSummary:
        "Nieuwe banden, remmen nablijven, versnellingingesteld, accu gereviseerd, complete reiniging en inlooprit.",
      features: ["charger", "lock", "lights", "rearRack", "goodTyres", "fenders", "stand", "bell"],
      priceCents: 124900,
      previousPriceCents: 149900,
      saleLabel: "Kortingen",
      acquisitionCostCents: 62000,
      acquisitionDate: new Date(Date.now() - 40 * 86400000),
      acquisitionSource: "Inruil van een klant",
      partsCostCents: 18550,
      repairCostCents: 9200,
      labourMinutes: 360,
      labourNotes: "O.a. accurevisie (2u) en complete inloop (1,5u).",
      frameSerialRef: "SP-C2-88231-DEV",
      supplierDetails: "Particulier, Hengelo",
      storageLocation: "Hok B3",
      workshopNotes: "Revisierapport accu bijgevoegd (DEV-data).",
      internalNotes: "DEV-seed: uniek exemplaar, nooit meer dan 1 stuks.",
      publishedAt: new Date(Date.now() - 6 * 86400000),
    },
  },
  {
    code: "T5",
    slug: "bakkenes-e-explorer-t5",
    brand: "Bakkenes",
    model: "E-Explorer",
    status: "AVAILABLE",
    images: [
      { bg: "#e9e5da", label: "Bakkenes E-Explorer", sub: "Elektrische trekkingfiets met vorkvering" },
      { bg: "#e4e0d2", label: "Bakkenes E-Explorer", sub: "Bafang middenmotor · 468Wh" },
    ],
    data: {
      title: "Bakkenes E-Explorer elektrische trekkingfiets",
      bikeType: "trekking",
      isElectric: true,
      frameStyle: "deurvrije",
      genderStyle: "unisex",
      colour: "antraciet",
      frameSizeCm: 56,
      wheelSizeInches: 28,
      gears: 9,
      assistanceLevels: 5,
      brakeInfo: "Mechanische schijfremmen",
      drivetrainInfo: "Shimano 9-voudig",
      motorManufacturer: "Bafang",
      motorModel: "M620",
      motorPosition: "middenbuis",
      nominalVoltage: 36,
      batteryType: "Li-ion",
      batteryVoltage: 36,
      batteryAh: 13,
      batteryWh: 468,
      batteryCondition: "Goede staat",
      batteryReconditioned: false,
      rangeMinKm: 50,
      rangeMaxKm: 90,
      batteryWarrantyMonths: 3,
      conditionGrade: "Nieuwstaat",
      conditionDescription:
        "Bijna nieuw, amper gereden. Volledige service in de werkplaats uitgevoerd en gereed voor direct gebruik.",
      cosmeticDefects: "Geen merkbare schade.",
      repairSummary: "Complete service: banden, remmen, versnellingingesteld en reiniging.",
      features: ["charger", "lights", "frontSuspension", "frontRack", "rearRack", "goodTyres", "fenders"],
      priceCents: 114900,
      acquisitionCostCents: 54000,
      acquisitionDate: new Date(Date.now() - 25 * 86400000),
      acquisitionSource: "Aanbesteding (corporate overstay)",
      partsCostCents: 6500,
      repairCostCents: 4000,
      labourMinutes: 180,
      frameSerialRef: "BK-EX-1022-DEV",
      storageLocation: "Hok A1",
      publishedAt: new Date(Date.now() - 2 * 86400000),
    },
  },
  {
    code: "2512",
    slug: "gazelle-ultimate-c8-hmb-2512",
    brand: "Gazelle",
    model: "Ultimate C8 HMB",
    status: "AVAILABLE",
    images: [
      { bg: "#e3e9e4", label: "Gazelle Ultimate C8 HMB", sub: "Elektrische stadfiets" },
      { bg: "#dde6e0", label: "Gazelle Ultimate C8 HMB", sub: "Shimano Steps · 425Wh" },
    ],
    data: {
      title: "Gazelle Ultimate C8 HMB elektrische stadfiets",
      bikeType: "stad",
      isElectric: true,
      frameStyle: "doorligger",
      genderStyle: "heren",
      colour: "donkergrijs",
      frameSizeCm: 58,
      wheelSizeInches: 28,
      gears: 7,
      assistanceLevels: 5,
      brakeInfo: "Hydraulische schijfremmen",
      drivetrainInfo: "7-voudig met automatische versnellingingsindicatie",
      motorManufacturer: "Shimano Steps",
      motorModel: "E6100",
      motorPosition: "middenbuis",
      nominalVoltage: 36,
      batteryType: "Li-ion",
      batteryVoltage: 36,
      batteryAh: 12,
      batteryWh: 425,
      batteryCondition: "Zeer goede staat",
      batteryReconditioned: false,
      rangeMinKm: 45,
      rangeMaxKm: 75,
      batteryWarrantyMonths: 6,
      conditionGrade: "Goede staat",
      conditionDescription:
        "Een betrouwbare Nederlandse e-bike, netjes onderhouden. Volledige werkplaatscontrole uitgevoerd.",
      cosmeticDefects: "Licht gescheurd zadel (nog prima bruikbaar); kleine rijplekjes.",
      repairSummary: "Nieuwe voorremblokken, ketting gesmeerd, complete inlooprit.",
      features: ["charger", "lock", "lights", "rearRack", "panniers", "fenders", "stand", "bell"],
      priceCents: 159900,
      acquisitionCostCents: 88000,
      acquisitionDate: new Date(Date.now() - 35 * 86400000),
      acquisitionSource: "Particulier, Enschede",
      partsCostCents: 9500,
      repairCostCents: 5500,
      labourMinutes: 240,
      frameSerialRef: "GZ-U8-55412-DEV",
      storageLocation: "Hok B1",
      publishedAt: new Date(Date.now() - 9 * 86400000),
    },
  },
  {
    code: "T9",
    slug: "gazelle-meduna-c10-hmb-t9",
    brand: "Gazelle",
    model: "Meduna C10 HMB",
    status: "AVAILABLE", // reservation is created atomically below
    images: [{ bg: "#e6e2d8", label: "Gazelle Meduna C10 HMB", sub: "Gereserveerd — afspraak gepland" }],
    data: {
      title: "Gazelle Meduna C10 HMB",
      bikeType: "stad",
      isElectric: true,
      frameStyle: "doorligger",
      genderStyle: "heren",
      colour: "bordeaux",
      frameSizeCm: 54,
      wheelSizeInches: 28,
      gears: 7,
      assistanceLevels: 5,
      brakeInfo: "Hydraulische schijfremmen",
      motorManufacturer: "Bosch",
      motorModel: "Active Line",
      motorPosition: "middenbuis",
      batteryVoltage: 36,
      batteryAh: 10,
      batteryWh: 360,
      rangeMinKm: 40,
      rangeMaxKm: 65,
      batteryWarrantyMonths: 3,
      conditionGrade: "Goede staat",
      conditionDescription: "Net onderhouden, direct rijklaar.",
      features: ["charger", "lock", "lights", "rearRack", "fenders", "stand"],
      priceCents: 134900,
      acquisitionCostCents: 72000,
      acquisitionDate: new Date(Date.now() - 50 * 86400000),
      acquisitionSource: "Inruil van een klant",
      partsCostCents: 4000,
      repairCostCents: 3000,
      frameSerialRef: "GZ-M10-77890-DEV",
      storageLocation: "Hok B2",
      workshopNotes: "Gereserveerd voor bevestigde afspraak (DEV-data).",
    },
  },
  {
    code: "2387",
    slug: "cube-touring-hybrid-500-2387",
    brand: "Cube",
    model: "Touring Hybrid 500",
    status: "AVAILABLE", // becomes SOLD via the sample order pipeline below
    images: [{ bg: "#e0e4ea", label: "Cube Touring Hybrid 500", sub: "Verkochte e-bike (historisch)" }],
    data: {
      title: "Cube Touring Hybrid 500",
      bikeType: "trekking",
      isElectric: true,
      frameStyle: "deurvrije",
      genderStyle: "unisex",
      colour: "zwart",
      frameSizeCm: 54,
      wheelSizeInches: 28,
      gears: 10,
      assistanceLevels: 4,
      brakeInfo: "Hydraulische schijfremmen",
      motorManufacturer: "Bosch",
      motorModel: "Performance Line CX",
      motorPosition: "middenbuis",
      batteryVoltage: 36,
      batteryAh: 13.8,
      batteryWh: 500,
      batteryCondition: "Gereviseerd",
      batteryReconditioned: true,
      rangeMinKm: 50,
      rangeMaxKm: 90,
      batteryWarrantyMonths: 6,
      conditionGrade: "Zeer goede staat",
      features: ["charger", "lights", "frontRack", "rearRack", "goodTyres", "fenders"],
      priceCents: 138900,
      acquisitionCostCents: 78000,
      acquisitionDate: new Date(Date.now() - 90 * 86400000),
      acquisitionSource: "Particulier, Oldenzaal",
      partsCostCents: 12000,
      repairCostCents: 8500,
      labourMinutes: 420,
      frameSerialRef: "CU-T5-30981-DEV",
      storageLocation: "Hok C2",
    },
  },
  {
    code: "2560",
    slug: "trek-marlin-7e-2560",
    brand: "Trek",
    model: "Marlin 7+",
    status: "WORKSHOP",
    images: [{ bg: "#e5e7e2", label: "Trek Marlin 7+", sub: "In de werkplaats" }],
    data: {
      title: "Trek Marlin 7+ elektrische mountainbike",
      bikeType: "mountain",
      isElectric: true,
      frameStyle: "deurvrije",
      genderStyle: "unisex",
      colour: "grijs",
      frameSizeCm: 17,
      wheelSizeInches: 27.5,
      gears: 12,
      assistanceLevels: 4,
      brakeInfo: "Hydraulische schijfremmen (4-kras)",
      motorManufacturer: "Bosch",
      motorModel: "Performance Line",
      motorPosition: "middenbuis",
      batteryVoltage: 36,
      batteryAh: 10.6,
      batteryWh: 380,
      batteryWarrantyMonths: 3,
      conditionGrade: "Goede staat",
      features: ["charger", "lights", "frontSuspension", "goodTyres"],
      priceCents: 179900,
      acquisitionCostCents: 95000,
      acquisitionDate: new Date(Date.now() - 8 * 86400000),
      acquisitionSource: "Particulier, Almelo",
      partsCostCents: 3500,
      repairCostCents: 0,
      frameSerialRef: "TR-M7-66120-DEV",
      storageLocation: "Werkbank 2",
      workshopNotes: "Nieuwe ketting besteld; acculading nog te testen. Niet publiceren vóór 'Klaar'.",
      internalNotes: "DEV-seed: workshop in gang.",
    },
  },
  {
    code: "2561",
    slug: "sparta-e-fusion-2561",
    brand: "Sparta",
    model: "E-Fusion",
    status: "INTAKE",
    images: [{ bg: "#e8e6e0", label: "Sparta E-Fusion", sub: "Nieuw binnen — nog niet gepubliceerd" }],
    data: {
      title: "Sparta E-Fusion",
      bikeType: "trekking",
      isElectric: true,
      colour: "wit",
      priceCents: 99900,
      acquisitionCostCents: 42000,
      acquisitionDate: new Date(Date.now() - 2 * 86400000),
      acquisitionSource: "Particulier, Hengelo",
      partsCostCents: 0,
      repairCostCents: 0,
      supplierDetails: "Naam nog te noteren (DEV)",
      storageLocation: "Intake-hoek",
      internalNotes: "DEV-seed: intake, specificaties nog te controleren.",
    },
  },
];

interface ProductSeed {
  sku: string;
  slug: string;
  title: string;
  category: string;
  priceCents: number;
  stock: number;
  low: number;
  description: string;
  bg: string;
}

const PRODUCTS: ProductSeed[] = [
  {
    sku: "ACC-1001",
    slug: "cateye-el100-voorlamp",
    title: "Fietslamp voor — Cateye EL100",
    category: "Verlichting",
    priceCents: 2495,
    stock: 12,
    low: 3,
    description: "Compacte dynamo-voorlamp (15 lux) met wisselmodus. Inclusief klem en kabel. Gebruikt, getest en schoon.",
    bg: "#eceadf",
  },
  {
    sku: "ACC-1002",
    slug: "abus-birlow-4045",
    title: "Fietsenslot — ABUS Birlow 4045",
    category: "Sloten",
    priceCents: 3495,
    stock: 8,
    low: 3,
    description: "Robuust kettenslot met schijfremslot, security level 9. Gebruikt maar volledig functioneel.",
    bg: "#e3e9f0",
  },
  {
    sku: "ACC-1003",
    slug: "emotion-accuhouder-adapter",
    title: "Accuhouder — E-Motion accu adapter",
    category: "Accu & elektrisch",
    priceCents: 1995,
    stock: 5,
    low: 3,
    description: "Framehouder/adapter voor E-Motion accu's, passend op de meest voorkomende stelschroefafmetingen.",
    bg: "#e9e4f0",
  },
  {
    sku: "ACC-1004",
    slug: "shimano-st-e6000-remhendel",
    title: "Remhendel — Shimano ST-E6000",
    category: "Remmen",
    priceCents: 2495,
    stock: 3,
    low: 3,
    description: "Nieuwe Shimano ST-E6000 remhendel (rechts), hydraulisch. Originele verpakking.",
    bg: "#f0e3e3",
  },
  {
    sku: "ACC-1005",
    slug: "emotion-throttle-set",
    title: "Draaiknop/throttle — E-Motion throttle set",
    category: "Accu & elektrisch",
    priceCents: 2995,
    stock: 4,
    low: 3,
    description: "Complete throttle-set (loopassistent) voor E-Motion systemen: draaiknop, bedrading en aansluiting.",
    bg: "#e6ece6",
  },
  {
    sku: "ACC-1006",
    slug: "wahoo-elemnt-roam",
    title: "Fietscomputer — Wahoo ELEMNT ROAM",
    category: "Computers",
    priceCents: 18995,
    stock: 2,
    low: 2,
    description: "GPS-fietscomputer met waterdichte behuizing. Volledig geüpdatet en getest; inclusief oplaadkabel.",
    bg: "#eef0e4",
  },
];

// ---------------------------------------------------------------------------
// Wipe + seed
// ---------------------------------------------------------------------------

async function wipe() {
  const models = [
    "analyticsEvent",
    "auditLog",
    "migrationImport",
    "webhookEvent",
    "stockMovement",
    "priceHistoryEntry",
    "serviceTask",
    "reservation",
    "cartLine",
    "cart",
    "orderLine",
    "payment",
    "order",
    "warrantyRecord",
    "invoice",
    "bikeImage",
    "productImage",
    "bike",
    "product",
    "appointmentAvailabilityOverride",
    "appointmentAvailabilityRule",
    "appointment",
    "contactMessage",
    "serviceRequest",
    "newsletterSubscriber",
    "userAddress",
    "authToken",
    "user",
    "rateLimitEntry",
    "numberCounter",
    "urlRedirect",
    "legalPage",
    "siteSettings",
  ] as const;
  type DeleteManyDelegate = { deleteMany: () => Promise<unknown> };
  const delegates = prisma as unknown as Record<(typeof models)[number], DeleteManyDelegate>;
  for (const m of models) {
    await delegates[m].deleteMany();
  }
}

async function main() {
  console.log("▸ Demi Fietsen seed — DEMO DATA ONLY (development)");
  console.log("▸ Wiping existing rows…");
  await wipe();

  // --- Site settings --------------------------------------------------------
  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: "Demi Fietsen",
      email: "info@demifietsen.nl",
      phone: "0548-555123",
      addressLine: "Fietspad 12",
      postcode: "7552 AB",
      city: "Hengelo",
      kvkNumber: "87654321",
      vatId: "NL876543219B01",
      iban: "NL00 DEMI 0000 0000 00",
      aboutText:
        "Demi Fietsen is een specialist in tweedehands elektrische fietsen. Elke fiets is een uniek exemplaar: we controleren en herstelten hem in onze eigen werkplaats, reviseren de accu waar mogelijk, en fotograferen de fiets die je koopt. Zo weet je precies wat je krijgt — met garantie en eerlijke prijzen.",
      openingHours: [
        { days: "ma t/m vr", hours: "09:00–17:00" },
        { days: "zaterdag", hours: "09:00–16:00" },
        { days: "zondag", hours: "gesloten" },
      ],
      socialLinks: [{ label: "Facebook", url: "https://www.facebook.com/demifietsen" }],
      announcement: { enabled: false, text: "", link: null },
      homepage: {
        heroTitle: null,
        heroSubtitle: null,
        intro: null,
        showRecentlyAdded: true,
        showWhyUs: true,
        showHowItWorks: true,
      },
      delivery: DEFAULT_DELIVERY as unknown as Prisma.InputJsonValue,
      warranty: DEFAULT_WARRANTY_CONFIG as unknown as Prisma.InputJsonValue,
      marketplace: DEFAULT_MARKTPLAATS_TEMPLATE as unknown as Prisma.InputJsonValue,
      seo: {
        siteName: "Demi Fietsen",
        description:
          "Tweedehands elektrische fietsen met garantie. Elke fiets is uniek, geïnspecteerd en gereviseerd. Bekijk het actuele aanbod en plan een proefrit.",
        ogImageKey: null,
      },
      analytics: { enabled: true },
      tax: DEFAULT_TAX_CONFIG as unknown as Prisma.InputJsonValue,
      newsletterEnabled: true,
    },
  });
  console.log(`▸ SiteSettings: ${settings.companyName} (tax/warranty/delivery = default, requiresReview=true)`);

  // --- Legal pages (placeholders — need legal review) ------------------------
  const legal: { slug: string; title: string; body: string }[] = [
    {
      slug: "privacy",
      title: "Privacyverklaring",
      body:
        "Demi Fietsen verwerkt persoonsgegevens (zoals naam, e-mailadres en bestelgegevens) uitsluitend voor de uitvoering van je bestelling, het in stand houden van je account, garantie- en serviceafhandeling en — met jouw toestemming — de nieuwsbrief.\n\nWij delen geen persoonsgegevens met derden, tenzij dit wettelijk verplicht is of nodig is voor de uitvoering van je bestelling (bijvoorbeeld transport of betaling).\n\nJe hebt te allen tijde recht op inzage, correctie en verwijdering van je persoonsgegevens. Neem hiervoor contact met ons op.\n\nLET OP: dit is nog geen definitieve tekst. Demi Fietsen brengt een volledige, door een juridisch professional gecontroleerde privacyverklaring aan plaats bij de livegang van de nieuwe website.",
    },
    {
      slug: "algemene-voorwaarden",
      title: "Algemene voorwaarden",
      body:
        "Deze pagina bevat nog geen definitieve algemene voorwaarden. Demi Fietsen werkt aan volledige voorwaarden (bestelling, betaling, levering, garantie, retour en klachten) die voorafgaand aan de livegang door een juridisch professional worden gecontroleerd.\n\nTot die tijd gelden de wettelijke bepalingen op consumentenovereenkomsten. Voor vragen kun je altijd contact met ons opnemen.",
    },
    {
      slug: "retourbeleid",
      title: "Retour- en garantiebeleid",
      body:
        "Op tweedehands fietsen die bij Demi Fietsen worden gekocht zit garantie; de exacte omvang (fiets, accu, elektrisch systeem) wordt bij elke verkoop vastgelegd en staat vermeld bij de betreffende fiets of bestelling.\n\nRetourneer- en garantieaanspraken worden per geval beoordeeld. Dien een verzoek in via het formulier ‘Retour, garantie & service’ en we nemen contact met je op.\n\nLET OP: dit is nog geen definitieve tekst. Demi Fietsen publiceert een volledige, door een juridisch professional gecontroleerde tekst voorafgaand aan de livegang van de nieuwe website.",
    },
    {
      slug: "cookiebeleid",
      title: "Cookiebeleid",
      body:
        "Demi Fietsen gebruikt uitsluitend functionele cookies die nodig zijn om de winkelwagen en je inlogsessie te laten werken. Er worden geen trackingcookies zonder toestemming geplaatst.",
    },
  ];
  for (const l of legal) {
    await prisma.legalPage.create({
      data: { slug: l.slug, title: l.title, body: l.body, requiresLegalReview: true },
    });
  }
  console.log(`▸ Legal pages: ${legal.length} (requiresLegalReview=true)`);

  // --- Users -----------------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      name: "Demi Beheerder",
      role: "OWNER",
      emailVerified: new Date(),
    },
  });
  const customer = await prisma.user.create({
    data: {
      email: CUSTOMER_EMAIL,
      passwordHash: await hashPassword(CUSTOMER_PASSWORD),
      name: "Jan Bakker",
      role: "CUSTOMER",
      emailVerified: new Date(),
    },
  });
  console.log(`▸ Users: admin ${ADMIN_EMAIL} (OWNER), customer ${CUSTOMER_EMAIL}`);

  // --- Bikes + images + descriptions -----------------------------------------
  const ctx = await defaultDescriptionContext();
  const bikeIds = new Map<string, string>();
  for (const seed of BIKES) {
    const bike = await prisma.bike.create({
      data: {
        inventoryCode: seed.code,
        slug: seed.slug,
        brand: seed.brand,
        model: seed.model,
        title: seed.data.title ?? `${seed.brand} ${seed.model}`,
        status: seed.status,
        ...seed.data,
      },
    });
    bikeIds.set(seed.code, bike.id);

    let sortOrder = 0;
    let cover: string | null = null;
    for (const img of seed.images) {
      const processed = await putPlaceholderImage(
        seed.code.startsWith("ACC") ? productSvg(img) : bikeSvg(img, seed.code),
        "bikes",
      );
      const row = await prisma.bikeImage.create({
        data: {
          bikeId: bike.id,
          storageKey: processed.key,
          altText: img.label,
          width: processed.width || 1200,
          height: processed.height || 900,
          sortOrder,
          isCover: sortOrder === 0,
        },
      });
      if (sortOrder === 0) cover = row.storageKey;
      sortOrder++;
    }

    // Generate the customer-facing description from the SAME structured data.
    const fresh = await prisma.bike.findUnique({ where: { id: bike.id } });
    if (fresh) {
      const description = generateBikeDescription(fresh, ctx);
      await prisma.bike.update({
        where: { id: bike.id },
        data: { description, descriptionTouched: false },
      });
    }
    console.log(`  • ${seed.code} — ${seed.brand} ${seed.model} (${seed.status})${cover ? "" : " (geen foto)"}`);
  }

  // --- Products + images + stock history --------------------------------------
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        slug: p.slug,
        title: p.title,
        category: p.category,
        description: p.description,
        salePriceCents: p.priceCents,
        purchasePriceCents: Math.round(p.priceCents * 0.55),
        stockQuantity: p.stock,
        lowStockThreshold: p.low,
        active: true,
      },
    });
    await prisma.stockMovement.create({
      data: { productId: product.id, change: p.stock, reason: "receive", note: "Startvoorraad (DEV-seed)" },
    });
    const processed = await putPlaceholderImage(productSvg({ bg: p.bg, label: p.title }), "products");
    await prisma.productImage.create({
      data: {
        productId: product.id,
        storageKey: processed.key,
        altText: p.title,
        width: processed.width || 1200,
        height: processed.height || 900,
        sortOrder: 0,
        isCover: true,
      },
    });
  }
  console.log(`▸ Products: ${PRODUCTS.length} accessoires met voorraadgeschiedenis`);

  // --- Sample SOLD order via the REAL business pipeline ------------------------
  const soldBikeId = bikeIds.get("2387")!;
  const soldBike = await prisma.bike.findUnique({ where: { id: soldBikeId } });
  const orderTotal = 138900;
  const taxRate = 21;
  const net = Math.round(orderTotal / (1 + taxRate / 100));
  const taxCents = orderTotal - net;
  const placedAt = new Date(Date.now() - 21 * 86400000);

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumberInTx(tx);
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: customer.id,
        customerName: "Jan Bakker",
        customerEmail: CUSTOMER_EMAIL,
        customerPhone: "06-5551234",
        billingLine1: "Prinsengracht 123",
        billingCity: "Amsterdam",
        billingPostcode: "1015 CJ",
        billingCountry: "NL",
        deliveryMethod: "pickup",
        deliveryLine1: "Fietspad 12",
        deliveryCity: "Hengelo",
        deliveryPostcode: "7552 AB",
        deliveryCountry: "NL",
        deliveryCostCents: 0,
        subtotalCents: orderTotal,
        taxTotalCents: taxCents,
        totalCents: orderTotal, // basis = incl (DEV-seed, requiresReview=true)
        currency: "EUR",
        placedAt,
        taxBasis: { basis: "incl", bikeRate: taxRate, accessoryRate: taxRate, requiresReview: true },
        internalNotes: "[seed] Voorbeeldbestelling — DEV-data.",
        lines: {
          create: [
            {
              kind: "UNIQUE_BIKE",
              bikeId: soldBikeId,
              name: soldBike!.title,
              identifier: "2387",
              unitPriceCents: orderTotal,
              quantity: 1,
              lineTotalCents: orderTotal,
              taxRate,
              taxCents: taxCents,
              specs: {
                frameSizeCm: 54,
                wheelSizeInches: 28,
                gears: 10,
                batteryWh: 500,
                motorPosition: "middenbuis",
                conditionGrade: "Zeer goede staat",
                colour: "zwart",
              },
            },
          ],
        },
      },
    });
    // Bike held for the order (checkout would do this atomically).
    const held = await tx.bike.updateMany({
      where: { id: soldBikeId, status: "AVAILABLE" },
      data: { status: "RESERVED" },
    });
    if (held.count !== 1) throw new Error("Seed sale bike could not be reserved.");
    await tx.reservation.create({
      data: {
        bikeId: soldBikeId,
        source: "CHECKOUT",
        customerName: "Jan Bakker",
        customerEmail: CUSTOMER_EMAIL,
        orderId: created.id,
        expiresAt: new Date(placedAt.getTime() + 30 * 60000),
        status: "ACTIVE",
      },
    });
    await tx.payment.create({
      data: {
        orderId: created.id,
        provider: "mock",
        method: "MOCK",
        providerPaymentId: "mock_seed_2387",
        amountCents: orderTotal,
        currency: "EUR",
        status: "open",
        description: `Bestelling ${orderNumber}`,
        metadata: { orderNumber },
      },
    });
    return created;
  });

  // "Paid" webhook — the SAME verified + idempotent pipeline production uses.
  const webhookResult = await processProviderWebhook("mock", {
    paymentId: "mock_seed_2387",
    status: "paid",
  });
  const invoice = await prisma.invoice.findUnique({ where: { issuedOrderKey: order.id } });
  console.log(
    `▸ Sample order ${order.orderNumber}: webhook=${webhookResult.outcome}, bike SOLD, invoice ${invoice?.invoiceNumber ?? "niet aangemaakt"} (PDF ${invoice?.pdfKey ? "ok" : "niet gegenereerd"})`,
  );

  // --- Reserved bike: reservation + confirmed appointment ----------------------
  const reservedBikeId = bikeIds.get("T9")!;
  const reservation = await prisma.$transaction(async (tx) => {
    const reserved = await tx.bike.updateMany({
      where: { id: reservedBikeId, status: "AVAILABLE" },
      data: { status: "RESERVED" },
    });
    if (reserved.count !== 1) throw new Error("Seed appointment bike could not be reserved.");
    return tx.reservation.create({
      data: {
        bikeId: reservedBikeId,
        source: "APPOINTMENT",
        customerName: "Sanne de Vries",
        customerEmail: "sanne@voorbeeld.nl",
        customerPhone: "06-5559876",
        expiresAt: new Date(Date.now() + 3 * 86400000),
        status: "ACTIVE",
        note: "Gereserveerd vanuit bevestigde afspraak (DEV-seed).",
      },
    });
  });
  const appointment = await prisma.appointment.create({
    data: {
      customerName: "Sanne de Vries",
      customerEmail: "sanne@voorbeeld.nl",
      customerPhone: "06-5559876",
      bikeId: reservedBikeId,
      preferredDate: new Date(Date.now() + 2 * 86400000),
      timeBlock: "10:00–11:00",
      message: "Ik wil de fiets graag even proefrijden en ook de accu laten checken.",
      status: "CONFIRMED",
      internalNotes: "DEV-seed: afspraak bevestigd, fiets gereserveerd.",
      reservationId: reservation.id,
    },
  });
  console.log(`▸ Reservation ${reservation.id.slice(0, 8)}… + appointment ${appointment.id.slice(0, 8)}… (T9, CONFIRMED)`);

  // --- Workshop bike: service tasks -------------------------------------------
  const workshopBikeId = bikeIds.get("2560")!;
  const tasks = [
    { description: "Complete inspectie na intake", partCostCents: 0, completed: true, doneDate: new Date(Date.now() - 5 * 86400000) },
    { description: "Voorband vervangen (Schwalbe)", partCostCents: 3500, completed: true, doneDate: new Date(Date.now() - 3 * 86400000) },
    { description: "Remmen nablijven en remvloeistof gecontroleerd", partCostCents: 0, completed: true, doneDate: new Date(Date.now() - 3 * 86400000) },
    { description: "Ketting vervangen (Shimano CN-M66)", partCostCents: 4500, completed: false, internalNotes: "Besteld, verwacht volgende week (DEV)." },
    { description: "Complete reiniging + inlooprit", partCostCents: 0, completed: false },
  ];
  for (const t of tasks) {
    await prisma.serviceTask.create({
      data: {
        bikeId: workshopBikeId,
        description: t.description,
        partCostCents: t.partCostCents,
        completed: t.completed,
        doneDate: t.doneDate ?? null,
        internalNotes: t.internalNotes ?? null,
      },
    });
  }
  console.log(`▸ Workshop tasks: ${tasks.length} op 2560`);

  // --- Contact message ----------------------------------------------------------
  await prisma.contactMessage.create({
    data: {
      name: "Marc Jansen",
      email: "marc.jansen@voorbeeld.nl",
      phone: "06-5550001",
      subject: "Vraag over proefrit",
      message: "Hoi, kan ik op zaterdag de Sparta C2 (nr. 2455) komen proefrijden? Groet, Marc",
      status: "NEW",
    },
  });
  console.log("▸ Contact message: 1 (NEW)");

  // --- Shopify URL redirects (migration demo) -----------------------------------
  const redirects: [string, string][] = [
    ["/products/sparta-c2-2455", "/fietsen/sparta-c2-2455"],
    ["/products/gazelle-ultimate-c8-hmb-2512", "/fietsen/gazelle-ultimate-c8-hmb-2512"],
    ["/products/bakkenes-e-explorer-t5", "/fietsen/bakkenes-e-explorer-t5"],
    ["/products/gazelle-meduna-c10-hmb-t9", "/fietsen/gazelle-meduna-c10-hmb-t9"],
    ["/products/cube-touring-hybrid-500-2387", "/fietsen/cube-touring-hybrid-500-2387"],
    ["/collections/elektrische-fietsen", "/fietsen"],
    ["/collections/accessoires", "/accessoires"],
    ["/cart", "/winkelwagen"],
    ["/policies/privacy-policy", "/privacy"],
    ["/pages/over-ons", "/over-ons"],
  ];
  for (const [oldPath, newPath] of redirects) {
    await prisma.urlRedirect.create({ data: { oldPath, newPath, active: true, source: "shopify" } });
  }
  console.log(`▸ URL redirects: ${redirects.length}`);

  // --- Price history demo (2455) --------------------------------------------------
  const available2455 = bikeIds.get("2455")!;
  await prisma.priceHistoryEntry.create({
    data: {
      bikeId: available2455,
      oldPriceCents: 149900,
      newPriceCents: 124900,
      changedBy: admin.id,
      createdAt: new Date(Date.now() - 5 * 86400000),
    },
  });
  console.log("▸ Price history: 1 verandering op 2455");

  console.log("");
  console.log("Seed voltooid. Samenvatting:");
  console.log("  - 7 fietsen: 3 AVAILABLE, 1 RESERVED (T9), 1 SOLD (2387), 1 WORKSHOP (2560), 1 INTAKE (2561)");
  console.log("  - 6 accessoires met voorraad + historie");
  console.log("  - 1 betaalde bestelling met factuur + garantie (via echte webhook-pipeline)");
  console.log("  - 1 afspraak (CONFIRMED) + reservation, 5 werkplaats-taken, 1 contactbericht");
  console.log(
    isRemoteDeployment
      ? "  - Admin: " + ADMIN_EMAIL + " (wachtwoord komt uit de beveiligde omgevingsvariabele)"
      : "  - Admin: " + ADMIN_EMAIL + " / " + ADMIN_PASSWORD,
  );
  console.log("  - Customer: " + CUSTOMER_EMAIL + " / " + CUSTOMER_PASSWORD);
  console.log("");
  console.log("LET OP: dit is DEMO-DATA. Gebruik dit niet als productiedata of voor productie-inloggen.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
