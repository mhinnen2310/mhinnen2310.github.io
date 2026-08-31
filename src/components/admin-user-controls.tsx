"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = ["OWNER", "ADMIN", "STAFF", "CUSTOMER"] as const;

export function AdminUserControls({
  user,
  canChangeRole,
  canManage = true,
}: {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
  };
  canChangeRole: boolean;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canManage)
    return (
      <p className="text-xs text-ink-faint">
        Alleen-lezen · rol {user.role} ·{" "}
        {user.isActive ? "actief" : "uitgeschakeld"}
      </p>
    );
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name"),
          role: canChangeRole ? form.get("role") : undefined,
          isActive: form.get("isActive") === "yes",
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error ?? "Account opslaan is mislukt.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Account opslaan is mislukt.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <input
        name="email"
        type="email"
        defaultValue={user.email}
        aria-label="E-mail"
        className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-xs"
      />
      <input
        name="name"
        defaultValue={user.name ?? ""}
        aria-label="Naam"
        className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-xs"
      />
      {canChangeRole ? (
        <select
          name="role"
          defaultValue={user.role}
          aria-label="Rol"
          className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-xs"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-ink-faint">Rol: {user.role}</p>
      )}
      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input
          name="isActive"
          value="yes"
          type="checkbox"
          defaultChecked={user.isActive}
        />{" "}
        Account actief
      </label>
      <button
        disabled={busy}
        className="rounded-md border border-brand-700 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60"
      >
        {busy ? "Opslaan…" : "Opslaan"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-state-error">
          {error}
        </p>
      )}
    </form>
  );
}

export function AdminUserCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name"),
          password: form.get("password"),
          role: form.get("role"),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error ?? "Account aanmaken is mislukt.");
      event.currentTarget.reset();
      setNotice("Account aangemaakt.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Account aanmaken is mislukt.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      <input
        name="name"
        placeholder="Naam"
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
      />
      <input
        required
        name="email"
        type="email"
        placeholder="E-mail"
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
      />
      <input
        required
        name="password"
        type="password"
        minLength={10}
        placeholder="Tijdelijk wachtwoord (10+)"
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
      />
      <select
        name="role"
        defaultValue="STAFF"
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <button
        disabled={busy}
        className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Aanmaken…" : "Account aanmaken"}
      </button>
      {error && (
        <p
          role="alert"
          className="sm:col-span-2 lg:col-span-5 text-sm text-state-error"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="sm:col-span-2 lg:col-span-5 text-sm text-brand-800"
        >
          {notice}
        </p>
      )}
    </form>
  );
}
