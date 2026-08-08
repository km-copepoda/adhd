import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readApiError, alertOnApiError } from "@/lib/apiError";

describe("readApiError", () => {
  it("res.ok=true は null (エラーなし)", async () => {
    const res = new Response(JSON.stringify({ id: "x" }), { status: 200 });
    expect(await readApiError(res)).toBeNull();
  });

  it("res.ok=false + JSON.error 文字列 → message にそれを入れる", async () => {
    const res = new Response(JSON.stringify({ error: "上限に達しました" }), { status: 403 });
    const err = await readApiError(res);
    expect(err).not.toBeNull();
    expect(err!.message).toBe("上限に達しました");
    expect(err!.status).toBe(403);
  });

  it("res.ok=false + code フィールドがあれば code に入れる", async () => {
    const res = new Response(
      JSON.stringify({ error: "だめ", code: "PLAN_LIMIT_EXCEEDED" }),
      { status: 403 },
    );
    const err = await readApiError(res);
    expect(err!.code).toBe("PLAN_LIMIT_EXCEEDED");
  });

  it("res.ok=false + code なしなら code は undefined", async () => {
    const res = new Response(JSON.stringify({ error: "ダメ" }), { status: 400 });
    const err = await readApiError(res);
    expect(err!.code).toBeUndefined();
  });

  it("res.ok=false + JSON パースできない body は汎用メッセージ", async () => {
    const res = new Response("not json", { status: 500 });
    const err = await readApiError(res);
    expect(err!.message).toContain("500");
  });

  it("res.ok=false + JSON はあるが error フィールドなし → 汎用メッセージ", async () => {
    const res = new Response(JSON.stringify({}), { status: 502 });
    const err = await readApiError(res);
    expect(err!.message).toContain("502");
  });
});

describe("alertOnApiError", () => {
  // vitest の node 環境には window.alert が無いので毎回スタブを差し込む。
  let alertMock: ReturnType<typeof vi.fn>;
  const originalAlert = (globalThis as { alert?: unknown }).alert;

  beforeEach(() => {
    alertMock = vi.fn();
    (globalThis as { alert: unknown }).alert = alertMock;
  });

  afterEach(() => {
    if (originalAlert === undefined) {
      delete (globalThis as { alert?: unknown }).alert;
    } else {
      (globalThis as { alert: unknown }).alert = originalAlert;
    }
  });

  it("res.ok=true は alert 呼ばず true を返す", async () => {
    const res = new Response("{}", { status: 200 });
    const ok = await alertOnApiError(res);
    expect(ok).toBe(true);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("res.ok=false は error メッセージで alert して false を返す", async () => {
    const res = new Response(JSON.stringify({ error: "上限です" }), { status: 403 });
    const ok = await alertOnApiError(res);
    expect(ok).toBe(false);
    expect(alertMock).toHaveBeenCalledWith("上限です");
  });

  it("res.ok=false + code=PLAN_LIMIT_EXCEEDED も同じ動作 (メッセージそのまま)", async () => {
    const res = new Response(
      JSON.stringify({
        error: "無料プランではタスクは10個までです。プレミアムプランで無制限になります。",
        code: "PLAN_LIMIT_EXCEEDED",
      }),
      { status: 403 },
    );
    const ok = await alertOnApiError(res);
    expect(ok).toBe(false);
    expect(alertMock).toHaveBeenCalledWith(
      expect.stringContaining("無料プランではタスクは10個までです"),
    );
  });
});
