import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as approveQuest } from "@/app/api/approve/[id]/route";
import {
  prisma,
  mockAsUser,
  seedFamily,
  seedTask,
  seedQuestForDate,
  cleanAll,
  makeRequest,
  makeParams,
} from "./helpers";

describe("ストリークフロー（連続達成→マイルストーン）", () => {
  let family: any;
  let parent: any;
  let child: any;
  let task: any;

  beforeAll(async () => {
    await cleanAll();
    ({ family, parent, child } = await seedFamily());
    // マイルストーンボーナスで進化を起こすため、stage1・studyPt=6からスタートする
    // 各承認で+1pt（計3日で+3pt=9pt）、ストリーク3のボーナス+5ptで計14pt ≥ 10pt → 進化
    await prisma.user.update({
      where: { id: child.id },
      data: { evolutionStage: 1, evolutionPath: "STUDY", studyPt: 6 },
    });
    task = await seedTask(family.id, { category: "STUDY" });
  });

  afterAll(async () => {
    await cleanAll();
  });

  it("1日目: クエスト承認でストリーク1になること", async () => {
    const day1 = new Date("2026-03-13");
    const quest = await seedQuestForDate(task.id, child.id, day1, "REPORTED");

    mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
    const res = await approveQuest(
      makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
      makeParams(quest.id),
    );
    expect((await res.json()).ok).toBe(true);

    const streak = await prisma.streak.findUnique({ where: { childId: child.id } });
    expect(streak!.currentStreak).toBe(1);
    expect(streak!.bestStreak).toBe(1);
  });

  it("2日目: 連続承認でストリーク2になること", async () => {
    const day2 = new Date("2026-03-14");
    const quest = await seedQuestForDate(task.id, child.id, day2, "REPORTED");

    mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
    await approveQuest(
      makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
      makeParams(quest.id),
    );

    const streak = await prisma.streak.findUnique({ where: { childId: child.id } });
    expect(streak!.currentStreak).toBe(2);
    expect(streak!.bestStreak).toBe(2);
  });

  it("3日目: ストリーク3達成でマイルストーンボーナスXPが付与されること", async () => {
    // 承認前の状態を記録
    const beforeChild = await prisma.user.findUnique({ where: { id: child.id } });
    const beforeStage = beforeChild!.evolutionStage;

    const day3 = new Date("2026-03-15");
    const quest = await seedQuestForDate(task.id, child.id, day3, "REPORTED");

    mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
    await approveQuest(
      makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
      makeParams(quest.id),
    );

    const streak = await prisma.streak.findUnique({ where: { childId: child.id } });
    expect(streak!.currentStreak).toBe(3);
    expect(streak!.bestStreak).toBe(3);

    // マイルストーンボーナス(+5pt)が付与された証拠として進化を確認:
    // 承認XPだけなら 8+1=9pt < 進化閾値10pt → 進化しない
    // マイルストーンボーナス込みで 9+5=14pt >= 10pt → 進化発生（XPリセット）
    const afterChild = await prisma.user.findUnique({ where: { id: child.id } });
    expect(afterChild!.evolutionStage).toBe(beforeStage + 1);
    // 進化によりXPはリセットされる
    expect(afterChild!.studyPt + afterChild!.staminaPt + afterChild!.lifePt).toBe(0);
  });

  it("1日空けるとストリークがリセットされること", async () => {
    // day4（3/16）をスキップして day5（3/17）に承認
    const day5 = new Date("2026-03-17");
    const quest = await seedQuestForDate(task.id, child.id, day5, "REPORTED");

    mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
    await approveQuest(
      makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
      makeParams(quest.id),
    );

    const streak = await prisma.streak.findUnique({ where: { childId: child.id } });
    expect(streak!.currentStreak).toBe(1); // リセット
    expect(streak!.bestStreak).toBe(3);    // 最高記録は保持
  });

  it("スキップ承認もストリーク連続にカウントされること", async () => {
    // day6（3/18）をスキップ承認
    const day6 = new Date("2026-03-18");
    const quest = await seedQuestForDate(task.id, child.id, day6, "SKIP_REPORTED");

    mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
    await approveQuest(
      makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
      makeParams(quest.id),
    );

    const dbQuest = await prisma.questInstance.findUnique({ where: { id: quest.id } });
    expect(dbQuest!.status).toBe("SKIPPED");

    const streak = await prisma.streak.findUnique({ where: { childId: child.id } });
    expect(streak!.currentStreak).toBe(2); // 昨日(day5)の続き
  });
});
