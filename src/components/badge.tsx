import { cn } from "@/lib/utils";

/**
 * State badge. Always pairs colour with a text label (accessibility:
 * information is never conveyed by colour alone).
 */
const STYLES: Record<string, string> = {
  green: "bg-brand-100 text-brand-800 border-brand-200",
  amber: "bg-accent-50 text-accent-700 border-accent-100",
  gray: "bg-surface text-ink-soft border-line",
  blue: "bg-[#e8eef5] text-state-workshop border-[#d3dde9]",
  red: "bg-[#f6e9e8] text-state-error border-[#ecd9d7]",
};

export function Badge({
  tone = "gray",
  children,
  className,
}: {
  tone?: "green" | "amber" | "gray" | "blue" | "red";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BikeStatusBadge({ status, label }: { status: string; label?: string }) {
  const map: Record<string, { tone: "green" | "amber" | "gray" | "blue" | "red"; text: string }> = {
    INTAKE: { tone: "gray", text: label ?? "Intake" },
    WORKSHOP: { tone: "blue", text: label ?? "In werkplaats" },
    READY: { tone: "green", text: label ?? "Klaar" },
    AVAILABLE: { tone: "green", text: label ?? "Beschikbaar" },
    RESERVED: { tone: "amber", text: label ?? "Gereserveerd" },
    SOLD: { tone: "gray", text: label ?? "Verkocht" },
    ARCHIVED: { tone: "gray", text: label ?? "Gearchiveerd" },
  };
  const m = map[status] ?? { tone: "gray" as const, text: status };
  return <Badge tone={m.tone}>{m.text}</Badge>;
}
