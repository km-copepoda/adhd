import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as getToday } from "@/app/api/quests/today/route";
import { POST as reportQuest } from "@/app/api/quests/[id]/report/route";
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
type QuestJson = {
  id: string;
  status: string;
  template: { id: string; title: string };
  child?: { name: string };
};

describe("クエストフロー（報告→承認→XP付与）", () => {
  let family: Family;
  let parent: User;
  let child: User;
  let task: TaskTemplate;

  beforeAll(async () => {
    await cleanAll();
    ({ family, parent, child } = await seedFamily());
    task = await seedTask(family.id, {
      category: "STUDY",
      assignedChildId: child.id,
    });
  });

  afterAll(async () => {
    await cleanAll();
  });

  it("子供が今日のクエストを取得し、QuestInstanceが自動生成されること", async () => {
    mockAsUser({ ...child, family });

    const res = await getToday();
    const quests: QuestJson[] = await res.json();

    expect(quests.length).toBeGreaterThanOrEqual(1);
    const quest = quests.find((q) => q.template.id === task.id);
    expect(quest).toBeDefined();
    expect(quest!.status).toBe("PENDING");
    expect(quest!.template.title).toBe("テストタスク");
  });

  it("子供がクエストを報告し、ステータスがREPORTEDになること", async () => {
    mockAsUser({ ...child, family });

    // まずクエストIDを取得
    const todayRes = await getToday();
    const quests: QuestJson[] = await todayRes.json();
    const quest = quests.find((q) => q.template.id === task.id);

    const res = await reportQuest(
      makeRequest(`/api/quests/${quest!.id}/report`, { comment: "やったよ！" }),
      makeParams(quest!.id),
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.xpAdded).toBe(1); // 基本1pt（期限ボーナス・写真ボーナスなし）

    // DB確認
    const updated = await prisma.questInstance.findUnique({ where: { id: quest!.id } });
    expect(updated!.status).toBe("REPORTED");
    expect(updated!.comment).toBe("やったよ！");
  });

  it("親の承認待ちリストにREPORTEDクエストが表示されること", async () => {
    mockAsUser({ ...parent, family, role: "PARENT" });

    const res = await getPending();
    const pending: QuestJson[] = await res.json();

    expect(pending.length).toBeGreaterThanOrEqual(1);
    const quest = pending.find((q) => q.template.title === "テストタスク");
    expect(quest).toBeDefined();
    expect(quest!.child!.name).toBe("テスト子");
  });

  it("親が承認するとAPPROVEDになりXPが付与されること", async () => {
    mockAsUser({ ...parent, family, role: "PARENT" });

    // 承認待ちのクエストIDを取得
    const pendingRes = await getPending();
    const pending: QuestJson[] = await pendingRes.json();
    const quest = pending.find((q) => q.template.title === "テストタスク");

    const res = await approveQuest(
      makeRequest(`/api/approve/${quest!.id}`, { action: "approve" }),
      makeParams(quest!.id),
    );
    const json = await res.json();

    expect(json.ok).toBe(true);

    // DB確認: クエストステータス
    const updatedQuest = await prisma.questInstance.findUnique({ where: { id: quest!.id } });
    expect(updatedQuest!.status).toBe("APPROVED");
    expect(updatedQuest!.approvedAt).toBeTruthy();

    // DB確認: XP付与（STUDY 1pt）→ stage0の孵化閾値1ptに達して進化→全ptリセット
    const updatedChild = await prisma.user.findUnique({ where: { id: child.id } });
    expect(updatedChild!.studyPt).toBe(0);
    expect(updatedChild!.staminaPt).toBe(0);
    expect(updatedChild!.lifePt).toBe(0);
  });

  it("承認後、承認待ちリストからクエストが消えること", async () => {
    mockAsUser({ ...parent, family, role: "PARENT" });

    const res = await getPending();
    const pending: QuestJson[] = await res.json();

    const quest = pending.find((q) => q.template.title === "テストタスク");
    expect(quest).toBeUndefined();
  });
});
