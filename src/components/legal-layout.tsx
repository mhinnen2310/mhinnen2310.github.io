/**
 * Shared legal page layout.
 *
 * `updatedAt.getTime() === 0` marks the honest placeholder fallback from
 * src/lib/legal.ts — in that case we make it visible that the text is not
 * final and not legal advice (spec 4: no invented binding statements).
 */
export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: Date;
  children: React.ReactNode;
}) {
  const isPlaceholder = updatedAt.getTime() === 0;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
      {isPlaceholder && (
        <p className="mt-4 rounded-lg border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">
          Deze tekst is nog een concept dat Demi Fietsen met een juridisch professional laat controleren
          voordat de nieuwe website live gaat. Behandel deze pagina niet als definitief juridisch advies.
        </p>
      )}
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-soft">{children}</div>
      {!isPlaceholder && (
        <p className="mt-8 text-xs text-ink-faint">Laatst bijgewerkt: {updatedAt.toLocaleDateString("nl-NL")}</p>
      )}
    </div>
  );
}
