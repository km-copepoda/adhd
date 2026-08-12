/**
 * テスト用リクエスト・パラメータビルダー
 */

import { NextRequest } from "next/server";

/** Next.js App Router の動的ルートパラメータ形式を生成 */
export function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** JSON ボディ付き NextRequest を生成 */
export function makeRequest(
  path: string,
  body: Record<string, unknown>,
  method = "POST",
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: JSON.stringify(body),
  });
}
