"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Revision = {
  id: string;
  version: number;
  createdAt: string;
  changedBy: { name: string | null; email: string } | null;
};

export function AdminSettingsRevisions({
  revisions,
}: {
  revisions: Revision[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    if (
      busy ||
      !window.confirm(
        "Deze versie terugzetten? De huidige tekst wordt eerst als nieuwe versie bewaard.",
      )
    )
      return;
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/settings/revisions/${id}/restore`,
        { method: "POST" },
      );
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error ?? "Terugzetten is mislukt.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Terugzetten is mislukt.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-line bg-card p-5">
      <h3 className="font-semibold text-ink">Versiehistorie website</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Iedere opslag bewaart de vorige live versie. Terugzetten maakt opnieuw
        een controleerbare versie aan.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-state-error"
        >
          {error}
        </p>
      )}
      <ul className="mt-4 divide-y divide-line">
        {revisions.map((revision) => (
          <li
            key={revision.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <span>
              <strong>Versie {revision.version}</strong>
              <span className="ml-2 text-ink-faint">
                {new Date(revision.createdAt).toLocaleString("nl-NL")}
              </span>
              {revision.changedBy && (
                <span className="ml-2 text-ink-soft">
                  door {revision.changedBy.name ?? revision.changedBy.email}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => void restore(revision.id)}
              disabled={busy !== null}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface disabled:opacity-60"
            >
              {busy === revision.id ? "Terugzetten…" : "Terugzetten"}
            </button>
          </li>
        ))}
        {revisions.length === 0 && (
          <li className="py-4 text-sm text-ink-faint">
            Nog geen eerdere versies.
          </li>
        )}
      </ul>
    </section>
  );
}
