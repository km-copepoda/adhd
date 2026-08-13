import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/quests/today/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, taskTemplate, questInstance, questDeclaration } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

/**
 * `questInstance.findMany` の `include: { template: { select: {...} } }` の戻り値を模した
 * テスト用オブジェクトを構築する。
 *
 * `prismaMock`（DeepMockProxy）の `mockResolvedValue` は常にベースの QuestInstance 完全型を
 * 要求し、`include`/`select` によるリレーション拡張までは型チェックされない
 * （`src/__tests__/helpers/prisma-mock.ts` 参照）。そのためリレーション部分
 * （`template` とその `taskStreaks`）の型安全性はこのヘルパーの責務とし、
 * 実装（`src/app/api/quests/today/route.ts`）が実際に参照するフィールドを過不足なく埋める。
 */
function makeTodayQuest(
  overrides?: Parameters<typeof questInstance>[0],
  templateOverrides?: Parameters<typeof taskTemplate>[0],
  taskStreaks: { currentStreak: number; bestStreak: number }[] = [],
) {
  return {
    ...questInstance({ snapshotTitle: undefined, snapshotEmoji: undefined, snapshotCategory: undefined, ...overrides }),
    template: { ...taskTemplate(templateOverrides), taskStreaks },
  };
}

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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ familyId: null }));
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("今日の曜日に該当するテンプレートからクエストを生成すること", async () => {
    // 2026-03-12 は木曜日 (day=4)
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));

    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());

    mockPrisma.taskTemplate.findMany.mockResolvedValue([
      taskTemplate({ id: "tpl-1", title: "宿題", repeatDays: [4], isTemporary: false }),
    ]);
    mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());

    const quest = makeTodayQuest(
      { id: "q1", templateId: "tpl-1", childId: "child-1", status: "PENDING" },
      { id: "tpl-1", title: "宿題", createdAt: new Date("2026-03-12T00:00:00Z") },
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([quest]);

    const res = await GET();
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].template.title).toBe("宿題");
  });

  it("upsertのcreateブロックにスナップショットフィールドが含まれること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());

    mockPrisma.taskTemplate.findMany.mockResolvedValue([
      taskTemplate({ id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [4], isTemporary: false }),
    ]);
    mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

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

  it("questInstance.findMany の where で date-branch / carryOver-branch 両方に template.pausedAt: null が入っていること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            expect.objectContaining({ template: expect.objectContaining({ pausedAt: null }) }),
            expect.objectContaining({ template: expect.objectContaining({ pausedAt: null, carryOver: true }) }),
          ],
        }),
      }),
    );
  });

  it("snapshotTitleがある場合、レスポンスのtemplate.titleにスナップショットを使用すること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());

    const quest = makeTodayQuest(
      { id: "q1", snapshotTitle: "宿題（旧名）", snapshotEmoji: "📖", snapshotCategory: "LIFE" },
      { id: "tpl-1", title: "宿題（新名）", emoji: "📚", category: "STUDY", createdAt: new Date("2026-03-12T00:00:00Z") },
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([quest]);

    const res = await GET();
    const json = await res.json();

    expect(json[0].template.title).toBe("宿題（旧名）");
    expect(json[0].template.emoji).toBe("📖");
    expect(json[0].template.category).toBe("LIFE");
  });

  it("スナップショットがnullの場合、template.titleにフォールバックすること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());

    // snapshotTitle/Emoji/Category は DB スキーマ上 NOT NULL だが、実データはこれらの
    // カラムが追加される前に作成された行を含みうる（approve.test.ts の legacy データ
    // ケースと同様）。route.ts の `q.snapshotTitle ?? q.template.title` はその防御的
    // フォールバックであり、`undefined`（= makeTodayQuest の既定値。フィールド省略）で
    // 同じ分岐を再現する。
    const quest = makeTodayQuest(
      { id: "q1" },
      { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", createdAt: new Date("2026-03-12T00:00:00Z") },
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([quest]);

    const res = await GET();
    const json = await res.json();

    expect(json[0].template.title).toBe("宿題");
    expect(json[0].template.emoji).toBe("📚");
    expect(json[0].template.category).toBe("STUDY");
  });

  it("テンプレートごとにupsertで重複クエストを防止すること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));

    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());

    mockPrisma.taskTemplate.findMany.mockResolvedValue([
      taskTemplate({ id: "tpl-1" }),
      taskTemplate({ id: "tpl-2" }),
    ]);
    mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

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

    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());

    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

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

      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());

      mockPrisma.taskTemplate.findMany.mockResolvedValue([
        taskTemplate({ id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: true }),
      ]);
      // 前日の PENDING インスタンスが存在する
      mockPrisma.questInstance.findFirst.mockResolvedValue(questInstance({ id: "q-old", status: "PENDING" }));
      mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());
      mockPrisma.questInstance.findMany.mockResolvedValue([]);

      await GET();

      // 既存 PENDING があるのでこの日の upsert は行わない
      expect(mockPrisma.questInstance.upsert).not.toHaveBeenCalled();
    });

    it("carryOver=true のタスクで PENDING が存在しない場合、通常通り upsert すること", async () => {
      vi.setSystemTime(new Date("2026-03-13T09:00:00")); // 金曜(5)

      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());

      mockPrisma.taskTemplate.findMany.mockResolvedValue([
        taskTemplate({ id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: true }),
      ]);
      // PENDING インスタンスなし
      mockPrisma.questInstance.findFirst.mockResolvedValue(null);
      mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());
      mockPrisma.questInstance.findMany.mockResolvedValue([]);

      await GET();

      expect(mockPrisma.questInstance.upsert).toHaveBeenCalledTimes(1);
    });

    it("carryOver=false のタスクは PENDING があっても通常通り upsert すること", async () => {
      vi.setSystemTime(new Date("2026-03-13T09:00:00"));

      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());

      mockPrisma.taskTemplate.findMany.mockResolvedValue([
        taskTemplate({ id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: false }),
      ]);
      mockPrisma.questInstance.findFirst.mockResolvedValue(null); // carryOver=false なので呼ばれない想定
      mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());
      mockPrisma.questInstance.findMany.mockResolvedValue([]);

      await GET();

      expect(mockPrisma.questInstance.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.questInstance.upsert).toHaveBeenCalledTimes(1);
    });

    it("最終 findMany は today の通常クエストと carryOver PENDING の両方を含む OR 条件を使うこと", async () => {
      vi.setSystemTime(new Date("2026-03-13T09:00:00"));

      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
      mockPrisma.questInstance.findMany.mockResolvedValue([]);

      await GET();

      const call = mockPrisma.questInstance.findMany.mock.calls[0][0];
      expect(call?.where).toEqual(
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

    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());

    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET();


    const today = new Date("2026-03-12T00:00:00Z");

    // OR条件に targetDate=今日 の一時タスク条件が含まれ、targetDate=null 条件は含まれないこと
    const call = mockPrisma.taskTemplate.findMany.mock.calls[0][0];
    const orConditions = call?.where?.OR;
    expect(orConditions).toEqual(
      expect.arrayContaining([{ isTemporary: true, targetDate: today }])
    );
    expect(orConditions).not.toEqual(
      expect.arrayContaining([{ isTemporary: true, targetDate: null }])
    );
  });

  describe("今日やる宣言: idleDays / eligibleForDeclaration / declaredToday", () => {
    const day = (s: string) => new Date(s + "T00:00:00.000Z");

    it("週次タスクで先週スキップしたばかりなら eligibleForDeclaration=false（missedExposures=2）", async () => {
      vi.setSystemTime(new Date("2026-05-11T09:00:00")); // JST 5/11 月曜
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);

      const todayQuest = makeTodayQuest(
        {
          id: "q1",
          templateId: "tpl-week",
          childId: "child-1",
          status: "PENDING",
          snapshotTitle: "ピアノ",
          snapshotEmoji: "🎹",
          snapshotCategory: "LIFE",
        },
        {
          id: "tpl-week",
          title: "ピアノ",
          emoji: "🎹",
          category: "LIFE",
          carryOver: false,
          createdAt: day("2026-04-01"),
        },
      );
      // メイン findMany と per-template findMany を順に返す
      mockPrisma.questInstance.findMany
        .mockResolvedValueOnce([todayQuest])
        .mockResolvedValueOnce([
          questInstance({ date: day("2026-05-11"), status: "PENDING", approvedAt: null }),
          questInstance({ date: day("2026-05-04"), status: "SKIPPED", approvedAt: day("2026-05-04") }),
          questInstance({ date: day("2026-04-27"), status: "APPROVED", approvedAt: day("2026-04-27") }),
        ]);

      const res = await GET();
      const json = await res.json();

      expect(json[0].eligibleForDeclaration).toBe(false);
      expect(json[0].declaredToday).toBe(false);
    });

    it("週次タスクで3週連続非APPROVED なら eligibleForDeclaration=true", async () => {
      vi.setSystemTime(new Date("2026-05-11T09:00:00"));
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);

      const todayQuest = makeTodayQuest(
        { id: "q1", templateId: "tpl-week", childId: "child-1", status: "PENDING" },
        {
          id: "tpl-week",
          title: "ピアノ",
          emoji: "🎹",
          category: "LIFE",
          carryOver: false,
          createdAt: day("2026-04-01"),
        },
      );
      mockPrisma.questInstance.findMany
        .mockResolvedValueOnce([todayQuest])
        .mockResolvedValueOnce([
          questInstance({ date: day("2026-05-11"), status: "PENDING", approvedAt: null }),
          questInstance({ date: day("2026-05-04"), status: "SKIPPED", approvedAt: day("2026-05-04") }),
          questInstance({ date: day("2026-04-27"), status: "SKIPPED", approvedAt: day("2026-04-27") }),
          questInstance({ date: day("2026-04-20"), status: "APPROVED", approvedAt: day("2026-04-20") }),
        ]);

      const res = await GET();
      const json = await res.json();

      expect(json[0].eligibleForDeclaration).toBe(true);
      // idleDays は最終APPROVED(4/20)からの暦日（21日）
      expect(json[0].idleDays).toBe(21);
    });

    it("毎日タスクで3日連続非APPROVED なら eligibleForDeclaration=true", async () => {
      vi.setSystemTime(new Date("2026-05-09T09:00:00"));
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);

      const todayQuest = makeTodayQuest(
        { id: "q1", templateId: "tpl-daily", childId: "child-1", status: "PENDING" },
        {
          id: "tpl-daily",
          title: "宿題",
          emoji: "📚",
          category: "STUDY",
          carryOver: false,
          createdAt: day("2026-04-01"),
        },
      );
      mockPrisma.questInstance.findMany
        .mockResolvedValueOnce([todayQuest])
        .mockResolvedValueOnce([
          questInstance({ date: day("2026-05-09"), status: "PENDING", approvedAt: null }),
          questInstance({ date: day("2026-05-08"), status: "PENDING", approvedAt: null }),
          questInstance({ date: day("2026-05-07"), status: "PENDING", approvedAt: null }),
          questInstance({ date: day("2026-05-06"), status: "APPROVED", approvedAt: day("2026-05-06") }),
        ]);

      const res = await GET();
      const json = await res.json();

      expect(json[0].eligibleForDeclaration).toBe(true);
      expect(json[0].idleDays).toBe(3);
    });

    it("当日の宣言レコードがあれば declaredToday=true", async () => {
      vi.setSystemTime(new Date("2026-05-09T09:00:00"));
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);

      const todayQuest = makeTodayQuest(
        { id: "q1", templateId: "tpl-1", childId: "child-1", status: "PENDING" },
        {
          id: "tpl-1",
          title: "練習",
          emoji: "🎹",
          category: "LIFE",
          carryOver: false,
          createdAt: day("2026-04-01"),
        },
      );
      mockPrisma.questInstance.findMany
        .mockResolvedValueOnce([todayQuest])
        .mockResolvedValueOnce([
          questInstance({ date: day("2026-05-09"), status: "PENDING", approvedAt: null }),
        ]);
      mockPrisma.questDeclaration.findMany.mockResolvedValue([
        questDeclaration({ templateId: "tpl-1" }),
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json[0].declaredToday).toBe(true);
    });
  });

  it("JST深夜（UTCは前日）でもJST基準の日付でリクエストを生成すること", async () => {
    // JST 2026-03-12 01:00 = UTC 2026-03-11 16:00
    vi.setSystemTime(new Date("2026-03-11T16:00:00Z"));

    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET();

    // JST 3/12(木曜=4)の日付・曜日で検索されること (UTC 3/11 水曜=3 ではない）
    const call = mockPrisma.taskTemplate.findMany.mock.calls[0][0];
    const orConditions = call?.where?.OR;
    expect(orConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ repeatDays: { has: 4 } }), // 木曜
        { isTemporary: true, targetDate: new Date("2026-03-12T00:00:00Z") },
      ])
    );
  });
});
