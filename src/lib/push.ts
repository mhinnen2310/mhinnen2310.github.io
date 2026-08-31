import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { cert, getApps, getApp, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { env } from "@/lib/env";
import { OPERATIONAL_CATEGORIES, getOperationalNotifications, type OperationalCategory } from "@/lib/operational-notifications";
import { prisma } from "@/lib/prisma";

const PUSH_TOKEN_VERSION = "v1";
let firebaseApp: App | null | undefined;

function pushKey() {
  if (!env.authSecret) throw new Error("AUTH_SECRET is vereist om push-tokengegevens te versleutelen.");
  return createHash("sha256").update(`${env.authSecret}:demifietsen-push-token:${PUSH_TOKEN_VERSION}`).digest();
}

export function hashPushToken(token: string) {
  if (!env.authSecret) throw new Error("AUTH_SECRET is vereist om push-tokens te registreren.");
  return createHmac("sha256", env.authSecret).update(`${PUSH_TOKEN_VERSION}:${token}`).digest("hex");
}

export function hashPushDeviceId(deviceId: string) {
  if (!env.authSecret) throw new Error("AUTH_SECRET is vereist om apparaten te registreren.");
  return createHmac("sha256", env.authSecret).update(`${PUSH_TOKEN_VERSION}:device:${deviceId}`).digest("hex");
}

export function encryptPushToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", pushKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PUSH_TOKEN_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptPushToken(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (version !== PUSH_TOKEN_VERSION || !encodedIv || !encodedTag || !encodedCiphertext) throw new Error("Ongeldig push-tokenformaat.");
  const decipher = createDecipheriv("aes-256-gcm", pushKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function firebasePushConfigured() {
  return Boolean(env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey);
}

function getFirebaseApp(): App | null {
  if (firebaseApp !== undefined) return firebaseApp;
  if (!firebasePushConfigured()) {
    firebaseApp = null;
    return firebaseApp;
  }
  const existing = getApps();
  firebaseApp = existing.length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: env.firebaseProjectId!,
          clientEmail: env.firebaseClientEmail!,
          privateKey: env.firebasePrivateKey!.replace(/\\n/g, "\n"),
        }),
      });
  return firebaseApp;
}

function messaging(): Messaging | null {
  const app = getFirebaseApp();
  return app ? getMessaging(app) : null;
}

function deviceAcceptsCategory(categories: unknown, category: OperationalCategory | "test") {
  if (!categories || typeof categories !== "object" || Array.isArray(categories)) return true;
  const value = (categories as Record<string, unknown>)[category];
  return value !== false;
}

type PushPayload = { category: OperationalCategory | "test"; title: string; body: string; href: string };

async function sendToUser(userId: string, payload: PushPayload) {
  const fcm = messaging();
  if (!fcm) return { configured: false, sent: 0, failed: 0 };
  const devices = await prisma.pushDevice.findMany({ where: { userId, enabled: true }, select: { id: true, tokenCiphertext: true, categories: true } });
  const tokens: Array<{ id: string; token: string }> = [];
  for (const device of devices) {
    if (!deviceAcceptsCategory(device.categories, payload.category)) continue;
    try {
      tokens.push({ id: device.id, token: decryptPushToken(device.tokenCiphertext) });
    } catch {
      await prisma.pushDevice.update({ where: { id: device.id }, data: { enabled: false } });
    }
  }
  if (!tokens.length) return { configured: true, sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < tokens.length; index += 500) {
    const batch = tokens.slice(index, index + 500);
    const result = await fcm.sendEachForMulticast({
      tokens: batch.map((item) => item.token),
      notification: { title: payload.title, body: payload.body },
      data: { category: payload.category, href: payload.href },
      android: { priority: "high", notification: { channelId: "operational" } },
    });
    sent += result.successCount;
    failed += result.failureCount;
    await Promise.all(result.responses.map((response, responseIndex) => {
      const code = response.error?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        return prisma.pushDevice.update({ where: { id: batch[responseIndex]!.id }, data: { enabled: false } });
      }
      return Promise.resolve();
    }));
  }
  return { configured: true, sent, failed };
}

/**
 * Sends a changed operational snapshot to every active staff account. This is
 * deliberately idempotent: the maintenance endpoint can run every minute,
 * while PushNotificationCursor prevents duplicate alerts until the snapshot
 * changes again.
 */
export async function dispatchOperationalPushes() {
  const snapshot = await getOperationalNotifications();
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["OWNER", "ADMIN", "STAFF"] } },
    select: { id: true },
  });
  const fcm = messaging();
  if (!fcm) return { configured: false, users: users.length, sent: 0, failed: 0, categories: snapshot.states };
  let sent = 0;
  let failed = 0;
  for (const category of OPERATIONAL_CATEGORIES) {
    const items = snapshot.notifications.filter((item) => item.category === category);
    const state = snapshot.states[category];
    const stateHash = createHash("sha256").update(`${category}:${state}`).digest("hex");
    const payload: PushPayload | null = items.length
      ? {
          category,
          title: items.length === 1 ? items[0]!.title : `${items.length} ${category === "inventory" ? "voorraadmeldingen" : "meldingen"}`,
          body: items.length === 1 ? items[0]!.body : items.map((item) => item.title).join(" · "),
          href: items[0]!.href,
        }
      : null;
    for (const user of users) {
      const devices = await prisma.pushDevice.count({ where: { userId: user.id, enabled: true } });
      if (!devices) continue;
      const cursor = await prisma.pushNotificationCursor.findUnique({ where: { userId_category: { userId: user.id, category } } });
      if (cursor?.snapshotHash === stateHash) continue;
      const result = payload ? await sendToUser(user.id, payload) : { configured: true, sent: 0, failed: 0 };
      sent += result.sent;
      failed += result.failed;
      // Store zero states too, otherwise a resolved alert would be considered
      // new forever until another non-zero state appears.
      if (result.sent > 0 || !payload) {
        await prisma.pushNotificationCursor.upsert({
          where: { userId_category: { userId: user.id, category } },
          create: { userId: user.id, category, snapshotHash: stateHash },
          update: { snapshotHash: stateHash },
        });
      }
    }
  }
  return { configured: true, users: users.length, sent, failed, categories: snapshot.states };
}

/** Sends one on-demand test message to the currently logged-in staff member. */
export async function sendTestPush(userId: string) {
  return sendToUser(userId, {
    category: "test",
    title: "Demi Fietsen testmelding",
    body: "Pushmeldingen werken op dit toestel.",
    href: "/admin/instellingen",
  });
}
