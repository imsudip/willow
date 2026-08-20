import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { pushSubscriptions } from "../db/schema.js";
import { env, isPushConfigured } from "../env.js";

if (isPushConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function subscribe(userId: string, subscription: PushSubscriptionLike) {
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, subscription.endpoint)),
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(pushSubscriptions).values({
    id: crypto.randomUUID(),
    userId,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function unsubscribe(userId: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function sendToUser(userId: string, payload: PushPayload) {
  if (!isPushConfigured) return 0;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
  return sent;
}

interface PushSubscriptionLike {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
