import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tasks/[id]/copy/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, parentUser, taskTemplate, subscription } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
});

/// タスクコピーも新規 TaskTemplate を作るので、FREE プランのタスク上限を enforce する。
/// 仕様: monetization-plan.md §2.2 / §4.4 (作成経路すべてに enforce)
describe("POST /api/tasks/[id]/copy — FREE プランのタスク数上限", () => {
  const original = taskTemplate({
    id: "orig",
    isTemporary: true,
    assignedChildId: "child-1",
    familyId: "fam-1",
  });

  it("FREE で対象子の active タスクが 10/10: コピーは 403", async () => {
    mockPrisma.taskTemplate.findFirst
      .mockResolvedValueOnce(original) // 元タスク
      .mockResolvedValueOnce(null); // 重複なし
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null); // FREE
    mockPrisma.taskTemplate.count.mockResolvedValue(10);

    const res = await POST(
      makeRequest("/api/tasks/orig/copy", {}),
      makeParams("orig"),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(json.resource).toBe("task");
    expect(mockPrisma.taskTemplate.create).not.toHaveBeenCalled();
  });

  it("FREE で対象子の active タスクが 9/10: コピー成功", async () => {
    mockPrisma.taskTemplate.findFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(9);
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "new" }));

    const res = await POST(
      makeRequest("/api/tasks/orig/copy", {}),
      makeParams("orig"),
    );
    expect(res.status).toBe(200);
  });

  it("PREMIUM は無制限にコピー可", async () => {
    mockPrisma.taskTemplate.findFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2099-12-31") }),
    );
    mockPrisma.taskTemplate.count.mockResolvedValue(999);
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "new" }));

    const res = await POST(
      makeRequest("/api/tasks/orig/copy", {}),
      makeParams("orig"),
    );
    expect(res.status).toBe(200);
  });

  it("既存の重複タスクが見つかったら上限チェックはスキップ (既存を返すだけなので枠を使わない)", async () => {
    mockPrisma.taskTemplate.findFirst
      .mockResolvedValueOnce(original) // 元タスク取得
      .mockResolvedValueOnce(taskTemplate({ id: "existing", isTemporary: true })); // 重複あり

    const res = await POST(
      makeRequest("/api/tasks/orig/copy", { targetDate: "2026-03-20" }),
      makeParams("orig"),
    );
    expect(res.status).toBe(200);
    // 重複を返しただけなので count / subscription 検索は不要 (呼ばれても許容だが create は呼ばない)
    expect(mockPrisma.taskTemplate.create).not.toHaveBeenCalled();
  });
});
