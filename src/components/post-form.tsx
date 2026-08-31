"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Generic accessible form that POSTs JSON (or FormData for multipart) to an
 * API route. Server-side validation errors come back as
 * { error, field? } and are mapped to the right control.
 *
 * No framework form library: these forms are small and the DOM is enough.
 */

export interface PostFormField {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "select" | "textarea" | "file";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  initial?: string;
  min?: string;
  max?: string;
  rows?: number;
  multiple?: boolean;
  accept?: string;
  autoComplete?: string;
  disabled?: boolean;
}

interface PostFormProps {
  action: string;
  fields: PostFormField[];
  submitLabel?: string;
  multipart?: boolean;
  /** Shown when the server confirms success. */
  successTitle?: string;
  successBody?: string;
  /** Extra static fields merged into the payload (e.g. preselected bikeId). */
  extra?: Record<string, string>;
  className?: string;
}

export function PostForm({
  action,
  fields,
  submitLabel = "Versturen",
  multipart = false,
  successTitle = "Ontvangen",
  successBody,
  extra,
  className,
}: PostFormProps) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      if (f.initial) init[f.name] = f.initial;
    }
    return init;
  });

  function setField(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setGlobalError(null);
    setErrors({});

    try {
      let res: Response;
      if (multipart) {
        const fd = new FormData();
        for (const f of fields) {
          if (f.type === "file") {
            const files = (document.getElementById(`field-${f.name}`) as HTMLInputElement | null)?.files;
            if (files) {
              for (const file of Array.from(files)) fd.append(f.name, file);
            }
          } else {
            const v = values[f.name] ?? "";
            if (v) fd.append(f.name, v);
          }
        }
        for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v);
        res = await fetch(action, { method: "POST", body: fd });
      } else {
        const payload: Record<string, unknown> = { ...(extra ?? {}) };
        for (const f of fields) {
          if (f.type === "file") continue;
          const v = (values[f.name] ?? "").trim();
          payload[f.name] = v;
        }
        res = await fetch(action, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        field?: string;
        message?: string;
        code?: string;
      } | null;

      if (!res.ok) {
        if (data?.field) {
          setErrors({ [data.field]: data.error ?? "Ongeldige invoer." });
        } else {
          setGlobalError(data?.error ?? "Er ging iets mis. Probeer het opnieuw.");
        }
        return;
      }
      setSuccess(data?.message ?? successBody ?? "Je aanvraag is ontvangen.");
    } catch {
      setGlobalError("Er ging iets mis met de verbinding. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className={cn("rounded-xl border border-brand-200 bg-brand-50 p-6", className)} role="status">
        <div className="flex items-start gap-3">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden className="mt-0.5 shrink-0 text-brand-700">
            <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M7 11.5l2.6 2.6L15 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="font-semibold text-brand-900">{successTitle}</p>
            <p className="mt-1 text-sm leading-relaxed text-brand-800">{success}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate={false} className={cn("space-y-4", className)}>
      {globalError && (
        <p role="alert" className="rounded-lg border border-state-error/30 bg-red-50 px-4 py-3 text-sm text-state-error">
          {globalError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div
            key={f.name}
            className={cn(
              "sm:col-span-2",
              (f.type === "email" || f.type === "tel" || f.type === "date" || f.type === "select") && "sm:col-span-1",
            )}
          >
            <FieldControl field={f} value={values[f.name] ?? ""} onChange={(v) => setField(f.name, v)} error={errors[f.name]} />
          </div>
        ))}
      </div>
      <div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-default disabled:opacity-70"
        >
          {busy ? "Versturen…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  error,
}: {
  field: PostFormField;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = `field-${field.name}`;
  const describedBy = error ? `${id}-error` : field.hint ? `${id}-hint` : undefined;

  const common = {
    id,
    name: field.name,
    required: field.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    disabled: field.disabled,
  };
  const inputCls = cn(
    "w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint",
    error ? "border-state-error" : "border-line focus:border-brand-500",
  );

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {field.label}
        {field.required && <span aria-hidden className="ml-0.5 text-state-error">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          {...common}
          rows={field.rows ?? 4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputCls}
        />
      ) : field.type === "select" ? (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">— Kies —</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "file" ? (
        <input
          id={id}
          name={field.name}
          type="file"
          multiple={field.multiple}
          accept={field.accept}
          disabled={field.disabled}
          className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-100"
        />
      ) : (
        <input
          {...common}
          type={field.type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          autoComplete={field.autoComplete}
          className={inputCls}
        />
      )}
      {field.hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-faint">
          {field.hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-state-error">
          {error}
        </p>
      )}
    </div>
  );
}
