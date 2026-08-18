import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/approve/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { recordTaskStreak } from "@/lib/streak";
import { cancelTreasuresOnReject } from "@/lib/treasureService";
import { makeRequest, makeParams } from "../../helpers/request";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, questWithTemplateAndChild, questInstance, questDeclaration } from "../../helpers/fixtures";

// recordDailyAchievement / recordTaskStreak をモックして承認テストから分離
vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/treasureService", () => ({
  unlockTreasuresOnApprove: vi.fn().mockResolvedValue(0),
  cancelTreasuresOnReject: vi.fn().mockResolvedValue(0),
}));

const mockRecordTaskStreak = vi.mocked(recordTaskStreak);
const mockCancelTreasures = vi.mocked(cancelTreasuresOnReject);

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  // 宣言ボーナス: 既定では宣言なし（テスト毎に上書き可能）
  prismaMock.questDeclaration.findUnique.mockResolvedValue(null);
  prismaMock.questInstance.findMany.mockResolvedValue([]);
});

describe("POST /api/approve/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/approve/q1", { action: "approve" }), makeParams("q1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(makeRequest("/api/approve/q1", { action: "approve" }), makeParams("q1"));
    expect(res.status).toBe(403);
  });

  it("存在しないクエストで404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest("/api/approve/q-none", { action: "approve" }),
      makeParams("q-none"),
    );
    expect(res.status).toBe(404);
  });

  // ── ステータスバリデーション ─────────────

  it("REPORTED以外のステータス（PENDING等）で400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild(
        { id: "q-pending", status: "PENDING", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY", createdBy: "PARENT" },
        { id: "child-1" },
      ),
    );

    const res = await POST(
      makeRequest("/api/approve/q-pending", { action: "approve" }),
      makeParams("q-pending"),
    );
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("既にAPPROVED済みのクエストで400を返すこと（二重承認防止）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild(
        { id: "q-approved", status: "APPROVED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY", createdBy: "PARENT" },
        { id: "child-1" },
      ),
    );

    const res = await POST(
      makeRequest("/api/approve/q-approved", { action: "approve" }),
      makeParams("q-approved"),
    );
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("SKIPPED済みのクエストで400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild(
        { id: "q-skipped", status: "SKIPPED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY", createdBy: "PARENT" },
        { id: "child-1" },
      ),
    );

    const res = await POST(
      makeRequest("/api/approve/q-skipped", { action: "approve" }),
      makeParams("q-skipped"),
    );
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("REJECTED（差し戻し中）のクエストで400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findUnique.mockResolvedValue(
      questWithTemplateAndChild(
        { id: "q-rejected", status: "REJECTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY", createdBy: "PARENT" },
        { id: "child-1" },
      ),
    );

    const res = await POST(
      makeRequest("/api/approve/q-rejected", { action: "approve" }),
      makeParams("q-rejected"),
    );
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  // ── 承認 ──────────────────────────────────

  describe("action: approve", () => {
    it("クエストをAPPROVEDに更新しXP（基本1pt）を付与すること", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      // monsterSetId未選択(dark)でも進化ログ用の getMonsterStage フォールバックが動くことを合わせて確認する
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 5, staminaPt: 3, lifePt: 1, collectedPaths: "[]", side: null, monsterSetId: "dark" };
      const quest = questWithTemplateAndChild(
        { id: "q1", status: "REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "STUDY" },
        { category: "STUDY", createdBy: "PARENT", photoBonus: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      const res = await POST(
        makeRequest("/api/approve/q1", { action: "approve" }),
        makeParams("q1"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(prismaMock.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q1" },
        data: { status: "APPROVED", approvedAt: expect.any(Date) },
      });
      // 基本1pt → studyPt: 5+1=6, total=6+3+1=10 >= 1（stage0閾値） → 孵化、STUDY選択
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: {
          studyPt: 0,
          staminaPt: 0,
          lifePt: 0,
          evolutionStage: 1,
          evolutionPath: "STUDY",
          collectedPaths: '["dark:STUDY"]',
          monsterLevels: "{}",
        },
      });
      vi.restoreAllMocks();
    });

    it("deadlineBonusEarned=trueで+1、合計2ptが付与されること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q1-dl", status: "REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: true, photoUrl: null, snapshotCategory: "STUDY" },
        { category: "STUDY", createdBy: "PARENT", photoBonus: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q1-dl", { action: "approve" }), makeParams("q1-dl"));

      // 基本1 + 期限1 = 2pt → studyPt: 2
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 2 }),
      });
    });

    it("photoBonus=trueかつphotoUrlありで+1、合計2ptが付与されること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q1-ph", status: "REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: false, photoUrl: "https://example.com/photo.jpg", snapshotCategory: "STAMINA" },
        { category: "STAMINA", createdBy: "PARENT", photoBonus: true },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q1-ph", { action: "approve" }), makeParams("q1-ph"));

      // 基本1 + 写真1 = 2pt → staminaPt: 2
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ staminaPt: 2 }),
      });
    });

    it("全ボーナスありで3ptが付与されること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q1-all", status: "REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: true, photoUrl: "https://example.com/photo.jpg", snapshotCategory: "LIFE" },
        { category: "LIFE", createdBy: "PARENT", photoBonus: true },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q1-all", { action: "approve" }), makeParams("q1-all"));

      // 基本1 + 期限1 + 写真1 = 3pt → lifePt: 3
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ lifePt: 3 }),
      });
    });

    it("進化閾値未満ならステージ変更なしでポイント更新すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 1, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q1b", status: "REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "STUDY" },
        { category: "STUDY", createdBy: "PARENT", photoBonus: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q1b", { action: "approve" }), makeParams("q1b"));

      // EASY=1pt → studyPt: 1+1=2, total=2 < 10 (ステージ1の閾値) → 進化しない
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: {
          studyPt: 2,
          staminaPt: 0,
          lifePt: 0,
          evolutionStage: 1,
          evolutionPath: "",
          collectedPaths: "[]",
          monsterLevels: "{}",
        },
      });
    });

    it("仮タスク（createdBy=CHILD）承認時にテンプレートも同時承認すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 1, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q2", status: "REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-child", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "LIFE" },
        { id: "tpl-child", category: "LIFE", createdBy: "CHILD", photoBonus: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);
      prismaMock.taskTemplate.update.mockResolvedValue(quest.template);

      const res = await POST(
        makeRequest("/api/approve/q2", { action: "approve" }),
        makeParams("q2"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(prismaMock.taskTemplate.update).toHaveBeenCalledWith({
        where: { id: "tpl-child" },
        data: { createdBy: "PARENT" },
      });
    });

    it("一時タスク承認時にrecordTaskStreakを呼ばないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q-tmp", status: "REPORTED", date: new Date("2026-03-19"), childId: "child-1", templateId: "tpl-tmp", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "LIFE" },
        { id: "tpl-tmp", category: "LIFE", createdBy: "PARENT", photoBonus: false, isTemporary: true },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      const res = await POST(
        makeRequest("/api/approve/q-tmp", { action: "approve" }),
        makeParams("q-tmp"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockRecordTaskStreak).not.toHaveBeenCalled();
    });

    it("stamp を渡すと questInstance.update に approvalStamp が含まれること", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q-stamp", status: "REPORTED", date: new Date("2026-04-09"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "STUDY" },
        { category: "STUDY", createdBy: "PARENT", photoBonus: false, isTemporary: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(
        makeRequest("/api/approve/q-stamp", { action: "approve", stamp: "⭐" }),
        makeParams("q-stamp"),
      );

      expect(prismaMock.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q-stamp" },
        data: { status: "APPROVED", approvedAt: expect.any(Date), approvalStamp: "⭐" },
      });
      vi.restoreAllMocks();
    });

    it("stamp なしで承認すると approvalStamp は undefined（フィールドなし）であること", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q-nostamp", status: "REPORTED", date: new Date("2026-04-09"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "STUDY" },
        { category: "STUDY", createdBy: "PARENT", photoBonus: false, isTemporary: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(
        makeRequest("/api/approve/q-nostamp", { action: "approve" }),
        makeParams("q-nostamp"),
      );

      expect(prismaMock.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q-nostamp" },
        data: { status: "APPROVED", approvedAt: expect.any(Date) },
      });
      vi.restoreAllMocks();
    });

    it("PARENT作成テンプレートの場合、テンプレート承認をスキップすること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q3", status: "REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-parent", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "STAMINA" },
        { id: "tpl-parent", category: "STAMINA", createdBy: "PARENT", photoBonus: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q3", { action: "approve" }), makeParams("q3"));

      expect(prismaMock.taskTemplate.update).not.toHaveBeenCalled();
    });

    it("宣言済みタスク承認時、+1XPボーナスが付与されること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        {
          id: "q-decl",
          status: "REPORTED",
          date: new Date("2026-05-09"),
          reportedAt: new Date("2026-05-09T05:00:00Z"),
          childId: "child-1",
          templateId: "tpl-1",
          deadlineBonusEarned: false,
          photoUrl: null,
          snapshotCategory: "STUDY",
        },
        { category: "STUDY", createdBy: "PARENT", photoBonus: false, isTemporary: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      // reportedAt の JST日付（2026-05-09）に対する宣言レコードあり
      prismaMock.questDeclaration.findUnique.mockResolvedValue(
        questDeclaration({ id: "decl-1", templateId: "tpl-1", childId: "child-1", date: new Date("2026-05-09") }),
      );
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q-decl", { action: "approve" }), makeParams("q-decl"));

      // 基本1pt + 宣言ボーナス1pt = 2pt
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 2 }),
      });
    });

    it("宣言なしのタスク承認時はボーナスなし（基本のみ）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        {
          id: "q-no-decl",
          status: "REPORTED",
          date: new Date("2026-05-09"),
          reportedAt: new Date("2026-05-09T05:00:00Z"),
          childId: "child-1",
          templateId: "tpl-1",
          deadlineBonusEarned: false,
          photoUrl: null,
          snapshotCategory: "STUDY",
        },
        { category: "STUDY", createdBy: "PARENT", photoBonus: false, isTemporary: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questDeclaration.findUnique.mockResolvedValue(null);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q-no-decl", { action: "approve" }), makeParams("q-no-decl"));

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 1 }),
      });
    });

    it("宣言あり + deadlineBonus + photoBonus を全部加算（最大4pt）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        {
          id: "q-decl-all",
          status: "REPORTED",
          date: new Date("2026-05-09"),
          reportedAt: new Date("2026-05-09T05:00:00Z"),
          childId: "child-1",
          templateId: "tpl-1",
          deadlineBonusEarned: true,
          photoUrl: "https://example.com/p.jpg",
          snapshotCategory: "LIFE",
        },
        { category: "LIFE", createdBy: "PARENT", photoBonus: true, isTemporary: false },
        childOverrides,
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue(quest.child);
      prismaMock.questDeclaration.findUnique.mockResolvedValue(questDeclaration({ id: "decl-2" }));
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q-decl-all", { action: "approve" }), makeParams("q-decl-all"));

      // 1 + 1 (deadline) + 1 (photo) + 1 (declaration) = 4
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ lifePt: 4 }),
      });
    });

    it("転生条件達成時にrebirthPending=trueをセットしstageをリセットしないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      // stage3でbasic 1pt追加 → total=19+1=20 >= REBIRTH_THRESHOLD(20) → 転生保留
      const quest = questWithTemplateAndChild(
        { id: "q-rebirth", status: "REPORTED", date: new Date("2026-03-26"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "STUDY" },
        { category: "STUDY", createdBy: "PARENT", photoBonus: false, isTemporary: false },
        {
          id: "child-1",
          evolutionPath: "STUDY_STAMINA_LIFE",
          evolutionStage: 3,
          studyPt: 19,
          staminaPt: 0,
          lifePt: 0,
          collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
        },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.user.findUnique.mockResolvedValue({
        ...quest.child,
        rebirthPending: false,
        rebirthEggBonus: null,
      });
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      const res = await POST(
        makeRequest("/api/approve/q-rebirth", { action: "approve" }),
        makeParams("q-rebirth"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      // 基本1pt → studyPt=20, total=20 >= REBIRTH_THRESHOLD(20) → rebirthPending=true
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "child-1" },
          data: expect.objectContaining({
            studyPt: 20,
            rebirthPending: true,
          }),
        }),
      );
      // evolutionStage はリセットされないこと
      const callArgs = prismaMock.user.update.mock.calls[0][0];
      expect(callArgs.data.evolutionStage).toBeUndefined();
    });

    it("スキーマ導入前の旧データ（snapshotCategory / monsterLevels 欠落）でも template.category / \"{}\" にフォールバックして承認できること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const childOverrides = { id: "child-1", evolutionPath: "", evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0, collectedPaths: "[]" };
      const quest = questWithTemplateAndChild(
        { id: "q-legacy", status: "REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1", deadlineBonusEarned: false, photoUrl: null },
        { category: "STAMINA", createdBy: "PARENT", photoBonus: false },
        childOverrides,
      );
      // snapshotCategory（Category, non-null）/ monsterLevels（String, @default("{}")）は
      // Prisma の生成型では必須フィールドだが、実データはこれらのカラムが追加される前に
      // 作成された行を含みうる。approve.ts の
      // `quest.snapshotCategory ?? quest.template.category` / `child.monsterLevels ?? "{}"`
      // はこの旧データ互換のための防御的フォールバックであり、生成型のままでは欠落を表現
      // できないため、この1テストに限り as unknown as で意図的に欠落を再現する。
      const legacyQuest = { ...quest, snapshotCategory: undefined } as unknown as typeof quest;
      const legacyChild = { ...quest.child, monsterLevels: undefined } as unknown as typeof quest.child;
      prismaMock.questInstance.findUnique.mockResolvedValue(legacyQuest);
      prismaMock.user.findUnique.mockResolvedValue(legacyChild);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.user.update.mockResolvedValue(quest.child);

      await POST(makeRequest("/api/approve/q-legacy", { action: "approve" }), makeParams("q-legacy"));

      // snapshotCategory欠落 → template.category (STAMINA) にフォールバックして staminaPt に加算
      // monsterLevels欠落 → "{}" 扱いで正常に更新される
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: expect.objectContaining({ staminaPt: 1, monsterLevels: "{}" }),
      });
    });
  });

  // ── スキップ申請の承認/差し戻し ─────────────────

  describe("SKIP_REPORTED", () => {
    it("スキップ申請を承認するとSKIPPEDに更新すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const quest = questWithTemplateAndChild(
        { id: "q-skip", status: "SKIP_REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY", createdBy: "PARENT" },
        { id: "child-1", evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.questInstance.update.mockResolvedValue(quest);

      const res = await POST(
        makeRequest("/api/approve/q-skip", { action: "approve" }),
        makeParams("q-skip"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(prismaMock.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q-skip" },
        data: { status: "SKIPPED", approvedAt: expect.any(Date) },
      });
      // XP付与されないこと
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("スキップ申請を差し戻すとPENDINGに戻しコメントをクリアすること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const quest = questWithTemplateAndChild(
        { id: "q-skip2", status: "SKIP_REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY", createdBy: "PARENT" },
        { id: "child-1", minTasksForStreak: 1, evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      prismaMock.questInstance.findMany.mockResolvedValue([
        questInstance({ status: "PENDING" }),
        questInstance({ status: "REPORTED" }),
        questInstance({ status: "REPORTED" }),
      ]);

      const res = await POST(
        makeRequest("/api/approve/q-skip2", { action: "reject" }),
        makeParams("q-skip2"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(prismaMock.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q-skip2" },
        data: { status: "PENDING", comment: null },
      });
    });

    // スキップ却下で reportedCount が落ちる (SKIP_REPORTED→PENDING) ため、
    // 既存 LOCKED 宝箱 (ALL_COMPLETE の boosted=false 等) を再評価する必要がある
    it("スキップ申請を差し戻すと cancelTreasuresOnReject を呼んで stale な LOCKED を整理する", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const dateJST = new Date("2026-03-13");
      const quest = questWithTemplateAndChild(
        { id: "q-skip3", status: "SKIP_REPORTED", date: dateJST, childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY", createdBy: "PARENT" },
        { id: "child-1", minTasksForStreak: 1, evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      // 却下後の集計: 3 件中 PENDING (戻った本人) + REPORTED 1 + REPORTED 1
      //   → reportedCount=2, totalCount=3, skippedCount=0
      prismaMock.questInstance.findMany.mockResolvedValue([
        questInstance({ status: "PENDING" }),
        questInstance({ status: "REPORTED" }),
        questInstance({ status: "REPORTED" }),
      ]);

      await POST(
        makeRequest("/api/approve/q-skip3", { action: "reject" }),
        makeParams("q-skip3"),
      );

      expect(mockCancelTreasures).toHaveBeenCalledWith({
        childId: "child-1",
        date: dateJST,
        reportedCount: 2,
        totalCount: 3,
        skippedCount: 0,
        minTasks: 1,
        isProxy: false,
      });
      // 差し戻し用の集計も子供画面と同じ template.isActive / pausedAt フィルタで絞る
      const findManyCall = prismaMock.questInstance.findMany.mock.calls[0][0];
      expect(findManyCall?.where?.template).toEqual({ isActive: true, pausedAt: null });
    });

    it("スキップ申請承認 (SKIPPED) では cancelTreasuresOnReject を呼ばない", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const quest = questWithTemplateAndChild(
        { id: "q-skip-ok", status: "SKIP_REPORTED", date: new Date("2026-03-13"), childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY", createdBy: "PARENT" },
        { id: "child-1", minTasksForStreak: 1, evolutionPath: "", evolutionStage: 0, studyPt: 0, staminaPt: 0, lifePt: 0 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.questInstance.update.mockResolvedValue(quest);

      await POST(
        makeRequest("/api/approve/q-skip-ok", { action: "approve" }),
        makeParams("q-skip-ok"),
      );
      // SKIP_REPORTED→SKIPPED は reportedCount も skippedCount も変えないので再評価不要
      expect(mockCancelTreasures).not.toHaveBeenCalled();
    });
  });

  // ── 差し戻し（リジェクト）───────────────────
  // XPは承認時付与のため、差し戻しではステータス変更のみ

  describe("action: reject", () => {
    it("rejectionReason なしで400を返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const quest = questWithTemplateAndChild(
        { id: "q4", status: "REPORTED", childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY" },
        { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);

      const res = await POST(
        makeRequest("/api/approve/q4", { action: "reject" }),
        makeParams("q4"),
      );
      expect(res.status).toBe(400);
      expect(prismaMock.questInstance.update).not.toHaveBeenCalled();
    });

    it("クエストをREJECTEDに更新しrejectionReasonを保存すること（XP差し引きなし）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const quest = questWithTemplateAndChild(
        { id: "q4", status: "REPORTED", childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY" },
        { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.questInstance.update.mockResolvedValue(quest);

      const res = await POST(
        makeRequest("/api/approve/q4", { action: "reject", rejectionReason: "写真が暗くてよく見えないよ" }),
        makeParams("q4"),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(prismaMock.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q4" },
        data: { status: "REJECTED", rejectionReason: "写真が暗くてよく見えないよ" },
      });
      // XPは承認時付与のため差し引き不要
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("その他を選択し追加メッセージなしで400を返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const quest = questWithTemplateAndChild(
        { id: "q4b", status: "REPORTED", childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY" },
        { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);

      const res = await POST(
        makeRequest("/api/approve/q4b", { action: "reject", rejectionReason: "その他" }),
        makeParams("q4b"),
      );
      expect(res.status).toBe(400);
    });

    it("その他＋追加メッセージでREJECTEDに更新すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const quest = questWithTemplateAndChild(
        { id: "q4c", status: "REPORTED", childId: "child-1", templateId: "tpl-1" },
        { category: "STUDY" },
        { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.questInstance.update.mockResolvedValue(quest);

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
      expect(prismaMock.questInstance.update).toHaveBeenCalledWith({
        where: { id: "q4c" },
        data: { status: "REJECTED", rejectionReason: "算数プリントだけやってね" },
      });
    });

    it("差し戻し後の当日進捗を集計して cancelTreasuresOnReject を呼ぶ", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      const dateJST = new Date("2026-03-13");
      const quest = questWithTemplateAndChild(
        { id: "q-rej", status: "REPORTED", childId: "child-1", templateId: "tpl-1", date: dateJST },
        { category: "STUDY" },
        { id: "child-1", minTasksForStreak: 1, studyPt: 0, staminaPt: 0, lifePt: 0 },
      );
      prismaMock.questInstance.findUnique.mockResolvedValue(quest);
      prismaMock.questInstance.update.mockResolvedValue(quest);
      // 差し戻し後の集計: 当日 3個中 PENDING (差し戻し後) + REPORTED 1個 + PENDING 1個 → reportedCount=1, totalCount=3
      prismaMock.questInstance.findMany.mockResolvedValue([
        questInstance({ status: "PENDING" }),
        questInstance({ status: "REPORTED" }),
        questInstance({ status: "PENDING" }),
      ]);

      await POST(
        makeRequest("/api/approve/q-rej", { action: "reject", rejectionReason: "がんばろう" }),
        makeParams("q-rej"),
      );

      expect(mockCancelTreasures).toHaveBeenCalledWith({
        childId: "child-1",
        date: dateJST,
        reportedCount: 1,
        totalCount: 3,
        skippedCount: 0,
        minTasks: 1,
        isProxy: false,
      });
      const findManyCall = prismaMock.questInstance.findMany.mock.calls[0][0];
      expect(findManyCall?.where?.template).toEqual({ isActive: true, pausedAt: null });
    });
  });
});
