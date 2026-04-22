import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/quests/today/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/quests/today", () => {
  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ familyId: null }) as any);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("今日の曜日に該当するテンプレートからクエストを生成すること", async () => {
    // 2026-03-12 は木曜日 (day=4)
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));

    mockGetCurrentUser.mockResolvedValue(childUser() as any);

    const templates = [
      { id: "tpl-1", title: "宿題", repeatDays: [4], isTemporary: false },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);

    const quests = [
      {
        id: "q1",
        templateId: "tpl-1",
        childId: "child-1",
        status: "PENDING",
        template: { id: "tpl-1", title: "宿題" },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(quests as any);

    const res = await GET();
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].template.title).toBe("宿題");
  });

  it("upsertのcreateブロックにスナップショットフィールドが含まれること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUser() as any);

    const templates = [
      { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [4], isTemporary: false },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    await GET();

    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          snapshotTitle: "宿題",
          snapshotEmoji: "📚",
          snapshotCategory: "STUDY",
        }),
      })
    );
  });

  it("snapshotTitleがある場合、レスポンスのtemplate.titleにスナップショットを使用すること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);

    const quests = [
      {
        id: "q1",
        snapshotTitle: "宿題（旧名）",
        snapshotEmoji: "📖",
        snapshotCategory: "LIFE",
        template: { id: "tpl-1", title: "宿題（新名）", emoji: "📚", category: "STUDY" },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(quests as any);

    const res = await GET();
    const json = await res.json();

    expect(json[0].template.title).toBe("宿題（旧名）");
    expect(json[0].template.emoji).toBe("📖");
    expect(json[0].template.category).toBe("LIFE");
  });

  it("スナップショットがnullの場合、template.titleにフォールバックすること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);

    const quests = [
      {
        id: "q1",
        snapshotTitle: null,
        snapshotEmoji: null,
        snapshotCategory: null,
        template: { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY" },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(quests as any);

    const res = await GET();
    const json = await res.json();

    expect(json[0].template.title).toBe("宿題");
    expect(json[0].template.emoji).toBe("📚");
    expect(json[0].template.category).toBe("STUDY");
  });

  it("テンプレートごとにupsertで重複クエストを防止すること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));

    mockGetCurrentUser.mockResolvedValue(childUser() as any);

    const templates = [{ id: "tpl-1" }, { id: "tpl-2" }];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    await GET();

    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          templateId_childId_date: expect.objectContaining({
            templateId: "tpl-1",
            childId: "child-1",
          }),
        }),
        update: {},
        create: expect.objectContaining({
          templateId: "tpl-1",
          childId: "child-1",
        }),
      })
    );
  });

  it("通常タスクと一時タスクの両方をOR条件で取得すること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));

    mockGetCurrentUser.mockResolvedValue(childUser() as any);

    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    await GET();

    expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        familyId: "fam-1",
        isActive: true,
        OR: expect.arrayContaining([
          expect.objectContaining({ isTemporary: false }),
          expect.objectContaining({ isTemporary: true }),
        ]),
      }),
    });
  });

  describe("carryOver（持ち越し）機能", () => {
    it("carryOver=true のタスクで前日の PENDING が存在する場合、upsert をスキップすること", async () => {
      vi.setSystemTime(new Date("2026-03-13T09:00:00")); // 金曜(5)

      mockGetCurrentUser.mockResolvedValue(childUser() as any);

      const templates = [
        { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: true },
      ];
      mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
      // 前日の PENDING インスタンスが存在する
      mockPrisma.questInstance.findFirst.mockResolvedValue({ id: "q-old", status: "PENDING" } as any);
      mockPrisma.questInstance.upsert.mockResolvedValue({} as any);
      mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

      await GET();

      // 既存 PENDING があるのでこの日の upsert は行わない
      expect(mockPrisma.questInstance.upsert).not.toHaveBeenCalled();
    });

    it("carryOver=true のタスクで PENDING が存在しない場合、通常通り upsert すること", async () => {
      vi.setSystemTime(new Date("2026-03-13T09:00:00")); // 金曜(5)

      mockGetCurrentUser.mockResolvedValue(childUser() as any);

      const templates = [
        { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: true },
      ];
      mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
      // PENDING インスタンスなし
      mockPrisma.questInstance.findFirst.mockResolvedValue(null);
      mockPrisma.questInstance.upsert.mockResolvedValue({} as any);
      mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

      await GET();

      expect(mockPrisma.questInstance.upsert).toHaveBeenCalledTimes(1);
    });

    it("carryOver=false のタスクは PENDING があっても通常通り upsert すること", async () => {
      vi.setSystemTime(new Date("2026-03-13T09:00:00"));

      mockGetCurrentUser.mockResolvedValue(childUser() as any);

      const templates = [
        { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: false },
      ];
      mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
      mockPrisma.questInstance.findFirst.mockResolvedValue(null); // carryOver=false なので呼ばれない想定
      mockPrisma.questInstance.upsert.mockResolvedValue({} as any);
      mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

      await GET();

      expect(mockPrisma.questInstance.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.questInstance.upsert).toHaveBeenCalledTimes(1);
    });

    it("最終 findMany は today の通常クエストと carryOver PENDING の両方を含む OR 条件を使うこと", async () => {
      vi.setSystemTime(new Date("2026-03-13T09:00:00"));

      mockGetCurrentUser.mockResolvedValue(childUser() as any);
      mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
      mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

      await GET();

      const call = mockPrisma.questInstance.findMany.mock.calls[0][0];
      expect(call.where).toEqual(
        expect.objectContaining({
          childId: "child-1",
          OR: expect.arrayContaining([
            expect.objectContaining({ date: new Date("2026-03-13T00:00:00Z") }),
            expect.objectContaining({ status: "PENDING", template: expect.objectContaining({ carryOver: true }) }),
          ]),
        })
      );
    });
  });

  it("一時タスクはtargetDate=今日の条件でのみ取得されること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));

    mockGetCurrentUser.mockResolvedValue(childUser() as any);

    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    await GET();

    
    const today = new Date("2026-03-12T00:00:00Z");

    // OR条件に targetDate=今日 の一時タスク条件が含まれ、targetDate=null 条件は含まれないこと
    const call = mockPrisma.taskTemplate.findMany.mock.calls[0][0];
    const orConditions = call.where.OR;
    expect(orConditions).toEqual(
      expect.arrayContaining([{ isTemporary: true, targetDate: today }])
    );
    expect(orConditions).not.toEqual(
      expect.arrayContaining([{ isTemporary: true, targetDate: null }])
    );
  });
  
  it("JST深夜（UTCは前日）でもJST基準の日付でリクエストを生成すること", async () => {
    // JST 2026-03-12 01:00 = UTC 2026-03-11 16:00
    vi.setSystemTime(new Date("2026-03-11T16:00:00Z"));
    
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
    
    await GET();
    
    // JST 3/12(木曜=4)の日付・曜日で検索されること (UTC 3/11 水曜=3 ではない）
    const call = mockPrisma.taskTemplate.findMany.mock.calls[0][0];
    const orConditions = call.where.OR;
    expect(orConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ repeatDays: { has: 4 } }), // 木曜
        { isTemporary: true, targetDate: new Date("2026-03-12T00:00:00Z") },
      ])
    );
  });
});
