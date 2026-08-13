import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as getToday } from "@/app/api/quests/today/route";
import { POST as skipQuest } from "@/app/api/quests/[id]/skip/route";
import { GET as getPending } from "@/app/api/approve/pending/route";
import { POST as approveQuest } from "@/app/api/approve/[id]/route";
import type { Family, TaskTemplate, User } from "@/generated/prisma/client";
import {
  prisma,
  mockAsUser,
  seedFamily,
  seedTask,
  cleanAll,
  makeRequest,
  makeParams,
} from "./helpers";

/** GET /api/quests/today, GET /api/approve/pending のレスポンス JSON のうちテストで参照するフィールドのみ */
type QuestJson = { id: string; status: string; template: { id: string } };

describe("スキップフロー（申請→親承認→SKIPPED）", () => {
  let family: Family;
  let parent: User;
  let child: User;
  let task: TaskTemplate;
  let questId: string;

  beforeAll(async () => {
    await cleanAll();
    ({ family, parent, child } = await seedFamily());
    task = await seedTask(family.id, { assignedChildId: child.id });

    // クエスト生成
    mockAsUser({ ...child, family });
    const res = await getToday();
    const quests: QuestJson[] = await res.json();
    questId = quests.find((q) => q.template.id === task.id)!.id;
  });

  afterAll(async () => {
    await cleanAll();
  });

  it("子供がスキップ申請するとSKIP_REPORTEDになること", async () => {
    mockAsUser({ ...child, family });

    const req = new Request(`http://localhost/api/quests/${questId}/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "体調が悪い" }),
    });
    const res = await skipQuest(req, makeParams(questId));
    const json = await res.json();

    expect(json.ok).toBe(true);

    const quest = await prisma.questInstance.findUnique({ where: { id: questId } });
    expect(quest!.status).toBe("SKIP_REPORTED");
    expect(quest!.reportedAt).toBeTruthy();
  });

  it("親の承認待ちリストにスキップ申請が表示されること", async () => {
    mockAsUser({ ...parent, family, role: "PARENT" });

    const res = await getPending();
    const pending: QuestJson[] = await res.json();

    const quest = pending.find((q) => q.id === questId);
    expect(quest).toBeDefined();
    expect(quest!.status).toBe("SKIP_REPORTED");
  });

  it("親が承認するとSKIPPEDになりXPは付与されないこと", async () => {
    mockAsUser({ ...parent, family, role: "PARENT" });

    const res = await approveQuest(
      makeRequest(`/api/approve/${questId}`, { action: "approve" }),
      makeParams(questId),
    );
    const json = await res.json();

    expect(json.ok).toBe(true);

    // DB確認: ステータス
    const quest = await prisma.questInstance.findUnique({ where: { id: questId } });
    expect(quest!.status).toBe("SKIPPED");
    expect(quest!.approvedAt).toBeTruthy();

    // DB確認: XPは増えていない（0のまま）
    const updatedChild = await prisma.user.findUnique({ where: { id: child.id } });
    expect(updatedChild!.studyPt).toBe(0);
    expect(updatedChild!.staminaPt).toBe(0);
    expect(updatedChild!.lifePt).toBe(0);
  });

  it("スキップ承認後もストリークに算入されること", async () => {
    const streak = await prisma.streak.findUnique({ where: { childId: child.id } });
    expect(streak).toBeTruthy();
    expect(streak!.currentStreak).toBe(1);
  });
});
