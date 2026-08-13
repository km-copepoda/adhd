import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/quests/history/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, questInstance, taskTemplate } from "../../helpers/fixtures";
import type { Prisma } from "@/generated/prisma/client";

type HistoryInstance = Prisma.QuestInstanceGetPayload<{
  include: {
    child: { select: { id: true; name: true; monsterName: true; side: true } };
    template: { select: { title: true; emoji: true; category: true; isActive: true; photoBonus: true } };
  };
}>;

type HistoryTemplate = Prisma.TaskTemplateGetPayload<{
  include: {
    assignedChild: { select: { id: true; name: true; monsterName: true; side: true } };
  };
}>;

/** questInstance.findMany(include: { child: {select...}, template: {select...} }) 相当 */
function historyInstance(
  overrides: Parameters<typeof questInstance>[0],
  child: HistoryInstance["child"],
  template: HistoryInstance["template"],
): HistoryInstance {
  return { ...questInstance(overrides), child, template };
}

/** taskTemplate.findMany(include: { assignedChild: {select...} }) 相当 */
function historyTemplate(
  overrides: Parameters<typeof taskTemplate>[0],
  assignedChild: HistoryTemplate["assignedChild"],
): HistoryTemplate {
  return { ...taskTemplate(overrides), assignedChild };
}

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/quests/history");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-12T14:30:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/quests/history", () => {
  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(await res.json()).toEqual([]);
  });

  it("CHILDロールの場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeRequest());
    expect(await res.json()).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }));
    const res = await GET(makeRequest());
    expect(await res.json()).toEqual([]);
  });

  it("date未指定の場合、今日の日付でクエリすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    await GET(makeRequest());

    const today = new Date("2026-03-12T00:00:00Z");
    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: today }),
      })
    );
  });

  it("dateパラメータで指定した日付のデータを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    await GET(makeRequest({ date: "2026-03-10" }));

    const targetDate = new Date("2026-03-10T00:00:00Z");
    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: targetDate }),
      })
    );
  });

  it("snapshotTitleがある場合、レスポンスのtemplate.titleにスナップショットを使用すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q1",
          status: "APPROVED",
          date: new Date("2026-03-12"),
          approvedAt: new Date("2026-03-12T10:00:00"),
          comment: null,
          deadlineBonusEarned: false,
          photoUrl: null,
          snapshotTitle: "宿題（旧名）",
          snapshotEmoji: "📖",
          snapshotCategory: "LIFE",
          templateId: "tpl-1",
          childId: "child-1",
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "宿題（新名）", emoji: "📚", category: "STUDY", isActive: true, photoBonus: false },
      ),
    ]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json[0].template.title).toBe("宿題（旧名）");
    expect(json[0].template.emoji).toBe("📖");
    expect(json[0].template.category).toBe("LIFE");
  });

  it("APPROVEDクエストをそのまま返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    // snapshotTitle/Emoji/Category は旧データを再現するため undefined にし、
    // template フォールバック分岐のカバレッジを維持する
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q1",
          status: "APPROVED",
          date: new Date("2026-03-12"),
          approvedAt: new Date("2026-03-12T10:00:00"),
          comment: null,
          templateId: "tpl-1",
          childId: "child-1",
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "宿題", emoji: "📚", category: "STUDY", isActive: true, photoBonus: false },
      ),
    ]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("APPROVED");
    expect(json[0].id).toBe("q1");
  });

  it("SKIPPEDクエストをそのまま返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q2",
          status: "SKIPPED",
          date: new Date("2026-03-12"),
          approvedAt: new Date("2026-03-12T11:00:00"),
          comment: "体調不良",
          templateId: "tpl-2",
          childId: "child-1",
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "運動", emoji: "🏃", category: "STAMINA", isActive: true, photoBonus: false },
      ),
    ]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("SKIPPED");
    expect(json[0].comment).toBe("体調不良");
  });

  it("PENDINGクエストはNO_ACTIONとして返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q3",
          status: "PENDING",
          date: new Date("2026-03-12"),
          approvedAt: null,
          comment: null,
          templateId: "tpl-3",
          childId: "child-1",
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "読書", emoji: "📖", category: "STUDY", isActive: true, photoBonus: false },
      ),
    ]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("NO_ACTION");
    expect(json[0].id).toBe("q3");
  });

  it("REPORTEDクエストはNO_ACTIONとして返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q4",
          status: "REPORTED",
          date: new Date("2026-03-12"),
          approvedAt: null,
          comment: null,
          templateId: "tpl-4",
          childId: "child-1",
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "片付け", emoji: "🧹", category: "LIFE", isActive: true, photoBonus: false },
      ),
    ]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("NO_ACTION");
  });

  it("QuestInstanceのないテンプレートをNO_ACTIONとして返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([
      historyTemplate(
        { id: "tpl-5", title: "お手伝い", emoji: "🧹", category: "LIFE", assignedChildId: "child-1" },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
      ),
    ]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("NO_ACTION");
    expect(json[0].id).toBeNull();
    expect(json[0].template.title).toBe("お手伝い");
    expect(json[0].child.name).toBe("太郎");
  });

  it("すでにQuestInstanceがあるテンプレートはNO_ACTIONとして重複しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q5",
          status: "PENDING",
          date: new Date("2026-03-12"),
          approvedAt: null,
          comment: null,
          templateId: "tpl-6",
          childId: "child-1",
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "宿題", emoji: "📚", category: "STUDY", isActive: true, photoBonus: false },
      ),
    ]);
    // Same template also returned by taskTemplate query
    prismaMock.taskTemplate.findMany.mockResolvedValue([
      historyTemplate(
        { id: "tpl-6", title: "宿題", emoji: "📚", category: "STUDY", assignedChildId: "child-1" },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
      ),
    ]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    // Should have only 1 item (not 2)
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe("q5");
  });

  it("正しい曜日でテンプレートをフィルタすること（2026-03-12は木曜=4）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    // 2026-03-12 is Thursday (day 4)
    await GET(makeRequest({ date: "2026-03-12" }));

    expect(prismaMock.taskTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          familyId: "fam-1",
          OR: expect.arrayContaining([
            expect.objectContaining({ repeatDays: { has: 4 } }),
          ]),
        }),
      })
    );
  });

  it("familyIdでQuestInstanceをフィルタすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    await GET(makeRequest({ date: "2026-03-12" }));

    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          template: { familyId: "fam-1" },
        }),
      })
    );
  });

  it("削除済みテンプレート（isActive:false）でQuestInstanceがない場合はNO_ACTIONに含めないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    // テンプレートクエリはisActive:trueのみ返すので、削除済みは含まれない
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(0);
  });

  it("テンプレートクエリでisActive:trueでフィルタすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    await GET(makeRequest({ date: "2026-03-12" }));

    const call = prismaMock.taskTemplate.findMany.mock.calls[0][0];
    expect(call?.where?.isActive).toBe(true);
  });

  it("削除済みテンプレート（isActive:false）のAPPROVEDクエストは表示すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q-approved-deleted",
          status: "APPROVED",
          date: new Date("2026-03-12"),
          approvedAt: new Date("2026-03-12T10:00:00"),
          comment: null,
          templateId: "tpl-del",
          childId: "child-1",
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "削除タスク", emoji: "🗑️", category: "LIFE", isActive: false, photoBonus: false },
      ),
    ]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("APPROVED");
  });

  it("削除済みテンプレート（isActive:false）のSKIPPEDクエストも表示すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q-skipped-deleted",
          status: "SKIPPED",
          date: new Date("2026-03-12"),
          approvedAt: new Date("2026-03-12T10:00:00"),
          comment: null,
          templateId: "tpl-del",
          childId: "child-1",
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "削除タスク", emoji: "🗑️", category: "LIFE", isActive: false, photoBonus: false },
      ),
    ]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("SKIPPED");
    expect(json[0].id).toBe("q-skipped-deleted");
  });

  it("削除済みテンプレート（isActive:false）のPENDINGクエストは表示しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      historyInstance(
        {
          id: "q-pending-deleted",
          status: "PENDING",
          date: new Date("2026-03-12"),
          approvedAt: null,
          comment: null,
          templateId: "tpl-del",
          childId: "child-1",
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        },
        { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        { title: "削除タスク", emoji: "🗑️", category: "LIFE", isActive: false, photoBonus: false },
      ),
    ]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(0);
  });

  it("対象日より後に作成されたテンプレートはNO_ACTIONに含まれないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);

    // 2026-03-10 を対象日とする
    await GET(makeRequest({ date: "2026-03-10" }));

    const nextDay = new Date("2026-03-11T00:00:00Z");
    expect(prismaMock.taskTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lt: nextDay },
        }),
      })
    );
  });
});
