import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/approve/[id]/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { recordTaskStreak } from "@/lib/streak";
import { makeRequest, makeParams } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

// recordDailyAchievement / recordTaskStreak をモックして承認テストから分離
vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
}));

const mockRecordTaskStreak = vi.mocked(recordTaskStreak);

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
    it("クエストをAPPROVEDに更新しXP（基本1pt）を付与すること", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      const childData = { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 5, staminaPt: 3, lifePt: 1, collectedPaths: "[]" };
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q1",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        deadlineBonusEarned: false,
        photoUrl: null,
        template: { category: "STUDY", createdBy: "PARENT", photoBonus: false },
        child: childData,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(childData as any);
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
      // 基本1pt → studyPt: 5+1=6, total=6+3+1=10 >= 1（stage0閾値） → 孵化、STUDY選択
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: {
          studyPt: 0,
          staminaPt: 0,
          lifePt: 0,
          evolutionStage: 1,
          evolutionPath: "STUDY",
          collectedPaths: '["STUDY"]',
        },
      });
      vi.restoreAllMocks();
    });

    it("deadlineBonusEarned=trueで+1、合計2ptが付与されること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      const childData = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q1-dl",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        deadlineBonusEarned: true,
        photoUrl: null,
        template: { category: "STUDY", createdBy: "PARENT", photoBonus: false },
        child: childData,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(childData as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      await POST(makeRequest("/api/approve/q1-dl", { action: "approve" }), makeParams("q1-dl"));

      // 基本1 + 期限1 = 2pt → studyPt: 2
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 2 }),
      });
    });

    it("photoBonus=trueかつphotoUrlありで+1、合計2ptが付与されること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      const childData = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q1-ph",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        deadlineBonusEarned: false,
        photoUrl: "https://example.com/photo.jpg",
        template: { category: "STAMINA", createdBy: "PARENT", photoBonus: true },
        child: childData,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(childData as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      await POST(makeRequest("/api/approve/q1-ph", { action: "approve" }), makeParams("q1-ph"));

      // 基本1 + 写真1 = 2pt → staminaPt: 2
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ staminaPt: 2 }),
      });
    });

    it("全ボーナスありで3ptが付与されること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      const childData = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q1-all",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        deadlineBonusEarned: true,
        photoUrl: "https://example.com/photo.jpg",
        template: { category: "LIFE", createdBy: "PARENT", photoBonus: true },
        child: childData,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(childData as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      await POST(makeRequest("/api/approve/q1-all", { action: "approve" }), makeParams("q1-all"));

      // 基本1 + 期限1 + 写真1 = 3pt → lifePt: 3
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ lifePt: 3 }),
      });
    });

    it("進化閾値未満ならステージ変更なしでポイント更新すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      const childData = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 1, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q1b",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-1",
        deadlineBonusEarned: false,
        photoUrl: null,
        template: { category: "STUDY", createdBy: "PARENT", photoBonus: false },
        child: childData,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(childData as any);
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
          evolutionPath: "",
          collectedPaths: "[]",
        },
      });
    });

    it("仮タスク（createdBy=CHILD）承認時にテンプレートも同時承認すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      const childData = { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 1, collectedPaths: "[]" };
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q2",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-child",
        deadlineBonusEarned: false,
        photoUrl: null,
        template: { category: "LIFE", createdBy: "CHILD", photoBonus: false },
        child: childData,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(childData as any);
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

    it("一時タスク承認時にrecordTaskStreakを呼ばないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      const childData = { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q-tmp",
        date: new Date("2026-03-19"),
        childId: "child-1",
        templateId: "tpl-tmp",
        deadlineBonusEarned: false,
        photoUrl: null,
        template: { category: "LIFE", createdBy: "PARENT", photoBonus: false, isTemporary: true },
        child: childData,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(childData as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q-tmp", { action: "approve" }),
        makeParams("q-tmp"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockRecordTaskStreak).not.toHaveBeenCalled();
    });

    it("PARENT作成テンプレートの場合、テンプレート承認をスキップすること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      const childData = { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q3",
        date: new Date("2026-03-13"),
        childId: "child-1",
        templateId: "tpl-parent",
        deadlineBonusEarned: false,
        photoUrl: null,
        template: { category: "STAMINA", createdBy: "PARENT", photoBonus: false },
        child: childData,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(childData as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      await POST(makeRequest("/api/approve/q3", { action: "approve" }), makeParams("q3"));

      expect(mockPrisma.taskTemplate.update).not.toHaveBeenCalled();
    });

    it("転生条件達成時にrebirthPending=trueをセットしstageをリセットしないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      // stage3でbasic 1pt追加 → total=19+1=20 >= REBIRTH_THRESHOLD(20) → 転生保留
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q-rebirth",
        date: new Date("2026-03-26"),
        childId: "child-1",
        templateId: "tpl-1",
        deadlineBonusEarned: false,
        photoUrl: null,
        template: { category: "STUDY", createdBy: "PARENT", photoBonus: false, isTemporary: false },
        child: {
          id: "child-1",
          evolutionPath: "STUDY_STAMINA_LIFE",
          evolutionStage: 3,
          studyPt: 19,
          staminaPt: 0,
          lifePt: 0,
          collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
        },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "child-1",
        evolutionPath: "STUDY_STAMINA_LIFE",
        evolutionStage: 3,
        studyPt: 19,
        staminaPt: 0,
        lifePt: 0,
        collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
        rebirthPending: false,
        rebirthEggBonus: null,
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q-rebirth", { action: "approve" }),
        makeParams("q-rebirth"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      // 基本1pt → studyPt=20, total=20 >= REBIRTH_THRESHOLD(20) → rebirthPending=true
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "child-1" },
          data: expect.objectContaining({
            studyPt: 20,
            rebirthPending: true,
          }),
        }),
      );
      // evolutionStage はリセットされないこと
      const callArgs = mockPrisma.user.update.mock.calls[0][0];
      expect(callArgs.data.evolutionStage).toBeUndefined();
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
        template: { category: "STUDY", createdBy: "PARENT" },
        child: { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
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
        template: { category: "STUDY", createdBy: "PARENT" },
        child: { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
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
    it("rejectionReason なしで400を返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q4",
        status: "REPORTED",
        childId: "child-1",
        templateId: "tpl-1",
        template: { category: "STUDY" },
        child: { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      } as any);

      const res = await POST(
        makeRequest("/api/approve/q4", { action: "reject" }),
        makeParams("q4"),
      );
      expect(res.status).toBe(400);
      expect(mockPrisma.questInstance.update).not.toHaveBeenCalled();
    });

    it("クエストをREJECTEDに更新しrejectionReasonを保存すること（XP差し引きなし）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q4",
        status: "REPORTED",
        childId: "child-1",
        templateId: "tpl-1",
        template: { category: "STUDY" },
        child: { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q4", { action: "reject", rejectionReason: "写真が暗くてよく見えないよ" }),
        makeParams("q4"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q4" },
        data: { status: "REJECTED", rejectionReason: "写真が暗くてよく見えないよ" },
      });
      // XPは承認時付与のため差し引き不要
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("その他を選択し追加メッセージなしで400を返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q4b",
        status: "REPORTED",
        childId: "child-1",
        templateId: "tpl-1",
        template: { category: "STUDY" },
        child: { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      } as any);

      const res = await POST(
        makeRequest("/api/approve/q4b", { action: "reject", rejectionReason: "その他" }),
        makeParams("q4b"),
      );
      expect(res.status).toBe(400);
    });

    it("その他＋追加メッセージでREJECTEDに更新すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUser() as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue({
        id: "q4c",
        status: "REPORTED",
        childId: "child-1",
        templateId: "tpl-1",
        template: { category: "STUDY" },
        child: { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      } as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);

      const res = await POST(
        makeRequest("/api/approve/q4c", {
          action: "reject",
          rejectionReason: "その他",
          rejectionComment: "算数プリントだけやってね",
        }),
        makeParams("q4c"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q4c" },
        data: { status: "REJECTED", rejectionReason: "算数プリントだけやってね" },
      });
    });
  });
});
