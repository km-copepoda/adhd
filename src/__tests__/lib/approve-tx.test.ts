import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { approveQuestInstance } from "@/lib/approve";
import type { QuestWithRelations } from "@/lib/approve";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";
import { checkAndUnlockBadges } from "@/lib/badges";
import { unlockTreasuresOnApprove } from "@/lib/treasureService";
import { lockUserForUpdate } from "@/lib/rowLock";
import { checkEvolution } from "@/lib/evolution";
import { prismaMock } from "@/__tests__/helpers/prisma-mock";
import { childUser, questInstance } from "@/__tests__/helpers/fixtures";

// #183: XP 更新を status 遷移と同一トランザクション内で、User 行ロック後の最新値に対して行う

vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/treasureService", () => ({
  unlockTreasuresOnApprove: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/rowLock", () => ({
  lockUserForUpdate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/evolution", async () => {
  const actual = await vi.importActual<typeof import("@/lib/evolution")>("@/lib/evolution");
  return { ...actual, checkEvolution: vi.fn(actual.checkEvolution) };
});

const mockLock = vi.mocked(lockUserForUpdate);
const mockCheckEvolution = vi.mocked(checkEvolution);

let tx: DeepMockProxy<PrismaClient>;

beforeEach(() => {
  vi.clearAllMocks();
  tx = mockDeep<PrismaClient>();
  // コールバック形式の $transaction には、prismaMock とは別の tx を渡す
  (
    prismaMock.$transaction as unknown as {
      mockImplementation: (fn: (ops: unknown) => Promise<unknown>) => void;
    }
  ).mockImplementation((ops) =>
    typeof ops === "function"
      ? (ops as (t: unknown) => Promise<unknown>)(tx)
      : Promise.all(ops as unknown[]),
  );
  prismaMock.questDeclaration.findUnique.mockResolvedValue(null);
  tx.questInstance.update.mockResolvedValue(questInstance());
  tx.user.findUnique.mockResolvedValue(childUser());
  tx.user.update.mockResolvedValue(childUser());
});

const baseQuest: QuestWithRelations = {
  id: "q-1",
  date: new Date("2026-03-21"),
  childId: "child-1",
  templateId: "tpl-1",
  deadlineBonusEarned: false,
  photoUrl: null,
  snapshotCategory: "STUDY",
  template: {
    id: "tpl-1",
    category: "STUDY",
    photoBonus: false,
    createdBy: "PARENT",
    isTemporary: false,
    repeatDays: [1, 2, 3, 4, 5],
    carryOver: false,
  },
  child: {
    id: "child-1",
    evolutionStage: 0,
    evolutionPath: "",
    collectedPaths: "[]",
    studyPt: 0,
    staminaPt: 0,
    lifePt: 0,
  },
};

function p2025(): Error {
  return Object.assign(new Error("Record to update not found."), { code: "P2025" });
}

function order(fn: unknown): number {
  return (fn as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0];
}

describe("approveQuestInstance: 単一トランザクション", () => {
  it("遷移・ロック・読み直し・user.update・taskTemplate.update がすべて同じ tx 経由で、遷移→ロック→読み直し→更新の順であること", async () => {
    const quest = { ...baseQuest, template: { ...baseQuest.template, createdBy: "CHILD" as const } };
    expect(await approveQuestInstance(quest)).toBe(true);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof vi.mocked(prismaMock.$transaction).mock.calls[0][0]).toBe("function");

    expect(tx.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-1", status: { in: ["REPORTED"] } },
        data: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
    expect(mockLock).toHaveBeenCalledTimes(1);
    expect(mockLock).toHaveBeenCalledWith(tx, "child-1");
    expect(tx.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "child-1" } }),
    );
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "tpl-1" },
      data: { createdBy: "PARENT" },
    });

    // グローバル prisma 経由では書かない・読まない
    expect(prismaMock.questInstance.update).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.taskTemplate.update).not.toHaveBeenCalled();

    const transition = order(tx.questInstance.update);
    const lock = order(mockLock);
    const reread = order(tx.user.findUnique);
    const write = order(tx.user.update);
    const tpl = order(tx.taskTemplate.update);
    expect(transition).toBeLessThan(lock);
    expect(lock).toBeLessThan(reread);
    expect(reread).toBeLessThan(write);
    expect(write).toBeLessThan(tpl);
  });

  it("宣言ボーナスの読み取りはトランザクション前（グローバル prisma）で行うこと", async () => {
    await approveQuestInstance(baseQuest);
    expect(prismaMock.questDeclaration.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.questDeclaration.findUnique).not.toHaveBeenCalled();
  });

  it("遷移に負けたら（P2025）ロック・XP 更新をせず false を返すこと", async () => {
    tx.questInstance.update.mockRejectedValue(p2025());
    expect(await approveQuestInstance(baseQuest)).toBe(false);
    expect(mockLock).not.toHaveBeenCalled();
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.taskTemplate.update).not.toHaveBeenCalled();
    expect(recordDailyAchievement).not.toHaveBeenCalled();
    expect(unlockTreasuresOnApprove).not.toHaveBeenCalled();
  });

  it("遷移が P2025 以外で失敗したら再スローし、ロックしないこと", async () => {
    tx.questInstance.update.mockRejectedValue(new Error("db down"));
    await expect(approveQuestInstance(baseQuest)).rejects.toThrow("db down");
    expect(mockLock).not.toHaveBeenCalled();
  });

  it("tx 内で child が見つからなければ throw し、後続処理を行わないこと", async () => {
    tx.user.findUnique.mockResolvedValue(null);
    await expect(approveQuestInstance(baseQuest)).rejects.toThrow();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(recordDailyAchievement).not.toHaveBeenCalled();
    expect(unlockTreasuresOnApprove).not.toHaveBeenCalled();
  });

  it("tx 内の user.update が throw したら throw し、ストリーク・宝箱アンロック・バッジを呼ばないこと", async () => {
    tx.user.update.mockRejectedValue(new Error("update failed"));
    await expect(approveQuestInstance(baseQuest)).rejects.toThrow("update failed");
    expect(recordDailyAchievement).not.toHaveBeenCalled();
    expect(recordTaskStreak).not.toHaveBeenCalled();
    expect(unlockTreasuresOnApprove).not.toHaveBeenCalled();
    expect(checkAndUnlockBadges).not.toHaveBeenCalled();
  });

  it("コミット後（勝者のみ）にストリーク・宝箱アンロック・バッジが呼ばれること", async () => {
    expect(await approveQuestInstance(baseQuest)).toBe(true);
    expect(recordDailyAchievement).toHaveBeenCalledTimes(1);
    expect(recordTaskStreak).toHaveBeenCalledTimes(1);
    expect(unlockTreasuresOnApprove).toHaveBeenCalledTimes(1);
    expect(checkAndUnlockBadges).toHaveBeenCalledWith("child-1");
  });
});

