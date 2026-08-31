/** Server-side validation shared by accessory create and update routes. */
export class ProductInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductInputError";
  }
}

type Payload = Record<string, unknown>;
type ProductData = Record<string, unknown>;
const own = (body: Payload, key: string) => Object.prototype.hasOwnProperty.call(body, key);

function text(body: Payload, key: string, label: string, max: number): string | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new ProductInputError(`${label} is ongeldig.`);
  const result = value.trim();
  if (result.length > max) throw new ProductInputError(`${label} is te lang.`);
  return result || null;
}

function requiredText(body: Payload, key: string, label: string, max: number): string {
  const value = text(body, key, label, max);
  if (!value) throw new ProductInputError(`${label} is verplicht.`);
  return value;
}

function integer(body: Payload, key: string, label: string, min: number, max: number): number | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ProductInputError(`${label} is ongeldig.`);
  }
  return value;
}

function boolean(body: Payload, key: string, label: string): boolean | undefined {
  if (!own(body, key)) return undefined;
  if (typeof body[key] !== "boolean") throw new ProductInputError(`${label} is ongeldig.`);
  return body[key] as boolean;
}

function set(data: ProductData, key: string, value: unknown) {
  if (value !== undefined) data[key] = value;
}

export function parseProductUpdate(body: Payload): ProductData {
  const data: ProductData = {};
  set(data, "sku", text(body, "sku", "SKU", 80));
  set(data, "title", text(body, "title", "Titel", 180));
  set(data, "slug", text(body, "slug", "Slug", 160));
  set(data, "description", text(body, "description", "Beschrijving", 12_000));
  set(data, "category", text(body, "category", "Categorie", 100));
  set(data, "purchasePriceCents", integer(body, "purchasePriceCents", "Inkoopprijs", 0, 100_000_000));
  set(data, "salePriceCents", integer(body, "salePriceCents", "Verkoopprijs", 0, 100_000_000));
  set(data, "stockQuantity", integer(body, "stockQuantity", "Voorraad", 0, 1_000_000));
  set(data, "lowStockThreshold", integer(body, "lowStockThreshold", "Lage voorraadgrens", 0, 100_000));
  set(data, "active", boolean(body, "active", "Actief-status"));
  return data;
}

export function parseProductCreate(body: Payload): ProductData {
  const data = parseProductUpdate(body);
  data.sku = requiredText(body, "sku", "SKU", 80);
  data.title = requiredText(body, "title", "Titel", 180);
  const price = integer(body, "salePriceCents", "Verkoopprijs", 0, 100_000_000);
  const stock = integer(body, "stockQuantity", "Voorraad", 0, 1_000_000);
  if (price == null) throw new ProductInputError("Verkoopprijs is verplicht.");
  if (stock == null) throw new ProductInputError("Voorraad is verplicht.");
  data.salePriceCents = price;
  data.stockQuantity = stock;
  data.lowStockThreshold = integer(body, "lowStockThreshold", "Lage voorraadgrens", 0, 100_000) ?? 3;
  data.active = boolean(body, "active", "Actief-status") ?? true;
  return data;
}
