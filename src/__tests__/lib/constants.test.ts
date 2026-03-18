import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  XP_MAP,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  DIFFICULTY_LABEL,
  MONSTER_STAGES,
  DAY_LABELS,
  STREAK_MILESTONES,
  getMonsterStage,
  checkEvolution,
  getXpInfo,
  getStreakTitle,
  getNewMilestoneBonus,
  distributeBonus,
  generateFamilyCode,
  generateChildCode,
} from "@/lib/constants";

// ─── 定数マップのテスト ───────────────────────────────

describe("XP_MAP", () => {
  it("EASY=1, NORMAL=3, HARD=5 であること", () => {
    expect(XP_MAP.EASY).toBe(1);
    expect(XP_MAP.NORMAL).toBe(3);
    expect(XP_MAP.HARD).toBe(5);
  });

  it("全ての難易度を網羅していること", () => {
    expect(Object.keys(XP_MAP).sort()).toEqual(["EASY", "HARD", "NORMAL"]);
  });
});

describe("CATEGORY_LABEL", () => {
  it("全カテゴリにemoji・nameを持つこと", () => {
    for (const key of ["STUDY", "STAMINA", "LIFE"] as const) {
      expect(CATEGORY_LABEL[key]).toHaveProperty("emoji");
      expect(CATEGORY_LABEL[key]).toHaveProperty("name");
      expect(CATEGORY_LABEL[key].emoji.length).toBeGreaterThan(0);
      expect(CATEGORY_LABEL[key].name.length).toBeGreaterThan(0);
    }
  });
});

