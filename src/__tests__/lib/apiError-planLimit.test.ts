import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promptPlanLimit, confirmPlanLimitOrAlert, alertChildPlanLimit } from "@/lib/apiError";

/**
 * vitest の node 環境には window/alert/confirm/location が無いので、既存の
 * apiError.test.ts と同じ手法で globalThis に都度スタブを差し込む。
 * location.href への代入は jsdom では例外になるが、node 環境ではプレーンな
 * オブジェクトへの代入として扱えるため、ここでは Object.defineProperty で
 * 書き込み可能な location スタブを用意する（設計ドキュメントの注意点に準拠）。
 */
describe("promptPlanLimit / confirmPlanLimitOrAlert / alertChildPlanLimit", () => {
  let confirmMock: ReturnType<typeof vi.fn>;
  let alertMock: ReturnType<typeof vi.fn>;
  const originalConfirm = (globalThis as { confirm?: unknown }).confirm;
  const originalAlert = (globalThis as { alert?: unknown }).alert;
  const originalLocation = (globalThis as { location?: unknown }).location;

  beforeEach(() => {
    confirmMock = vi.fn();
    alertMock = vi.fn();
    (globalThis as { confirm: unknown }).confirm = confirmMock;
    (globalThis as { alert: unknown }).alert = alertMock;
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalConfirm === undefined) delete (globalThis as { confirm?: unknown }).confirm;
    else (globalThis as { confirm: unknown }).confirm = originalConfirm;

    if (originalAlert === undefined) delete (globalThis as { alert?: unknown }).alert;
    else (globalThis as { alert: unknown }).alert = originalAlert;

    Object.defineProperty(globalThis, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe("promptPlanLimit", () => {
    it("confirm に message を含む文言を渡す", () => {
      confirmMock.mockReturnValue(false);
      promptPlanLimit("無料プランではタスクは10個までです。");
      expect(confirmMock).toHaveBeenCalledTimes(1);
      const shown = confirmMock.mock.calls[0]?.[0] as string;
      expect(shown).toContain("無料プランではタスクは10個までです。");
    });

    it("OK (true) を選ぶと /app/parent/plan へ遷移する", () => {
      confirmMock.mockReturnValue(true);
      const result = promptPlanLimit("上限です");
      expect(result).toBe(true);
      expect((globalThis as unknown as { location: { href: string } }).location.href).toBe(
        "/app/parent/plan",
      );
    });

    it("キャンセル (false) を選ぶと遷移しない", () => {
      confirmMock.mockReturnValue(false);
      const result = promptPlanLimit("上限です");
      expect(result).toBe(false);
      expect((globalThis as unknown as { location: { href: string } }).location.href).toBe("");
    });
  });

  describe("confirmPlanLimitOrAlert — 戻り値契約 (v2修正: res.ok のときだけ true)", () => {
    it("res.ok=true は confirm/alert を呼ばず true を返す", async () => {
      const res = new Response(JSON.stringify({ id: "x" }), { status: 200 });
      const ok = await confirmPlanLimitOrAlert(res);
      expect(ok).toBe(true);
      expect(confirmMock).not.toHaveBeenCalled();
      expect(alertMock).not.toHaveBeenCalled();
    });

    it("PLAN_LIMIT_EXCEEDED + confirm で OK を選んでも戻り値は必ず false", async () => {
      confirmMock.mockReturnValue(true);
      const res = new Response(
        JSON.stringify({ error: "上限です", code: "PLAN_LIMIT_EXCEEDED" }),
        { status: 403 },
      );
      const ok = await confirmPlanLimitOrAlert(res);
      expect(ok).toBe(false);
      expect(confirmMock).toHaveBeenCalledTimes(1);
    });

    it("PLAN_LIMIT_EXCEEDED + confirm でキャンセルしても戻り値は false", async () => {
      confirmMock.mockReturnValue(false);
      const res = new Response(
        JSON.stringify({ error: "上限です", code: "PLAN_LIMIT_EXCEEDED" }),
        { status: 403 },
      );
      const ok = await confirmPlanLimitOrAlert(res);
      expect(ok).toBe(false);
    });

    it("呼び出し側の `if (!(await confirmPlanLimitOrAlert(res))) return;` パターンが OK 選択時も早期returnする", async () => {
      confirmMock.mockReturnValue(true); // OK を選んでも…
      const res = new Response(
        JSON.stringify({ error: "上限です", code: "PLAN_LIMIT_EXCEEDED" }),
        { status: 403 },
      );
      let reachedSuccessPath = false;
      async function callSite() {
        if (!(await confirmPlanLimitOrAlert(res))) return;
        reachedSuccessPath = true; // ここに来てはいけない (v1案のバグ)
      }
      await callSite();
      expect(reachedSuccessPath).toBe(false);
    });

    it("PLAN_LIMIT_EXCEEDED はサーバの error 文言をそのまま promptPlanLimit に渡す (内容を複製・改変しない)", async () => {
      confirmMock.mockReturnValue(false);
      const serverMessage = "無料プランではタスクは10個までです。プレミアムプランで無制限になります。";
      const res = new Response(
        JSON.stringify({ error: serverMessage, code: "PLAN_LIMIT_EXCEEDED" }),
        { status: 403 },
      );
      await confirmPlanLimitOrAlert(res);
      const shown = confirmMock.mock.calls[0]?.[0] as string;
      expect(shown).toContain(serverMessage);
    });

    it("PLAN_LIMIT_EXCEEDED 以外のエラーは confirm を呼ばず alert して false を返す", async () => {
      const res = new Response(JSON.stringify({ error: "タスク名は必須です" }), { status: 400 });
      const ok = await confirmPlanLimitOrAlert(res);
      expect(ok).toBe(false);
      expect(confirmMock).not.toHaveBeenCalled();
      expect(alertMock).toHaveBeenCalledWith("タスク名は必須です");
    });

    it("JSON でないエラーレスポンスは汎用メッセージで alert し false を返す", async () => {
      const res = new Response("not json", { status: 500 });
      const ok = await confirmPlanLimitOrAlert(res);
      expect(ok).toBe(false);
      expect(confirmMock).not.toHaveBeenCalled();
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining("500"));
    });

    it("error が空文字のレスポンスは汎用メッセージにフォールバックする", async () => {
      const res = new Response(JSON.stringify({ error: "" }), { status: 400 });
      const ok = await confirmPlanLimitOrAlert(res);
      expect(ok).toBe(false);
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining("400"));
    });

    it("error が型不正 (数値) のレスポンスは汎用メッセージにフォールバックする", async () => {
      const res = new Response(JSON.stringify({ error: 12345 }), { status: 400 });
      const ok = await confirmPlanLimitOrAlert(res);
      expect(ok).toBe(false);
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining("400"));
    });

    it("遷移先は固定値 /app/parent/plan であり、サーバ本文をURLに利用しない", async () => {
      confirmMock.mockReturnValue(true);
      const res = new Response(
        JSON.stringify({ error: "<script>evil</script>", code: "PLAN_LIMIT_EXCEEDED" }),
        { status: 403 },
      );
      await confirmPlanLimitOrAlert(res);
      expect((globalThis as unknown as { location: { href: string } }).location.href).toBe(
        "/app/parent/plan",
      );
    });
  });

  describe("alertChildPlanLimit — 子供向け固定文言", () => {
    const childMessage = "これいじょうタスクをふやせないよ。ママ・パパにおねがいしてね！";

    it("res.ok=true は alert を呼ばず true を返す", async () => {
      const res = new Response("{}", { status: 200 });
      const ok = await alertChildPlanLimit(res, childMessage);
      expect(ok).toBe(true);
      expect(alertMock).not.toHaveBeenCalled();
      expect(confirmMock).not.toHaveBeenCalled();
    });

    it("PLAN_LIMIT_EXCEEDED は呼び出し元が渡した子供向け固定文言で alert し、confirm は呼ばない", async () => {
      const res = new Response(
        JSON.stringify({
          error: "無料プランではタスクは10個までです。プレミアムプランで無制限になります。",
          code: "PLAN_LIMIT_EXCEEDED",
        }),
        { status: 403 },
      );
      const ok = await alertChildPlanLimit(res, childMessage);
      expect(ok).toBe(false);
      expect(alertMock).toHaveBeenCalledWith(childMessage);
      expect(confirmMock).not.toHaveBeenCalled();
    });

    it("サーバのプラン文言 (数値・プラン名を含む) がそのまま子供に見えることはない", async () => {
      const res = new Response(
        JSON.stringify({
          error: "無料プランではタスクは10個までです。プレミアムプランで無制限になります。",
          code: "PLAN_LIMIT_EXCEEDED",
        }),
        { status: 403 },
      );
      await alertChildPlanLimit(res, childMessage);
      const shown = alertMock.mock.calls[0]?.[0] as string;
      expect(shown).not.toMatch(/プレミアム|10個|FREE|PREMIUM/);
    });

    it("PLAN_LIMIT_EXCEEDED 以外のエラーはサーバの error 文言をそのまま alert する", async () => {
      const res = new Response(JSON.stringify({ error: "タスク名は必須です" }), { status: 400 });
      const ok = await alertChildPlanLimit(res, childMessage);
      expect(ok).toBe(false);
      expect(alertMock).toHaveBeenCalledWith("タスク名は必須です");
    });
  });
});
