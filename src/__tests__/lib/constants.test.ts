import { describe, it, expect, vi } from "vitest";
import { MONSTER_TABLE, MONSTER_TABLE_LIGHT, getMonsterStage, getEvolutionChildren } from "@/lib/monsters";
import { EVOLUTION_THRESHOLDS, REBIRTH_THRESHOLD, REBIRTH_EGG_THRESHOLD, checkEvolution, getXpInfo, computeEvolutionWeights, selectEvolutionPath, applyEggBonus } from "@/lib/evolution";
import { CATEGORY_LABEL, CATEGORY_COLOR, DAY_LABELS, TEMP_TASK_TEMPLATES, generateFamilyCode, generateChildCode } from "@/lib/categories";
import { STREAK_MILESTONES, getStreakTitle, getNewMilestoneBonus, getNewlyUnlockedMilestone, getUnreadAchievements, shouldShowMonsterBadge, shouldShowZukanBadge, getNewBadgeCount, distributeBonus } from "@/lib/streakMilestones";

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

describe("REBIRTH_EGG_THRESHOLD", () => {
  it("5であること", () => {
    expect(REBIRTH_EGG_THRESHOLD).toBe(5);
  });

  it("EVOLUTION_THRESHOLDS[0]（初回孵化）より大きいこと", () => {
    expect(REBIRTH_EGG_THRESHOLD).toBeGreaterThan(EVOLUTION_THRESHOLDS[0]!);
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
    expect(stage.image).toBe("/monsters/dark/egg.webp");
    expect(stage.ptToEvolve).toBe(1);
  });

  it("stage0でthemeId=lightのときかわいい系卵画像を返すこと", () => {
    const stage = getMonsterStage(0, "", "light");
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

  it("themeId=darkの場合darkテーブルの画像を返すこと", () => {
    const stage = getMonsterStage(1, "STUDY", "dark");
    expect(stage.image).toBe(MONSTER_TABLE["STUDY"].image);
  });

  it("themeId=lightの場合lightテーブルの画像を返すこと", () => {
    const stage = getMonsterStage(1, "STUDY", "light");
    expect(stage.image).toBe(MONSTER_TABLE_LIGHT["STUDY"].image);
  });

  it("themeId未指定はdarkと同じ結果を返すこと", () => {
    const withoutTheme = getMonsterStage(1, "STUDY");
    const withDark = getMonsterStage(1, "STUDY", "dark");
    expect(withoutTheme.image).toBe(withDark.image);
    expect(withoutTheme.name).toBe(withDark.name);
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

  describe("転生後の卵（isReborn=true）", () => {
    it("isReborn=true かつ stage0 で 1pt では孵化しないこと", () => {
      const result = checkEvolution(0, "", 1, 0, 0, true);
      expect(result.evolved).toBe(false);
      expect(result.newStage).toBe(0);
    });

    it("isReborn=true かつ stage0 で REBIRTH_EGG_THRESHOLD pt で孵化すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = checkEvolution(0, "", REBIRTH_EGG_THRESHOLD, 0, 0, true);
      expect(result.evolved).toBe(true);
      expect(result.newStage).toBe(1);
      vi.restoreAllMocks();
    });

    it("isReborn=false（初回）は REBIRTH_EGG_THRESHOLD pt 未満でも 1pt で孵化すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = checkEvolution(0, "", 1, 0, 0, false);
      expect(result.evolved).toBe(true);
      expect(result.newStage).toBe(1);
      vi.restoreAllMocks();
    });

    it("isReborn 未指定（デフォルト）は初回扱いで 1pt で孵化すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = checkEvolution(0, "", 1, 0, 0);
      expect(result.evolved).toBe(true);
      vi.restoreAllMocks();
    });

    it("isReborn=true でも stage1 以降の進化閾値は変わらないこと", () => {
      const result = checkEvolution(1, "STUDY", 9, 0, 0, true);
      expect(result.evolved).toBe(false); // 9pt < 10pt
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

  describe("転生後の卵（isReborn=true）", () => {
    it("isReborn=true かつ stage0 は xpToEvolve=REBIRTH_EGG_THRESHOLD を返すこと", () => {
      const info = getXpInfo(0, "", 0, 0, 0, true);
      expect(info.xpToEvolve).toBe(REBIRTH_EGG_THRESHOLD);
      expect(info.ptNeeded).toBe(REBIRTH_EGG_THRESHOLD);
    });

    it("isReborn=false（初回）は xpToEvolve=1 を返すこと", () => {
      const info = getXpInfo(0, "", 0, 0, 0, false);
      expect(info.xpToEvolve).toBe(1);
      expect(info.ptNeeded).toBe(1);
    });

    it("isReborn 未指定はデフォルト false で xpToEvolve=1 を返すこと", () => {
      const info = getXpInfo(0, "", 0, 0, 0);
      expect(info.xpToEvolve).toBe(1);
    });

    it("isReborn=true でも stage1 以降の xpToEvolve は変わらないこと", () => {
      const info = getXpInfo(1, "STUDY", 0, 0, 0, true);
      expect(info.xpToEvolve).toBe(10);
    });
  });
  
  describe("卵ボーナス（eggBonusCategory）", () => {
    it("eggBonusCategory=STUDY で STUDY の確率が絶対値+20%されること", () => {
      // ポイント均等 -> ベースは1/3ずつ
      const info = getXpInfo(0, "", 1, 1, 1, false, "STUDY");
      expect(info.evolutionWeights).not.toBeNull();
      // STUDY: 33% + 20% = 53%, 残りは比例縮小
      expect(info.evolutionWeights!.STUDY).toBeCloseTo(1 / 3 + 0.2, 4);
      // 残り: (1/3) * (1 - 0.5333) / (2/3) = 0.2333
      const remaining = (1 - (1 / 3 + 0.2)) / 2;
      expect(info.evolutionWeights!.STAMINA).toBeCloseTo(remaining, 4);
      expect(info.evolutionWeights!.LIFE).toBeCloseTo(remaining, 4);
    });
    
    it("eggBonusCategory=null の場合はベース重みのままであること", () => {
      const withBonus = getXpInfo(0, "", 1, 1, 1, false, null);
      const without = getXpInfo(0, "", 1, 1, 1, false);
      expect(withBonus.evolutionWeights).toEqual(without.evolutionWeights);
    });
    
    it("eggBonusCategory=undefined の場合はベース重みのままであること", () => {
      const info = getXpInfo(0, "", 1, 1, 1, false, undefined);
      expect(info.evolutionWeights!.STUDY).toBeCloseTo(1 / 3, 4);
    });
    
    it("最終形態（stage3）では eggBonusCategory があっても evolutionWeights はnull", () => {
      const info = getXpInfo(3, "STUDY_STAMINA_LIFE", 10, 10, 10, false, "STUDY");
      expect(info.evolutionWeights).toBeNull();
    });
    
    it("偏ったポイントに卵ボーナスを加算しても合計が1になること", () => {
      const info = getXpInfo(1, "STUDY", 8, 1, 1, false, "LIFE");
      expect(info.evolutionWeights).not.toBeNull();
      const sum = info.evolutionWeights!.STUDY + info.evolutionWeights!.STAMINA + info.evolutionWeights!.LIFE;
      expect(sum).toBeCloseTo(1, 4);
    });
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

// ─── getNewlyUnlockedMilestone ───────────────────────

describe("getNewlyUnlockedMilestone", () => {
  it("lastSeenTitle が null（初回訪問）の場合は null を返すこと", () => {
    expect(getNewlyUnlockedMilestone(null, "はじめの一歩")).toBeNull();
  });

  it("lastSeenTitle と currentTitle が同じなら null を返すこと", () => {
    expect(getNewlyUnlockedMilestone("はじめの一歩", "はじめの一歩")).toBeNull();
  });

  it("currentTitle が null の場合は null を返すこと", () => {
    expect(getNewlyUnlockedMilestone("はじめの一歩", null)).toBeNull();
  });

  it("currentTitle が空文字の場合は null を返すこと", () => {
    expect(getNewlyUnlockedMilestone("はじめの一歩", "")).toBeNull();
  });

  it("称号が変わった場合は対応するマイルストーンを返すこと", () => {
    const result = getNewlyUnlockedMilestone("はじめの一歩", "一週間の戦士");
    expect(result).toMatchObject({ title: "一週間の戦士", emoji: "⚔️", days: 7 });
  });

  it("前回称号なし（空文字）から新称号解除の場合はマイルストーンを返すこと", () => {
    const result = getNewlyUnlockedMilestone("", "はじめの一歩");
    expect(result).toMatchObject({ title: "はじめの一歩", emoji: "🔥", days: 3 });
  });

  it("存在しない称号名の場合は null を返すこと", () => {
    expect(getNewlyUnlockedMilestone("", "存在しない称号")).toBeNull();
  });
});

// ─── shouldShowMonsterBadge ──────────────────────────

describe("shouldShowMonsterBadge", () => {
  it("lastSeenStage が null（未訪問）なら false を返すこと", () => {
    expect(shouldShowMonsterBadge(3, null)).toBe(false);
  });

  it("現在のステージが前回より大きい場合 true を返すこと", () => {
    expect(shouldShowMonsterBadge(3, "2")).toBe(true);
  });

  it("現在のステージと前回が同じなら false を返すこと", () => {
    expect(shouldShowMonsterBadge(3, "3")).toBe(false);
  });

  it("前回より現在が小さい（あり得ないが）場合も false を返すこと", () => {
    expect(shouldShowMonsterBadge(1, "3")).toBe(false);
  });
});

// ─── shouldShowZukanBadge ────────────────────────────

describe("shouldShowZukanBadge", () => {
  it("lastSeenCount が null（未訪問）なら false を返すこと", () => {
    expect(shouldShowZukanBadge(3, null)).toBe(false);
  });

  it("コレクション数が前回より多い場合 true を返すこと", () => {
    expect(shouldShowZukanBadge(3, "2")).toBe(true);
  });

  it("コレクション数が前回と同じなら false を返すこと", () => {
    expect(shouldShowZukanBadge(3, "3")).toBe(false);
  });

  it("コレクション数0・前回も0なら false を返すこと", () => {
    expect(shouldShowZukanBadge(0, "0")).toBe(false);
  });
});

// ─── getUnreadAchievements ───────────────────────────

describe("getUnreadAchievements", () => {
  it("ストリーク0では空配列を返すこと", () => {
    expect(getUnreadAchievements(0, [])).toHaveLength(0);
  });

  it("達成済みマイルストーンが未読の場合はすべて返すこと", () => {
    const result = getUnreadAchievements(7, []);
    expect(result).toHaveLength(2); // 3日と7日
    expect(result.map(m => m.title)).toContain("はじめの一歩");
    expect(result.map(m => m.title)).toContain("一週間の戦士");
  });

  it("既読マイルストーンは除外すること", () => {
    const result = getUnreadAchievements(7, ["はじめの一歩"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("一週間の戦士");
  });

  it("すべて既読の場合は空配列を返すこと", () => {
    const result = getUnreadAchievements(7, ["はじめの一歩", "一週間の戦士"]);
    expect(result).toHaveLength(0);
  });

  it("未達成のマイルストーンは含まないこと", () => {
    const result = getUnreadAchievements(3, []);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("はじめの一歩");
    expect(result.map(m => m.title)).not.toContain("一週間の戦士");
  });

  it("境界値: ちょうどマイルストーン日数で達成とみなすこと", () => {
    expect(getUnreadAchievements(3, [])).toHaveLength(1);
    expect(getUnreadAchievements(2, [])).toHaveLength(0);
  });
});

// ─── getNewBadgeCount ────────────────────────────────

describe("getNewBadgeCount", () => {
  it("lastSeenCount が null（未訪問）なら 0 を返すこと", () => {
    expect(getNewBadgeCount(5, null)).toBe(0);
  });

  it("解除数が前回より多い場合は差分を返すこと", () => {
    expect(getNewBadgeCount(5, "3")).toBe(2);
  });

  it("解除数が前回と同じなら 0 を返すこと", () => {
    expect(getNewBadgeCount(5, "5")).toBe(0);
  });

  it("解除数が前回より少ない（あり得ないが）場合は 0 を返すこと", () => {
    expect(getNewBadgeCount(3, "5")).toBe(0);
  });

  it("初回訪問後（lastSeen='0'）に1個解除された場合は 1 を返すこと", () => {
    expect(getNewBadgeCount(1, "0")).toBe(1);
  });

  it("解除数も前回も 0 なら 0 を返すこと", () => {
    expect(getNewBadgeCount(0, "0")).toBe(0);
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

// ─── getEvolutionChildren ────────────────────────────

describe("getEvolutionChildren", () => {
  it("卵（空文字列）の子はStage1の3体であること", () => {
    expect(getEvolutionChildren("").sort()).toEqual(["LIFE", "STAMINA", "STUDY"]);
  });

  it("Stage1パスの子はStage2の3体であること", () => {
    expect(getEvolutionChildren("STUDY").sort()).toEqual(
      ["STUDY_LIFE", "STUDY_STAMINA", "STUDY_STUDY"]
    );
  });

  it("STAMINAのStage2子も正しく返すこと", () => {
    expect(getEvolutionChildren("STAMINA").sort()).toEqual(
      ["STAMINA_LIFE", "STAMINA_STAMINA", "STAMINA_STUDY"]
    );
  });

  it("Stage2パスの子はStage3の3体であること", () => {
    expect(getEvolutionChildren("STUDY_STAMINA").sort()).toEqual(
      ["STUDY_STAMINA_LIFE", "STUDY_STAMINA_STAMINA", "STUDY_STAMINA_STUDY"]
    );
  });

  it("Stage3パスの子は空配列（最終形態）であること", () => {
    expect(getEvolutionChildren("STUDY_STAMINA_LIFE")).toEqual([]);
  });

  it("Stage1パスが誤って含まれないこと（STAMINAがSTUDYの子にならない）", () => {
    const children = getEvolutionChildren("STUDY");
    expect(children).not.toContain("STAMINA");
    expect(children).not.toContain("LIFE");
  });
});

// ─── TEMP_TASK_TEMPLATES ─────────────────────────────

describe("TEMP_TASK_TEMPLATES", () => {
  it("1件以上のテンプレートが定義されていること", () => {
    expect(TEMP_TASK_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("全テンプレートにtitleとcategoryが存在すること", () => {
    for (const tpl of TEMP_TASK_TEMPLATES) {
      expect(typeof tpl.title).toBe("string");
      expect(tpl.title.length).toBeGreaterThan(0);
      expect(["STUDY", "STAMINA", "LIFE"]).toContain(tpl.category);
    }
  });

  it("3カテゴリ（STUDY/STAMINA/LIFE）が各1件以上含まれること", () => {
    const categories = TEMP_TASK_TEMPLATES.map((t) => t.category);
    expect(categories).toContain("STUDY");
    expect(categories).toContain("STAMINA");
    expect(categories).toContain("LIFE");
  });

  it("タイトルが重複しないこと", () => {
    const titles = TEMP_TASK_TEMPLATES.map((t) => t.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });
});

// ─── selectEvolutionPath (egg bonus) ─────────────────

// ─── applyEggBonus ─────────────────

describe("applyEggBonus", () => {
  it("均等ベースに STUDY ボーナスで 53%/23%/23%になること", () => {
    const w = { STUDY: 1 / 3, STAMINA: 1 / 3, LIFE: 1 / 3 };
    applyEggBonus(w, "STUDY");
    expect(w.STUDY).toBeCloseTo(1 / 3 + 0.2, 4);
    expect(w.STAMINA).toBeCloseTo(w.LIFE, 4);
    expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1, 4);
  });

  it("偏ったベース(0.6/0.3/0.1に最大カテゴリのボーナスで 80%/10%/10% になること", () => {
    const w = { STUDY: 0.6, STAMINA: 0.3, LIFE: 0.1 };
    applyEggBonus(w, "STUDY");
    expect(w.STUDY).toBeCloseTo(0.8, 4);
    expect(w.STAMINA).toBeCloseTo(0.15, 4);
    expect(w.LIFE).toBeCloseTo(0.05, 4);
    expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1, 4);
  });
  
  it("偏ったベースに最小カテゴリのボーナスでも合計が1になること", () => {
    const w = { STUDY: 0.6, STAMINA: 0.3, LIFE: 0.1 };
    applyEggBonus(w, "LIFE");
    expect(w.LIFE).toBeCloseTo(0.3, 4);
    expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1, 4);
  });

  it("無効なカテゴリでは何も変わらないこと", () => {
    const w = { STUDY: 0.5, STAMINA: 0.3, LIFE: 0.2 };
    const before = { ...w };
    applyEggBonus(w, "INVALID");
    expect(w).toEqual(before);
  });
});

describe("selectEvolutionPath with eggBonusCategory", () => {
  it("eggBonusCategory=STUDYで確率の合計が1.0であること", () => {
    // bonusを適用後も合計は1.0（絶対値+20%, 残りを比例縮小）
    // weights without bonus: STUDY=0.6, STAMINA=0.2, LIFE=0.2
    // +0.2 to STUDY -> STUDY = 0.8, 残り0.2を比例分配 -> STAMINA=0.1, LIFE=0.1
    for (const r of [0, 0.3, 0.6, 0.8, 0.99]) {
      vi.spyOn(Math, "random").mockReturnValue(r);
      const path = selectEvolutionPath(80, 10, 10, "STUDY");
      expect(["STUDY", "STAMINA", "LIFE"]).toContain(path);
      vi.restoreAllMocks();
    }
  });

  it("eggBonusCategory=STUDYでSTUDY選択確率が上がること（r=0.75はSTUDYになる）", () => {
    // bonus なし: STUDY=0.6, STAMINA=0.2, LIFE=0.2 -> r=0.75 は STAMINA
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    expect(selectEvolutionPath(80, 10, 10)).toBe("STAMINA");
    vi.restoreAllMocks();

    // bonus あり: STUDY≈0.8 → r=0.75 は STUDY
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    expect(selectEvolutionPath(80, 10, 10, "STUDY")).toBe("STUDY");
    vi.restoreAllMocks();
  });

  it("eggBonusCategory=STAMINAでSTAMINA選択確率が上がること", () => {
    // 均等（0,0,0）: STUDY=STAMINA=LIFE=1/3≈0.333
    // STAMINA bonus（絶対値+20%）: STAMINA=0.533, 残り0.467を比例分配
    // -> STUDY=0.233, STAMINA=0.533, LIFE=0.233
    // r=0.4 -> cumulative: STUDY=0.233 < 0.4, STAMINA=0.233+0.533=0.767 >= 0.4 -> STAMINA
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    const path = selectEvolutionPath(0, 0, 0, "STAMINA");
    expect(path).toBe("STAMINA");
    vi.restoreAllMocks();
  });

  it("eggBonusCategoryがnullの場合はbonusなしと同じ動作をすること", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const withNull = selectEvolutionPath(80, 10, 10, null);
    const withUndefined = selectEvolutionPath(80, 10, 10);
    expect(withNull).toBe(withUndefined);
    vi.restoreAllMocks();
  });

  it("eggBonusCategoryが無効な値の場合はbonusなしと同じ動作をすること", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const withInvalid = selectEvolutionPath(80, 10, 10, "INVALID");
    const withUndefined = selectEvolutionPath(80, 10, 10);
    expect(withInvalid).toBe(withUndefined);
    vi.restoreAllMocks();
  });
});

// ─── checkEvolution with eggBonusCategory ────────────

describe("checkEvolution with eggBonusCategory (egg bonus)", () => {
  it("eggBonusCategoryがSTUDYの場合、進化パス選択にbonusが適用されること", () => {
    // r=0.65: bonus=STUDYなし→STAMINA, bonus=STUDY→STUDY になることを確認
    vi.spyOn(Math, "random").mockReturnValue(0.65);
    const withoutBonus = checkEvolution(1, "STAMINA", 80, 10, 10, false);
    vi.restoreAllMocks();

    vi.spyOn(Math, "random").mockReturnValue(0.65);
    const withBonus = checkEvolution(1, "STAMINA", 80, 10, 10, false, "STUDY");
    vi.restoreAllMocks();

    expect(withoutBonus.newPath).toBe("STAMINA_STAMINA");
    expect(withBonus.newPath).toBe("STAMINA_STUDY");
  });

  it("eggBonusCategoryがnullでも正常に動作すること", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = checkEvolution(1, "STUDY", 10, 0, 0, false, null);
    expect(result.evolved).toBe(true);
    vi.restoreAllMocks();
  });

  it("転生判定にeggBonusCategoryは影響しないこと", () => {
    const result = checkEvolution(3, "STUDY_STAMINA_LIFE", REBIRTH_THRESHOLD, 0, 0, false, "STUDY");
    expect(result.reborn).toBe(true);
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
