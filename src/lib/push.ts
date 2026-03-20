import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

function initVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv ) {
    log.warn("Push skipped: VAPID not configured");
    return false;
  }
  webpush.setVapidDetails("mailto:admin@questboard.app", pub, priv);
  return true;
}

export async function sendPushToChild(
  childId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!initVapid()) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: childId },
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
            log.info("Push subscription expired, removed", { userId: childId, subId: sub.id });
          } else {
            log.error("Push send failed", { userId: childId, statusCode: err.statusCode });
          }
        })
    )
  );
  
  const sent = results.filter((r) => r.status === "fulfilled").length;
  log.info("Push sent to child", { userId: childId, subsCount: subs.length, sent, title: payload.title });
}

export async function sendPushToParent(
  parentId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!initVapid()) return; // VAPID未設定環境（ビルド時など）はスキップ

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: parentId },
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch(async (err: { statusCode?: number }) => {
          // 410 Gone = subscription expired, remove it
          if (err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
            log.info("Push subscription expired, removed", { userId: parentId, subId: sub.id });
          } else {
            log.error("Push send failed", { userId: parentId, statusCode: err.statusCode });
          }
        })
    )
  );
  
  const sent = results.filter((r) => r.status === "fulfilled").length;
  log.info("Push sent to parent", { userId: parentId, subsCount: subs.length, sent, title: payload.title });
}
