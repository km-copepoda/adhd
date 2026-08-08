/// API レスポンスの共通エラーハンドリング (UI 用ヘルパー)。
/// 仕様: サーバは失敗時に `{ error: string, code?: string }` を返す。特にプラン上限は
/// `{ error: "...", code: "PLAN_LIMIT_EXCEEDED", resource, current, limit }` (403)。
/// 参照: docs/未実装仕様書/monetization-plan.md §5.2

export interface ApiErrorInfo {
  message: string;
  code?: string;
  status: number;
}

/// レスポンスがエラーなら ApiErrorInfo を、成功なら null を返す。
/// error フィールドが読めない場合は `エラー (HTTP {status})` にフォールバック。
export async function readApiError(res: Response): Promise<ApiErrorInfo | null> {
  if (res.ok) return null;
  let body: { error?: unknown; code?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // JSON パース失敗は body={} 扱い
  }
  const message =
    typeof body.error === "string" && body.error.length > 0
      ? body.error
      : `エラー (HTTP ${res.status})`;
  const code = typeof body.code === "string" ? body.code : undefined;
  return { message, code, status: res.status };
}

/// エラーなら alert してから false を返す。成功なら true を返す。
/// UI 側は `if (!(await alertOnApiError(res))) return;` で早期リターンできる。
export async function alertOnApiError(res: Response): Promise<boolean> {
  const err = await readApiError(res);
  if (!err) return true;
  alert(err.message);
  return false;
}
