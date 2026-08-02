import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tasks/bulk/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

const validTasks = [
  { title: "宿題をやる", category: "STUDY", repeatDays: [1, 2, 3, 4, 5] },
  { title: "外で遊ぶ", category: "STAMINA", repeatDays: [0, 6] },
  { title: "歯磨きをする", category: "LIFE", repeatDays: [1, 2, 3, 4, 5] },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/tasks/bulk", () => {
  it("未認証の場合403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/tasks/bulk", { assignedChildId: "child-1", tasks: validTasks })
    );
    expect(res.status).toBe(403);
  });

  it("familyId なしの場合403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await POST(
      makeRequest("/api/tasks/bulk", { assignedChildId: "child-1", tasks: validTasks })
    );
    expect(res.status).toBe(403);
  });

  it("CHILD ロールの場合403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(
      makeRequest("/api/tasks/bulk", { assignedChildId: "child-1", tasks: validTasks })
    );
    expect(res.status).toBe(403);
  });

  it("assignedChildId がない場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(
      makeRequest("/api/tasks/bulk", { tasks: validTasks })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/assignedChildId/);
  });

  it("tasks が配列でない場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(
      makeRequest("/api/tasks/bulk", { assignedChildId: "child-1", tasks: "invalid" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/tasks/);
  });

  it("tasks が空配列の場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(
      makeRequest("/api/tasks/bulk", { assignedChildId: "child-1", tasks: [] })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/tasks/);
  });

  it("tasks が多すぎる場合（30件超）400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tooMany = Array.from({ length: 31 }, (_, i) => ({
      title: `タスク${i}`,
      category: "STUDY",
      repeatDays: [1],
    }));
    const res = await POST(
      makeRequest("/api/tasks/bulk", { assignedChildId: "child-1", tasks: tooMany })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/30/);
  });

  it("タイトルが空のタスクが含まれる場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(
      makeRequest("/api/tasks/bulk", {
        assignedChildId: "child-1",
        tasks: [{ title: "", category: "STUDY", repeatDays: [1] }],
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/タスク名/);
  });

  it("タイトルが32文字を超えるタスクが含まれる場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(
      makeRequest("/api/tasks/bulk", {
        assignedChildId: "child-1",
        tasks: [{ title: "あ".repeat(33), category: "STUDY", repeatDays: [1] }],
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/32文字/);
  });

  it("複数タスクを一括作成できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const created = validTasks.map((t, i) => ({ id: `t-${i}`, ...t }));
    // 家族スコープ検証で assignedChildId が自分の family の CHILD であることを確認するために findFirst を呼ぶ
    mockPrisma.user.findFirst.mockResolvedValue({ id: "child-1" } as any);
    mockPrisma.taskTemplate.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.taskTemplate.findMany.mockResolvedValue(created as any);

    const res = await POST(
      makeRequest("/api/tasks/bulk", { assignedChildId: "child-1", tasks: validTasks })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(3);

    expect(mockPrisma.taskTemplate.createMany).toHaveBeenCalledWith({
      data: validTasks.map((t) => ({
        title: t.title,
        emoji: expect.any(String),
        category: t.category,
        repeatDays: t.repeatDays,
        isTemporary: false,
        targetDate: null,
        requestedDate: null,
        photoBonus: false,
        createdBy: "PARENT",
        originalCreatedBy: "PARENT",
        familyId: "fam-1",
        assignedChildId: "child-1",
      })),
    });
  });

  // IDOR 対策: 親が他 family の子供 ID を assignedChildId に渡しても 404 で拒否する
  it("他 family の子供 ID を assignedChildId に指定した場合 404 を返す（IDOR 防止）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    // findFirst が「同 family かつ CHILD」で null を返す（別 family の子は見つからない）
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await POST(
      makeRequest("/api/tasks/bulk", {
        assignedChildId: "other-family-child",
        tasks: validTasks,
      })
    );
    expect(res.status).toBe(404);
    // 家族チェックが失敗したら createMany は呼ばない
    expect(mockPrisma.taskTemplate.createMany).not.toHaveBeenCalled();
  });
});
