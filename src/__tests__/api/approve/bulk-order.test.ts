import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/approve/bulk/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, questWithTemplateAndChild } from "../../helpers/fixtures";

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

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

const makeQuest = (id: string, date: string) =>
  questWithTemplateAndChild(
    {
      id,
      date: new Date(date),
      childId: "child-1",
      templateId: `tpl-${id}`,
      status: "REPORTED",
      deadlineBonusEarned: false,
      photoUrl: null,
    },
    {
      id: `tpl-${id}`,
      category: "STUDY",
      createdBy: "PARENT",
      photoBonus: false,
      isTemporary: false,
    },
    {
      id: "child-1",
      evolutionStage: 1,
      evolutionPath: "STUDY",
      collectedPaths: "[]",
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
    },
  );

describe("POST /api/approve/bulk: 承認順（#188）", () => {
  it("入力順に関わらずクエストを date 昇順で承認する", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const qNew = makeQuest("q-new", "2026-10-20");
    const qOld = makeQuest("q-old", "2026-10-19");
    prismaMock.questInstance.findUnique
      .mockResolvedValueOnce(qNew)
      .mockResolvedValueOnce(qOld);
    prismaMock.user.findUnique.mockResolvedValue({ ...qNew.child, studyPt: 0 });
    prismaMock.questInstance.update.mockResolvedValue(qNew);
    prismaMock.user.update.mockResolvedValue(qNew.child);

    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q-new", "q-old"] }));
    const json = await res.json();

    expect(json).toEqual({ ok: true, count: 2 });
    const order = prismaMock.questInstance.update.mock.calls.map((c) => c[0].where.id);
    expect(order).toEqual(["q-old", "q-new"]);
  });
});
