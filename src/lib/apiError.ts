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

/// プラン上限到達時の誘導ダイアログ (親向け)。
/// サーバのエラー文言 (message) をそのまま使い、末尾に案内文を追加するだけで内容は複製・改変しない。
/// confirm で OK を選ぶと `/app/parent/plan` へ遷移する。戻り値は confirm の選択結果
/// (呼び出し元がテストしやすいよう boolean を返すが、`confirmPlanLimitOrAlert` はこの値を
/// 使わず常に false を返す。詳細は Issue #148 v2 差分1番参照)。
export function promptPlanLimit(message: string): boolean {
  const ok = confirm(`${message}\n\nプラン管理ページを開きますか？`);
  if (ok) {
    location.href = "/app/parent/plan";
  }
  return ok;
}

/// 親向け: プラン上限エラー (`code === "PLAN_LIMIT_EXCEEDED"`) なら `promptPlanLimit` で
/// プラン管理ページへの誘導ダイアログを出す。それ以外のエラーは `alertOnApiError` と同じ挙動。
///
/// 戻り値の契約は既存の `alertOnApiError` と統一し、`res.ok` のときだけ true を返す。
/// PLAN_LIMIT_EXCEEDED を含む全エラーは、confirm の選択結果に関わらず必ず false を返す
/// (v1案「confirm結果をそのまま返す」は誤り。OKを選んでも403のまま成功処理が走ってしまうバグになる)。
/// 呼び出し側は `if (!(await confirmPlanLimitOrAlert(res))) return;` で早期リターンできる。
export async function confirmPlanLimitOrAlert(res: Response): Promise<boolean> {
  if (res.ok) return true;
  const err = await readApiError(res);
  if (!err) return true;
  if (err.code === "PLAN_LIMIT_EXCEEDED") {
    promptPlanLimit(err.message);
    return false;
  }
  alert(err.message);
  return false;
}

/// 子供向け: プラン上限エラーは、呼び出し元が渡した子供向け固定文言 (`childMessage`) で alert する。
/// サーバのエラー文言 (数値・プラン名を含む) をそのまま子供に見せない (monetization-plan.md §5.1)。
/// それ以外のエラーはサーバの文言をそのまま alert する (回帰: 通常のバリデーションエラー等)。
/// `childMessage` は具体的な数値・プラン名を含まない固定文言であること (呼び出し元の責務)。
export async function alertChildPlanLimit(res: Response, childMessage: string): Promise<boolean> {
  if (res.ok) return true;
  const err = await readApiError(res);
  if (!err) return true;
  if (err.code === "PLAN_LIMIT_EXCEEDED") {
    alert(childMessage);
    return false;
  }
  alert(err.message);
  return false;
}
