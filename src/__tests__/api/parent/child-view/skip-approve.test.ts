import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { after } from "next/server";
import { POST } from "@/app/api/parent/child-view/quests/[id]/skip-approve/route";
import { getCurrentUser } from "@/lib/auth";
import * as approveModule from "@/lib/approve";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";
import { generateProxyTreasure } from "@/lib/treasureService";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import {
  parentUserWithFamily,
  childUserWithFamily,
  childUser,
  questWithTemplateAndChild,
  questInstance,
} from "../../../helpers/fixtures";
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

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockApproveSkip = vi.mocked(approveModule.approveSkipQuestInstance);
const mockAfter = vi.mocked(after);
const mockTriggerTaskProgressLog = vi.mocked(triggerTaskProgressLog);
const mockGenerateProxyTreasure = vi.mocked(generateProxyTreasure);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/parent/child-view/quests/q1/skip-approve", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.questInstance.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/parent/child-view/quests/[id]/skip-approve", () => {
  it("未認証の場合、401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(
      makeReq({ childId: "child-1", comment: "体調不良" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(401);
  });

  it("CHILD ロールの場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(
      makeReq({ childId: "child-1", comment: "体調不良" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(403);
  });

  it("childId 未指定の場合、400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeReq({ comment: "理由" }), makeParams("q1"));
    expect(res.status).toBe(400);
  });

  it("comment が空文字の場合、400 を返す（スキップ理由必須）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    const res = await POST(
      makeReq({ childId: "child-1", comment: "   " }),
      makeParams("q1"),
    );
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeReq({ childId: "child-other", comment: "理由" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(404);
  });

  it("クエストが見つからない場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeReq({ childId: "child-1", comment: "理由" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(404);
  });

  it("クエストが指定の子供のものでない場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({ id: "q1", childId: "child-OTHER", status: "PENDING" }),
    );
    const res = await POST(
      makeReq({ childId: "child-1", comment: "理由" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(404);
  });

  it("APPROVED 済みのクエストは 400 を返す（不正な遷移）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({ id: "q1", childId: "child-1", status: "APPROVED" }),
    );
    const res = await POST(
      makeReq({ childId: "child-1", comment: "理由" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(400);
    expect(mockApproveSkip).not.toHaveBeenCalled();
  });

  it("既に SKIPPED 済みのクエストは 400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({ id: "q1", childId: "child-1", status: "SKIPPED" }),
    );
    const res = await POST(
      makeReq({ childId: "child-1", comment: "理由" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(400);
  });

  it("REPORTED 状態は 400 を返す（報告済みはスキップではなく承認/差し戻し）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({ id: "q1", childId: "child-1", status: "REPORTED" }),
    );
    const res = await POST(
      makeReq({ childId: "child-1", comment: "理由" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(400);
  });

  it("PENDING 状態のクエストは SKIP_REPORTED を経由せず一気に SKIPPED まで進める", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({
        id: "q1",
        childId: "child-1",
        status: "PENDING",
        date: new Date("2026-03-12T00:00:00Z"),
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());

    const res = await POST(
      makeReq({ childId: "child-1", comment: "体調不良で休む" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(200);

    // 報告フィールド書き込み: comment と reportedAt が入る
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({
        comment: "体調不良で休む",
        reportedAt: expect.any(Date),
      }),
    });
    // approveSkipQuestInstance が呼ばれて SKIPPED に確定する
    expect(mockApproveSkip).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1", childId: "child-1" }),
    );
  });

  it("SKIP_REPORTED 状態（子供がスキップ申請済）も親代理で SKIPPED にできる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({
        id: "q1",
        childId: "child-1",
        status: "SKIP_REPORTED",
        date: new Date("2026-03-12T00:00:00Z"),
        comment: "子供が書いた理由",
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());

    const res = await POST(
      makeReq({ childId: "child-1", comment: "OK" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(200);
    expect(mockApproveSkip).toHaveBeenCalled();
  });

  it("掲示板の TASK_* 進捗ログを after() 経由で発火する（子供本人のスキップと同等の社会的フィードバックを保つ）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({
        id: "q1",
        childId: "child-1",
        status: "PENDING",
        date: new Date("2026-03-12T00:00:00Z"),
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());

    await POST(
      makeReq({ childId: "child-1", comment: "代理スキップ" }),
      makeParams("q1"),
    );

    expect(mockAfter).toHaveBeenCalled();
    expect(mockTriggerTaskProgressLog).toHaveBeenCalledWith("child-1");
  });

  it("minTasks 達成時に PROXY 宝箱を即 UNLOCKED で生成する（report-approve と同じ規約）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", minTasksForStreak: 1 }),
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({
        id: "q1",
        childId: "child-1",
        status: "PENDING",
        date: new Date("2026-03-12T00:00:00Z"),
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    // approveSkipQuestInstance 後の集計: SKIPPED は computeCompletedCount に含まれる
    mockPrisma.questInstance.findMany.mockResolvedValue([questInstance({ status: "SKIPPED" })]);
    mockGenerateProxyTreasure.mockResolvedValue(["treasure-log-skip"]);

    const res = await POST(
      makeReq({ childId: "child-1", comment: "理由" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(200);
    expect(mockGenerateProxyTreasure).toHaveBeenCalledWith({
      childId: "child-1",
      date: new Date("2026-03-12T00:00:00Z"),
      reportedCount: 1,
      totalCount: 1,
      skippedCount: 1,
      minTasks: 1,
    });
    const body = await res.json();
    expect(body.treasureIds).toEqual(["treasure-log-skip"]);
  });

  it("minTasks 未達なら generateProxyTreasure は呼ばない", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", minTasksForStreak: 3 }),
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({
        id: "q1",
        childId: "child-1",
        status: "PENDING",
        date: new Date("2026-03-12T00:00:00Z"),
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.questInstance.findMany.mockResolvedValue([
      questInstance({ status: "SKIPPED" }),
      questInstance({ status: "PENDING" }),
      questInstance({ status: "PENDING" }),
    ]);

    const res = await POST(
      makeReq({ childId: "child-1", comment: "理由" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(200);
    expect(mockGenerateProxyTreasure).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.treasureIds).toEqual([]);
  });

  // 子供画面 (/api/quests/today) と同じ template.isActive / pausedAt フィルタで絞る
  it("集計クエリは template.isActive: true, pausedAt: null でフィルタする", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", minTasksForStreak: 1 }),
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild({
        id: "q1",
        childId: "child-1",
        status: "PENDING",
        date: new Date("2026-03-12T00:00:00Z"),
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.questInstance.findMany.mockResolvedValue([questInstance({ status: "SKIPPED" })]);

    await POST(makeReq({ childId: "child-1", comment: "理由" }), makeParams("q1"));

    const findManyCall = mockPrisma.questInstance.findMany.mock.calls[0][0];
    expect(findManyCall?.where?.template).toEqual({ isActive: true, pausedAt: null });
  });

  // 子セルフ skip 経路と同様、carryOver 過去日付の親代理スキップでは集計を今日基準に切り替える
  describe("carryOver の古日付（quest.date < today）を親代理でスキップ", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-12T09:00:00Z")); // JST 18:00 → today=2026-03-12
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("宝箱の date と集計を今日基準に切り替える", async () => {
      const today = new Date("2026-03-12T00:00:00.000Z");
      const oldDate = new Date("2026-03-03T00:00:00.000Z"); // 9日前
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", minTasksForStreak: 1 }),
      );
      mockPrisma.questInstance.findUnique.mockResolvedValue(
        questWithTemplateAndChild(
          { id: "q1", childId: "child-1", status: "PENDING", date: oldDate },
          { id: "tpl-1", category: "STUDY", carryOver: true },
        ),
      );
      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      mockPrisma.questInstance.findMany.mockResolvedValue([
        questInstance({ status: "PENDING" }),
        questInstance({ status: "PENDING" }),
      ]);

      await POST(
        makeReq({ childId: "child-1", comment: "やっぱりできない" }),
        makeParams("q1"),
      );

      expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ childId: "child-1", date: today }),
        }),
      );
      // 今日 PENDING 2件 + carryOver SKIPPED 自身 1件 = total 3, reported 1, skipped 1
      expect(mockGenerateProxyTreasure).toHaveBeenCalledWith({
        childId: "child-1",
        date: today,
        reportedCount: 1,
        totalCount: 3,
        skippedCount: 1,
        minTasks: 1,
      });
    });
  });
});
