import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/tasks/route";
import { getCurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { makeRequest } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import {
  parentUserWithFamily,
  childUserWithFamily,
  childUser,
  taskTemplate,
  questInstance,
} from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

/**
 * `mockImplementation` の戻り値は実際の Prisma メソッドと同じ `PrismaPromise<T>` 型が
 * 要求されるが、`vitest-mock-extended` の DeepMockProxy はジェネリックオーバーロードを
 * 保持しないためテストコード側では通常の `Promise` しか作れない。
 * `PrismaPromise` は実行時には通常の thenable として振る舞うため、型だけ合わせる。
 */
function asPrismaPromise<T>(value: T): Prisma.PrismaPromise<T> {
  return Promise.resolve(value) as unknown as Prisma.PrismaPromise<T>;
}

/**
 * `NextResponse.json()` は Date を ISO 文字列にシリアライズするため、フィクスチャ
 * （`createdAt` 等が `Date`）と `res.json()` の結果をそのまま `toEqual` すると型不一致になる。
 * 期待値側も同じ JSON ラウンドトリップを通して比較する。
 */
function toSerialized<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

beforeEach(() => {
  vi.clearAllMocks();
  // ensureTodayQuests が user.findMany を呼ぶ。デフォルトでは子供なし（no-op）。
  mockPrisma.user.findMany.mockResolvedValue([]);
});

describe("GET /api/tasks", () => {
  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("ファミリーのアクティブタスクを返すこと（completedToday付き）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "宿題", isActive: true }),
      taskTemplate({ id: "t2", title: "運動", isActive: true }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual([
      toSerialized({ ...tasks[0], completedToday: false, lastSkippedDate: null, carryOverMissedCount: null }),
      toSerialized({ ...tasks[1], completedToday: false, lastSkippedDate: null, carryOverMissedCount: null }),
    ]);
    expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith({
      where: { familyId: "fam-1", isActive: true },
      include: {
        assignedChild: { select: { id: true, monsterName: true } },
        taskStreaks: {
          select: { childId: true, currentStreak: true, bestStreak: true, lastAchievedDate: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("当日にAPPROVEDのクエストがあるタスクはcompletedToday=trueになること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "宿題", isActive: true }),
      taskTemplate({ id: "t2", title: "運動", isActive: true }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);
    // completedQuests のみ t1 の APPROVED を返す。recentSkipped/recentApproved は空。
    // (フィクスチャの questInstance() は date が既定で埋まっているため、これらを空にしないと
    //  lastSkippedDate が誤って設定されてしまう)
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([questInstance({ templateId: "t1" })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual([
      toSerialized({ ...tasks[0], completedToday: true, lastSkippedDate: null, carryOverMissedCount: null }),
      toSerialized({ ...tasks[1], completedToday: false, lastSkippedDate: null, carryOverMissedCount: null }),
    ]);
    const expectedToday = new Date("2026-03-18T00:00:00Z");
    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith({
      where: {
        templateId: { in: ["t1", "t2"] },
        date: expectedToday,
        status: { in: ["APPROVED", "SKIPPED"] },
      },
      select: { templateId: true },
    });
  });

  it("当日にSKIPPEDのクエストがあるタスクもcompletedToday=trueになること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [taskTemplate({ id: "t1", title: "宿題", isActive: true })];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      questInstance({ templateId: "t1" }),
    ]);

    const res = await GET();
    const json = await res.json();

    expect(json[0].completedToday).toBe(true);
  });

  it("直近SKIPPEDがあるタスクには lastSkippedDate が設定されること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "宿題", isActive: true }),
      taskTemplate({ id: "t2", title: "運動", isActive: true }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);

    const skippedDate = new Date("2026-03-15T00:00:00Z");
    // 1回目: 今日のAPPROVED/SKIPPED（空）
    // 2回目: 直近SKIPPED（t1のみ3日前）
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: skippedDate })]);

    const res = await GET();
    const json = await res.json();

    expect(json[0].lastSkippedDate).toBe(skippedDate.toISOString());
    expect(json[1].lastSkippedDate).toBeNull();
  });

  it("直近SKIPPEDクエリは過去7日間・SKIPPEDのみに限定されること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [taskTemplate({ id: "t1", title: "宿題", isActive: true })];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET();

    const sevenDaysAgo = new Date("2026-03-11T00:00:00Z");
    const today = new Date("2026-03-18T00:00:00Z");
    expect(mockPrisma.questInstance.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          templateId: { in: ["t1"] },
          status: "SKIPPED",
          date: { gte: sevenDaysAgo, lte: today },
        }),
      })
    );
  });

  it("同じテンプレートに複数のSKIPPEDがある場合、最新の日付を返すこと", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [taskTemplate({ id: "t1", title: "宿題", isActive: true })];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);

    const recent = new Date("2026-03-17T00:00:00Z");
    const older = new Date("2026-03-13T00:00:00Z");
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([])
      // orderBy: date desc を前提に、先頭が最新
      .mockResolvedValueOnce([
        questInstance({ templateId: "t1", date: recent }),
        questInstance({ templateId: "t1", date: older }),
      ]);

    const res = await GET();
    const json = await res.json();

    expect(json[0].lastSkippedDate).toBe(recent.toISOString());
  });

  it("carryOver=true の毎日タスクで PENDING が3日前なら carryOverMissedCount=4（出現回数 inclusive）", async () => {
    // 2026-03-18 は水曜（dayOfWeek=3）
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      // 毎日タスク
      taskTemplate({ id: "t1", title: "宿題", isActive: true, carryOver: true, repeatDays: [0, 1, 2, 3, 4, 5, 6] }),
      taskTemplate({ id: "t2", title: "運動", isActive: true, carryOver: false, repeatDays: [1, 2, 3, 4, 5] }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);

    const oldPending = new Date("2026-03-15T00:00:00Z"); // 3日前（日曜）
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([]) // completedQuests (today)
      .mockResolvedValueOnce([]) // recentSkipped (7日窓 SKIPPED)
      .mockResolvedValueOnce([]) // recentApproved (7日窓 APPROVED, lastSkippedDate クリア判定用)
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: oldPending })]) // carryOverPending
      .mockResolvedValueOnce([]); // latestSettled

    const res = await GET();
    const json = await res.json();

    // 3/15(日)〜3/18(水) inclusive = 4 日、毎日タスクなので 4 回出現
    expect(json[0].carryOverMissedCount).toBe(4);
    expect(json[1].carryOverMissedCount).toBeNull();
  });

  it("carryOver=true の週次タスク(月曜のみ)で先週月曜の PENDING なら carryOverMissedCount=2", async () => {
    // 2026-03-23 は月曜（dayOfWeek=1）
    vi.setSystemTime(new Date("2026-03-23T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "週次宿題", isActive: true, carryOver: true, repeatDays: [1] }), // 月曜のみ
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);

    const oldPending = new Date("2026-03-16T00:00:00Z"); // 先週月曜
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: oldPending })])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const json = await res.json();

    // 先週月曜＋今週月曜 = 2 回（暦日では 7 日経過しているが、出現は 2 回）
    expect(json[0].carryOverMissedCount).toBe(2);
  });

  it("carryOver=true の週次タスク(月曜のみ)で先週月曜の PENDING でも翌日火曜の時点では 1 回", async () => {
    // 2026-03-24 は火曜（dayOfWeek=2）。先週月曜から見て今週月曜はまだ過ぎていない…のではなく、3/24時点で直前の月曜=3/23 はすでに過ぎている
    // 先週月曜から見て次の月曜（3/23）も含めると 2 回。この境界を別に検証する。
    // ここでは「先週月曜が PENDING で、今日が翌日火曜（=出現は1回のまま）」のケースを確認する。
    // 2026-03-17 は火曜
    vi.setSystemTime(new Date("2026-03-17T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "週次宿題", isActive: true, carryOver: true, repeatDays: [1] }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);

    const oldPending = new Date("2026-03-16T00:00:00Z"); // 月曜
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: oldPending })])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const json = await res.json();

    // 月曜PENDING〜翌日火曜 inclusive で月曜は 1 回しか含まれない
    expect(json[0].carryOverMissedCount).toBe(1);
  });

  it("直近の APPROVED より古い PENDING は無視されること（stale データ対策）", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "宿題", isActive: true, carryOver: true, repeatDays: [0, 1, 2, 3, 4, 5, 6] }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);

    const stalePending = new Date("2026-03-11T00:00:00Z"); // 7日前 (古い PENDING、stale)
    const approvedDate = new Date("2026-03-13T00:00:00Z"); // 5日前 (完了)
    const realPending = new Date("2026-03-15T00:00:00Z"); // 3日前 (本物の carryOver)

    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: approvedDate })]) // recentApproved（7日窓内の APPROVED）
      .mockResolvedValueOnce([
        questInstance({ templateId: "t1", date: stalePending }),
        questInstance({ templateId: "t1", date: realPending }),
      ])
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: approvedDate })]);

    const res = await GET();
    const json = await res.json();

    // stale を飛ばして realPending（3/15）採用、3/15〜3/18 で毎日タスクなら 4 回
    expect(json[0].carryOverMissedCount).toBe(4);
  });

  it("PENDING がすべて settled より古い場合は null になること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "宿題", isActive: true, carryOver: true, repeatDays: [0, 1, 2, 3, 4, 5, 6] }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);

    const stalePending = new Date("2026-03-11T00:00:00Z"); // 7日前
    const approvedDate = new Date("2026-03-15T00:00:00Z"); // 3日前 (PENDING より新しい)

    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: approvedDate })]) // recentApproved
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: stalePending })])
      .mockResolvedValueOnce([questInstance({ templateId: "t1", date: approvedDate })]);

    const res = await GET();
    const json = await res.json();

    expect(json[0].carryOverMissedCount).toBeNull();
  });

  it("carryOver=false のタスクは carryOver PENDING クエリの対象外", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "宿題", isActive: true, carryOver: false }),
      taskTemplate({ id: "t2", title: "運動", isActive: true, carryOver: true }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET();

    const today = new Date("2026-03-18T00:00:00Z");
    // calls: 1=completedQuests, 2=recentSkipped, 3=recentApproved, 4=carryOverPending
    expect(mockPrisma.questInstance.findMany).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: expect.objectContaining({
          templateId: { in: ["t2"] },
          status: "PENDING",
          date: { lt: today },
        }),
      })
    );
  });

  it("同じテンプレートに複数のcarryOver PENDINGがある場合、最古の日付を起点に出現回数を数えること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const tasks = [
      taskTemplate({ id: "t1", title: "宿題", isActive: true, carryOver: true, repeatDays: [0, 1, 2, 3, 4, 5, 6] }),
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks);

    const oldest = new Date("2026-03-13T00:00:00Z");
    const newer = new Date("2026-03-16T00:00:00Z");
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]) // recentApproved
      // orderBy: date asc を前提に、先頭が最古
      .mockResolvedValueOnce([
        questInstance({ templateId: "t1", date: oldest }),
        questInstance({ templateId: "t1", date: newer }),
      ])
      .mockResolvedValueOnce([]); // 直近settled なし

    const res = await GET();
    const json = await res.json();

    // 3/13〜3/18 inclusive = 6 日、毎日タスクなので 6 回
    expect(json[0].carryOverMissedCount).toBe(6);
  });

  it("親がアクセスした時、ファミリー内の各子供について ensureTodayQuests が呼ばれること", async () => {
    // 2026-03-12 は木曜 (day=4)
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    // ファミリーの子供を2人返す
    mockPrisma.user.findMany.mockResolvedValue([
      childUser({ id: "child-1" }),
      childUser({ id: "child-2" }),
    ]);

    // ensureTodayQuests が child-1 の今日のテンプレートを返す想定
    // child-2 の呼び出しではテンプレートなし
    mockPrisma.taskTemplate.findMany.mockImplementation((args?: Prisma.TaskTemplateFindManyArgs) => {
      if (args?.where?.assignedChildId === "child-1") {
        return asPrismaPromise([
          taskTemplate({
            id: "tpl-1",
            title: "宿題",
            emoji: "📚",
            category: "STUDY",
            repeatDays: [4],
            isTemporary: false,
            carryOver: false,
          }),
        ]);
      }
      if (args?.where?.assignedChildId === "child-2") {
        return asPrismaPromise([]);
      }
      // 親画面のタスク一覧取得
      return asPrismaPromise([]);
    });
    mockPrisma.questInstance.upsert.mockResolvedValue(questInstance());
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET();

    // 子供一覧を取得していること
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ familyId: "fam-1", role: "CHILD" }),
      })
    );

    // child-1 用に upsert が呼ばれていること（ensureTodayQuests 経由）
    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          templateId: "tpl-1",
          childId: "child-1",
        }),
      })
    );
  });
});

