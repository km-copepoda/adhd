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

describe("承認ガード（不正ステータス遷移の防止）", () => {
    let family: any;
    let parent: any;
    let child: any;
    let task: any;

    beforeAll(async () => {
        await cleanAll();
        ({ family, parent, child } = await seedFamily() );
        task = await seedTask(family.id, {
            category: "STUDY",
            assignedChildId: child.id,
        });
    });

    afterAll(async () => {
        await cleanAll();
    });

    it("PENDINGタスクを承認しようとすると400を返し、XPが加算されないこと", async () => {
        const quest = await seedQuestForDate(task.id, child.id, new Date("2026-04-05"), "PENDING");

        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        const res = await approveQuest(
            makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
            makeParams(quest.id),
        );

        expect(res.status).toBe(400);

        // XP は変化なし
        const updatedChild = await prisma.user.findUnique({ where: { id: child.id } });
        expect(updatedChild!.studyPt).toBe(0);

        // ステータスもPENDINGのまま
        const updatedQuest = await prisma.questInstance.findUnique({ where: { id: quest.id } });
        expect(updatedQuest!.status).toBe("PENDING");
    });

    it("APPROVE済みクエストを再承認しようとすると400を返し、XPが加算されないこと", async () => {
        // 正規フローで確認する
        const quest = await seedQuestForDate(task.id, child.id, new Date("2026-04-06"), "REPORTED");

        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        const res1 = await approveQuest(
            makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
            makeParams(quest.id),
        );
        expect((await res1.json()).ok).toBe(true);

        // 承認後のXPを記録
        const afterFirst = await prisma.user.findUnique({ where: { id: child.id } });
        const xpAfterFirst = afterFirst!.studyPt + afterFirst!.staminaPt + afterFirst!.lifePt;

        // 同じクエストを再度承認しようとする
        const res2 = await approveQuest(
            makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
            makeParams(quest.id),
        );
        expect(res2.status).toBe(400);

        // XP は変化なし
        const afterSecond = await prisma.user.findUnique({ where: { id: child.id } });
        const xpAfterSecond = afterSecond!.studyPt + afterSecond!.staminaPt + afterSecond!.lifePt;
        expect(xpAfterSecond).toBe(xpAfterFirst);
    });

    it("REJECTEDクエストを承認しようとすると400を返すこと", async () => {
        const quest = await seedQuestForDate(task.id, child.id, new Date("2026-04-07"), "REJECTED");

        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        const res = await approveQuest(
            makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
            makeParams(quest.id),
        );

        expect(res.status).toBe(400);
    });
});