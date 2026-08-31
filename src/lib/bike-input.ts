/**
 * Server-side allow-list and validation for the bike intake and dossier.
 * Browser forms may be convenient, but they are never the authority for the
 * bike's status, money values or private fields.
 */

export class BikeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BikeInputError";
  }
}

type Payload = Record<string, unknown>;
type BikeData = Record<string, unknown>;

const own = (body: Payload, key: string) => Object.prototype.hasOwnProperty.call(body, key);

function optionalText(body: Payload, key: string, label: string, max: number): string | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new BikeInputError(`${label} is ongeldig.`);
  const result = value.trim();
  if (result.length > max) throw new BikeInputError(`${label} is te lang.`);
  return result || null;
}

function requiredText(body: Payload, key: string, label: string, max: number): string {
  const value = optionalText(body, key, label, max);
  if (!value) throw new BikeInputError(`${label} is verplicht.`);
  return value;
}

function optionalInteger(
  body: Payload,
  key: string,
  label: string,
  min: number,
  max: number,
): number | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new BikeInputError(`${label} is ongeldig.`);
  }
  return value;
}

function requiredInteger(body: Payload, key: string, label: string, min: number, max: number): number {
  const value = optionalInteger(body, key, label, min, max);
  if (value == null) throw new BikeInputError(`${label} is verplicht.`);
  return value;
}

function optionalDecimal(
  body: Payload,
  key: string,
  label: string,
  min: number,
  max: number,
  scale: number,
): string | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  const factor = 10 ** scale;
  if (!Number.isFinite(numeric) || numeric < min || numeric > max || Math.round(numeric * factor) !== numeric * factor) {
    throw new BikeInputError(`${label} is ongeldig.`);
  }
  return numeric.toFixed(scale);
}

function optionalBoolean(body: Payload, key: string, label: string): boolean | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null) return null;
  if (typeof value !== "boolean") throw new BikeInputError(`${label} is ongeldig.`);
  return value;
}

function requiredBoolean(body: Payload, key: string, label: string): boolean {
  const value = optionalBoolean(body, key, label);
  if (value == null) throw new BikeInputError(`${label} is verplicht.`);
  return value;
}

