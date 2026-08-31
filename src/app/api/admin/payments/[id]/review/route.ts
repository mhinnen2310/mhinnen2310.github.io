import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { completeVerifiedPaymentSale, OrderStateError } from "@/lib/orders";

/** Re-attempts only the existing, provider-verified completion path. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const result = await completeVerifiedPaymentSale(id);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof OrderStateError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("manual payment review retry failed", error);
    return NextResponse.json({ error: "De betaling kon niet veilig opnieuw worden verwerkt." }, { status: 500 });
  }
}
