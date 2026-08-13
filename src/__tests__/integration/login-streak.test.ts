import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as loginCheck } from "@/app/api/streak/login-check/route";
import { todayJST } from "@/lib/date";
import type { Family, User } from "@/generated/prisma/client";
import {
    prisma,
    mockAsUser,
    seedFamily,
    cleanAll,
} from "./helpers";

describe("ログインストリーク（記録 => ボーナス付与 -> 進化）", () => {
    let family: Family;
    let child: User;
    
    beforeAll(async () => {
        await cleanAll();
        ({ family, child } = await seedFamily());
        // stage1, studyPt=2 でスタート（10日ボーナス+1ptで total=7、閾値10未満で進化しない）
        await prisma.user.update({
            where: { id: child.id },
            data: { evolutionStage: 1, evolutionPath: "STUDY", studyPt: 2, staminaPt: 2, lifePt: 2 },
        });
    });

    afterAll(async () => {
        await cleanAll();
    });

    it("初回ログインでloginCurrentStreak=1になること", async () => {
        mockAsUser({ ...child, family });

        const res = await loginCheck();
        const json = await res.json();

        expect(json.loginStreak).toBe(1);
        expect(json.bonusGranted).toBe(0);
    });

    it("10日目のログインでマイルストーンボーナスが付与されること", async () => {
        // lastLoginDateをJST基準の昨日に設定して翌日のログインをシミュレート
        const today = todayJST();
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate()  -1);
        await prisma.streak.update({
            where: { childId: child.id },
            data: {
                loginCurrentStreak: 9,
                loginBestStreak: 9,
                lastLoginDate: yesterday,
            },
        });

        mockAsUser({ ...child, family });
        const res = await loginCheck();
        const json = await res.json();

        expect(json.loginStreak).toBe(10);
        expect(json.bonusGranted).toBe(1);

        // ボーナスでXPが増えていること
        const c = await prisma.user.findUnique({ where: { id: child.id } });
        const totalXp = c!.studyPt + c!.staminaPt + c!.lifePt;
        // 基本XP(6) + ボーナス(1pt最小カテゴリに加算) = 7
        expect(totalXp).toBe(7);
    });

    it("rebirthPending中のログインボーナスではXPのみ加算され進化チェックがスキップされること", async () => {
        // rebirthPending にする
        await prisma.user.update({
            where: { id: child.id },
            data: {
                rebirthPending: true,
                evolutionStage: 3,
                evolutionPath: "STUDY_STUDY_STUDY",
                studyPt: 18, staminaPt: 0, lifePt: 0,
            },
        });

        // ストリークを19にして次回で20日目ボーナス
        const today = todayJST();
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        await prisma.streak.update({
            where: { childId: child.id },
            data: {
                loginCurrentStreak: 19,
                loginBestStreak: 19,
                lastLoginDate: yesterday,
            },
        });

        mockAsUser({ ...child, family });
        const res = await loginCheck();
        const json = await res.json();

        expect(json.loginStreak).toBe(20);
        expect(json.bonusGranted).toBe(1);

        // rebirthPendingが維持され、stageリセットされていないこと
        const c = await prisma.user.findUnique({ where: { id: child.id } });
        expect(c!.rebirthPending).toBe(true);
        expect(c!.evolutionStage).toBe(3);
        // XPは加算されていること（最小カテゴリに+1pt）
        const totalXp = c!.studyPt + c!.staminaPt + c!.lifePt;
        expect(totalXp).toBe(19);
    });
});
