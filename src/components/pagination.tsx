import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Simple link-based pagination (server-rendered, URL is the state).
 */
export function Pagination({
  page,
  totalPages,
  baseUrl,
  params,
}: {
  page: number;
  totalPages: number;
  baseUrl: string;
  params?: Record<string, string | number | null | undefined>;
}) {
  if (totalPages <= 1) return null;

  const urlFor = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v != null && v !== "") sp.set(k, String(v));
    }
    sp.set("page", String(p));
    return `${baseUrl}?${sp.toString()}`;
  };

  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = start; p <= Math.min(totalPages, start + 4); p++) pages.push(p);

  return (
    <nav aria-label="Paginering" className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link
          href={urlFor(page - 1)}
          className="rounded-md border border-line bg-card px-3 py-2 text-sm font-medium hover:bg-brand-50"
        >
          ← Vorige
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={urlFor(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium",
            p === page ? "bg-brand-700 text-white" : "border border-line bg-card hover:bg-brand-50",
          )}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link
          href={urlFor(page + 1)}
          className="rounded-md border border-line bg-card px-3 py-2 text-sm font-medium hover:bg-brand-50"
        >
          Volgende →
        </Link>
      )}
    </nav>
  );
}
