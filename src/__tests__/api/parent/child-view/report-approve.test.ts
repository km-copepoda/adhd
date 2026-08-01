import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { after } from "next/server";
import { POST } from "@/app/api/parent/child-view/quests/[id]/report-approve/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import * as approveModule from "@/lib/approve";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";
import { generateProxyTreasure } from "@/lib/treasureService";
import { parentUser, childUser } from "../../../helpers/fixtures";
import { makeParams } from "../../../helpers/request";

vi.mock("@/lib/approve", () => ({
  approveQuestInstance: vi.fn(),
  approveSkipQuestInstance: vi.fn(),
}));

vi.mock("@/lib/bulletinLog", () => ({
  triggerTaskProgressLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/treasureService", () => ({
  generateProxyTreasure: vi.fn().mockResolvedValue([]),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockApprove = vi.mocked(approveModule.approveQuestInstance);
const mockAfter = vi.mocked(after);
const mockTriggerTaskProgressLog = vi.mocked(triggerTaskProgressLog);
const mockGenerateProxyTreasure = vi.mocked(generateProxyTreasure);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/parent/child-view/quests/q1/report-approve", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-12T09:00:00Z")); // JST 18:00
  // 既定では「today のクエストは無い」状態に。AUTO 宝箱生成は minTasks=1 達成しないため発火しない。
  mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/parent/child-view/quests/[id]/report-approve", () => {
  it("未認証の場合、401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールの場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定の場合、400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(makeReq({}), makeParams("q1"));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-other" }), makeParams("q1"));
    expect(res.status).toBe(404);
  });

  it("クエストが見つからない場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(404);
  });

  it("クエストが指定の子供のものでない場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-OTHER",
      status: "PENDING",
      template: { category: "STUDY", photoBonus: false },
    } as any);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(404);
  });

  it("PENDING 状態のクエストは PENDING→REPORTED 経由せず一気に APPROVED まで進める", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", reportDeadlineTime: null }) as any,
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "PENDING",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: false,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeReq({ childId: "child-1", comment: "代理報告", stamp: "🎉" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(200);

    // REPORTED 経由ではなく、まず report フィールドだけ更新してから approveQuestInstance を呼ぶ
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({
        comment: "代理報告",
        reportedAt: expect.any(Date),
      }),
    });
    // approveQuestInstance がスタンプ込みで呼ばれる
    expect(mockApprove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1", childId: "child-1" }),
      "🎉",
    );
  });

  it("既に APPROVED 済みのクエストは 400 を返す（二重承認防止）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "APPROVED",
      template: { category: "STUDY", photoBonus: false },
    } as any);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(400);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("SKIPPED 済みのクエストは 400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "SKIPPED",
      template: { category: "STUDY", photoBonus: false },
    } as any);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(400);
  });

  it("REJECTED 状態（差し戻し後）の再報告も APPROVED にできる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "REJECTED",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: true,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeReq({ childId: "child-1", comment: "やり直し" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(200);
    expect(mockApprove).toHaveBeenCalled();
  });

  it("PENDING 初回: 期限内なら deadlineBonusEarned=true で update される", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", reportDeadlineTime: "20:00" }) as any,
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "PENDING",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: false,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    // 2026-03-12T09:00:00Z = JST 18:00（20:00 より前なので期限内）
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({ deadlineBonusEarned: true }),
    });
  });

  it("REJECTED 再報告: deadlineBonusEarned は変更しない（既存値保持）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", reportDeadlineTime: "20:00" }) as any,
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "REJECTED",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: true,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

    const updateCall = mockPrisma.questInstance.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("deadlineBonusEarned");
  });

  it("掲示板の TASK_* 進捗ログを after() 経由で発火する（子供本人の報告と同等の社会的フィードバックを保つ）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "PENDING",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: false,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

    expect(mockAfter).toHaveBeenCalled();
    expect(mockTriggerTaskProgressLog).toHaveBeenCalledWith("child-1");
  });

  it("REPORTED 状態（子供が既に報告済み）も APPROVED にできる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "REPORTED",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: true,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(200);
    expect(mockApprove).toHaveBeenCalled();
  });

  // 2026-05-30: 親代理 report-approve で「即 UNLOCKED の宝箱を 1個生成」を発火する
  // （親端末しかない家庭で「あと一個で宝箱出るよ」のコミュニケーション・体験完結のため）。
  // 2026-05-31: trigger を AUTO → PROXY にリネーム（cron 経由生成も同日に撤回）。
  describe("親代理経路で PROXY 宝箱を即 UNLOCKED で生成する", () => {
    function setupApprovedQuest(opts: { minTasksForStreak?: number } = {}) {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({
          id: "child-1",
          minTasksForStreak: opts.minTasksForStreak ?? 1,
        }) as any,
      );
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q1",
        childId: "child-1",
        status: "PENDING",
        date: new Date("2026-03-12T00:00:00Z"),
        deadlineBonusEarned: false,
        photoUrl: null,
        snapshotCategory: "STUDY",
        template: { id: "tpl-1", category: "STUDY", photoBonus: false },
        child: { id: "child-1" },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
    }

    it("minTasks 達成時に generateProxyTreasure を呼ぶ（reportedCount / totalCount / skippedCount / minTasks 込み）", async () => {
      setupApprovedQuest({ minTasksForStreak: 1 });
      // approve 後の集計：今日 1件 APPROVED（自分自身）, 全1件 → minTasks=1 達成
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "APPROVED" },
      ] as any);

      const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
      expect(res.status).toBe(200);

      expect(mockGenerateProxyTreasure).toHaveBeenCalledWith({
        childId: "child-1",
        date: new Date("2026-03-12T00:00:00Z"),
        reportedCount: 1,
        totalCount: 1,
        skippedCount: 0,
        minTasks: 1,
      });
    });

    it("minTasks 未達なら generateProxyTreasure は呼ばない（=「あと N 個で宝箱」状態）", async () => {
      setupApprovedQuest({ minTasksForStreak: 3 });
      // 今日 1件 APPROVED, 全3件 → 3 > 1 で未達
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "APPROVED" },
        { status: "PENDING" },
        { status: "PENDING" },
      ] as any);

      const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
      expect(res.status).toBe(200);

      // 関数自体は呼ばれてよいが、その場合 reportedCount < minTasks で内部 no-op になる。
      // 仕様としては「呼ばれても呼ばれなくても良い」だが、無駄な DB 呼び出しを避けるため、
      // route 層で minTasks 判定して呼ばない、を期待動作にする。
      expect(mockGenerateProxyTreasure).not.toHaveBeenCalled();
    });

    it("approveQuestInstance より後（つまり今クエストの APPROVED 反映後）に集計する", async () => {
      setupApprovedQuest({ minTasksForStreak: 1 });
      const callOrder: string[] = [];
      mockApprove.mockImplementation(async () => {
        callOrder.push("approve");
      });
      (mockPrisma.questInstance.findMany as any).mockImplementation(async () => {
        callOrder.push("findMany");
        return [{ status: "APPROVED" }];
      });
      mockGenerateProxyTreasure.mockImplementation(async () => {
        callOrder.push("generateTreasure");
        return ["log-1"];
      });

      await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

      expect(callOrder).toEqual(["approve", "findMany", "generateTreasure"]);
    });

    it("findMany は同じ childId と同じ date で today のクエストを取りに行く", async () => {
      setupApprovedQuest({ minTasksForStreak: 1 });
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "APPROVED" },
      ] as any);

      await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

      const findManyCall = (mockPrisma.questInstance.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.childId).toBe("child-1");
      expect(findManyCall.where.date).toEqual(new Date("2026-03-12T00:00:00Z"));
    });

    // 親代理側のクエスト画面にもカットイン演出を出すため、生成された宝箱の id を
    // レスポンスに含めて UI から検出できるようにする。子供セルフ報告 API
    // (/api/quests/[id]/report) が treasureIds を返すのと同じ規約に揃える。
    it("宝箱が生成されたら treasureIds をレスポンスに含める", async () => {
      setupApprovedQuest({ minTasksForStreak: 1 });
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "APPROVED" },
      ] as any);
      mockGenerateProxyTreasure.mockResolvedValue(["treasure-log-xyz"]);

      const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
      const body = await res.json();
      expect(body.treasureIds).toEqual(["treasure-log-xyz"]);
    });

    it("全完了で PROXY + ALL_COMPLETE の 2 個が生成された場合、両方 treasureIds に含める", async () => {
      setupApprovedQuest({ minTasksForStreak: 1 });
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "APPROVED" },
      ] as any);
      mockGenerateProxyTreasure.mockResolvedValue(["proxy-log", "all-complete-log"]);

      const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
      const body = await res.json();
      expect(body.treasureIds).toEqual(["proxy-log", "all-complete-log"]);
    });

    it("宝箱条件を満たさない場合は treasureIds=空配列", async () => {
      setupApprovedQuest({ minTasksForStreak: 3 });
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "APPROVED" },
        { status: "PENDING" },
        { status: "PENDING" },
      ] as any);

      const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
      const body = await res.json();
      expect(body.treasureIds).toEqual([]);
    });

    it("プール未設定や同日 STREAK/PROXY 既存等で生成関数が空配列を返した場合も treasureIds=空配列", async () => {
      setupApprovedQuest({ minTasksForStreak: 1 });
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "APPROVED" },
      ] as any);
      mockGenerateProxyTreasure.mockResolvedValue([]);

      const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
      const body = await res.json();
      expect(body.treasureIds).toEqual([]);
    });

    // 子供画面と揃えるため、宝箱集計側も template.isActive: true, pausedAt: null で絞る
    it("集計クエリは template.isActive: true, pausedAt: null でフィルタする", async () => {
      setupApprovedQuest({ minTasksForStreak: 1 });
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "APPROVED" },
      ] as any);

      await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

      const findManyCall = (mockPrisma.questInstance.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.template).toEqual({ isActive: true, pausedAt: null });
    });

    // 子セルフ report/skip 経路と同様、carryOver 過去日付の親代理承認では集計を今日基準に切り替える
    describe("carryOver の古日付（quest.date < today）を親代理で承認", () => {
      it("宝箱の date と集計を今日基準に切り替える（水増し ALL_COMPLETE を防ぐ）", async () => {
        // JST 2026-03-12 の設定に合わせる (beforeEach で setSystemTime 済み)
        const today = new Date("2026-03-12T00:00:00.000Z");
        const oldDate = new Date("2026-03-03T00:00:00.000Z"); // 9日前
        mockGetCurrentUser.mockResolvedValue(parentUser() as any);
        mockPrisma.user.findFirst.mockResolvedValue(
          childUser({ id: "child-1", minTasksForStreak: 1 }) as any,
        );
        mockPrisma.questInstance.findUnique.mockResolvedValue({
          id: "q1",
          childId: "child-1",
          status: "PENDING",
          date: oldDate,
          deadlineBonusEarned: false,
          photoUrl: null,
          snapshotCategory: "STUDY",
          template: { id: "tpl-1", category: "STUDY", photoBonus: false, carryOver: true },
          child: { id: "child-1", minTasksForStreak: 1 },
        } as any);
        mockPrisma.questInstance.update.mockResolvedValue({} as any);
        mockPrisma.questInstance.findMany.mockResolvedValue([
          { status: "PENDING" } as any,
          { status: "PENDING" } as any,
        ]);

        await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

        expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ childId: "child-1", date: today }),
          }),
        );
        // 今日 PENDING 2件 + carryOver APPROVED 自身 1件 = total 3, reported 1, skipped 0
        // → 1 < 3 なので ALL_COMPLETE 出さない
        expect(mockGenerateProxyTreasure).toHaveBeenCalledWith({
          childId: "child-1",
          date: today,
          reportedCount: 1,
          totalCount: 3,
          skippedCount: 0,
          minTasks: 1,
        });
      });
    });
  });
});
