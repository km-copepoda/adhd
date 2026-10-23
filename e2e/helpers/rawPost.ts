/**
 * 応答をそのまま返す薄い POST（Issue #222）。
 * testData.ts の callApi は 2xx 以外で throw するため、4xx を検証したいときはこちらを使う。
 */
import type { APIRequestContext } from "@playwright/test";
import { getBypassHeaders } from "../credentials";

/** 2xx 以外でも throw せず { status, body(本文のテキスト) } を返す。bypass ヘッダー付き。 */
export async function postRaw(
  req: APIRequestContext,
  url: string,
  data?: unknown,
): Promise<{ status: number; body: string }> {
  const res = await req.fetch(url, {
    method: "POST",
    headers: getBypassHeaders(),
    ...(data === undefined ? {} : { data }),
  });
  return { status: res.status(), body: await res.text() };
}