function optionalDate(body: Payload, key: string, label: string): Date | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new BikeInputError(`${label} is ongeldig.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BikeInputError(`${label} is ongeldig.`);
  return date;
}

function requiredDate(body: Payload, key: string, label: string): Date {
  const value = optionalDate(body, key, label);
  if (!value) throw new BikeInputError(`${label} is verplicht.`);
  return value;
}

function optionalFeatures(body: Payload): string[] | undefined {
  if (!own(body, "features")) return undefined;
  const value = body.features;
  if (!Array.isArray(value) || value.length > 30) throw new BikeInputError("De accessoires zijn ongeldig.");
  const result = [...new Set(value.map((entry) => {
    if (typeof entry !== "string") throw new BikeInputError("De accessoires zijn ongeldig.");
    const key = entry.trim();
    if (!key || key.length > 60) throw new BikeInputError("De accessoires zijn ongeldig.");
    return key;
  }))];
  return result;
}

function assign(data: BikeData, key: string, value: unknown) {
  if (value !== undefined) data[key] = value;
}

/** Parse only editable dossier fields. Status and sale lifecycle fields are deliberately absent. */
export function parseBikeUpdate(body: Payload): BikeData {
  const data: BikeData = {};
  const textFields: Array<[string, string, number]> = [
    ["title", "Titel", 160], ["inventoryCode", "Inventarisnummer", 50], ["slug", "Slug", 160],
    ["brand", "Merk", 100], ["model", "Model", 120], ["variant", "Uitvoering", 120],
    ["bikeType", "Fietstype", 80], ["frameStyle", "Frametype", 80], ["genderStyle", "Doelgroep", 80],
    ["colour", "Kleur", 80], ["brakeInfo", "Remmen", 500], ["drivetrainInfo", "Aandrijving", 500],
    ["motorManufacturer", "Motorfabrikant", 100], ["motorModel", "Motormodel", 120],
    ["motorPosition", "Motorpositie", 80], ["motorDescription", "Motorinformatie", 1_000],
    ["electricalNotes", "Elektrische notities", 2_000], ["batteryType", "Accumerk en -model", 160], ["batteryManufacturer", "Accufabrikant", 100], ["batteryModel", "Accumodel", 120],
    ["batteryCondition", "Accustaat", 500], ["batterySerialRef", "Accuserienummer", 160],
    ["batteryNotes", "Interne accunotities", 2_000], ["batteryTestMethod", "Accutestmethode", 500], ["conditionGrade", "Algemene conditie", 80],
    ["conditionDescription", "Conditiebeschrijving", 2_000], ["cosmeticDefects", "Cosmetische gebreken", 2_000],
    ["technicalDefects", "Technische gebreken", 2_000], ["repairSummary", "Uitgevoerd onderhoud", 4_000],
    ["description", "Winkelbeschrijving", 12_000], ["acquisitionSource", "Inkoopbron", 250],
    ["supplierDetails", "Inkoopnotitie", 2_000], ["labourNotes", "Arbeidsnotities", 2_000],
    ["frameSerialRef", "Framenummer", 160], ["storageLocation", "Locatie", 160],
    ["workshopNotes", "Interne werkplaatsnotities", 4_000], ["internalNotes", "Interne notities", 4_000],
    ["saleLabel", "Verkooplabel", 120],
  ];
  for (const [key, label, max] of textFields) assign(data, key, optionalText(body, key, label, max));

  const integerFields: Array<[string, string, number, number]> = [
    ["modelYear", "Bouwjaar", 1900, new Date().getFullYear() + 1], ["frameSizeCm", "Framemaat", 20, 100],
    ["gears", "Aantal versnellingen", 0, 99], ["assistanceLevels", "Ondersteuningsniveaus", 0, 20],
    ["nominalVoltage", "Motorvoltage", 0, 100], ["batteryVoltage", "Accuvoltage", 0, 100],
    ["batteryWh", "Accucapaciteit", 0, 3_000], ["batteryMeasuredWh", "Gemeten accucapaciteit", 0, 3_000], ["batteryCycleCount", "Accucycli", 0, 100_000], ["rangeMinKm", "Minimale actieradius", 0, 500],
    ["rangeMaxKm", "Maximale actieradius", 0, 500], ["batteryWarrantyMonths", "Accugarantie", 0, 120],
    ["labourMinutes", "Arbeidstijd", 0, 100_000], ["priceCents", "Vraagprijs", 0, 100_000_000],
    ["acquisitionCostCents", "Inkoopprijs", 0, 100_000_000], ["partsCostCents", "Onderdelenkosten", 0, 100_000_000],
    ["repairCostCents", "Reparatiekosten", 0, 100_000_000], ["otherCostCents", "Overige kosten", 0, 100_000_000],
  ];
  for (const [key, label, min, max] of integerFields) assign(data, key, optionalInteger(body, key, label, min, max));

  assign(data, "wheelSizeInches", optionalDecimal(body, "wheelSizeInches", "Wielmaat", 8, 36, 1));
  assign(data, "batteryAh", optionalDecimal(body, "batteryAh", "Accucapaciteit (Ah)", 0, 999.99, 2));
  assign(data, "batteryMeasuredAh", optionalDecimal(body, "batteryMeasuredAh", "Gemeten accucapaciteit (Ah)", 0, 999.99, 2));
  assign(data, "batterySohPercent", optionalDecimal(body, "batterySohPercent", "Accu-SOH", 0, 100, 2));

  for (const [key, label] of [["isElectric", "Elektrisch"], ["walkAssist", "Loopondersteuning"], ["batteryReconditioned", "Accurevisie"]] as const) {
    assign(data, key, optionalBoolean(body, key, label));
  }
  for (const [key, label] of [["acquisitionDate", "Inkoopdatum"], ["batteryRevisionDate", "Accurevisiedatum"], ["batteryTestDate", "Accutestdatum"]] as const) {
    assign(data, key, optionalDate(body, key, label));
  }
  assign(data, "features", optionalFeatures(body));

  // These database fields cannot be cleared. Reject that explicitly instead
  // of relying on a Prisma constraint error (which would be a 500 response).
  for (const [key, label] of [
    ["title", "Titel"], ["inventoryCode", "Inventarisnummer"], ["slug", "Slug"], ["brand", "Merk"], ["model", "Model"],
    ["isElectric", "Elektrisch"], ["priceCents", "Vraagprijs"], ["partsCostCents", "Onderdelenkosten"],
    ["repairCostCents", "Reparatiekosten"], ["otherCostCents", "Overige kosten"],
  ] as const) {
    if (data[key] === null) throw new BikeInputError(`${label} is verplicht.`);
  }
  if (data.description !== undefined) data.descriptionTouched = true;
  return data;
}

/** Required intake fields plus the same allow-listed dossier data. */
export function parseBikeCreate(body: Payload): BikeData {
  const data = parseBikeUpdate(body);
  const brand = requiredText(body, "brand", "Merk", 100);
  const model = requiredText(body, "model", "Model", 120);
  const variant = optionalText(body, "variant", "Uitvoering", 120);
  data.brand = brand;
  data.model = model;
  data.bikeType = requiredText(body, "bikeType", "Fietstype", 80);
  data.isElectric = requiredBoolean(body, "isElectric", "Elektrisch");
  data.colour = requiredText(body, "colour", "Kleur", 80);
  data.frameSerialRef = requiredText(body, "frameSerialRef", "Framenummer", 160);
  data.acquisitionCostCents = requiredInteger(body, "acquisitionCostCents", "Inkoopprijs", 0, 100_000_000);
  data.acquisitionDate = requiredDate(body, "acquisitionDate", "Inkoopdatum");
  data.title = optionalText(body, "title", "Titel", 160) ?? [brand, model, variant].filter(Boolean).join(" ");
  data.priceCents = optionalInteger(body, "priceCents", "Vraagprijs", 0, 100_000_000) ?? 0;
  data.features = optionalFeatures(body) ?? [];
  data.descriptionTouched = Boolean(data.description);
  return data;
}

/** The only valid initial lifecycle state for an intake created in admin. */
export function withInitialBikeLifecycle(data: BikeData): BikeData {
  return { ...data, status: "INTAKE" };
}
