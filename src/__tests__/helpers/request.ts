/**
 * テスト用リクエスト・パラメータビルダー
 */

/** Next.js App Router の動的ルートパラメータ形式を生成 */
export function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** JSON ボディ付き Request を生成 */
export function makeRequest(
  path: string,
  body: Record<string, unknown>,
  method = "POST",
) {
  return new Request(`http://localhost${path}`, {
    method,
    body: JSON.stringify(body),
  });
}