describe("approveQuestInstance: XP は tx 内で読み直した最新値に加算される", () => {
  it("読み直しで studyPt が増えていれば、書き込み値は読み直した値 + xp（claim 前の古い値ではない）", async () => {
    // 呼び出し元スナップショットは studyPt: 0。ロック後の読み直しでは 3 になっている
    tx.user.findUnique.mockResolvedValue(childUser({ evolutionStage: 1, studyPt: 3 }));
    await approveQuestInstance(baseQuest); // xp = 1
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 4 }),
      }),
    );
  });

  it("カテゴリ外のポイントは読み直した値のまま保持されること", async () => {
    tx.user.findUnique.mockResolvedValue(childUser({ evolutionStage: 1, studyPt: 3, staminaPt: 2, lifePt: 1 }));
    await approveQuestInstance(baseQuest);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studyPt: 4, staminaPt: 2, lifePt: 1 }),
      }),
    );
  });
});

describe("approveQuestInstance: 進化チェックリストが tx 内で維持される", () => {
  it("rebirthPending なら XP のみ加算し、checkEvolution を呼ばないこと", async () => {
    tx.user.findUnique.mockResolvedValue(childUser({ rebirthPending: true, studyPt: 7 }));
    await approveQuestInstance(baseQuest);
    expect(mockCheckEvolution).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    const data = tx.user.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.studyPt).toBe(8);
    expect(data).not.toHaveProperty("evolutionStage");
    expect(data).not.toHaveProperty("rebirthPending");
  });

  it("isReborn（collectedPaths 非空）と rebirthEggBonus を checkEvolution に渡すこと", async () => {
    tx.user.findUnique.mockResolvedValue(
      childUser({ collectedPaths: '["a"]', rebirthEggBonus: "bonus-x", studyPt: 2 }),
    );
    await approveQuestInstance(baseQuest);
    expect(mockCheckEvolution).toHaveBeenCalledWith(0, "", 3, 0, 0, true, "bonus-x");
  });

  it("進化したら collectedPaths と monsterLevels を更新して tx.user.update に書くこと", async () => {
    mockCheckEvolution.mockReturnValueOnce({
      evolved: true,
      reborn: false,
      newStage: 3,
      newPath: "study_path",
      resetStudy: 0,
      resetStamina: 0,
      resetLife: 0,
    } as never);
    await approveQuestInstance(baseQuest);
    const data = tx.user.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.evolutionStage).toBe(3);
    expect(data.evolutionPath).toBe("study_path");
    expect(
      (JSON.parse(data.collectedPaths as string) as string[]).some((p) => p.endsWith("study_path")),
    ).toBe(true);
    expect(Object.keys(JSON.parse(data.monsterLevels as string)).length).toBeGreaterThan(0);
  });

  it("転生閾値到達なら rebirthPending=true をセットし、ステージはリセットしないこと", async () => {
    mockCheckEvolution.mockReturnValueOnce({
      evolved: false,
      reborn: true,
      newStage: 3,
      newPath: "p",
      resetStudy: 0,
      resetStamina: 0,
      resetLife: 0,
    } as never);
    await approveQuestInstance(baseQuest);
    const data = tx.user.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.rebirthPending).toBe(true);
    expect(data).not.toHaveProperty("evolutionStage");
  });
});
