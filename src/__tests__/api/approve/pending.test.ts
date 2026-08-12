import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/approve/pending/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser, taskTemplate, questInstance, questDeclaration } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/approve/pending", () => {
  beforeEach(() => {
    // ensureTodayQuests / cleanup が呼ぶデフォルトのモック
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findMany.mockResolvedValue([]);
    prismaMock.questInstance.findMany.mockResolvedValue([]);
  });

  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("CHILDロールの場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("親アクセス時にファミリーの carryOver タスクの stale クリーンアップが走ること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    // ファミリーの子供
    const child = childUser({ id: "child-1" });
    prismaMock.user.findMany.mockResolvedValue([child]);
    // 子供の carryOver タスク
    const carryOverTemplate = taskTemplate({ id: "tpl-1", carryOver: true });
    prismaMock.taskTemplate.findMany.mockResolvedValue([carryOverTemplate]);
    // 直近 APPROVED が存在 → cleanup が updateMany を呼ぶ
    const settled = questInstance({ templateId: "tpl-1", date: new Date("2026-03-13T00:00:00Z") });
    prismaMock.questInstance.findMany.mockResolvedValue([settled]);
    prismaMock.questInstance.updateMany.mockResolvedValue({ count: 2 });

    await GET();

    expect(prismaMock.questInstance.updateMany).toHaveBeenCalledWith(
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
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const pendingQuests = [
      {
        ...questInstance({ id: "q1", status: "REPORTED", reportedAt: new Date("2026-03-12T10:00:00") }),
        child: { name: "太郎", monsterName: "ドラゴン", side: "DARK" },
        template: { title: "宿題", emoji: "📚", category: "STUDY" },
      },
      {
        ...questInstance({
          id: "q2",
          templateId: "tpl-2",
          status: "SKIP_REPORTED",
          reportedAt: new Date("2026-03-12T09:00:00"),
        }),
        child: { name: "花子", monsterName: "ユニコーン", side: "LIGHT" },
        template: { title: "運動", emoji: "💪", category: "STAMINA", isTemporary: true },
      },
    ];
    prismaMock.questInstance.findMany.mockResolvedValue(pendingQuests);

    const res = await GET();
    const json = await res.json();

    expect(json).toHaveLength(2);
    expect(json[1].templateId).toBeDefined();
    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith({
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
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

      // JST 2026-03-12 09:00 = UTC 2026-03-12 00:00
      const reportedAt = new Date("2026-03-12T00:00:00Z");
      const jstDate = new Date("2026-03-12T00:00:00Z"); // jstDateOf の戻り値（JST 日付の UTC 0:00）

      const quest = {
        ...questInstance({
          id: "q1",
          templateId: "tpl-1",
          childId: "child-1",
          status: "REPORTED",
          reportedAt,
        }),
        child: { name: "太郎", monsterName: "ド" },
        template: { title: "宿題", emoji: "📚", category: "STUDY", photoBonus: false, isTemporary: false },
      };
      prismaMock.questInstance.findMany.mockResolvedValue([quest]);
      prismaMock.questDeclaration.findMany.mockResolvedValue([
        questDeclaration({ templateId: "tpl-1", childId: "child-1", date: jstDate }),
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json[0].declaredToday).toBe(true);
    });

    it("該当宣言が無ければ declaredToday=false", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

      const quest = {
        ...questInstance({
          id: "q1",
          templateId: "tpl-1",
          childId: "child-1",
          status: "REPORTED",
          reportedAt: new Date("2026-03-12T00:00:00Z"),
        }),
        child: { name: "太郎" },
        template: { title: "宿題", emoji: "📚", category: "STUDY", photoBonus: false, isTemporary: false },
      };
      prismaMock.questInstance.findMany.mockResolvedValue([quest]);
      prismaMock.questDeclaration.findMany.mockResolvedValue([]);

      const res = await GET();
      const json = await res.json();

      expect(json[0].declaredToday).toBe(false);
    });

    it("別の templateId の宣言は混同しない", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

      const jstDate = new Date("2026-03-12T00:00:00Z");
      const quest = {
        ...questInstance({
          id: "q1",
          templateId: "tpl-1",
          childId: "child-1",
          status: "REPORTED",
          reportedAt: new Date("2026-03-12T00:00:00Z"),
        }),
        child: { name: "太郎" },
        template: { title: "宿題", emoji: "📚", category: "STUDY", photoBonus: false, isTemporary: false },
      };
      prismaMock.questInstance.findMany.mockResolvedValue([quest]);
      // 別 template の宣言は来るが、対象クエストの templateId とは違う
      prismaMock.questDeclaration.findMany.mockResolvedValue([
        questDeclaration({ templateId: "tpl-OTHER", childId: "child-1", date: jstDate }),
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json[0].declaredToday).toBe(false);
    });

    it("REPORTED クエストが0件なら QuestDeclaration を検索しない", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      prismaMock.questInstance.findMany.mockResolvedValue([]);

      await GET();

      expect(prismaMock.questDeclaration.findMany).not.toHaveBeenCalled();
    });
  });
});
