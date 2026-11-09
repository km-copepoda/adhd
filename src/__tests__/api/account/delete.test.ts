import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { after } from "next/server";

vi.mock("@/lib/accountDeletion", () => ({
  deleteParentAccount: vi.fn(),
  deleteChildAccount: vi.fn(),
}));
vi.mock("@/lib/accountCleanupJob", () => ({
  runAccountCleanupJob: vi.fn(),
}));

import { DELETE } from "@/app/api/account/route";
import { getCurrentUser } from "@/lib/auth";
import { deleteParentAccount } from "@/lib/accountDeletion";
import { runAccountCleanupJob } from "@/lib/accountCleanupJob";
import { parentUserWithFamily, childUserWithFamily } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockDeleteParent = vi.mocked(deleteParentAccount);
const mockCleanup = vi.mocked(runAccountCleanupJob);
const mockAfter = vi.mocked(after);

const cleanup = { supabaseIds: ["sup-parent-1"], childIds: [], photoPaths: [] };

const req = (body: unknown, raw?: string) =>
  new Request("http://localhost/api/account", {
    method: "DELETE",
    body: raw ?? JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
  mockDeleteParent.mockResolvedValue({ status: "deleted", scope: "family", cleanup, jobId: "job-1" });
});

afterEach(() => {
  // グローバルモック（setup.ts）の実装へ戻す
  mockAfter.mockImplementation(((fn: () => unknown) => fn()) as never);
});

describe("DELETE /api/account", () => {
  describe("認証・認可", () => {
    it("未認証なら 401、削除を実行しない", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await DELETE(req({ confirm: "削除します" }));
      expect(res.status).toBe(401);
      expect(mockDeleteParent).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
    });

    it("CHILD ロールなら 403、削除を実行しない", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
      const res = await DELETE(req({ confirm: "削除します" }));
      expect(res.status).toBe(403);
      expect(mockDeleteParent).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
    });
  });

  describe("確認文字列の検証（400）", () => {
    it.each([
      ["JSON として不正", undefined, "{not json"],
      ["ボディが空", undefined, ""],
      ["null", null, undefined],
      ["配列", ["削除します"], undefined],
      ["文字列", "削除します", undefined],
      ["confirm が無い", {}, undefined],
      ["confirm が数値", { confirm: 123 }, undefined],
      ["confirm が null", { confirm: null }, undefined],
      ["confirm が配列", { confirm: ["削除します"] }, undefined],
      ["confirm が空文字", { confirm: "" }, undefined],
      ["confirm が不一致", { confirm: "削除" }, undefined],
      ["confirm に余分な文字", { confirm: "削除します！" }, undefined],
    ])("%s の場合は 400、削除を実行しない", async (_label, body, raw) => {
      const res = await DELETE(req(body, raw));
      expect(res.status).toBe(400);
      expect(mockDeleteParent).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
    });

    it("前後に空白があっても trim して受理する（境界）", async () => {
      const res = await DELETE(req({ confirm: "  削除します\n" }));
      expect(res.status).toBe(200);
    });
  });

  describe("削除結果の分岐", () => {
    it("subscription_active は 409 + code SUBSCRIPTION_ACTIVE、after を登録しない", async () => {
      mockDeleteParent.mockResolvedValue({ status: "subscription_active" });

      const res = await DELETE(req({ confirm: "削除します" }));
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.code).toBe("SUBSCRIPTION_ACTIVE");
      expect(typeof json.error).toBe("string");
      expect(mockAfter).not.toHaveBeenCalled();
      expect(mockCleanup).not.toHaveBeenCalled();
    });

    it("not_found（tx 内で親でないと判明）は 404、after を登録しない", async () => {
      mockDeleteParent.mockResolvedValue({ status: "not_found" });

      const res = await DELETE(req({ confirm: "削除します" }));

      expect(res.status).toBe(404);
      expect(mockAfter).not.toHaveBeenCalled();
    });

    it("DB 例外は 500、after を登録しない", async () => {
      mockDeleteParent.mockRejectedValue(new Error("db down"));

      const res = await DELETE(req({ confirm: "削除します" }));

      expect(res.status).toBe(500);
      expect(mockAfter).not.toHaveBeenCalled();
      expect(mockCleanup).not.toHaveBeenCalled();
    });

    it("成功時は deleteParentAccount(user.id, Date) を 1 回呼び、200 { ok, scope } を返す", async () => {
      const res = await DELETE(req({ confirm: "削除します" }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ ok: true, scope: "family" });
      expect(mockDeleteParent).toHaveBeenCalledTimes(1);
      expect(mockDeleteParent).toHaveBeenCalledWith("parent-1", expect.any(Date));
    });

    it("scope=self も そのまま返す", async () => {
      mockDeleteParent.mockResolvedValue({ status: "deleted", scope: "self", cleanup, jobId: "job-1" });
      const res = await DELETE(req({ confirm: "削除します" }));
      expect((await res.json()).scope).toBe("self");
    });

    it("成功時は after() に runAccountCleanupJob(jobId) を登録し、応答前には実行しない", async () => {
      let registered: (() => unknown) | undefined;
      mockAfter.mockImplementation(((fn: () => unknown) => {
        registered = fn;
      }) as never);

      const res = await DELETE(req({ confirm: "削除します" }));

      expect(res.status).toBe(200);
      expect(mockAfter).toHaveBeenCalledTimes(1);
      expect(mockCleanup).not.toHaveBeenCalled();

      await registered!();
      expect(mockCleanup).toHaveBeenCalledWith("job-1");
    });
  });
});
