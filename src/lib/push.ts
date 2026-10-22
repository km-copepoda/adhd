import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

function initVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    log.warn("Push skipped: VAPID not configured");
    return false;
  }
  webpush.setVapidDetails("mailto:admin@questboard.app", pub, priv);
  return true;
}

/** 購読が失効している（再送しても届かない）ステータスか。404 Not Found / 410 Gone */
function isExpiredStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/**
 * ユーザーの全購読へ通知を送り、成功数を返す。失効購読（404/410）は削除する。
 * 送信失敗はログに残して握りつぶす（呼び出し元の処理は止めない）。
 */
async function sendPushToUser(
  userId: string,
  role: "child" | "parent",
  payload: { title: string; body: string; url?: string },
) {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const results = await Promise.all(
    subs.map(async (sub): Promise<boolean> => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        return true;
      } catch (err) {
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        if (isExpiredStatus(statusCode)) {
          try {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
            log.info("Push subscription expired, removed", { userId, subId: sub.id, statusCode });
          } catch (delErr) {
            log.error("Push subscription removal failed", { userId, subId: sub.id, error: String(delErr) });
          }
        } else {
          log.error("Push send failed", { userId, statusCode });
        }
        return false;
      }
    }),
  );

  const sent = results.filter(Boolean).length;
  log.info(`Push sent to ${role}`, { userId, subsCount: subs.length, sent, title: payload.title });
}

export async function sendPushToChild(
  childId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!initVapid()) return;
  await sendPushToUser(childId, "child", payload);
}

export async function sendPushToParent(
  parentId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!initVapid()) return; // VAPID未設定環境（ビルド時など）はスキップ
  await sendPushToUser(parentId, "parent", payload);
}
