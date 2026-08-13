import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as approveQuest } from "@/app/api/approve/[id]/route";
import { POST as rebirthQuest } from "@/app/api/rebirth/route";
import type { Family, TaskTemplate, User } from "@/generated/prisma/client";
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

describe("転生フロー（閾値到達 → 卵選択 → 転生実行）", () => {
  let family: Family;
  let parent: User;
  let child: User;
  let task: TaskTemplate;

  beforeAll(async () => {
    await cleanAll();
    ({ family, parent, child } = await seedFamily());
    // 最終形態（stage3）・studyPt=19（転生閾値20ptの手前）に設定
    await prisma.user.update({
      where: { id: child.id },
      data: {
        evolutionStage: 3,
        evolutionPath: "STUDY_STUDY_STUDY",
        studyPt: 19,
      },
    });
    task = await seedTask(family.id, { category: "STUDY" });
  });

  afterAll(async () => {
    await cleanAll();
  });

  it("STUDYクエスト承認で転生閾値に達し、rebirthPendingがtrueになること", async () => {
    const day1 = new Date("2026-04-01");
    const quest = await seedQuestForDate(task.id, child.id, day1, "REPORTED");

    mockAsUser({ ...parent, family, role: "PARENT" });
    const res = await approveQuest(
      makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
      makeParams(quest.id),
    );
    expect((await res.json()).ok).toBe(true);

    // rebirthPendingがtrueになり、stage・XPはそのまま（まだリセットしない）
    const updatedChild = await prisma.user.findUnique({ where: { id: child.id } });
    expect(updatedChild!.rebirthPending).toBe(true);
    expect(updatedChild!.evolutionStage).toBe(3);
    expect(updatedChild!.evolutionPath).toBe("STUDY_STUDY_STUDY");
    expect(updatedChild!.studyPt).toBe(20); // 19+1
  });

  it("rebirthPending中に承認されてもXPだけ加算され、進化チェックがスキップされること", async () => {
    const day2 = new Date("2026-04-02");
    const quest = await seedQuestForDate(task.id, child.id, day2, "REPORTED");

    mockAsUser({ ...parent, family, role: "PARENT" });
    await approveQuest(
      makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
      makeParams(quest.id),
    );

    const updatedChild = await prisma.user.findUnique({ where: { id: child.id } });
    expect(updatedChild!.studyPt).toBe(21); // 20+1
    expect(updatedChild!.rebirthPending).toBe(true);
    expect(updatedChild!.evolutionStage).toBe(3);
  });

  it("POST /api/rebirth で卵(STUDY)を選択すると転生が完了しstage/ptsがリセットされること", async () => {
    mockAsUser({ ...child, family, role: "CHILD" });

    const res = await rebirthQuest(makeRequest("/api/rebirth", { eggType: "STUDY" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    const updatedChild = await prisma.user.findUnique({ where: { id: child.id } });
    expect(updatedChild!.rebirthPending).toBe(false);
    expect(updatedChild!.rebirthEggBonus).toBe("STUDY");
    expect(updatedChild!.evolutionStage).toBe(0);
    expect(updatedChild!.evolutionPath).toBe("");
    expect(updatedChild!.studyPt).toBe(0);
    expect(updatedChild!.staminaPt).toBe(0);
    expect(updatedChild!.lifePt).toBe(0);
  });

  it("転生完了後（rebirthPending=false）にPOST /api/rebirthを呼ぶと400を返すこと", async () => {
    mockAsUser({ ...child, family, role: "CHILD" });

    const res = await rebirthQuest(makeRequest("/api/rebirth", { eggType: "STAMINA" }));
    expect(res.status).toBe(400);
  });
});
