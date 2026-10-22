import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  approveQuestInstance,
  approveSkipQuestInstance,
  transitionQuestStatus,
} from "@/lib/approve";
import type { QuestWithRelations } from "@/lib/approve";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";
import { unlockTreasuresOnApprove } from "@/lib/treasureService";
import { prismaMock } from "@/__tests__/helpers/prisma-mock";
import { childUser, questInstance } from "@/__tests__/helpers/fixtures";

// #183: 承認の status 遷移をアトミックにする

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

const mockPrisma = prismaMock;
const mockRecordDailyAchievement = vi.mocked(recordDailyAchievement);
const mockRecordTaskStreak = vi.mocked(recordTaskStreak);
const mockUnlockTreasures = vi.mocked(unlockTreasuresOnApprove);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue(childUser());
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

describe("transitionQuestStatus", () => {
  it("遷移できたとき true を返し、status 条件付き where で更新すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    const ok = await transitionQuestStatus("q-1", ["REPORTED"], { status: "REJECTED" });
    expect(ok).toBe(true);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q-1", status: { in: ["REPORTED"] } },
      data: { status: "REJECTED" },
    });
  });

  it("P2025 のとき false を返すこと", async () => {
    mockPrisma.questInstance.update.mockRejectedValue(p2025());
    expect(await transitionQuestStatus("q-1", ["REPORTED"], { status: "REJECTED" })).toBe(false);
  });

  it("P2025 以外のエラーは再スローすること", async () => {
    mockPrisma.questInstance.update.mockRejectedValue(
      Object.assign(new Error("x"), { code: "P2002" }),
    );
    await expect(
      transitionQuestStatus("q-1", ["REPORTED"], { status: "REJECTED" }),
    ).rejects.toThrow("x");
    mockPrisma.questInstance.update.mockRejectedValue(new Error("boom"));
    await expect(
      transitionQuestStatus("q-1", ["REPORTED"], { status: "REJECTED" }),
    ).rejects.toThrow("boom");
  });
});

describe("approveQuestInstance のレース対策", () => {
  it("成功時 true を返し、既定の遷移元は REPORTED であること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());
    expect(await approveQuestInstance(baseQuest)).toBe(true);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q-1", status: { in: ["REPORTED"] } } }),
    );
  });

  it("options.fromStatuses を where に反映すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());
    await approveQuestInstance(baseQuest, undefined, {
      fromStatuses: ["PENDING", "REJECTED", "REPORTED"],
    });
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-1", status: { in: ["PENDING", "REJECTED", "REPORTED"] } },
      }),
    );
  });

  it("遷移に負けたら false を返し、XP・ストリーク・宝箱を一切処理しないこと", async () => {
    mockPrisma.questInstance.update.mockRejectedValue(p2025());
    expect(await approveQuestInstance(baseQuest)).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.taskTemplate.update).not.toHaveBeenCalled();
    expect(mockRecordDailyAchievement).not.toHaveBeenCalled();
    expect(mockRecordTaskStreak).not.toHaveBeenCalled();
    expect(mockUnlockTreasures).not.toHaveBeenCalled();
  });

  it("P2025 以外のエラーは再スローすること", async () => {
    mockPrisma.questInstance.update.mockRejectedValue(new Error("db down"));
    await expect(approveQuestInstance(baseQuest)).rejects.toThrow("db down");
  });
});

describe("approveSkipQuestInstance のレース対策", () => {
  const skipQuest = { ...baseQuest, status: "SKIP_REPORTED" as const };

  it("成功時 true、既定の遷移元は SKIP_REPORTED であること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    expect(await approveSkipQuestInstance(skipQuest)).toBe(true);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q-1", status: { in: ["SKIP_REPORTED"] } } }),
    );
  });

  it("options.fromStatuses を where に反映すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    await approveSkipQuestInstance(skipQuest, { fromStatuses: ["PENDING", "SKIP_REPORTED"] });
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-1", status: { in: ["PENDING", "SKIP_REPORTED"] } },
      }),
    );
  });

  it("遷移に負けたら false を返し、achievement / 宝箱を処理しないこと", async () => {
    mockPrisma.questInstance.update.mockRejectedValue(p2025());
    expect(await approveSkipQuestInstance(skipQuest)).toBe(false);
    expect(mockRecordDailyAchievement).not.toHaveBeenCalled();
    expect(mockUnlockTreasures).not.toHaveBeenCalled();
  });

  it("P2025 以外は再スローすること", async () => {
    mockPrisma.questInstance.update.mockRejectedValue(new Error("db down"));
    await expect(approveSkipQuestInstance(skipQuest)).rejects.toThrow("db down");
  });
});
