import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { after } from "next/server";

vi.mock("@/lib/accountDeletion", () => ({
  deleteChildAccount: vi.fn(),
  deleteParentAccount: vi.fn(),
}));
vi.mock("@/lib/accountCleanupJob", () => ({
  runAccountCleanupJob: vi.fn(),
}));

import { DELETE } from "@/app/api/family/members/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { deleteChildAccount } from "@/lib/accountDeletion";
import { runAccountCleanupJob } from "@/lib/accountCleanupJob";
import { makeParams } from "../../helpers/request";
import { parentUserWithFamily, childUserWithFamily } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockDeleteChild = vi.mocked(deleteChildAccount);
const mockCleanup = vi.mocked(runAccountCleanupJob);
const mockAfter = vi.mocked(after);

const cleanup = { supabaseIds: ["sup-child-1"], childIds: ["child-1"], photoPaths: ["child-1/a.webp"] };

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteChild.mockResolvedValue({ cleanup, jobId: "job-1" });
});

afterEach(() => {
  mockAfter.mockImplementation(((fn: () => unknown) => fn()) as never);
});

describe("DELETE /api/family/members/[id]", () => {
  it("未認証の場合、403を返し削除しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    expect(res.status).toBe(403);
    expect(mockDeleteChild).not.toHaveBeenCalled();
  });

  it("CHILDロールの場合、403を返し削除しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    expect(res.status).toBe(403);
    expect(mockDeleteChild).not.toHaveBeenCalled();
  });

  it("familyIdがない場合、403を返し削除しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    expect(res.status).toBe(403);
    expect(mockDeleteChild).not.toHaveBeenCalled();
  });

  it("deleteChildAccount が null（別家族・存在しない・CHILD でない）の場合、404を返し after を登録しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockDeleteChild.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost"), makeParams("child-999"));

    expect(res.status).toBe(404);
    expect(mockDeleteChild).toHaveBeenCalledWith({ childId: "child-999", familyId: "fam-1" });
    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockCleanup).not.toHaveBeenCalled();
  });

  it("自分の familyId で deleteChildAccount({ childId, familyId }) を呼び、200 { ok: true } を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-7" }, { id: "fam-7" }));

    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockDeleteChild).toHaveBeenCalledTimes(1);
    expect(mockDeleteChild).toHaveBeenCalledWith({ childId: "child-1", familyId: "fam-7" });
  });

  it("成功時は after() に runAccountCleanupJob(jobId) を登録し、応答前には実行しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    let registered: (() => unknown) | undefined;
    mockAfter.mockImplementation(((fn: () => unknown) => {
      registered = fn;
    }) as never);

    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));

    expect(res.status).toBe(200);
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockCleanup).not.toHaveBeenCalled();
    await registered!();
    expect(mockCleanup).toHaveBeenCalledWith("job-1");
  });

  it("DB 削除が例外なら after を登録しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockDeleteChild.mockRejectedValue(new Error("db down"));

    // ルートが 500 を返す実装でも、例外を伝播する実装でも、外部削除は登録されない
    await DELETE(new Request("http://localhost"), makeParams("child-1")).catch(() => undefined);

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockCleanup).not.toHaveBeenCalled();
  });

  it("ルート内で prisma を直接使った手動削除を行わないこと（削除は deleteChildAccount に集約）", async () => {
    const { prismaMock } = await import("../../helpers/prisma-mock");
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    await DELETE(new Request("http://localhost"), makeParams("child-1"));

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.questInstance.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });
});
