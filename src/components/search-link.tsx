"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

/** Header search: quick input, submits to /zoeken. */
export function SearchLink() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = ref.current?.value.trim();
    if (!q) return;
    router.push(`/zoeken?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={submit} role="search" className="hidden items-center md:flex">
      <label htmlFor="site-zoeken" className="sr-only">
        Zoeken
      </label>
      <input
        id="site-zoeken"
        ref={ref}
        type="search"
        placeholder="Fiets of accessoire zoeken…"
        className="h-9 w-44 rounded-l-md border border-line bg-card px-3 text-sm placeholder:text-ink-faint focus:w-56"
      />
      <button
        type="submit"
        className="h-9 rounded-r-md border border-l-0 border-line bg-brand-700 px-3 text-sm font-medium text-white hover:bg-brand-800"
      >
        Zoek
      </button>
    </form>
  );
}
