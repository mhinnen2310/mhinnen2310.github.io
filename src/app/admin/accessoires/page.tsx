import { AdminProductEditor } from "@/components/admin-product-editor";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({ orderBy: [{ active: "desc" }, { title: "asc" }], take: 250 });
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-ink">Accessoires & voorraad</h2>
      <p className="mt-1 text-sm text-ink-soft">Pas prijs, beschikbare voorraad en zichtbaarheid direct aan. Voorraadcorrecties worden gelogd.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-ink-faint"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Categorie</th><th className="px-4 py-3">Bewerken</th></tr></thead>
          <tbody className="divide-y divide-line">
            {products.map((product) => <tr key={product.id} className={product.stockQuantity <= product.lowStockThreshold ? "bg-amber-50/50" : undefined}>
              <td className="px-4 py-3"><p className="font-semibold text-ink">{product.title}</p><p className="text-xs text-ink-faint">SKU {product.sku} · gewijzigd {formatDateTime(product.updatedAt)}</p></td>
              <td className="px-4 py-3 text-ink-soft">{product.category ?? "—"}{product.stockQuantity <= product.lowStockThreshold && <p className="text-xs font-semibold text-amber-700">Lage voorraad</p>}</td>
              <td className="px-4 py-3"><AdminProductEditor product={{ id: product.id, stockQuantity: product.stockQuantity, salePriceCents: product.salePriceCents, active: product.active }} /></td>
            </tr>)}
            {products.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-ink-soft">Nog geen accessoires.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
