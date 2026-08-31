import {
  AdminProductCreateForm,
  AdminProductEditor,
} from "@/components/admin-product-editor";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const products = await prisma.product.findMany({
    where: query
      ? {
          OR: [
            { sku: { contains: query, mode: "insensitive" } },
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ active: "desc" }, { title: "asc" }],
    take: 250,
  });
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-ink">
        Accessoires & voorraad
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Pas prijs, beschikbare voorraad en zichtbaarheid direct aan.
        Voorraadcorrecties worden gelogd.
      </p>
      <AdminProductCreateForm />
      <form className="mt-5 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Zoek op SKU, naam, omschrijving of categorie"
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm"
        />
        <button className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-surface">
          Zoeken
        </button>
        {query && (
          <Link
            href="/admin/accessoires"
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft hover:bg-surface"
          >
            Wis
          </Link>
        )}
      </form>
      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Categorie</th>
              <th className="px-4 py-3">Bewerken</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((product) => (
              <tr
                key={product.id}
                className={
                  product.stockQuantity <= product.lowStockThreshold
                    ? "bg-amber-50/50"
                    : undefined
                }
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{product.title}</p>
                  <p className="text-xs text-ink-faint">
                    SKU {product.sku} · gewijzigd{" "}
                    {formatDateTime(product.updatedAt)}
                  </p>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {product.category ?? "—"}
                  {product.stockQuantity <= product.lowStockThreshold && (
                    <p className="text-xs font-semibold text-amber-700">
                      Lage voorraad
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AdminProductEditor product={product} />
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-ink-soft">
                  Nog geen accessoires.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
