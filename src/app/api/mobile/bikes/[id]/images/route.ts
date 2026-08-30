import { NextResponse } from "next/server";
import { addBikeImage, BikeImageError } from "@/lib/bike-images";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";

export const runtime = "nodejs";

/** Mobile camera upload; processing, storage and audit are shared with web admin. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  try {
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return NextResponse.json({ error: "Kies eerst een afbeelding." }, { status: 400 });
    return mobileOk({ image: await addBikeImage(id, image, actor) }, 201);
  } catch (error) {
    if (error instanceof BikeImageError) return mobileError(error, "Afbeelding kon niet worden toegevoegd.");
    console.error("mobile bike image upload failed", error); return NextResponse.json({ error: "Afbeelding kon niet worden toegevoegd." }, { status: 500 });
  }
}
