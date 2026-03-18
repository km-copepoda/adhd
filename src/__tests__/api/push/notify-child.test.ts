import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/push/notify-child/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { parentUser, childUser, taskTemplate } from "../../helpers/fixtures";

vi.mock("@/lib/push", () => ({
  sendPushToChild: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/push/notify-child", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    expect(res.status).toBe(403);
  });

  it("childIdが未指定の場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(makeRequest("/api/push/notify-child", {}));
    expect(res.status).toBe(400);
  });

  it("対象の子供が同じファミリーでない場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-other" }));
    expect(res.status).toBe(403);
  });

  it("taskIdなしの場合、未完了タスク一覧を通知すること", async () => {
    const parent = parentUser();
    const child = childUser();
    mockGetCurrentUser.mockResolvedValue(parent as any);
    mockPrisma.user.findFirst.mockResolvedValue(child as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { id: "q-1", template: { title: "宿題" } },
      { id: "q-2", template: { title: "運動" } },
    ] as any);

    const { sendPushToChild } = await import("@/lib/push");

    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(sendPushToChild).toHaveBeenCalledWith(
      "child-1",
      expect.objectContaining({
        title: expect.stringContaining("リマインド"),
        body: expect.stringContaining("宿題"),
        url: "/child/quests",
      })
    );
  });

  it("taskId指定の場合、そのタスク名で通知すること", async () => {
    const parent = parentUser();
    const child = childUser();
    const tpl = taskTemplate({ title: "漢字練習" });
    mockGetCurrentUser.mockResolvedValue(parent as any);
    mockPrisma.user.findFirst.mockResolvedValue(child as any);
    mockPrisma.questInstance.findFirst.mockResolvedValue({
      id: "q-1",
      template: { title: "漢字練習" },
    } as any);

    const { sendPushToChild } = await import("@/lib/push");

    const res = await POST(
      makeRequest("/api/push/notify-child", { childId: "child-1", taskId: tpl.id })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(sendPushToChild).toHaveBeenCalledWith(
      "child-1",
      expect.objectContaining({
        body: expect.stringContaining("漢字練習"),
        url: "/child/quests",
      })
    );
  });

  it("未完了タスクが0件の場合、400を返すこと", async () => {
    const parent = parentUser();
    const child = childUser();
    mockGetCurrentUser.mockResolvedValue(parent as any);
    mockPrisma.user.findFirst.mockResolvedValue(child as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    expect(res.status).toBe(400);
  });
});
