import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadBadgeContext } from "@/lib/badges";
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

describe("バッジコンテキスト計算の正確性", () => {
    let family: any;
    let parent: any;
    let child: any;
    let task: any;

    beforeAll(async () => {
        await cleanAll();
        ({ family, parent, child } = await seedFamily());
        task = await seedTask(family.id, {
            category: "STUDY",
            assignedChildId: child.id,
            photoBonus: true,
        });
    });

    beforeEach(async () => {
        // 各テストの独立性を保つため、クエストとユーザーデータをリセット
        await prisma.questInstance.deleteMany({ where: { childId: child.id } });
        await prisma.taskStreak.deleteMany({ where: { childId: child.id } });
        await prisma.streak.deleteMany({ where: { childId: child.id } });
        await prisma.user.update({
            where: { id: child.id },
            data: {
                studyPt: 0,
                staminaPt: 0,
                lifePt: 0,
                evolutionStage: 1,
                evolutionPath: "",
                collectedPaths: "[]",
                rebirthPending: false,
            },
        });
    });

    afterAll(async () => {
        await cleanAll();
    });

    it("新規ユーザ（collectedPaths=[]）で rebirthCount が0以上であること", async () => {
        const ctx = await loadBadgeContext(child.id);
        expect(ctx.rebirthCount).toBeGreaterThanOrEqual(0);
        expect(ctx.rebirthCount).toBe(0); // 新規ユーザ
    });

    it("collectionCount が collectedPaths.length と等しいこと", async () => {
        // collectedPaths に3パスをセット
        await prisma.user.update({
            where: { id: child.id },
            data: {
                collectedPaths: '["STUDY", "STUDY_STUDY", "STUDY_STUDY_STUDY"]',
                evolutionStage: 3,
                evolutionPath: "STUDY_STUDY_STUDY",
            },
        });

        const ctx = await loadBadgeContext(child.id);
        expect(ctx.collectionCount).toBe(3); // パス数と同じ
    });

    it("totalXp が現在のポイント合計と一致すること", async () => {
        // 3つのクエストを承認（各1pt基本 = 3pt）
        for (let i = 0; i < 3; i++) {
            const date = new Date(`2026-04-${20 + i}`);
            const quest = await seedQuestForDate(task.id, child.id, date, "REPORTED");

            mockAsUser({ ...parent, familyId: family.id, role: "PARENT" });
            await approveQuest(
                makeRequest(`/api/approve/${quest.id}`, { action: "approve" }),
                makeParams(quest.id),
            );
        }

        const currentChild = await prisma.user.findUnique({ where: { id: child.id } });
        const currentXp = currentChild!.studyPt + currentChild!.staminaPt + currentChild!.lifePt;

        const ctx = await loadBadgeContext(child.id);

        // totalXp は現在のXP合計と一致する
        expect(ctx.totalXp).toBe(currentXp);
        // 承認3回分なので最低3pt
        expect(ctx.totalXp).toBeGreaterThanOrEqual(3);
    });

    it("写真付きクエストのXPがtotalXPに正しく反映されていること", async () => {
        // XP を付与しておく
        await prisma.user.update({
            where: { id: child.id },
            data: { studyPt: 3 },
        });

        // 写真付きクエストを作成
        await prisma.questInstance.create({
            data: {
                templateId: task.id,
                childId: child.id,
                date: new Date("2026-04-25"),
                status: "APPROVED",
                reportedAt: new Date(),
                approvedAt: new Date(),
                photoUrl: "http://example.com/photo.jpg",
                deadlineBonusEarned: true,
            },
        });

        const ctx = await loadBadgeContext(child.id);

        expect(ctx.photoCount).toBe(1);
        expect(ctx.deadlineBonusCount).toBe(1);
        // totalXp は studyPt(3) + staminaPTt(0) + lifePt(0) = 3
        expect(ctx.totalXp).toBe(3);
    });
});
