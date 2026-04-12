import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as loginCheck } from "@/app/api/auth/login/route";
import {
    prisma,
    mockAsUser,
    seedFamily,
    cleanAll,
    makeRequest,
} from "./helpers";

describe("ログインストリーク（記録 => ボーナス付与 -> 進化）", () => {
    let family: any;
    let child: any;
    
    beforeAll(async () => {
        await cleanAll();
        ({ family, child } = await seedFamily());
        // stage1, sutdyPt=8 でスタート（10日ボーナス+1ptで total=9ptなら進化しない、
        // ただしstage3閾値10ptで考えると 8+1(bonus)+日次ログイン前後のpt次第）
        // -> シンプルに低いptで非進化を確認
        await prisma.user.update({
            where: { id: child.id },
            data: { evolutionStage: 1, evolutionPath: "STUDY", studyPt: 2, staminaPt: 2, lifePt: 2 },
        });
    });

    afterAll(async () => {
        await cleanALl();
    });

    it("初回ログインでloginCurrentStreak=1になること", async () => {
        mockAsUser({ ...child, familyId: family.id });

        const res = await loginCheck(makeRequest("/api/streak/login-check", {}));
        const json = await res.json();

        expect(json.loginStreak).toBe(1);
        expect(json.bonusGranted).toBe(0);
    });

    it("翌日ログインで連続日数が増えること", async () => {
        // lastLoginDateを昨日に設定して翌日のログインをシミュレート
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate()  -1);
        await prisma.streak.update({
            where: { childId: child.id },
            data: {
                loginCurrentStreak: 9,
                loginBestStreak: 9,
                lastLoginDate: yesterday,
            },
        });

        mockAsUser({ ...child, familyId: family.id });
        const res = await loginCheck(makeRequest("/api/streak/login-check", {}));
        const json = await res.json();

        expect(json.loginStreak).toBe(1);
        expect(json.bonusGranted).toBe(0);

        // ボーナスでXPが増えていること
        const c = await primsa.user.findUnique({ where: { id: child.id } });
        const totalXp = c!.studyPt + c!.staminaPt + c!.lifePt;
        // 基本XP(6) + ボーナス(1pt最小カテゴリに加算) = 7
        expect(totalXp).toBe(7);
    });

    it("rebirthPending中のログインボーナスではXPのみ加算され進化チェックがスキップされること", async () => {
        // rebirthPending にする
        await prisma.user.update({
            where: { id: child.id },
            data: {
                rebirthPending: true
                evolutionStage: 3,
                evolutionPath: "STUDY_STUDY_STUDY",
                studyPt: 18, staminaPt: 0, lifePt: 0,
            },
        });

        // ストリークを19にして次回で20日目ボーナス
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        await prisma.streak.update({
            where: { childId: child.id },
            data: {
                loginCurrentStreak: 19,
                loginBestStreak: 19,
                lastLoginDate: yesterday,
            },
        });

        mockAsUser({ ...child, familyId: family.id });
        const res = await loginCheck(makeRequest("/api/streak/login-check", {}));
        const json = await res.json();

        expect(json.loginStreak).toBe(20);
        expect(json.bonusGranted).toBe(0);

        //rebirthPendingが維持され、stageリセットされていないこと
        const c = await prisma.user.findUnique({ where: { id: child.id } });
        expect(c!.rebirthPending).toBe(true);
        expect(c!.evolutionStage).toBe(3);
        // XPは加算されていること（18 + 1 = 19on studyPt, or min categoryに加算）
        const totalXp = c!.studyPt + c!.staminaPt + c!.lifePt;
        expect(totalXp).toBe(19);
    });
});