import { mobileActor, mobileOk } from "@/lib/mobile-route";
import { getOperationalNotifications } from "@/lib/operational-notifications";

export const dynamic = "force-dynamic";

/** In-app alerts and the same data contract used by the remote push worker. */
export async function GET(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const result = await getOperationalNotifications();
  return mobileOk({ notifications: result.notifications, generatedAt: result.generatedAt });
}
