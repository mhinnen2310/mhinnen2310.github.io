import type { SettingsView } from "@/lib/settings";

export function Announcement({ settings }: { settings: SettingsView }) {
  if (!settings.announcement.enabled || !settings.announcement.text.trim()) return null;
  const a = settings.announcement;
  const inner = (
    <p className="mx-auto max-w-6xl px-4 text-center text-sm text-white">
      {a.link ? (
        <a href={a.link} className="underline underline-offset-2 hover:no-underline">
          {a.text}
        </a>
      ) : (
        a.text
      )}
    </p>
  );
  return <div role="status" className="bg-brand-800 py-2">{inner}</div>;
}
