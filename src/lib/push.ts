import webpush from "web-push";
import { prisma } from "@/lib/prisma";

function initVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:admin@questboard.app", pub, priv);
  return true;
}

export async function sendPushToParent(
  parentId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!initVapid()) return; // VAPID未設定環境（ビルド時など）はスキップ

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: parentId },
  });

  await Promise.allSettled(
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
          }
        })
    )
  );
}
