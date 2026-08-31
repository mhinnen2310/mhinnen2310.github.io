"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mediaSrcSet, mediaWidthUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  key: string;
  alt: string | null;
}

/**
 * Responsive image gallery with thumbnails + accessible lightbox
 * (keyboard: Esc closes, arrows navigate).
 */
export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const clamp = useCallback(
    (i: number) => (images.length ? Math.min(Math.max(i, 0), images.length - 1) : 0),
    [images.length],
  );

  useEffect(() => {
    if (!lightbox) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") setIndex((i) => clamp(i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => clamp(i - 1));
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, clamp]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-line bg-surface text-sm text-ink-faint">
        Foto&apos;s volgen binnenkort
      </div>
    );
  }

  const current = images[index] ?? images[0]!;
  const ss = mediaSrcSet(current.key);

  return (
    <div>
      <button
        type="button"
        className="relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-line bg-surface"
        onClick={() => setLightbox(true)}
        aria-label={`Foto ${index + 1} van ${images.length} openen in groter formaat`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ss.src}
          srcSet={ss.srcSet}
          sizes="(max-width: 768px) 100vw, 768px"
          alt={current.alt || `${title} — foto ${index + 1}`}
          className="aspect-[4/3] w-full object-contain"
        />
        {images.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-ink/80 px-2 py-0.5 text-xs text-white">
            {index + 1} / {images.length}
          </span>
        )}
      </button>

      {images.length > 1 && (
        <div className="mt-2 grid grid-cols-5 gap-2" role="listbox" aria-label="Fotogalerij">
          {images.slice(0, 10).map((img, i) => (
            <button
              key={img.key + i}
              type="button"
              role="option"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "overflow-hidden rounded-lg border-2 bg-surface transition-colors",
                i === index ? "border-brand-600" : "border-transparent hover:border-line",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaWidthUrl(img.key, 256)}
                alt={img.alt || `${title} — miniatuur ${i + 1}`}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto's van ${title}`}
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightbox(false);
          }}
        >
          <div className="flex items-center justify-between p-3">
            <p className="text-sm text-white/80">
              {index + 1} / {images.length} — {title}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setLightbox(false)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            >
              Sluiten (Esc)
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden px-2 pb-4">
            <button
              type="button"
              aria-label="Vorige foto"
              onClick={() => setIndex((i) => clamp(i - 1))}
              className="shrink-0 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            >
              ‹
            </button>
            <div className="max-h-full min-w-0 flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaWidthUrl(current.key, 1600)}
                alt={current.alt || `${title} — foto ${index + 1}`}
                className="mx-auto max-h-[78vh] w-auto max-w-full object-contain"
              />
            </div>
            <button
              type="button"
              aria-label="Volgende foto"
              onClick={() => setIndex((i) => clamp(i + 1))}
              className="shrink-0 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
