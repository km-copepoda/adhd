import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/approve/[id]/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

// recordDailyAchievement / recordTaskStreak をモックして承認テストから分離
vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/approve/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/approve/q1", { action: "approve" }), makeParams("q1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeRequest("/api/approve/q1", { action: "approve" }), makeParams("q1"));
    expect(res.status).toBe(403);
  });

  it("存在しないクエストで404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest("/api/approve/q-none", { action: "approve" }),
      makeParams("q-none"),
    );
    expect(res.status).toBe(404);
  });

  // ── 承認 ──────────────────────────────────

  describe("action: approve", () => {
    it("クエストをAPPROVEDに更新しXPを付与すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q1",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        template: { difficulty: "NORMAL", category: "STUDY", createdBy: "PARENT" },
        child: { id: "child-1", side: "LIGHT", evolutionStage: 0, studyPt: 5, staminaPt: 3, lifePt: 1 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q1", { action: "approve" }),
        makeParams("q1"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q1" },
        data: { status: "APPROVED", approvedAt: expect.any(Date) },
      });
      // NORMAL=3pt → studyPt: 5+3=8, total=8+3+1=12 >= 10 → 進化
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: {
          studyPt: 0,
          staminaPt: 0,
          lifePt: 0,
          evolutionStage: 1,
        },
      });
    });

    it("進化閾値未満ならステージ変更なしでポイント更新すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q1b",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        template: { difficulty: "EASY", category: "STUDY", createdBy: "PARENT" },
        child: { id: "child-1", side: "LIGHT", evolutionStage: 1, studyPt: 1, staminaPt: 0, lifePt: 0 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      await POST(makeRequest("/api/approve/q1b", { action: "approve" }), makeParams("q1b"));

      // EASY=1pt → studyPt: 1+1=2, total=2 < 10 (ステージ1の閾値) → 進化しない
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: {
          studyPt: 2,
          staminaPt: 0,
          lifePt: 0,
          evolutionStage: 1,
        },
      });
    });

    it("仮タスク（createdBy=CHILD）承認時にテンプレートも同時承認すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q2",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-child",
        template: { difficulty: "EASY", category: "LIFE", createdBy: "CHILD" },
        child: { id: "child-1", side: "LIGHT", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 1 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.taskTemplate.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q2", { action: "approve" }),
        makeParams("q2"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
        where: { id: "tpl-child" },
        data: { createdBy: "PARENT" },
      });
    });

    it("PARENT作成テンプレートの場合、テンプレート承認をスキップすること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q3",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-parent",
        template: { difficulty: "HARD", category: "STAMINA", createdBy: "PARENT" },
        child: { id: "child-1", side: "DARK", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      await POST(makeRequest("/api/approve/q3", { action: "approve" }), makeParams("q3"));

      expect(mockPrisma.taskTemplate.update).not.toHaveBeenCalled();
    });
  });

  // ── スキップ申請の承認/差し戻し ─────────────────

  describe("SKIP_REPORTED", () => {
    it("スキップ申請を承認するとSKIPPEDに更新すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q-skip",
        status: "SKIP_REPORTED",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        template: { difficulty: "NORMAL", category: "STUDY", createdBy: "PARENT" },
        child: { id: "child-1", side: "LIGHT", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q-skip", { action: "approve" }),
        makeParams("q-skip"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q-skip" },
        data: { status: "SKIPPED", approvedAt: expect.any(Date) },
      });
      // XP付与されないこと
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("スキップ申請を差し戻すとPENDINGに戻しコメントをクリアすること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q-skip2",
        status: "SKIP_REPORTED",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        template: { difficulty: "NORMAL", category: "STUDY", createdBy: "PARENT" },
        child: { id: "child-1", side: "LIGHT", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q-skip2", { action: "reject" }),
        makeParams("q-skip2"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q-skip2" },
        data: { status: "PENDING", comment: null },
      });
    });
  });

  // ── 差し戻し（リジェクト）───────────────────
  // XPは承認時付与のため、差し戻しではステータス変更のみ

  describe("action: reject", () => {
    it("クエストをREJECTEDに更新すること（XP差し引きなし）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q4",
        childId: "child-1",
        templateId: "tpl-1",
        template: { difficulty: "NORMAL", category: "STUDY" },
        child: { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q4", { action: "reject" }),
        makeParams("q4"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q4" },
        data: { status: "REJECTED" },
      });
      // XPは承認時付与のため差し引き不要
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
