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

/// プラン上限メッセージを confirm() で提示し、OK なら /app/parent/plan へ遷移する。
/// サーバ 403 のレスポンスがまだ無い段階 (ボタン押下時の preempt チェック等) からも
/// 直接呼べるように、apiError の分岐から独立した「純粋な誘導導線」として提供する。
/// 親 UI からのみ使う (子は /app/parent/plan にアクセスできない)。
export function promptPlanLimit(message: string): boolean {
  const goPlan = confirm(`${message}\n\nプラン管理ページを開きますか？`);
  if (goPlan) {
    location.href = "/app/parent/plan";
  }
  return goPlan;
}

/// PLAN_LIMIT_EXCEEDED (403) は promptPlanLimit で「プラン管理ページへ移動しますか？」を出し、
/// OK なら /app/parent/plan へ遷移する。それ以外のエラーは alertOnApiError と同じ挙動。
/// 親 UI の call site (タスク作成/再開・ごほうび・copy・bulk など) から使う。
export async function confirmPlanLimitOrAlert(res: Response): Promise<boolean> {
  const err = await readApiError(res);
  if (!err) return true;
  if (err.code === "PLAN_LIMIT_EXCEEDED") {
    promptPlanLimit(err.message);
    return false;
  }
  alert(err.message);
  return false;
}
