import { AdminBikeCreateForm } from "@/components/admin-bike-forms";
import { prisma } from "@/lib/prisma";

const BUILTIN_BRANDS = ["Batavus", "Cortina", "Gazelle", "Giant", "Kalkhoff", "Koga", "Pegasus", "Sparta", "Trek", "Victoria"];
const BUILTIN_TYPES = ["Stadsfiets", "Trekkingfiets", "Transportfiets", "Moederfiets", "Vouwfiets", "Bakfiets", "Mountainbike"];
const BUILTIN_COLOURS = ["Zwart", "Grijs", "Zilver", "Wit", "Blauw", "Groen", "Rood", "Bruin", "Beige"];
const BUILTIN_CONDITIONS = ["Nieuwstaat", "Zeer goede staat", "Goede staat", "Gebruikt", "Opknapper"];

export default async function NewAdminBikePage() {
  const existing = await prisma.bike.findMany({
    select: { brand: true, model: true, bikeType: true, colour: true, conditionGrade: true },
    orderBy: { createdAt: "desc" },
  });
  const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))].sort((a, b) => a.localeCompare(b, "nl"));
  const modelsByBrand: Record<string, string[]> = {};
  for (const bike of existing) modelsByBrand[bike.brand] = unique([...(modelsByBrand[bike.brand] ?? []), bike.model]);
  const suggestions = {
    brands: unique([...BUILTIN_BRANDS, ...existing.map((bike) => bike.brand)]),
    modelsByBrand,
    bikeTypes: unique([...BUILTIN_TYPES, ...existing.map((bike) => bike.bikeType)]),
    colours: unique([...BUILTIN_COLOURS, ...existing.map((bike) => bike.colour)]),
    conditions: unique([...BUILTIN_CONDITIONS, ...existing.map((bike) => bike.conditionGrade)]),
  };
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold tracking-tight text-ink">Fiets toevoegen</h2>
      <p className="mt-1 text-sm text-ink-soft">
        De fiets start altijd in intake en is niet zichtbaar in de winkel totdat je hem volledig hebt aangevuld en publiceert.
      </p>
      <div className="mt-6 rounded-xl border border-line bg-card p-5 sm:p-6">
        <AdminBikeCreateForm suggestions={suggestions} />
      </div>
    </div>
  );
}
