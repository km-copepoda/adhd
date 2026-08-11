import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { confirmPlanLimitOrAlert, alertChildPlanLimit } from "@/lib/apiError";

/// PLAN_LIMIT_EXCEEDED を検出したら confirm() で /app/parent/plan への遷移を促す。
/// 通常エラーは既存の alert フォールバック。
describe("confirmPlanLimitOrAlert", () => {
  let confirmMock: ReturnType<typeof vi.fn>;
  let alertMock: ReturnType<typeof vi.fn>;
  let locationHref = "";
  const originalConfirm = (globalThis as { confirm?: unknown }).confirm;
  const originalAlert = (globalThis as { alert?: unknown }).alert;
  const originalLocation = (globalThis as { location?: unknown }).location;

  beforeEach(() => {
    confirmMock = vi.fn();
    alertMock = vi.fn();
    locationHref = "";
    (globalThis as { confirm: unknown }).confirm = confirmMock;
    (globalThis as { alert: unknown }).alert = alertMock;
    // location.href への代入を検出できる薄いスタブ
    Object.defineProperty(globalThis, "location", {
      value: {
        get href() {
          return locationHref;
        },
        set href(v: string) {
          locationHref = v;
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalConfirm === undefined) delete (globalThis as { confirm?: unknown }).confirm;
    else (globalThis as { confirm: unknown }).confirm = originalConfirm;
    if (originalAlert === undefined) delete (globalThis as { alert?: unknown }).alert;
    else (globalThis as { alert: unknown }).alert = originalAlert;
    if (originalLocation === undefined) delete (globalThis as { location?: unknown }).location;
    else
      Object.defineProperty(globalThis, "location", {
        value: originalLocation,
        configurable: true,
        writable: true,
      });
  });

  it("res.ok=true は confirm/alert 呼ばず true を返す", async () => {
    const res = new Response("{}", { status: 200 });
    const ok = await confirmPlanLimitOrAlert(res);
    expect(ok).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalled();
    expect(locationHref).toBe("");
  });

  it("PLAN_LIMIT_EXCEEDED + confirm=true → /app/parent/plan へ遷移し false を返す", async () => {
    confirmMock.mockReturnValue(true);
    const res = new Response(
      JSON.stringify({
        error: "無料プランではタスクは10個までです。プレミアムプランで無制限になります。",
        code: "PLAN_LIMIT_EXCEEDED",
      }),
      { status: 403 },
    );
    const ok = await confirmPlanLimitOrAlert(res);
    expect(ok).toBe(false);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    // confirm メッセージにはエラー本文とプラン管理への案内が含まれる
    expect(confirmMock.mock.calls[0][0]).toContain("プラン管理");
    expect(locationHref).toBe("/app/parent/plan");
    // fallback の alert は使われない
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("PLAN_LIMIT_EXCEEDED + confirm=false → 遷移せず false を返す", async () => {
    confirmMock.mockReturnValue(false);
    const res = new Response(
      JSON.stringify({ error: "だめ", code: "PLAN_LIMIT_EXCEEDED" }),
      { status: 403 },
    );
    const ok = await confirmPlanLimitOrAlert(res);
    expect(ok).toBe(false);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(locationHref).toBe("");
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("code=PLAN_LIMIT_EXCEEDED 以外のエラーは既存 alert フォールバック", async () => {
    const res = new Response(
      JSON.stringify({ error: "サーバーエラー" }),
      { status: 500 },
    );
    const ok = await confirmPlanLimitOrAlert(res);
    expect(ok).toBe(false);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith("サーバーエラー");
    expect(locationHref).toBe("");
  });

  it("400 + code なしのバリデーションエラーは alert フォールバック", async () => {
    const res = new Response(JSON.stringify({ error: "名前は必須" }), { status: 400 });
    const ok = await confirmPlanLimitOrAlert(res);
    expect(ok).toBe(false);
    expect(alertMock).toHaveBeenCalledWith("名前は必須");
    expect(confirmMock).not.toHaveBeenCalled();
  });
});

/// CHILD 端末で使う。PLAN_LIMIT_EXCEEDED を検知したらプラン名・金額に触れない
/// 子供向けメッセージに置き換えて alert する。それ以外は通常のエラーメッセージ。
describe("alertChildPlanLimit", () => {
  let alertMock: ReturnType<typeof vi.fn>;
  const originalAlert = (globalThis as { alert?: unknown }).alert;

  beforeEach(() => {
    alertMock = vi.fn();
    (globalThis as { alert: unknown }).alert = alertMock;
  });
  afterEach(() => {
    if (originalAlert === undefined) delete (globalThis as { alert?: unknown }).alert;
    else (globalThis as { alert: unknown }).alert = originalAlert;
  });

  it("res.ok=true は alert 呼ばず true を返す", async () => {
    const res = new Response("{}", { status: 200 });
    const ok = await alertChildPlanLimit(res, "子向けメッセージ");
    expect(ok).toBe(true);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("PLAN_LIMIT_EXCEEDED は childMessage を alert する (プレミアム等の課金訴求語を出さない)", async () => {
    const res = new Response(
      JSON.stringify({
        error: "無料プランではタスクは10個までです。プレミアムプランで無制限になります。",
        code: "PLAN_LIMIT_EXCEEDED",
      }),
      { status: 403 },
    );
    const ok = await alertChildPlanLimit(res, "今日はもう追加できないよ 🐾");
    expect(ok).toBe(false);
    expect(alertMock).toHaveBeenCalledWith("今日はもう追加できないよ 🐾");
    // サーバのメッセージ (プレミアム を含む) は出ない
    expect(alertMock).not.toHaveBeenCalledWith(
      expect.stringContaining("プレミアム"),
    );
  });

  it("非プランエラーはサーバの error 文字列で alert (child-safe 変換の対象外)", async () => {
    const res = new Response(JSON.stringify({ error: "サーバーエラー" }), { status: 500 });
    const ok = await alertChildPlanLimit(res, "子向けメッセージ");
    expect(ok).toBe(false);
    expect(alertMock).toHaveBeenCalledWith("サーバーエラー");
  });
});