describe("CATEGORY_COLOR", () => {
  it("全カテゴリに16進カラーが定義されていること", () => {
    for (const key of ["STUDY", "STAMINA", "LIFE"] as const) {
      expect(CATEGORY_COLOR[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("DIFFICULTY_LABEL", () => {
  it("全難易度にname・colorを持つこと", () => {
    for (const key of ["EASY", "NORMAL", "HARD"] as const) {
      expect(DIFFICULTY_LABEL[key]).toHaveProperty("name");
      expect(DIFFICULTY_LABEL[key]).toHaveProperty("color");
    }
  });
});

describe("MONSTER_STAGES", () => {
  it("DARK/LIGHT 両方に5段階あること", () => {
    expect(MONSTER_STAGES.DARK).toHaveLength(5);
    expect(MONSTER_STAGES.LIGHT).toHaveLength(5);
  });

  it("最終段階のptToEvolveがnullであること", () => {
    expect(MONSTER_STAGES.DARK[4].ptToEvolve).toBeNull();
    expect(MONSTER_STAGES.LIGHT[4].ptToEvolve).toBeNull();
  });

  it("進化閾値が 1→10→30→70→null の順であること（stage0はたまご）", () => {
    for (const side of ["DARK", "LIGHT"] as const) {
      expect(MONSTER_STAGES[side].map((s) => s.ptToEvolve)).toEqual([1, 10, 30, 70, null]);
    }
  });

  it("全段階にemoji・nameが存在すること", () => {
    for (const side of ["DARK", "LIGHT"] as const) {
      for (const stage of MONSTER_STAGES[side]) {
        expect(stage.emoji.length).toBeGreaterThan(0);
        expect(stage.name.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("DAY_LABELS", () => {
  it("7日分の曜日ラベルがあること", () => {
    expect(DAY_LABELS).toHaveLength(7);
  });

  it("日曜始まりであること", () => {
    expect(DAY_LABELS[0]).toBe("日");
    expect(DAY_LABELS[6]).toBe("土");
  });
});

// ─── getMonsterStage ──────────────────────────────────

describe("getMonsterStage", () => {
  it("正常なステージインデックスで正しいステージを返すこと", () => {
    const stage0 = getMonsterStage("DARK", 0);
    expect(stage0.emoji).toBe("🥚");
    expect(stage0.name).toBe("やみのたまご");

    const stage2 = getMonsterStage("LIGHT", 2);
    expect(stage2.emoji).toBe("🦊");
    expect(stage2.name).toBe("キツネ");
  });

  it("最大ステージを返すこと (境界値)", () => {
    const stage4 = getMonsterStage("DARK", 4);
    expect(stage4.name).toBe("真・魔王");
  });

  it("ステージが範囲外の場合、最大ステージにクランプされること", () => {
    const stage = getMonsterStage("DARK", 100);
    expect(stage.name).toBe("真・魔王");
    expect(stage.ptToEvolve).toBeNull();
  });

  it("負のステージインデックスでも最低限動作すること", () => {
    // Math.min(-1, 4) = -1 → stages[-1] = undefined, but this is an edge case
    const stage = getMonsterStage("LIGHT", -1);
    expect(stage).toBeUndefined();
  });
});

// ─── checkEvolution ───────────────────────────────────

describe("checkEvolution", () => {
  describe("進化条件を満たさない場合", () => {
    it("合計ポイントが閾値未満なら evolved=false を返すこと", () => {
      const result = checkEvolution("DARK", 1, 3, 3, 3); // total=9 < 10 (ステージ1の閾値)
      expect(result).toEqual({
        evolved: false,
        newStage: 1,
        resetStudy: 3,
        resetStamina: 3,
        resetLife: 3,
      });
    });

    it("ポイント0でも正常に動作すること", () => {
      const result = checkEvolution("LIGHT", 1, 0, 0, 0);
      expect(result.evolved).toBe(false);
      expect(result.newStage).toBe(1);
    });
  });

  describe("進化条件を満たす場合", () => {
    it("ステージ0（たまご）→1: 合計1ptで孵化すること", () => {
      const result = checkEvolution("DARK", 0, 1, 0, 0); // total=1 >= 1
      expect(result).toEqual({
        evolved: true,
        newStage: 1,
        resetStudy: 0,
        resetStamina: 0,
        resetLife: 0,
      });
    });

    it("ステージ1→2: 合計10ptで進化すること", () => {
      const result = checkEvolution("DARK", 1, 5, 3, 2); // total=10
      expect(result).toEqual({
        evolved: true,
        newStage: 2,
        resetStudy: 0,
        resetStamina: 0,
        resetLife: 0,
      });
    });

    it("ステージ2→3: 合計30ptで進化すること", () => {
      const result = checkEvolution("LIGHT", 2, 10, 10, 10); // total=30
      expect(result).toEqual({
        evolved: true,
        newStage: 3,
        resetStudy: 0,
        resetStamina: 0,
        resetLife: 0,
      });
    });

    it("ステージ3→4: 合計70ptで進化すること", () => {
      const result = checkEvolution("DARK", 3, 25, 25, 20); // total=70
      expect(result).toEqual({
        evolved: true,
        newStage: 4,
        resetStudy: 0,
        resetStamina: 0,
        resetLife: 0,
      });
    });

    it("閾値を超過しても進化すること", () => {
      const result = checkEvolution("DARK", 1, 10, 10, 10); // total=30 >> 10
      expect(result.evolved).toBe(true);
      expect(result.newStage).toBe(2);
      expect(result.resetStudy).toBe(0);
    });
  });

  describe("最大進化ステージ", () => {
    it("ステージ4では進化しないこと (ptToEvolve=null)", () => {
      const result = checkEvolution("DARK", 4, 100, 100, 100);
      expect(result).toEqual({
        evolved: false,
        newStage: 4,
        resetStudy: 100,
        resetStamina: 100,
        resetLife: 100,
      });
    });

    it("LIGHT側ステージ4でも進化しないこと", () => {
      const result = checkEvolution("LIGHT", 4, 50, 50, 50);
      expect(result.evolved).toBe(false);
    });
  });

  describe("境界値テスト", () => {
    it("ステージ0: 閾値ちょうど（1pt）で孵化すること", () => {
      const result = checkEvolution("LIGHT", 0, 1, 0, 0);
      expect(result.evolved).toBe(true);
    });

    it("ステージ1: 閾値ちょうど（10pt）で進化すること", () => {
      const result = checkEvolution("LIGHT", 1, 10, 0, 0);
      expect(result.evolved).toBe(true);
    });

    it("ステージ1: 閾値-1pt（9pt）で進化しないこと", () => {
      const result = checkEvolution("LIGHT", 1, 9, 0, 0);
      expect(result.evolved).toBe(false);
    });

    it("ステージ2: 閾値ちょうど（30pt）で進化すること", () => {
      const result = checkEvolution("DARK", 2, 10, 10, 10);
      expect(result.evolved).toBe(true);
    });

    it("ステージ2: 閾値-1pt（29pt）で進化しないこと", () => {
      const result = checkEvolution("DARK", 2, 10, 10, 9);
      expect(result.evolved).toBe(false);
    });

    it("ステージ3: 閾値ちょうど（70pt）で進化すること", () => {
      const result = checkEvolution("LIGHT", 3, 30, 20, 20);
      expect(result.evolved).toBe(true);
    });

    it("ステージ3: 閾値-1pt（69pt）で進化しないこと", () => {
      const result = checkEvolution("LIGHT", 3, 30, 20, 19);
      expect(result.evolved).toBe(false);
    });
  });

  describe("カテゴリ別ポイント分布", () => {
    it("1カテゴリのみでも孵化すること（たまご→ステージ1）", () => {
      expect(checkEvolution("DARK", 0, 1, 0, 0).evolved).toBe(true);
      expect(checkEvolution("DARK", 0, 0, 1, 0).evolved).toBe(true);
      expect(checkEvolution("DARK", 0, 0, 0, 1).evolved).toBe(true);
    });

    it("ステージ1で3カテゴリ均等でも進化すること", () => {
      // 10/3 ≈ 3.33 なので均等だと 3+3+4=10
      expect(checkEvolution("LIGHT", 1, 4, 3, 3).evolved).toBe(true);
    });
  });
});

// ─── getXpInfo ────────────────────────────────────────

describe("getXpInfo", () => {
  it("ステージ0（たまご）での基本情報を返すこと", () => {
    const info = getXpInfo("DARK", 0, 0, 0, 0);
    expect(info.totalPt).toBe(0);
    expect(info.evolutionStage).toBe(0);
    expect(info.xpInStage).toBe(0);
    expect(info.xpToEvolve).toBe(1);
    expect(info.nextEvolution).not.toBeNull();
    expect(info.nextEvolution!.ptNeeded).toBe(1); // 1-0
  });

  it("ステージ1での基本情報を返すこと", () => {
    const info = getXpInfo("DARK", 1, 3, 2, 1);
    expect(info.totalPt).toBe(6);
    expect(info.evolutionStage).toBe(1);
    expect(info.xpInStage).toBe(6);
    expect(info.xpToEvolve).toBe(10);
    expect(info.nextEvolution).not.toBeNull();
    expect(info.nextEvolution!.ptNeeded).toBe(4); // 10-6
  });

  it("次のステージ情報を含むこと", () => {
    const info = getXpInfo("LIGHT", 1, 5, 0, 0);
    expect(info.nextEvolution).toMatchObject({
      emoji: "🦊",
      name: "キツネ",
      ptNeeded: 5,
    });
  });

  it("ステージ2での進化情報を返すこと", () => {
    const info = getXpInfo("DARK", 2, 10, 5, 5);
    expect(info.totalPt).toBe(20);
    expect(info.xpToEvolve).toBe(30);
    expect(info.nextEvolution!.ptNeeded).toBe(10); // 30-20
  });

  it("最大ステージ（4）ではnextEvolutionがnullであること", () => {
    const info = getXpInfo("DARK", 4, 100, 100, 100);
    expect(info.evolutionStage).toBe(4);
    expect(info.xpToEvolve).toBeNull();
    expect(info.nextEvolution).toBeNull();
  });

  it("ポイント0でも正常に計算されること（ステージ1）", () => {
    const info = getXpInfo("LIGHT", 1, 0, 0, 0);
    expect(info.totalPt).toBe(0);
    expect(info.xpInStage).toBe(0);
    expect(info.nextEvolution!.ptNeeded).toBe(10);
  });

  it("ステージが範囲外の場合、最大ステージにクランプされること", () => {
    const info = getXpInfo("LIGHT", 99, 10, 10, 10);
    expect(info.evolutionStage).toBe(4);
    expect(info.xpToEvolve).toBeNull();
    expect(info.nextEvolution).toBeNull();
  });

  it("ptNeededが負になるケース（閾値超過）", () => {
    // ステージ1で11pt → ptNeeded = 10-11 = -1
    const info = getXpInfo("DARK", 1, 5, 3, 3);
    expect(info.nextEvolution!.ptNeeded).toBe(-1);
  });
});

// ─── STREAK_MILESTONES ──────────────────────────────

describe("STREAK_MILESTONES", () => {
  it("4つのマイルストーンが昇順であること", () => {
    expect(STREAK_MILESTONES).toHaveLength(4);
    for (let i = 1; i < STREAK_MILESTONES.length; i++) {
      expect(STREAK_MILESTONES[i].days).toBeGreaterThan(STREAK_MILESTONES[i - 1].days);
    }
  });
});

describe("getStreakTitle", () => {
  it("0日ならnullを返すこと", () => {
    expect(getStreakTitle(0)).toBeNull();
  });

  it("3日で「はじめの一歩」を返すこと", () => {
    expect(getStreakTitle(3)).toMatchObject({ title: "はじめの一歩", emoji: "🔥" });
  });

  it("6日でも「はじめの一歩」を返すこと（7未満）", () => {
    expect(getStreakTitle(6)).toMatchObject({ title: "はじめの一歩" });
  });

  it("100日で「伝説の冒険者」を返すこと", () => {
    expect(getStreakTitle(100)).toMatchObject({ title: "伝説の冒険者", emoji: "👑" });
  });
});

describe("getNewMilestoneBonus", () => {
  it("2→3で5ptボーナスを返すこと", () => {
    expect(getNewMilestoneBonus(2, 3)).toBe(5);
  });

  it("6→7で10ptボーナスを返すこと", () => {
    expect(getNewMilestoneBonus(6, 7)).toBe(10);
  });

  it("マイルストーンをまたがない場合は0を返すこと", () => {
    expect(getNewMilestoneBonus(3, 4)).toBe(0);
  });

  it("複数マイルストーンをまたぐ場合は合計を返すこと", () => {
    // 2→7: 3日(+5) + 7日(+10) = 15
    expect(getNewMilestoneBonus(2, 7)).toBe(15);
  });
});

describe("distributeBonus", () => {
  it("3の倍数を均等分配すること", () => {
    expect(distributeBonus(9)).toEqual({ study: 3, stamina: 3, life: 3 });
  });

  it("端数をstudyに加算すること", () => {
    expect(distributeBonus(5)).toEqual({ study: 3, stamina: 1, life: 1 });
  });

  it("0ptの場合はすべて0であること", () => {
    expect(distributeBonus(0)).toEqual({ study: 0, stamina: 0, life: 0 });
  });
});

// ─── generateFamilyCode ──────────────────────────────

describe("generateFamilyCode", () => {
  it("6文字のコードを生成すること", () => {
    const code = generateFamilyCode();
    expect(code).toHaveLength(6);
  });

  it("許可文字のみ含むこと（0, O, I, 1 を除く）", () => {
    const allowedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 100; i++) {
      const code = generateFamilyCode();
      for (const ch of code) {
        expect(allowedChars).toContain(ch);
      }
    }
  });

  it("紛らわしい文字を含まないこと", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateFamilyCode();
      expect(code).not.toMatch(/[0OI1]/);
    }
  });

  it("100回生成して全てユニークであること（衝突確率がほぼ0）", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateFamilyCode());
    }
    expect(codes.size).toBe(100);
  });

  it("常に大文字と数字のみであること", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateFamilyCode()).toMatch(/^[A-Z2-9]{6}$/);
    }
  });
});

// ─── generateChildCode ───────────────────────────────

describe("generateChildCode", () => {
  it("4桁の数字コードを生成すること", () => {
    const code = generateChildCode();
    expect(code).toHaveLength(4);
    expect(code).toMatch(/^\d{4}$/);
  });

  it("数字のみ含むこと", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateChildCode()).toMatch(/^\d{4}$/);
    }
  });

  it("0000も生成可能であること（先頭0あり）", () => {
    // Math.random をモックして確認
    const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0);
    const code = generateChildCode();
    expect(code).toBe("0000");
    mockRandom.mockRestore();
  });

  it("9999も生成可能であること", () => {
    const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.999);
    const code = generateChildCode();
    expect(code).toBe("9999");
    mockRandom.mockRestore();
  });
});
