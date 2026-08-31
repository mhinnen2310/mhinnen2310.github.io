import { mobileActor, mobileOk } from "@/lib/mobile-route";
import { sendTestPush } from "@/lib/push";

export async function POST(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const result = await sendTestPush(actor.id);
  return mobileOk({
    ok: result.sent > 0,
    ...result,
    ...(result.configured ? {} : { error: "Firebase pushmeldingen zijn nog niet geconfigureerd op de server." }),
  }, result.configured ? 200 : 503);
}
