import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  MONSTER_TABLE,
  MONSTER_TABLE_LIGHT,
  EVOLUTION_THRESHOLDS,
  REBIRTH_THRESHOLD,
  DAY_LABELS,
  STREAK_MILESTONES,
  getMonsterStage,
  checkEvolution,
  getXpInfo,
  computeEvolutionWeights,
  selectEvolutionPath,
  getStreakTitle,
  getNewMilestoneBonus,
  distributeBonus,
  generateFamilyCode,
  generateChildCode,
} from "@/lib/constants";

// ─── 定数マップのテスト ───────────────────────────────

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

describe("REBIRTH_THRESHOLD", () => {
  it("正の整数であること", () => {
    expect(REBIRTH_THRESHOLD).toBeGreaterThan(0);
    expect(Number.isInteger(REBIRTH_THRESHOLD)).toBe(true);
  });
});

describe("EVOLUTION_THRESHOLDS", () => {
  it("4段階の閾値が定義されていること", () => {
    expect(EVOLUTION_THRESHOLDS).toHaveLength(4);
  });

  it("閾値が 1→10→30→null の順であること", () => {
    expect(EVOLUTION_THRESHOLDS).toEqual([1, 10, 30, null]);
  });

  it("最終ステージのみnullであること", () => {
    expect(EVOLUTION_THRESHOLDS[3]).toBeNull();
    for (let i = 0; i < 3; i++) {
      expect(EVOLUTION_THRESHOLDS[i]).not.toBeNull();
    }
  });
});

