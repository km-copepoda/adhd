import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { routeLogger } from "@/lib/logger";
import {
  isLocked,
  recordAttempt,
  purgeExpiredAttempts,
  resetAttempts,
  userKey,
  familyKey,
  USER_MAX_FAILURES,
  FAMILY_MAX_FAILURES,
} from "@/lib/childRejoinLimit";

const tooMany = () =>
  NextResponse.json(
    { error: "試行回数が多すぎます。しばらくしてからもう一度お試しください" },
    { status: 429 },
  );

// POST: ファミリーコード + ユーザーコードで子どもを検証し、supabaseIdを紐付ける
export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/auth/child-rejoin");
  let body: { familyCode?: unknown; childCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const { familyCode, childCode } = body ?? {};
  if (typeof familyCode !== "string" || typeof childCode !== "string") {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (!familyCode || !childCode) {
    return NextResponse.json(
      { error: "ファミリーコードとユーザーコードを入力してください" },
      { status: 400 },
    );
  }
  // 失敗カウンタのキーとして保存するため長さを制限する
  if (familyCode.length > 32 || childCode.length > 16) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const normalizedFamilyCode = familyCode.toUpperCase();

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
    const fKey = familyKey(normalizedFamilyCode);

    // 総当たり対策:
    // - ユーザー単位（補助）: ロック中は照合せずに 429
    // - ファミリー単位: 照合の前に原子的に数え（成功も含む）、戻り値の件数で拒否を判定する。
    //   並列の総当たりでもカウントを取りこぼさない。成功してもリセットしない
    if (await isLocked(uKey)) {
      rlog.warn("Child rejoin locked", { scope: "user" });
      return tooMany();
    }
    const familyAttempt = await recordAttempt(fKey, FAMILY_MAX_FAILURES);
    if (familyAttempt.locked) {
      rlog.warn("Child rejoin locked", { scope: "family" });
      return tooMany();
    }
    // 新しいウィンドウの先頭で期限切れの行を掃除する（行が無制限に増えないように）
    if (familyAttempt.count === 1) {
      await purgeExpiredAttempts().catch((e) =>
        rlog.warn("Failed to purge expired rejoin attempts", { error: String(e) }),
      );
    }

    const recordFailure = () => recordAttempt(uKey, USER_MAX_FAILURES);

    // ファミリーを検索
    const family = await prisma.family.findUnique({
      where: { code: normalizedFamilyCode },
    });
    if (!family) {
      rlog.warn("Family not found on rejoin");
      await recordFailure();
      return NextResponse.json({ error: "コードが正しくありません" }, { status: 404 });
    }

    // ファミリーコード + ユーザーコードの組み合わせで子どもを特定
    const child = await prisma.user.findUnique({
      where: {
        familyId_childCode: {
          familyId: family.id,
          childCode: childCode,
        },
      },
    });
    if (!child || child.role !== "CHILD") {
      rlog.warn("Child not found on rejoin", { familyId: family.id });
      await recordFailure();
      return NextResponse.json({ error: "コードが正しくありません" }, { status: 404 });
    }

    // 同じsupabaseIdが他の子どもに紐付いている場合は先に解除
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { supabaseId: supabaseUserId, id: { not: child.id }, role: "CHILD" },
        data: { supabaseId: `detached_${Date.now()}` },
      }),
      prisma.user.update({
        where: { id: child.id },
        data: { supabaseId: supabaseUserId },
      }),
    ]);

    // ユーザー単位のみリセット。ファミリー単位は成功でもリセットしない（総当たりの巻き戻し防止）
    await resetAttempts(uKey);

    rlog.info("Child rejoin success", { childId: child.id, familyId: family.id });
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
