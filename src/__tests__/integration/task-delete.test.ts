import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DELETE as deleteTask } from "@/app/api/tasks/[id]/route";
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

describe("タスク削除時のXP回復（CHILD作成タスクの却下）", () => {
    let family: any;
    let parent: any;
    let child: any;

    beforeAll(async () => {
        await cleanAll();
        ({ family, parent, child } = await seedFamily());
    });

    afterAll(async () => {
        await cleanAll();
    });

    it("CHILDタスクの削除で、APPROVEDクエストのXPのみ回収されること（REPORTEDは対象外）", async () => {
        // CHILD作成タスクを作成
        const task = await seedTask(family.id, {
            category: "STUDY",
            createdBy: "CHILD",
            assignedChildId: child.id,
        });

        // APPROVEDクエスト（XP付与済み想定）とREPORTEDクエスト（XP未付与）
        const quest1 = await seedQuestForDate(task.id, child.id, new Date("2026-04-01"), "APPROVED");
        const quest2 = await seedQuestForDate(task.id, child.id, new Date("2026-04-02"), "REPORTED");

        // APPROVE分のXPを手動設定（approveQuest経由だとcreatedByがPARENTに代わるため）
        await prisma.user.update({
            where: { id: child.id },
            data: { studyPt: 1, staminaPt: 0, lifePt: 0 },
        })

        const beforeChild = await prisma.user.findUnique({ where: { id: child.id } });
        const xpBefore = beforeChild!.studyPt + beforeChild!.staminaPt + beforeChild!.lifePt;

        // 親がタスク削除
        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        const req = new Request(`http://localhost/api/tasks/${task.id}`, {
            method: "DELETE",
            body: "{}",
        });
        const res = await deleteTask(req, makeParams(task.id));
        const json = await res.json();
        expect(json.ok).toBe(true);

        // XP回収の確認: APPROVEDのquest1の1クエストのみ回収される
        const afterDelete = await prisma.user.findUnique({ where: { id: child.id } });
        const xpAfter = afterDelete!.studyPt + afterDelete!.staminaPt + afterDelete!.lifePt;
        expect(xpAfter).toBe(xpBefore - 1);

        // 両クエストがREJECTEDになること
        const q1 = await prisma.questInstance.findUnique({ where: { id: quest1.id } });
        const q2 = await prisma.questInstance.findUnique({ where: { id: quest2.id } });
        expect(q1!.status).toBe("REJECTED");
        expect(q2!.status).toBe("REJECTED");

        // タスクがソフトデリートされること
        const deletedTask = await prisma.taskTemplate.findUnique({ where: { id: task.id } });
        expect(deletedTask!.isActive).toBe(false);
    });

    it("PARENT作成タスクの削除ではXP回収が発生しないこと", async () => {
        const task = await seedTask(family.id, {
            category: "STAMINA",
            createdBy: "PARENT",
            assignedChildId: child.id,
        });
        const quest = await seedQuestForDate(task.id, child.id, new Date("2026-04-10"), "REPORTED");

        // 承認してXP付与
        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        await approveQuest(
            makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
            makeParams(quest.id),
        );

        const beforeDelete = await prisma.user.findUnique({ where: { id: child.id } });
        const xpBefore = beforeDelete!.studyPt + beforeDelete!.staminaPt + beforeDelete!.lifePt;

        // PARENT作成タスクを削除
        const req = new Request(`http://localhost/api/tasks/${task.id}`, {
            method: "DELETE",
            body: "{}",
        });
        await deleteTask(req, makeParams(task.id));

        // XPは変化しないこと
        const afterDelete = await prisma.user.findUnique({ where: { id: child.id } });
        const xpAfter = afterDelete!.studyPt + afterDelete!.staminaPt + afterDelete!.lifePt;
        expect(xpAfter).toBe(xpBefore);
    });
});
