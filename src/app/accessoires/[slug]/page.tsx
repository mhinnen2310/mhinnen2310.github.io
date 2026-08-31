import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findProductBySlug } from "@/lib/catalog";
import { formatPrice } from "@/lib/utils";
import { mediaSrcSet, mediaWidthUrl } from "@/lib/media";
import { env } from "@/lib/env";
import { getTaxConfig } from "@/lib/tax";
import { Gallery } from "@/components/gallery";
import { AddProductButton } from "@/components/add-product-button";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { listProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await findProductBySlug(slug);
  if (!product || !product.active) return { robots: { index: false, follow: false } };
  const title = product.title;
  return {
    title,
    description: product.description?.slice(0, 160) || `${title} — koop direct bij Demi Fietsen.`,
    openGraph: {
      title,
      type: "website",
      images: product.images[0] ? [`${env.siteUrl}${mediaWidthUrl(product.images[0].storageKey, 1200)}`] : undefined,
    },
  };
}

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const product = await findProductBySlug(slug);
  if (!product || !product.active) notFound();

  const taxConfig = await getTaxConfig();
  const inStock = product.stockQuantity > 0;
  const lowStock = inStock && product.stockQuantity <= product.lowStockThreshold;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    sku: product.sku,
    image: product.images.length
      ? product.images.map((i) => `${env.siteUrl}${mediaWidthUrl(i.storageKey, 1200)}`)
      : undefined,
    offers: {
      "@type": "Offer",
      price: (product.salePriceCents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `/accessoires/${product.slug}`,
    },
  };

  const images = product.images.map((i) => ({ key: i.storageKey, alt: i.altText }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav aria-label="Kruimelpad" className="mb-4 text-sm text-ink-soft">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden className="mx-1.5">
            /
          </span>
          <Link href="/accessoires" className="hover:underline">
            Accessoires
          </Link>
          {product.category && (
            <>
              <span aria-hidden className="mx-1.5">
                /
              </span>
              <span className="text-ink">{product.category}</span>
            </>
          )}
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          <Gallery images={images} title={product.title} />

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{product.sku}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{product.title}</h1>
            <p className="mt-3 text-2xl font-bold text-ink">{formatPrice(product.salePriceCents)}</p>
            <p className="mt-1 text-xs text-ink-faint">
              {taxConfig.basis === "incl" ? "Inclusief btw (indien van toepassing)." : "Exclusief btw; btw wordt bij de bestelling berekend."}
            </p>

            <div className="mt-4">
              {inStock ? (
                <Badge tone={lowStock ? "amber" : "green"}>
                  {lowStock ? `Nog maar ${product.stockQuantity} op voorraad` : "Op voorraad"}
                </Badge>
              ) : (
                <Badge tone="gray">Op dit moment niet leverbaar</Badge>
              )}
            </div>

            {inStock ? (
              <div className="mt-6 max-w-sm">
                <AddProductButton productId={product.id} stockQuantity={product.stockQuantity} size="lg" />
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-line bg-surface p-4">
                <p className="text-sm text-ink-soft">
                  Dit product is momenteel niet op voorraad.{" "}
                  <Link href="/contact" className="font-medium text-brand-800 underline">
                    Vraag de beschikbaarheid aan
                  </Link>{" "}
                  — we kunnen vaak ook onderdelen bestellen.
                </p>
              </div>
            )}

            {product.description && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-ink">Beschrijving</h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
                  {product.description.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 rounded-xl border border-line bg-card p-4 text-sm text-ink-soft">
              <p className="font-medium text-ink">Ophalen & bezorgen</p>
              <p className="mt-1">
                Accessoires zijn tegen meehelping gratis op te halen; bezorging en verzending worden bij de
                bestelling berekend.
              </p>
            </div>
          </div>
        </div>

        {/* Related accessories */}
        <RelatedProducts currentId={product.id} category={product.category} />
      </div>
    </>
  );
}

async function RelatedProducts({ currentId, category }: { currentId: string; category: string | null }) {
  const cat = category ?? "";
  const result = await listProducts({
    category: cat ? [cat] : undefined,
    page: 1,
    pageSize: 4,
  });
  const related = result.products.filter((p) => p.id !== currentId).slice(0, 4);
  if (related.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="related-heading">
      <h2 id="related-heading" className="text-xl font-semibold tracking-tight text-ink">
        Ook in deze categorie
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {related.map((p) => (
          <RelatedCard
            key={p.id}
            id={p.id}
            slug={p.slug}
            title={p.title}
            priceCents={p.salePriceCents}
            imageKey={p.images[0]?.storageKey ?? null}
            inStock={p.stockQuantity > 0}
          />
        ))}
      </div>
    </section>
  );
}

function RelatedCard({
  id,
  slug,
  title,
  priceCents,
  imageKey,
  inStock,
}: {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  imageKey: string | null;
  inStock: boolean;
}) {
  const ss = imageKey ? mediaSrcSet(imageKey) : null;
  return (
    <Link
      href={`/accessoires/${slug}`}
      className="flex flex-col overflow-hidden rounded-xl border border-line bg-card transition-shadow hover:shadow-card"
    >
      <div className="aspect-square overflow-hidden bg-surface">
        {ss && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ss.src} alt={title} loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-sm font-semibold text-ink">{formatPrice(priceCents)}</span>
      </div>
      <p className="px-3 pb-3 text-xs text-ink-faint">{inStock ? "Op voorraad" : "Niet leverbaar"}</p>
      {/* id keeps the card stable in lists; also used by tests */}
      <span className="hidden" data-testid={`related-${id}`} />
    </Link>
  );
}
