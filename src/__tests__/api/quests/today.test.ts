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
  
  if("JST深夜（UTCは前日）でもJST基準の日付でリクエストを生成すること", async () => {
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
