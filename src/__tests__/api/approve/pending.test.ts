import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/approve/pending/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/approve/pending", () => {
  beforeEach(() => {
    // ensureTodayQuests / cleanup が呼ぶデフォルトのモック
    mockPrisma.user.findMany.mockResolvedValue([] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
  });

  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("CHILDロールの場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("親アクセス時にファミリーの carryOver タスクの stale クリーンアップが走ること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    // ファミリーの子供
    mockPrisma.user.findMany.mockResolvedValue([{ id: "child-1" }] as any);
    // 子供の carryOver タスク
    mockPrisma.taskTemplate.findMany.mockResolvedValue([
      { id: "tpl-1", carryOver: true },
    ] as any);
    // 直近 APPROVED が存在 → cleanup が updateMany を呼ぶ
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { templateId: "tpl-1", date: new Date("2026-03-13T00:00:00Z") },
    ] as any);
    mockPrisma.questInstance.updateMany.mockResolvedValue({ count: 2 } as any);

    await GET();

    expect(mockPrisma.questInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          templateId: "tpl-1",
          childId: "child-1",
          status: { in: ["PENDING", "REPORTED", "SKIP_REPORTED"] },
        }),
        data: expect.objectContaining({ status: "REJECTED" }),
      })
    );
  });

  it("PARENTがREPORTEDとSKIP_REPORTEDのクエストを取得できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    const pendingQuests = [
      {
        id: "q1",
        status: "REPORTED",
        reportedAt: new Date("2026-03-12T10:00:00"),
        child: { name: "太郎", monsterName: "ドラゴン", side: "DARK" },
        template: { title: "宿題", emoji: "📚", category: "STUDY" },
      },
      {
        id: "q2",
        templateId: "tpl-2",
        status: "SKIP_REPORTED",
        reportedAt: new Date("2026-03-12T09:00:00"),
        child: { name: "花子", monsterName: "ユニコーン", side: "LIGHT" },
        template: { title: "運動", emoji: "💪", category: "STAMINA", isTemporary: true },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(pendingQuests as any);

    const res = await GET();
    const json = await res.json();

    expect(json).toHaveLength(2);
    expect(json[1].templateId).toBeDefined();
    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
        template: { familyId: "fam-1" },
      },
      include: {
        child: { select: { name: true, monsterName: true, side: true, reportDeadlineTime: true } },
        template: { select: { title: true, emoji: true, category: true, isTemporary: true, photoBonus: true } },
      },
      orderBy: { reportedAt: "desc" },
    });
  });

  describe("declaredToday: 承認時の宣言ボーナスを反映する", () => {
    it("(templateId, childId, reportedAtのJST日付) に一致する宣言があれば declaredToday=true", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);

      // JST 2026-03-12 09:00 = UTC 2026-03-12 00:00
      const reportedAt = new Date("2026-03-12T00:00:00Z");
      const jstDate = new Date("2026-03-12T00:00:00Z"); // jstDateOf の戻り値（JST 日付の UTC 0:00）

      mockPrisma.questInstance.findMany.mockResolvedValue([
        {
          id: "q1",
          templateId: "tpl-1",
          childId: "child-1",
          status: "REPORTED",
          reportedAt,
          child: { name: "太郎", monsterName: "ド" },
          template: { title: "宿題", emoji: "📚", category: "STUDY", photoBonus: false, isTemporary: false },
        },
      ] as any);
      mockPrisma.questDeclaration.findMany.mockResolvedValue([
        { templateId: "tpl-1", childId: "child-1", date: jstDate },
      ] as any);

      const res = await GET();
      const json = await res.json();

      expect(json[0].declaredToday).toBe(true);
    });

    it("該当宣言が無ければ declaredToday=false", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);

      mockPrisma.questInstance.findMany.mockResolvedValue([
        {
          id: "q1",
          templateId: "tpl-1",
          childId: "child-1",
          status: "REPORTED",
          reportedAt: new Date("2026-03-12T00:00:00Z"),
          child: { name: "太郎" },
          template: { title: "宿題", emoji: "📚", category: "STUDY", photoBonus: false, isTemporary: false },
        },
      ] as any);
      mockPrisma.questDeclaration.findMany.mockResolvedValue([] as any);

      const res = await GET();
      const json = await res.json();

      expect(json[0].declaredToday).toBe(false);
    });

    it("別の templateId の宣言は混同しない", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);

      const jstDate = new Date("2026-03-12T00:00:00Z");
      mockPrisma.questInstance.findMany.mockResolvedValue([
        {
          id: "q1",
          templateId: "tpl-1",
          childId: "child-1",
          status: "REPORTED",
          reportedAt: new Date("2026-03-12T00:00:00Z"),
          child: { name: "太郎" },
          template: { title: "宿題", emoji: "📚", category: "STUDY", photoBonus: false, isTemporary: false },
        },
      ] as any);
      // 別 template の宣言は来るが、対象クエストの templateId とは違う
      mockPrisma.questDeclaration.findMany.mockResolvedValue([
        { templateId: "tpl-OTHER", childId: "child-1", date: jstDate },
      ] as any);

      const res = await GET();
      const json = await res.json();

      expect(json[0].declaredToday).toBe(false);
    });

    it("REPORTED クエストが0件なら QuestDeclaration を検索しない", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

      await GET();

      expect(mockPrisma.questDeclaration.findMany).not.toHaveBeenCalled();
    });
  });
});
