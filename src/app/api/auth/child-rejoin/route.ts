import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { routeLogger } from "@/lib/logger";
import { sendPushToParent } from "@/lib/push";
import { consumeLoginCode } from "@/lib/childLoginCodeService";
import { normalizeLoginCode } from "@/lib/childLoginCode";
import {
  isLocked,
  recordAttempt,
  purgeExpiredAttempts,
  resetAttempts,
  userKey,
  ipKey,
  clientIpFrom,
  USER_MAX_FAILURES,
  IP_MAX_FAILURES,
} from "@/lib/childRejoinLimit";

const LOGIN_CODE_LENGTH = 8;
/** 正規化前の入力の上限（極端に長い入力は正規化せず弾く） */
const RAW_INPUT_MAX_LENGTH = 64;

const badRequest = () =>
  NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });

const tooMany = () =>
  NextResponse.json(
    { error: "試行回数が多すぎます。しばらくしてからもう一度お試しください" },
    { status: 429 },
  );

// POST: 親が発行したワンタイムのログインコードで子どもを検証し、supabaseIdを紐付ける
export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/auth/child-rejoin");
  let body: { loginCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest();
  }

  const raw = body?.loginCode;
  if (typeof raw !== "string" || raw.length > RAW_INPUT_MAX_LENGTH) return badRequest();
  const loginCode = normalizeLoginCode(raw);
  if (loginCode.length !== LOGIN_CODE_LENGTH) return badRequest();

  try {
    // サーバー側でセッションを読み取る（クライアントから ID を受け取らない）
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証情報がありません" }, { status: 401 });
    }

    // email がある = 親のメールアカウント → 子ども認証には使えない
    if (user.email) {
      return NextResponse.json(
        { error: "子どもアカウントでログインしてください" },
        { status: 403 },
      );
    }

    const supabaseUserId = user.id;
    const uKey = userKey(supabaseUserId);
    const iKey = ipKey(clientIpFrom(request.headers));

    // 総当たり対策（順序は IP → ユーザー）:
    // - ユーザー単位（補助）: ロック中は照合せずに 429
    // - IP 単位: 照合の前に原子的に数え（成功も含む）、戻り値の件数で拒否を判定する。
    //   成功してもリセットしない。IP が取れないときは使わない
    if (await isLocked(uKey)) {
      rlog.warn("Child rejoin locked", { scope: "user" });
      return tooMany();
    }
    if (iKey) {
      const ipAttempt = await recordAttempt(iKey, IP_MAX_FAILURES);
      if (ipAttempt.locked) {
        rlog.warn("Child rejoin locked", { scope: "ip" });
        return tooMany();
      }
      // 新しいウィンドウの先頭で期限切れの行を掃除する（行が無制限に増えないように）
      if (ipAttempt.count === 1) {
        await purgeExpiredAttempts().catch((e) =>
          rlog.warn("Failed to purge expired rejoin attempts", { error: String(e) }),
        );
      }
    }

    // コード消費と付け替えを同じトランザクションで行う（付け替えが失敗したらコードも復活する）
    const child = await prisma.$transaction(async (tx) => {
      const childId = await consumeLoginCode(loginCode, tx);
      if (!childId) return null;
      // 同じsupabaseIdが他の子どもに紐付いている場合は先に解除
      await tx.user.updateMany({
        where: { supabaseId: supabaseUserId, id: { not: childId }, role: "CHILD" },
        data: { supabaseId: `detached_${Date.now()}` },
      });
      return tx.user.update({
        where: { id: childId },
        data: { supabaseId: supabaseUserId },
      });
    });

    if (!child) {
      rlog.warn("Invalid, expired or used login code on rejoin");
      await recordAttempt(uKey, USER_MAX_FAILURES);
      return NextResponse.json({ error: "コードが正しくありません" }, { status: 404 });
    }

    // ユーザー単位のみリセット。IP 単位は成功でもリセットしない（総当たりの巻き戻し防止）
    await resetAttempts(uKey);

    // 親への通知（失敗しても rejoin は成功させる）
    const familyId = child.familyId;
    if (familyId) {
      after(async () => {
        try {
          const parents = await prisma.user.findMany({
            where: { familyId, role: "PARENT" },
            select: { id: true },
          });
          await Promise.allSettled(
            parents.map((p) =>
              sendPushToParent(p.id, {
                title: "ログインコードが使われました",
                body: `${child.monsterName ?? "子ども"}の端末でログインしました`,
                url: "/app/parent/family",
              }),
            ),
          );
        } catch (e) {
          rlog.warn("Failed to notify parents of child rejoin", { error: String(e) });
        }
      });
    }

    rlog.info("Child rejoin success", { childId: child.id, familyId });
    return NextResponse.json({
      userId: child.id,
      monsterName: child.monsterName,
      side: child.side,
    });
  } catch (e) {
    rlog.error("Unexpected error on child rejoin", { error: String(e) });
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
