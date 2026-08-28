import { AdminBikeCreateForm } from "@/components/admin-bike-forms";

export default function NewAdminBikePage() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold tracking-tight text-ink">Fiets toevoegen</h2>
      <p className="mt-1 text-sm text-ink-soft">
        De fiets start altijd in intake en is niet zichtbaar in de winkel totdat je hem volledig hebt aangevuld en publiceert.
      </p>
      <div className="mt-6 rounded-xl border border-line bg-card p-5 sm:p-6">
        <AdminBikeCreateForm />
      </div>
    </div>
  );
}
