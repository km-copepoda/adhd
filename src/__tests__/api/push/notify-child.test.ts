import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/push/notify-child/route";
import { getCurrentUser } from "@/lib/auth";
import type { Prisma, TaskTemplate } from "@/generated/prisma/client";
import { makeRequest } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import {
  parentUserWithFamily,
  childUser,
  childUserWithFamily,
  taskTemplate,
  questInstance,
} from "../../helpers/fixtures";

vi.mock("@/lib/push", () => ({
  sendPushToChild: vi.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);

type QuestWithTemplateTitle = Prisma.QuestInstanceGetPayload<{
  include: { template: { select: { title: true } } };
}>;

/** 共通のテンプレート & upsertモック設定 */
function mockQuestGeneration(templates: TaskTemplate[] = []) {
  mockPrisma.taskTemplate.findMany.mockResolvedValue(templates);
  mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());
}

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルトでテンプレート0件（個別テストで上書き可能）
  mockQuestGeneration();
});

describe("POST /api/push/notify-child", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    expect(res.status).toBe(403);
  });

  it("childIdが未指定の場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeRequest("/api/push/notify-child", {}));
    expect(res.status).toBe(400);
  });

  it("対象の子供が同じファミリーでない場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-other" }));
    expect(res.status).toBe(403);
  });

  it("taskIdなしの場合、未完了タスク一覧を通知すること", async () => {
    const parent = parentUserWithFamily();
    const child = childUser();
    mockGetCurrentUser.mockResolvedValue(parent);
    mockPrisma.user.findFirst.mockResolvedValue(child);
    const quests: QuestWithTemplateTitle[] = [
      // snapshotTitle 未設定（= 旧データ）を再現し `?? q.template.title` の
      // フォールバック分岐を通す（taskId 指定時のテストと同じ理由）。
      {
        ...questInstance({ id: "q-1", templateId: "tpl-1", snapshotTitle: undefined }),
        template: { title: "宿題" },
      },
      {
        ...questInstance({ id: "q-2", templateId: "tpl-2", snapshotTitle: "運動" }),
        template: { title: "運動" },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(quests);

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
        url: "/app/child/quests",
      })
    );
  });

  it("taskId指定の場合、そのタスク名で通知すること", async () => {
    const parent = parentUserWithFamily();
    const child = childUser();
    const tpl = taskTemplate({ title: "漢字練習" });
    mockGetCurrentUser.mockResolvedValue(parent);
    mockPrisma.user.findFirst.mockResolvedValue(child);
    const quest: QuestWithTemplateTitle = {
      // snapshotTitle 未設定（= 旧データ）を再現し `?? quest.template.title` の
      // フォールバック分岐を通す。schema 上は必須の String だが overrides は
      // Partial のため undefined を明示的に指定できる。
      ...questInstance({ id: "q-1", snapshotTitle: undefined }),
      template: { title: "漢字練習" },
    };
    mockPrisma.questInstance.findFirst.mockResolvedValue(quest);

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
        url: "/app/child/quests",
      })
    );
  });

  it("未完了タスクが0件の場合、400を返すこと", async () => {
    const parent = parentUserWithFamily();
    const child = childUser();
    mockGetCurrentUser.mockResolvedValue(parent);
    mockPrisma.user.findFirst.mockResolvedValue(child);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    expect(res.status).toBe(400);
  });

  it("子供がアプリ未起動でもQuestInstanceを生成してリマインドを送ること", async () => {
    const parent = parentUserWithFamily();
    const child = childUser();
    const tpl1 = taskTemplate({ id: "tpl-1", title: "宿題" });
    const tpl2 = taskTemplate({ id: "tpl-2", title: "運動" });
    mockGetCurrentUser.mockResolvedValue(parent);
    mockPrisma.user.findFirst.mockResolvedValue(child);

    // テンプレートが存在 -> upsert でQuestInstanceが生成される
    mockQuestGeneration([tpl1, tpl2]);

    // upsert後のfindManyで生成済みQuestInstanceが返る
    const quests: QuestWithTemplateTitle[] = [
      {
        ...questInstance({ id: "q-1", templateId: "tpl-1", snapshotTitle: "宿題" }),
        template: { title: "宿題" },
      },
      {
        ...questInstance({ id: "q-2", templateId: "tpl-2", snapshotTitle: "運動" }),
        template: { title: "運動" },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(quests);

    const { sendPushToChild } = await import("@/lib/push");

    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    expect(res.status).toBe(200);

    // 2テンプレート分のupsertが呼ばれること
    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId_childId_date: { templateId: "tpl-1", childId: "child-1", date: expect.any(Date) } },
        create: expect.objectContaining({ templateId: "tpl-1", childId: "child-1" }),
      })
    );

    expect(sendPushToChild).toHaveBeenCalledWith(
      "child-1",
      expect.objectContaining({
        body: expect.stringContaining("宿題"),
      })
    );
  });

  it("テンプレートがあっても全タスク完了済みなら400を返すこと", async () => {
    const parent = parentUserWithFamily();
    const child = childUser();
    const tpl = taskTemplate({ id: "tpl-1" });
    mockGetCurrentUser.mockResolvedValue(parent);
    mockPrisma.user.findFirst.mockResolvedValue(child);

    // テンプレートは存在するがupsert後のfindManyは0件(すべてAPPROVED済み等）
    mockQuestGeneration([tpl]);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await POST(makeRequest("/api/push/notify-child", { childId: "child-1" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("未完了のクエストがありません");
  });
});
