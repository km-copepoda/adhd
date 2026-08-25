"use client";

// モンスター図鑑の本体 UI。
// 旧 `/app/child/zukan` の中身を抽出し、コレクションタブ (`/app/child/collection`)
// と既存 `/app/child/zukan` の両方から同じ内容を表示できるようにした。
// マウント時に lastSeenCollectedCount を更新して BottomNav バッジを既読化する副作用は
// このコンポーネント側に持たせる（旧ページからもタブからも自動で動く）。
//
// Issue #86: 図鑑のテーマ別タブ対応。
// 所持テーマ（ownedThemes）ごとにタブを表示し、アクティブなタブのモンスター表・卵のみを
// DOM に描画する（非アクティブなタブの内容はアンマウントする）。未所持テーマのタブ・
// 紹介カードは一切表示しない（購入前に内容を見せない、という docs/decisions.md の方針）。
// テーマ構成（モンスター表・卵画像）は @/lib/monsterThemes/index の MONSTER_THEMES を正とし、
// 旧 side ベースの MONSTER_TABLE / MONSTER_TABLE_LIGHT 直接切り替えは行わない。

import { useEffect, useState } from "react";
import { getEvolutionChildren, themeIdFromSide } from "@/lib/monsters";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";
import { hasCollectedPath } from "@/lib/monsterThemes/collectedPaths";
import LoadingSpinner from "@/components/LoadingSpinner";
import MonsterImageModal from "@/components/MonsterImageModal";
import { getZukanStageLabel } from "@/lib/zukanStageLabel";
import ZukanEggSection from "./ZukanEggSection";
import ZukanEvolutionBranch from "./ZukanEvolutionBranch";

type ZukanApiResponse = {
  side?: string | null;
  collectedPaths?: string;
  monsterLevels?: string;
  usedEggBonuses?: string;
  monsterSetId?: string;
  ownedThemes?: string[];
};

type ZukanData = {
  collectedPaths: string;
  monsterLevels: string;
  usedEggBonuses: string;
  ownedThemes: string[];
};

type SelectedMonster = { image: string; name: string; stageLabel: string };

interface ZukanContentProps {
  /** 取得元 API。親モードでは /api/parent/child-view/monster?childId=X を渡す。 */
  fetchUrl?: string;
  /** localStorage 既読フラグを更新するか。親モードでは false（親端末の子供バッジに影響させない）。 */
  trackVisit?: boolean;
}

/**
 * API レスポンスから所持テーマ一覧を決定する。
 * ownedThemes を返さない旧レスポンス（親代理ビュー等）との後方互換のため、
 * ownedThemes が空・未指定の場合は現在のテーマ（monsterSetId、無ければ side から変換）
 * のみを所持テーマとして扱う。
 */
function resolveOwnedThemes(d: ZukanApiResponse): { ownedThemes: string[]; currentTheme: string } {
  const currentTheme = d.monsterSetId && MONSTER_THEMES[d.monsterSetId]
    ? d.monsterSetId
    : themeIdFromSide(d.side);
  const owned = (d.ownedThemes ?? []).filter((id) => MONSTER_THEMES[id]);
  const ownedThemes = owned.length > 0 ? owned : [currentTheme];
  return { ownedThemes, currentTheme };
}

export default function ZukanContent({
  fetchUrl = "/api/monster",
  trackVisit = true,
}: ZukanContentProps = {}) {
  const [data, setData] = useState<ZukanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedMonster | null>(null);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  useEffect(() => {
    fetch(fetchUrl)
      .then((r) => r.json())
      .then((d: ZukanApiResponse) => {
        const paths = d.collectedPaths ?? "[]";
        const { ownedThemes, currentTheme } = resolveOwnedThemes(d);
        setData({
          collectedPaths: paths,
          monsterLevels: d.monsterLevels ?? "{}",
          usedEggBonuses: d.usedEggBonuses ?? "[]",
          ownedThemes,
        });
        setActiveTheme(ownedThemes.includes(currentTheme) ? currentTheme : ownedThemes[0]);
        if (trackVisit) {
          const count = (JSON.parse(paths) as string[]).length;
          localStorage.setItem("lastSeenCollectedCount", String(count));
        }
      })
      .finally(() => setLoading(false));
  }, [fetchUrl, trackVisit]);

  if (loading || !data || !activeTheme) return <LoadingSpinner />;

  const collectedPathsList = JSON.parse(data.collectedPaths) as string[];
  const usedEggs = new Set<string>(JSON.parse(data.usedEggBonuses) as string[]);
  const monsterLevels = JSON.parse(data.monsterLevels) as Record<string, number>;

  const openModal = (image: string, name: string, path: string) =>
    setSelected({ image, name, stageLabel: getZukanStageLabel(path) });

  const activeThemeDef = MONSTER_THEMES[activeTheme];
  const monsterTable = activeThemeDef.table;
  const eggData = { image: activeThemeDef.eggImage };
  // collectedPaths はテーマ名前空間付き（"{themeId}:{path}"）または旧形式（裸のパス、
  // 無料テーマのみ）で記録されている。ZukanEvolutionBranch は裸のパスで collected.has()
  // を検索するため、アクティブテーマに属するパスのみを含む Set に変換して渡す。
  const collected = new Set<string>(
    Object.keys(monsterTable).filter((path) =>
      hasCollectedPath(collectedPathsList, activeTheme, path),
    ),
  );
  const total = collected.size;
  const max = Object.keys(monsterTable).length;

  const stage1Keys = getEvolutionChildren("");

  return (
    <div className="px-4 pt-6 pb-24">
      <style>{`
        @keyframes s3-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      {/* ── ヘッダー ── */}
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-1 text-center">
        📖 モンスター図鑑
      </h1>
      <p className="text-quest-dim text-xs text-center mb-4">
        {total} / {max} 体
      </p>

      {/* ── テーマタブ（所持テーマのみ表示） ── */}
      {data.ownedThemes.length > 0 && (
        <div className="flex gap-1 justify-center mb-4" role="tablist">
          {data.ownedThemes.map((themeId) => {
            const theme = MONSTER_THEMES[themeId];
            if (!theme) return null;
            const isActive = themeId === activeTheme;
            return (
              <button
                key={themeId}
                type="button"
                data-testid={`zukan-theme-tab-${themeId}`}
                aria-selected={isActive}
                role="tab"
                onClick={() => setActiveTheme(themeId)}
                className="flex-1 text-xs py-1.5 rounded-md font-bold tracking-wider transition-colors"
                style={
                  isActive
                    ? { background: "rgba(251,191,36,0.2)", color: "var(--quest-gold, #fbbf24)", border: "1px solid rgba(251,191,36,0.3)" }
                    : { color: "var(--quest-dim, #9a8c6e)", border: "1px solid transparent" }
                }
              >
                {theme.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── アクティブテーマのパネル（非アクティブなタブの内容はアンマウント） ── */}
      <div key={activeTheme} data-testid={`zukan-theme-panel-${activeTheme}`}>
        {/* ── 卵 ── */}
        <ZukanEggSection eggData={eggData} usedEggs={usedEggs} monsterSetId={activeTheme} />

        {/* ── 3系統ブランチ ── */}
        {stage1Keys.map((s1) => (
          <ZukanEvolutionBranch
            key={s1}
            s1={s1}
            collected={collected}
            monsterLevels={monsterLevels}
            monsterTable={monsterTable}
            themeId={activeTheme}
            openModal={openModal}
          />
        ))}
      </div>

      {selected && (
        <MonsterImageModal
          image={selected.image}
          monsterName={selected.name}
          stageLabel={selected.stageLabel}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
