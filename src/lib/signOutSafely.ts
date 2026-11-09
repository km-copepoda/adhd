type SignOutAuth = {
  signOut: (options?: { scope?: "global" | "local" | "others" }) => Promise<{ error: unknown } | unknown>;
};

/**
 * ログアウトを確実に行う（クライアント専用）。
 *
 * supabase-js の signOut() は Auth API がネットワークエラー等で失敗すると、ブラウザのセッション
 * （クッキー）を消さずに error を返す。セッションが残るとミドルウェアは「ログイン中」と判定し続け、
 * ユーザーが画面から抜け出せなくなるため、失敗時は scope: "local" でブラウザ側だけでも必ず消す。
 * 例外は呼び出し側に投げない（この後のリダイレクトを止めないため）。
 */
export async function signOutSafely(auth: SignOutAuth): Promise<void> {
  try {
    const result = await auth.signOut();
    if (!(result as { error?: unknown } | undefined)?.error) return;
  } catch {
    // 下でローカル削除にフォールバック
  }
  try {
    await auth.signOut({ scope: "local" });
  } catch {
    // ローカル削除まで失敗する状況では打つ手がない。リダイレクトは呼び出し側で続行する
  }
}
