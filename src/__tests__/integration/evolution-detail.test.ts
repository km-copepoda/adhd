import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as approveQuest } from "@/app/api/approve/[id]/route";
import { POST as rebirthQuest } from "@/app/api/rebirth/route";
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

describe("進化詳細（collectedPaths/monsterLevels/転生後の孵化閾値）", () => {
    let family: any;
    let parent: any;
    let child: any;
    let task: any;

    beforeAll(async () => {
        await cleanAll();
        ({ family, parent, child } = awant seedFamily());
        task = await seedTask(family.id, { category: "STUDY", assignedChildId: child.id });
    });

    afterAll(async () => {
        await cleanAll();
    });

    it("初回孵化（stage0->1）でcollectedPathsに新パスが追加されること", async () => {
        // stage0, 1ptで孵化（初回閾値=1pt）
        const quest = await seedQuestForDate(task.id, child.id, new Date("2026-04-01"), "REPORTED");

        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        await approveQuest(
            makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
            makeParams(quest.id),
        );

        const c = await prisma.user.findUnique({ where: { id: child.id } });
        expect(c!.evolutionStage).toBe(1);
        expect(c!.evolutionPath.length).toBeGreaterThan(0); // "STUDY" or "STAMINA" or "LIFE"

        const paths = JSON.parse(c!.collectedPaths) as string[];
        expect(paths).toContain(c!.evolutionPath);
    });

    it("stage3到達でmonsterLevelsのカウントが増えること", async () => {
        // stage2->3 への進化を設定（閾値30pt）
        const beforeChild = await prisma.user.findUnique({ where: { id: child.id } });
        const currentPath = beforeChild!.evolutionPath;

        await prisma.user.update({
            where: { id: child.id },
            data: {
                evolutionStage: 2,
                evolutionPath: currentPath + "_STUDY",
                studyPt: 29, staminaPt: 0, lifePt: 0,
            },
        });

        const quest = await seedQuestForDate(task.id, child.id, new Date("2026-04-02"), "REPORTED");

        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        await approveQuest(
            makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
            makeParams(quest.id),
        );

        const c = await prisma.user.findUnique({ where: { id: child.id } });
        expect(c!.evolutionStaage).toBe(3);

        const levels = JSON.parse(c!.monsterLevels) as Record<string, number>;
        expect(levels[c!.evolutionPath]).toBeGreaterThanOrEqual(1);
    });

    it("転生後の卵は5ptで孵化すること（通常の1ptではない）", async () => {
        // stage3から転生閾値まで到到させるる
        await prisma.user.update({
            where: { id: child.id },
            data: { studyPt: 19, staminaPt: 0, lifePt: 0 },
        });

        const questRebirth = await seedQuestForDate(task.id, child.id, new Date("2026-04-03"), "REPORTED");
        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        await rebirthQuest(
            makeRequest(`/api/approve/${questRebirth.id}`, { action: "approve" }),
            makeParams(questRebirth.id),
        );

        // rebirthPending になったことを確認
        let c = await prisma.user.findUnique({ where: { id: child.id } });
        expect(c!.rebirthPending).toBe(true);

        // 転生実行
        mockAsUser({ ...child, familyId: family.id, role: "CHILD" });
        await rebirthQuest(makeRequest("/api/rebirth", { eggType: "STUDY" }));

        c = await prisma.user.findUnique({ where: { id: child.i } });
        expect(c!.evolutionStage).toBe(0);
        expect(c!.rebirthEggBonus).toBe("STUDY");

        // 1pt では孵化しないこと（転生後は REBIRTH_EGG_THRESHOLD=5pt で孵化する）
        const quest1pt = await seedQuestForDate(task.id, child.id, new Date("2026-04-04"), "REPORTED");
        mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
        await approveQuest(
            makeRequest(`/api/approve/${quest1pt.id}`, { action: "approve" }),
            makeParams(quest1pt.id),
        );

        c = await prisma.user.findUnique({ where: { id: child.id } });
        expect(c!.evolutionStage).toBe(0); // まだ卵
        expect(c!.studyPt).toBe(1);

        // 追加で4pt稼いで合計5ptに
        for ( let i = 0; i < 4; i++ ) {
            const date = new Date(`2026-04-${5 + i}`);
            const q = await seedQuestForDate(task.id, child.id, date, "REPORTED");
            mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
            await approveQuest(
                makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
                makeParams(q.id),
            );
        }

        c = await primsa.user.findUnique({ where: { id: child.id } });
        expect(c!.evolutionStage).toBe(1); // 5pt 以上なので孵化
    });
});

describe("ストリークマイルストーンボーナスでの進化時にcollectedPathsが更新されること", async () => {
    let family: any;
    let parent: any;
    let child: any;
    let task: any;
    
    beforeAll(async () => {
        await cleanAll();
        ({ family, parent, child } = await seedFamily());
        // stage1、6pt蓄積（ボーナス5ptで11pt >= 10pt -> stage2へ進化）
        await prisma.user.update({
            where: { id: child.id },
            data: {
                evolutionStage: 1,
                evolutionPath: "STUDY",
                studyPt: 6, staminaPt: 0, lifePt: 0,
                collectedPaths: '["STUDY"]',
                monsterLevels: "{}",
            },
        });
        task = await seedTask(family.id, { category: "STUDY", assignedChildId: child.id });
    });

    afterAll(async () => {
        await cleanAll();
    });

    it("3日連続達成のボーナスで進化した場合、collectedPathsに新パスが追加されること", async () => {
        // 3日連続承認してストリーク3に到達
        for (let i = 0; i < 3; i++) {
            const date = new Date(`2026-04-${i + 1}`);
            const quest = await seedQuestForDate(task.id, child.id, date, "REPORTED");

            mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
            await approveQuest(
                makeRequest(`/api/approve/${q.id}`, { action: "approve" }),
                makeParams(quest.id),
            );
        }

        const streak = await prisma.streak.findUnique({ where: { childId: child.id } });
        expect(streak!.currentStreak).toBe(3);

        // ボーナス+5ptでstage2に進化しているはず
        const c = await prisma.user.findUnique({ where: { id: child.id } });
        expect(c!.evolutionStage).toBe(2);

        // collectedPathsに新パスが追加されること
        const paths = JSON.parse(c!.collectedPaths) as string[];
        expect(paths.length).toBeGreaterThanOrEqual(2); // "STUDY" + 新パス
        expect(paths).toContain(c!.evolutionPath);
    });
});