describe("POST /api/tasks", () => {
  it("タスク名が空の場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeRequest("/api/tasks", { title: "", assignedChildId: "child-1" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("タスク名は必須です");
  });

  it("タスク名が32文字を超える場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(
      makeRequest("/api/tasks", {
        title: "あ".repeat(33),
        category: "STUDY",
        assignedChildId: "child-1",
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("タスク名は32文字以内にしてください");
  });

  it("タスク名が32文字ちょうどなら作成できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "t-exact32" }));
    const res = await POST(
      makeRequest("/api/tasks", {
        title: "あ".repeat(32),
        category: "STUDY",
        assignedChildId: "child-1",
      })
    );
    expect(res.status).toBe(200);
  });

  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/tasks", { title: "test" }));
    expect(res.status).toBe(403);
  });

  it("familyIdなしの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await POST(makeRequest("/api/tasks", { title: "test" }));
    expect(res.status).toBe(403);
  });

  it("通常タスクを作成できること（PARENT）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const created = taskTemplate({ id: "t-new", title: "漢字練習", isTemporary: false });
    mockPrisma.taskTemplate.create.mockResolvedValue(created);

    const res = await POST(
      makeRequest("/api/tasks", {
        title: "漢字練習",
        emoji: "✏️",
        category: "STUDY",
        repeatDays: [1, 2, 3, 4, 5],
        assignedChildId: "child-1",
      })
    );
    const json = await res.json();

    expect(json.id).toBe("t-new");
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: {
        title: "漢字練習",
        emoji: "✏️",
        category: "STUDY",
        repeatDays: [1, 2, 3, 4, 5],
        isTemporary: false,
        targetDate: null,
        requestedDate: null,
        photoBonus: false,
        carryOver: false,
        createdBy: "PARENT",
        originalCreatedBy: "PARENT",
        familyId: "fam-1",
        assignedChildId: "child-1",
      },
    });
  });

  it("photoBonus=true を指定してタスクを作成できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "t-photo" }));

    await POST(
      makeRequest("/api/tasks", {
        title: "宿題写真",
        emoji: "📷",
        category: "STUDY",
        repeatDays: [1, 2, 3, 4, 5],
        assignedChildId: "child-1",
        photoBonus: true,
      })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ photoBonus: true }),
    });
  });

  it("一時タスクを作成できること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "t-temp" }));

    await POST(
      makeRequest("/api/tasks", {
        title: "特別掃除",
        category: "LIFE",
        isTemporary: true,
        targetDate: "2026-03-12",
      })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isTemporary: true,
        repeatDays: [],
        targetDate: new Date("2026-03-12"),
        createdBy: "CHILD",
      }),
    });
  });

  it("一時タスクでtargetDateがない場合、当日の日付が設定されること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "t-temp2" }));

    await POST(
      makeRequest("/api/tasks", {
        title: "今日のタスク",
        category: "STAMINA",
        isTemporary: true,
      })
    );

    const today = new Date("2026-03-12T00:00:00Z");
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isTemporary: true,
        targetDate: today,
      }),
    });
  });

  it("emojiが未指定の場合、デフォルト ⚔️ を使用すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "t-def" }));

    await POST(
      makeRequest("/api/tasks", { title: "テスト", category: "STUDY", assignedChildId: "child-1" })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ emoji: "⚔️" }),
    });
  });

  it("repeatDaysが未指定かつ非一時タスクの場合、空配列になること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "t-norep" }));

    await POST(
      makeRequest("/api/tasks", { title: "テスト", category: "STUDY", assignedChildId: "child-1" })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ repeatDays: [] }),
    });
  });
});
