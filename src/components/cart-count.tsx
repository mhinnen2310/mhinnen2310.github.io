"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/**
 * Client-side cart count: fetches the server quote (authoritative) and
 * listens for "df:cart-changed" events fired after add/remove actions.
 */
export function CartCount() {
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cart/quote", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { lines?: unknown[] };
      setCount(Array.isArray(data.lines) ? data.lines.length : 0);
    } catch {
      setCount(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("df:cart-changed", handler);
    return () => window.removeEventListener("df:cart-changed", handler);
  }, [refresh]);

  if (count === null) return null;
  return (
    <span
      aria-hidden
      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[11px] font-semibold text-white"
    >
      {count > 99 ? "99" : count}
    </span>
  );
}

export function CartCountButton() {
  return (
    <Link
      href="/winkelwagen"
      aria-label="Winkelwagen bekijken"
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-brand-50 hover:text-brand-800"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 4h2l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="20.5" r="1.3" fill="currentColor" />
        <circle cx="17.5" cy="20.5" r="1.3" fill="currentColor" />
      </svg>
      <CartCount />
    </Link>
  );
}
