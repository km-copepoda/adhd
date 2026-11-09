"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchDeduped } from "@/lib/fetchDeduped";
import { signOutSafely } from "@/lib/signOutSafely";

/**
 * 子画面に「DB の子どもと紐付いていない匿名セッション」で入ってしまった場合に、
 * セッションを消して子どもログイン画面へ戻す。
 *
 * ログインコードの検証失敗やログアウト失敗で匿名セッションだけが残ると、ミドルウェアは
 * 子どもと判定して /app/parent 等も子画面へ飛ばす一方、子画面の API は 401 を返して
 * 永久ローディングになり、ログアウトボタン（育成画面）にも到達できなくなる。
 * monster-status はページ側も呼ぶため fetchDeduped で相乗りし、余分なリクエストは増やさない。
 */
export default function ChildSessionGuard() {
  const pathname = usePathname();
  // ログイン画面も同じ layout 配下。未ログインで 401 → ログイン画面へ移動、の無限リロードになるので除外
  const isLoginPage = pathname === "/app/child/login";

  useEffect(() => {
    if (isLoginPage) return;
    let cancelled = false;
    fetchDeduped("/api/monster-status")
      .then(async (res) => {
        // 401 = セッションに対応する User が DB に無い。それ以外（5xx・通信エラー）では何もしない
        if (cancelled || res.status !== 401) return;
        await signOutSafely(createClient().auth);
        window.location.href = "/app/child/login";
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoginPage]);

  return null;
}