describe("MONSTER_TABLE", () => {
  it("39体（3+9+27）が定義されていること（ひよこなし）", () => {
    expect(Object.keys(MONSTER_TABLE)).toHaveLength(39);
  });

  it("空パス（ひよこ）は存在しないこと", () => {
    expect(MONSTER_TABLE[""]).toBeUndefined();
  });

  it("stage1の3パスが全て存在すること", () => {
    for (const path of ["STUDY", "STAMINA", "LIFE"]) {
      expect(MONSTER_TABLE[path]).toBeDefined();
    }
  });

  it("stage2の9パスが全て存在すること", () => {
    const paths = ["STUDY", "STAMINA", "LIFE"];
    for (const p1 of paths) {
      for (const p2 of paths) {
        expect(MONSTER_TABLE[`${p1}_${p2}`]).toBeDefined();
      }
    }
  });

  it("stage3の27パスが全て存在すること", () => {
    const paths = ["STUDY", "STAMINA", "LIFE"];
    for (const p1 of paths) {
      for (const p2 of paths) {
        for (const p3 of paths) {
          expect(MONSTER_TABLE[`${p1}_${p2}_${p3}`]).toBeDefined();
        }
      }
    }
  });

  it("全エントリにimage・nameが存在すること", () => {
    for (const [, entry] of Object.entries(MONSTER_TABLE)) {
      expect(entry.image.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
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

describe("MONSTER_TABLE_LIGHT", () => {
  it("LIGHTテーブルが39体を持つこと", () => {
    expect(Object.keys(MONSTER_TABLE_LIGHT)).toHaveLength(39);
  });

  it("全エントリにimage・nameが存在すること", () => {
    for (const [, entry] of Object.entries(MONSTER_TABLE_LIGHT)) {
      expect(entry.image.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it("DARKと異なるimage/nameを持つこと（独自の女の子画像）", () => {
    for (const key of Object.keys(MONSTER_TABLE)) {
      expect(MONSTER_TABLE_LIGHT[key].image).not.toBe(MONSTER_TABLE[key].image);
      expect(MONSTER_TABLE_LIGHT[key].name).not.toBe(MONSTER_TABLE[key].name);
    }
  });

  it("画像パスが /monsters/light/ 以下であること", () => {
    for (const [, entry] of Object.entries(MONSTER_TABLE_LIGHT)) {
      expect(entry.image).toMatch(/^\/monsters\/light\//);
    }
  });
});

describe("getMonsterStage", () => {
  it("stage0（たまご）はMONSTER_TABLEに依存せず卵を返すこと", () => {
    const stage = getMonsterStage(0, "");
    expect(stage.image).toBe("/monsters/egg.webp");
    expect(stage.ptToEvolve).toBe(1);
  });

  it("stage0でside=LIGHTのときライト卵画像を返すこと", () => {
    const stage = getMonsterStage(0, "", "LIGHT");
    expect(stage.image).toBe("/monsters/light/egg.webp");
    expect(stage.ptToEvolve).toBe(1);
  });

  it("stage1はevolutionPathのモンスターを返しptToEvolve=10であること", () => {
    const stage = getMonsterStage(1, "STUDY");
    expect(stage.image).toBe(MONSTER_TABLE["STUDY"].image);
    expect(stage.name).toBe(MONSTER_TABLE["STUDY"].name);
    expect(stage.ptToEvolve).toBe(10);
  });

  it("stage2の複合パスを返しptToEvolve=30であること", () => {
    const stage = getMonsterStage(2, "STUDY_STAMINA");
    expect(stage.image).toBe(MONSTER_TABLE["STUDY_STAMINA"].image);
    expect(stage.ptToEvolve).toBe(30);
  });

  it("stage3（最終）のptToEvolveがnullであること", () => {
    const stage = getMonsterStage(3, "STUDY_STAMINA_LIFE");
    expect(stage.ptToEvolve).toBeNull();
  });

  it("ステージが範囲外(4+)の場合、最大ステージの設定を使うこと", () => {
    const stage = getMonsterStage(99, "STUDY_STUDY_STUDY");
    expect(stage.ptToEvolve).toBeNull();
  });

  it("side=DARKの場合DARKテーブルの画像を返すこと", () => {
    const stage = getMonsterStage(1, "STUDY", "DARK");
    expect(stage.image).toBe(MONSTER_TABLE["STUDY"].image);
  });

  it("side=LIGHTの場合LIGHTテーブルの画像を返すこと", () => {
    const stage = getMonsterStage(1, "STUDY", "LIGHT");
    expect(stage.image).toBe(MONSTER_TABLE_LIGHT["STUDY"].image);
  });

  it("side未指定はDARKと同じ結果を返すこと", () => {
    const withoutSide = getMonsterStage(1, "STUDY");
    const withDark = getMonsterStage(1, "STUDY", "DARK");
    expect(withoutSide.image).toBe(withDark.image);
    expect(withoutSide.name).toBe(withDark.name);
  });
});

// ─── computeEvolutionWeights ─────────────────────────

describe("computeEvolutionWeights", () => {
  it("合計0の場合は均等（1/3ずつ）を返すこと", () => {
    const w = computeEvolutionWeights(0, 0, 0);
    expect(w.STUDY).toBeCloseTo(1 / 3);
    expect(w.STAMINA).toBeCloseTo(1 / 3);
    expect(w.LIFE).toBeCloseTo(1 / 3);
  });

  it("確率の合計が常に1.0であること", () => {
    const cases = [
      [10, 0, 0],
      [5, 3, 2],
      [4, 3, 3],
      [100, 50, 10],
    ] as const;
    for (const [s, st, l] of cases) {
      const w = computeEvolutionWeights(s, st, l);
      expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1.0);
    }
  });

  it("dominant が60%超えの場合、topが60%にキャップされること", () => {
    // study=80, stamina=10, life=10 → study比率80%
    const w = computeEvolutionWeights(80, 10, 10);
    expect(w.STUDY).toBeCloseTo(0.6);
    expect(w.STAMINA + w.LIFE).toBeCloseTo(0.4);
  });

  it("dominant が60%以下の場合はそのままの比率であること", () => {
    // study=50, stamina=30, life=20 → study比率50%（60%以下）
    const w = computeEvolutionWeights(50, 30, 20);
    expect(w.STUDY).toBeCloseTo(0.5);
    expect(w.STAMINA).toBeCloseTo(0.3);
    expect(w.LIFE).toBeCloseTo(0.2);
  });

  it("残り40%が2番目・3番目の割合で分配されること", () => {
    // study=90, stamina=6, life=4 → study 60% キャップ、残り40%: stamina=40%*(6/10)=24%, life=40%*(4/10)=16%
    const w = computeEvolutionWeights(90, 6, 4);
    expect(w.STUDY).toBeCloseTo(0.6);
    expect(w.STAMINA).toBeCloseTo(0.24);
    expect(w.LIFE).toBeCloseTo(0.16);
  });

  it("2番目・3番目の合計が0の場合、残りを均等分配すること", () => {
    // study=10, stamina=0, life=0 → study 60%、残り40%を均等: stamina=20%, life=20%
    const w = computeEvolutionWeights(10, 0, 0);
    expect(w.STUDY).toBeCloseTo(0.6);
    expect(w.STAMINA).toBeCloseTo(0.2);
    expect(w.LIFE).toBeCloseTo(0.2);
  });

  it("STAMINAが最大の場合も正しくキャップされること", () => {
    const w = computeEvolutionWeights(5, 100, 5);
    expect(w.STAMINA).toBeCloseTo(0.6);
    expect(w.STUDY + w.LIFE).toBeCloseTo(0.4);
  });
});

// ─── selectEvolutionPath ─────────────────────────────

describe("selectEvolutionPath", () => {
  it("Math.random=0のとき最初のパスを選択すること（STUDY dominant）", () => {
    // study=80, stamina=10, life=10: weights = {STUDY:0.6, STAMINA:0.2, LIFE:0.2}
    // r=0 → STUDY (累積0.6>0)
    vi.spyOn(Math, "random").mockReturnValue(0);
    const path = selectEvolutionPath(80, 10, 10);
    expect(path).toBe("STUDY");
    vi.restoreAllMocks();
  });

  it("確率に従いSTAMINAが選ばれること", () => {
    // study=80: STUDY=0.6, STAMINA=0.2, LIFE=0.2
    // r=0.7 → STUDY(0.6)は超える、STAMINA(0.6+0.2=0.8)を超えない → STAMINA
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    const path = selectEvolutionPath(80, 10, 10);
    expect(path).toBe("STAMINA");
    vi.restoreAllMocks();
  });

  it("返り値は常にMonsterPathのいずれかであること", () => {
    for (const r of [0, 0.3, 0.6, 0.8, 0.99]) {
      vi.spyOn(Math, "random").mockReturnValue(r);
      const path = selectEvolutionPath(10, 5, 5);
      expect(["STUDY", "STAMINA", "LIFE"]).toContain(path);
      vi.restoreAllMocks();
    }
  });
});

// ─── checkEvolution ───────────────────────────────────

describe("checkEvolution", () => {
  describe("進化条件を満たさない場合", () => {
    it("合計ポイントが閾値未満なら evolved=false を返すこと", () => {
      const result = checkEvolution(1, "STUDY", 3, 3, 3); // total=9 < 10
      expect(result.evolved).toBe(false);
      expect(result.newStage).toBe(1);
      expect(result.newPath).toBe("STUDY");
      expect(result.resetStudy).toBe(3);
      expect(result.resetStamina).toBe(3);
      expect(result.resetLife).toBe(3);
    });

    it("ポイント0でも正常に動作すること", () => {
      const result = checkEvolution(1, "STAMINA", 0, 0, 0);
      expect(result.evolved).toBe(false);
      expect(result.newStage).toBe(1);
    });
  });

  describe("進化条件を満たす場合", () => {
    it("ステージ0（たまご）→1: 1ptで孵化しパスが選択されること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
      const result = checkEvolution(0, "", 1, 0, 0);
      expect(result.evolved).toBe(true);
      expect(result.newStage).toBe(1);
      expect(result.newPath).toBe("STUDY"); // 孵化時もパス選択する
      expect(result.resetStudy).toBe(0);
      vi.restoreAllMocks();
    });

    it("ステージ1→2: 10ptで進化しnewPathが追記されること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
      const result = checkEvolution(1, "STAMINA", 10, 0, 0);
      expect(result.evolved).toBe(true);
      expect(result.newStage).toBe(2);
      expect(result.newPath).toBe("STAMINA_STUDY");
      vi.restoreAllMocks();
    });

    it("ステージ2→3: 既存パスに新パスが追記されること（最終形態）", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99); // LIFE が選ばれる想定
      const result = checkEvolution(2, "STUDY_STAMINA", 0, 0, 30);
      expect(result.evolved).toBe(true);
      expect(result.newStage).toBe(3);
      expect(result.newPath).toBe("STUDY_STAMINA_LIFE");
      vi.restoreAllMocks();
    });

    it("閾値を超過しても進化すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = checkEvolution(1, "STAMINA", 30, 0, 0);
      expect(result.evolved).toBe(true);
      expect(result.newStage).toBe(2);
      vi.restoreAllMocks();
    });
  });

  describe("転生（Rebirth）", () => {
    it("ステージ3でREBIRTH_THRESHOLD未満なら転生しないこと", () => {
      const result = checkEvolution(3, "STUDY_STAMINA_LIFE", 1, 0, 0);
      expect(result.evolved).toBe(false);
      expect(result.reborn).toBe(false);
      expect(result.newStage).toBe(3);
    });

    it("ステージ3でREBIRTH_THRESHOLD以上なら転生しstage0・空パスに戻ること", () => {
      const result = checkEvolution(3, "STUDY_STAMINA_LIFE", REBIRTH_THRESHOLD, 0, 0);
      expect(result.evolved).toBe(false);
      expect(result.reborn).toBe(true);
      expect(result.newStage).toBe(0);
      expect(result.newPath).toBe("");
      expect(result.resetStudy).toBe(0);
      expect(result.resetStamina).toBe(0);
      expect(result.resetLife).toBe(0);
    });

    it("転生後は evolved=false であること", () => {
      const result = checkEvolution(3, "LIFE_LIFE_LIFE", 0, 0, REBIRTH_THRESHOLD);
      expect(result.evolved).toBe(false);
      expect(result.reborn).toBe(true);
    });
  });

  describe("evolved/reborn フラグが常に含まれること", () => {
    it("通常時 reborn=false が返ること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = checkEvolution(0, "", 1, 0, 0);
      expect(result.reborn).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe("境界値テスト", () => {
    it("ステージ0: 閾値ちょうど（1pt）で孵化すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(checkEvolution(0, "", 1, 0, 0).evolved).toBe(true);
      vi.restoreAllMocks();
    });

    it("ステージ1: 閾値ちょうど（10pt）で進化すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(checkEvolution(1, "STUDY", 10, 0, 0).evolved).toBe(true);
      vi.restoreAllMocks();
    });

    it("ステージ1: 閾値-1pt（9pt）で進化しないこと", () => {
      expect(checkEvolution(1, "STUDY", 9, 0, 0).evolved).toBe(false);
    });

    it("ステージ2: 閾値ちょうど（30pt）で進化すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(checkEvolution(2, "STUDY_STAMINA", 10, 10, 10).evolved).toBe(true);
      vi.restoreAllMocks();
    });

    it("ステージ2: 閾値-1pt（29pt）で進化しないこと", () => {
      expect(checkEvolution(2, "STUDY_STAMINA", 10, 10, 9).evolved).toBe(false);
    });
  });
});

// ─── getXpInfo ────────────────────────────────────────

describe("getXpInfo", () => {
  it("ステージ0（たまご）での基本情報を返すこと", () => {
    const info = getXpInfo(0, "", 0, 0, 0);
    expect(info.totalPt).toBe(0);
    expect(info.evolutionStage).toBe(0);
    expect(info.xpInStage).toBe(0);
    expect(info.xpToEvolve).toBe(1);
    expect(info.ptNeeded).toBe(1);
    expect(info.evolutionWeights).not.toBeNull();
  });

  it("ステージ1での基本情報を返すこと", () => {
    const info = getXpInfo(1, "", 3, 2, 1);
    expect(info.totalPt).toBe(6);
    expect(info.evolutionStage).toBe(1);
    expect(info.xpInStage).toBe(6);
    expect(info.xpToEvolve).toBe(10);
    expect(info.ptNeeded).toBe(4); // 10-6
  });

  it("進化重みがパラメータ比率を反映すること", () => {
    // study 主体: study=8, stamina=1, life=1
    const info = getXpInfo(1, "", 8, 1, 1);
    expect(info.evolutionWeights).not.toBeNull();
    expect(info.evolutionWeights!.STUDY).toBeGreaterThan(info.evolutionWeights!.STAMINA);
  });

  it("ステージ2での進化情報を返すこと", () => {
    const info = getXpInfo(2, "STUDY", 10, 5, 5);
    expect(info.totalPt).toBe(20);
    expect(info.xpToEvolve).toBe(30);
    expect(info.ptNeeded).toBe(10); // 30-20
  });

  it("最大ステージ（3）ではevolutionWeightsがnullであること", () => {
    const info = getXpInfo(3, "STUDY_STAMINA_LIFE", 100, 100, 100);
    expect(info.evolutionStage).toBe(3);
    expect(info.xpToEvolve).toBeNull();
    expect(info.evolutionWeights).toBeNull();
    expect(info.ptNeeded).toBeNull();
  });

  it("ポイント0でも正常に計算されること（ステージ1）", () => {
    const info = getXpInfo(1, "", 0, 0, 0);
    expect(info.totalPt).toBe(0);
    expect(info.ptNeeded).toBe(10);
  });

  it("ステージが範囲外の場合、最大ステージにクランプされること", () => {
    const info = getXpInfo(99, "STUDY_STAMINA_LIFE", 10, 10, 10);
    expect(info.evolutionStage).toBe(3);
    expect(info.xpToEvolve).toBeNull();
    expect(info.evolutionWeights).toBeNull();
  });

  it("ptNeededが負になるケース（閾値超過）", () => {
    const info = getXpInfo(1, "", 5, 3, 3);
    expect(info.ptNeeded).toBe(-1); // 10-11 = -1
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
