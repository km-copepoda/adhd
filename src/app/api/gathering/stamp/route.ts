import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";
import { sendPushToChild } from "@/lib/push";
import { buildStampMessage, getStampProgressStatus } from "@/lib/gathering";
import { triggerStampSentLog } from "@/lib/bulletinLog";
import { log } from "@/lib/logger";

/**
 * グループに「エールを送る」スタンプ。1日1回のみ。
 * 受信側ごとに当日進捗を判定して個別メッセージで Push 配信する。
 * 受信ログは別テーブルに残さない（Realtime 配信は Stamp 行 INSERT を購読する）。
 *
 * Push 配信はレスポンス前に await する。1日1回の低頻度アクションなので
 * Vercel Function の終了でメッセージが落ちないことを優先（高頻度ログのような after() 化は不要）。
 */
export async function POST(_request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const member = await prisma.gatheringMember.findUnique({
    where: { childId: user.id },
    include: {
      group: {
        include: {
          members: { select: { childId: true } },
        },
      },
    },
  });
  if (!member) {
    return NextResponse.json({ error: "グループに参加していません" }, { status: 404 });
  }

  const today = todayJST();

  const already = await prisma.stamp.findUnique({
    where: { senderId_date: { senderId: user.id, date: today } },
  });
  if (already) {
    return NextResponse.json({ error: "今日はもうエールを送ったよ！" }, { status: 409 });
  }

  let stampId: string;
  try {
    const created = await prisma.stamp.create({
      data: { groupId: member.groupId, senderId: user.id, date: today },
    });
    stampId = created.id;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "今日はもうエールを送ったよ！" }, { status: 409 });
    }
    throw err;
  }

  // 掲示板（BulletinLog）にも書き込む。レスポンス送信後の after() で実行し、
  // 失敗してもユーザ操作のレイテンシ・成功応答に影響を与えない。
  after(() => triggerStampSentLog(user.id).catch(() => {}));

  const senderName = user.monsterName ?? user.name ?? "なかま";

  const recipients = member.group.members
    .map((m) => m.childId)
    .filter((id) => id !== user.id);

  await Promise.allSettled(
    recipients.map(async (recipientId) => {
      try {
        const total = await prisma.questInstance.count({
          where: { childId: recipientId, date: today },
        });
        const done = await prisma.questInstance.count({
          where: {
            childId: recipientId,
            date: today,
            status: { in: ["REPORTED", "SKIP_REPORTED", "APPROVED", "SKIPPED"] },
          },
        });
        const status = getStampProgressStatus(done, total);
        // 受信側が今日のクエストを全部終わらせている場合は OS Push を抑制する。
        // Realtime トーストは流す（ひろばを開いたタイミングで未読として復元される）。
        if (status === "DONE") return;
        const body = buildStampMessage(senderName, status);
        await sendPushToChild(recipientId, {
          title: "エールが届いたよ！",
          body,
          url: "/app/child/gathering",
        });
      } catch (e) {
        log.error("stamp push failed", { recipientId, err: e });
      }
    }),
  );

  return NextResponse.json({ stampId, ok: true });
}
