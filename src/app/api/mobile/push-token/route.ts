import { NextResponse } from "next/server";
import { z } from "zod";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { hashPushDeviceId, hashPushToken, encryptPushToken } from "@/lib/push";
import { prisma } from "@/lib/prisma";

const tokenBody = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.string().trim().min(1).max(40).default("android"),
  deviceId: z.string().trim().min(8).max(200).optional(),
  enabled: z.boolean().default(true),
  categories: z.record(z.boolean()).optional(),
});

async function parseBody(req: Request) {
  try {
    return tokenBody.parse(await req.json());
  } catch {
    throw new Error("Ongeldige push-instellingen.");
  }
}

export async function POST(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  try {
    const body = await parseBody(req);
    const tokenHash = hashPushToken(body.token);
    await prisma.pushDevice.upsert({
      where: { tokenHash },
      create: {
        userId: actor.id,
        tokenHash,
        tokenCiphertext: encryptPushToken(body.token),
        platform: body.platform,
        deviceIdHash: body.deviceId ? hashPushDeviceId(body.deviceId) : undefined,
        enabled: body.enabled,
        categories: body.categories,
        lastSeenAt: new Date(),
      },
      update: {
        userId: actor.id,
        tokenCiphertext: encryptPushToken(body.token),
        platform: body.platform,
        deviceIdHash: body.deviceId ? hashPushDeviceId(body.deviceId) : undefined,
        enabled: body.enabled,
        categories: body.categories,
        lastSeenAt: new Date(),
      },
    });
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error, "Push-token kon niet worden opgeslagen.");
  }
}

export async function DELETE(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();
    const deviceId = url.searchParams.get("deviceId")?.trim();
    if (!token && !deviceId) return NextResponse.json({ error: "Token of apparaat ontbreekt." }, { status: 400 });
    if (token) {
      await prisma.pushDevice.deleteMany({ where: { userId: actor.id, tokenHash: hashPushToken(token) } });
    } else {
      await prisma.pushDevice.deleteMany({ where: { userId: actor.id, deviceIdHash: hashPushDeviceId(deviceId!) } });
    }
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error, "Push-token kon niet worden verwijderd.");
  }
}
