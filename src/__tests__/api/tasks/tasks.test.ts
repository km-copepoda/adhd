import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/tasks/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  // ensureTodayQuests が user.findMany を呼ぶ。デフォルトでは子供なし（no-op）。
  mockPrisma.user.findMany.mockResolvedValue([] as any);
});

describe("GET /api/tasks", () => {
  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("ファミリーのアクティブタスクを返すこと（completedToday付き）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [
      { id: "t1", title: "宿題", isActive: true },
      { id: "t2", title: "運動", isActive: true },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual([
      { ...tasks[0], completedToday: false, lastSkippedDate: null, oldestCarryOverPendingDate: null },
      { ...tasks[1], completedToday: false, lastSkippedDate: null, oldestCarryOverPendingDate: null },
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
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [
      { id: "t1", title: "宿題", isActive: true },
      { id: "t2", title: "運動", isActive: true },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { templateId: "t1" },
    ] as any);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual([
      { ...tasks[0], completedToday: true, lastSkippedDate: null, oldestCarryOverPendingDate: null },
      { ...tasks[1], completedToday: false, lastSkippedDate: null, oldestCarryOverPendingDate: null },
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
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [{ id: "t1", title: "宿題", isActive: true }];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { templateId: "t1" },
    ] as any);

    const res = await GET();
    const json = await res.json();

    expect(json[0].completedToday).toBe(true);
  });

  it("直近SKIPPEDがあるタスクには lastSkippedDate が設定されること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [
      { id: "t1", title: "宿題", isActive: true },
      { id: "t2", title: "運動", isActive: true },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);

    const skippedDate = new Date("2026-03-15T00:00:00Z");
    // 1回目: 今日のAPPROVED/SKIPPED（空）
    // 2回目: 直近SKIPPED（t1のみ3日前）
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ templateId: "t1", date: skippedDate }] as any);

    const res = await GET();
    const json = await res.json();

    expect(json[0].lastSkippedDate).toBe(skippedDate.toISOString());
    expect(json[1].lastSkippedDate).toBeNull();
  });

  it("直近SKIPPEDクエリは過去7日間・SKIPPEDのみに限定されること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [{ id: "t1", title: "宿題", isActive: true }];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

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
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [{ id: "t1", title: "宿題", isActive: true }];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);

    const recent = new Date("2026-03-17T00:00:00Z");
    const older = new Date("2026-03-13T00:00:00Z");
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([] as any)
      // orderBy: date desc を前提に、先頭が最新
      .mockResolvedValueOnce([
        { templateId: "t1", date: recent },
        { templateId: "t1", date: older },
      ] as any);

    const res = await GET();
    const json = await res.json();

    expect(json[0].lastSkippedDate).toBe(recent.toISOString());
  });

  it("carryOver=true のタスクに過去のPENDINGがある場合、oldestCarryOverPendingDate が設定されること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [
      { id: "t1", title: "宿題", isActive: true, carryOver: true },
      { id: "t2", title: "運動", isActive: true, carryOver: false },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);

    const oldPending = new Date("2026-03-15T00:00:00Z");
    // 1回目: 今日のAPPROVED/SKIPPED（空）
    // 2回目: 直近SKIPPED（空）
    // 3回目: 過去のcarryOver PENDING
    // 4回目: 直近settled（無し）
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ templateId: "t1", date: oldPending }] as any)
      .mockResolvedValueOnce([] as any);

    const res = await GET();
    const json = await res.json();

    expect(json[0].oldestCarryOverPendingDate).toBe(oldPending.toISOString());
    expect(json[1].oldestCarryOverPendingDate).toBeNull();
  });

  it("直近の APPROVED より古い PENDING は無視されること（stale データ対策）", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [{ id: "t1", title: "宿題", isActive: true, carryOver: true }];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);

    const stalePending = new Date("2026-03-11T00:00:00Z"); // 7日前 (古い PENDING、stale)
    const approvedDate = new Date("2026-03-13T00:00:00Z"); // 5日前 (完了)
    const realPending = new Date("2026-03-15T00:00:00Z"); // 3日前 (本物の carryOver)

    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([
        { templateId: "t1", date: stalePending },
        { templateId: "t1", date: realPending },
      ] as any)
      .mockResolvedValueOnce([{ templateId: "t1", date: approvedDate }] as any);

    const res = await GET();
    const json = await res.json();

    // stale を飛ばして realPending が採用される
    expect(json[0].oldestCarryOverPendingDate).toBe(realPending.toISOString());
  });

  it("PENDING がすべて settled より古い場合は null になること", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [{ id: "t1", title: "宿題", isActive: true, carryOver: true }];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);

    const stalePending = new Date("2026-03-11T00:00:00Z"); // 7日前
    const approvedDate = new Date("2026-03-15T00:00:00Z"); // 3日前 (PENDING より新しい)

    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ templateId: "t1", date: stalePending }] as any)
      .mockResolvedValueOnce([{ templateId: "t1", date: approvedDate }] as any);

    const res = await GET();
    const json = await res.json();

    expect(json[0].oldestCarryOverPendingDate).toBeNull();
  });

  it("carryOver=false のタスクは carryOver PENDING クエリの対象外", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [
      { id: "t1", title: "宿題", isActive: true, carryOver: false },
      { id: "t2", title: "運動", isActive: true, carryOver: true },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    await GET();

    const today = new Date("2026-03-18T00:00:00Z");
    expect(mockPrisma.questInstance.findMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          templateId: { in: ["t2"] },
          status: "PENDING",
          date: { lt: today },
        }),
      })
    );
  });

  it("同じテンプレートに複数のcarryOver PENDINGがある場合、最古の日付を返すこと", async () => {
    vi.setSystemTime(new Date("2026-03-18T10:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [{ id: "t1", title: "宿題", isActive: true, carryOver: true }];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);

    const oldest = new Date("2026-03-13T00:00:00Z");
    const newer = new Date("2026-03-16T00:00:00Z");
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)
      // orderBy: date asc を前提に、先頭が最古
      .mockResolvedValueOnce([
        { templateId: "t1", date: oldest },
        { templateId: "t1", date: newer },
      ] as any)
      .mockResolvedValueOnce([] as any); // 直近settled なし

    const res = await GET();
    const json = await res.json();

    expect(json[0].oldestCarryOverPendingDate).toBe(oldest.toISOString());
  });

  it("親がアクセスした時、ファミリー内の各子供について ensureTodayQuests が呼ばれること", async () => {
    // 2026-03-12 は木曜 (day=4)
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    // ファミリーの子供を2人返す
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "child-1" },
      { id: "child-2" },
    ] as any);

    // ensureTodayQuests が child-1 の今日のテンプレートを返す想定
    // child-2 の呼び出しではテンプレートなし
    mockPrisma.taskTemplate.findMany.mockImplementation(((args: any) => {
      if (args?.where?.assignedChildId === "child-1") {
        return Promise.resolve([
          { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [4], isTemporary: false, carryOver: false },
        ] as any);
      }
      if (args?.where?.assignedChildId === "child-2") {
        return Promise.resolve([] as any);
      }
      // 親画面のタスク一覧取得
      return Promise.resolve([] as any);
    }) as any);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

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
  if("タスク名が空の場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(makeRequest("/api/tasks", { title: "", assignedChildId: "child-1" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("タスク名は必須です");
  });
  
  if("タスク名が32文字を超える場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
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
  
  if("タスク名が32文字ちょうどなら作成できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
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
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await POST(makeRequest("/api/tasks", { title: "test" }));
    expect(res.status).toBe(403);
  });

  it("通常タスクを作成できること（PARENT）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const created = { id: "t-new", title: "漢字練習", isTemporary: false };
    mockPrisma.taskTemplate.create.mockResolvedValue(created as any);

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
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-photo" } as any);

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
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-temp" } as any);

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
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-temp2" } as any);

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
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-def" } as any);

    await POST(
      makeRequest("/api/tasks", { title: "テスト", category: "STUDY", assignedChildId: "child-1" })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ emoji: "⚔️" }),
    });
  });

  it("repeatDaysが未指定かつ非一時タスクの場合、空配列になること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-norep" } as any);

    await POST(
      makeRequest("/api/tasks", { title: "テスト", category: "STUDY", assignedChildId: "child-1" })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ repeatDays: [] }),
    });
  });
});
