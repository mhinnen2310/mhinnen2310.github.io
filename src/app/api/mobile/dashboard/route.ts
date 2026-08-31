import { mobileActor, mobileOk } from "@/lib/mobile-route";
import { getDashboardSnapshot } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { actor, response } = await mobileActor(req);
  if (!actor) return response!;
  return mobileOk({ dashboard: await getDashboardSnapshot() });
}
