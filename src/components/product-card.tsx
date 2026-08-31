import Link from "next/link";
import type { Product, ProductImage } from "@prisma/client";
import { formatPrice } from "@/lib/utils";
import { mediaSrcSet } from "@/lib/media";
import { Badge } from "./badge";
import { AddProductButton } from "./add-product-button";

export interface ProductView extends Product {
  images: ProductImage[];
}

export function ProductCard({ product }: { product: ProductView }) {
  const img = product.images[0];
  const ss = img ? mediaSrcSet(img.storageKey) : null;
  const lowStock = product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-card shadow-card">
      <Link href={`/accessoires/${product.slug}`} className="relative block aspect-square overflow-hidden bg-surface">
        {img && ss ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ss.src}
            srcSet={ss.srcSet}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            alt={img.altText || product.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-ink-faint">
            Geen foto
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/accessoires/${product.slug}`}
            className="text-sm font-semibold text-ink hover:text-brand-800 hover:underline"
          >
            {product.title}
          </Link>
          <p className="shrink-0 text-sm font-bold text-ink">{formatPrice(product.salePriceCents)}</p>
        </div>
        {product.stockQuantity > 0 ? (
          <p className="text-xs text-ink-soft">
            {lowStock ? (
              <Badge tone="amber">Nog maar {product.stockQuantity} op voorraad</Badge>
            ) : (
              `Op voorraad (${product.stockQuantity})`
            )}
          </p>
        ) : (
          <p className="text-xs text-ink-faint">Op dit moment niet leverbaar</p>
        )}
        <div className="mt-auto pt-2">
          {product.stockQuantity > 0 ? (
            <AddProductButton productId={product.id} stockQuantity={product.stockQuantity} />
          ) : (
            <Link
              href="/contact"
              className="inline-block rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-brand-50"
            >
              Beschikbaarheid aanvragen
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
