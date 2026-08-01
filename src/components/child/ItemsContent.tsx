"use client";

// コレクションアイテム (宝箱で親ごほうび不当選時に獲得) の図鑑タブ。
// 仕様: docs/未実装仕様書/treasure-collection-items.md (通常 80種)
//       docs/未実装仕様書/monthly-limited-collection-items.md (月限定 60種)
//
// - 現在シーズン (春/夏/秋/冬) をデフォルト表示し、シーズンタブで切替可能
// - 各シーズン 20種の通常アイテム + 15種の月限定 (5 × 3ヶ月) = 35種を持つ
// - 通常アイテムはカテゴリ別グリッド、月限定はシーズン内 3ヶ月の月別行で表示
// - 現在シーズンのタブでは、最上部に「今月のげんてい」を残日数付きでピン留め

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  CATEGORY_LABEL,
  SEASON_LABEL,
  getSeasonByMonth,
  type CollectionCategory,
  type CollectionRarity,
  type CollectionSeason,
} from "@/lib/collectionItems";
import { todayStringJST } from "@/lib/date";

interface ApiItem {
  id: string;
  season: CollectionSeason;
  category: CollectionCategory;
  rarity: CollectionRarity;
  name: string;
  description: string;
  image: string;
  month?: number;
  owned: boolean;
  count: number;
  firstAcquiredAt: string | null;
  lastAcquiredAt: string | null;
}

interface ApiResponse {
  currentSeason: CollectionSeason;
  currentMonth: number;
  items: ApiItem[];
}

interface Props {
  fetchUrl?: string;
}

const SEASON_ORDER: CollectionSeason[] = ["spring", "summer", "fall", "winter"];

const SEASON_EMOJI: Record<CollectionSeason, string> = {
  spring: "🌸",
  summer: "🌻",
  fall: "🍁",
  winter: "❄️",
};

const RARITY_COLOR_HEX: Record<CollectionRarity, string> = {
  COMMON: "rgba(96,165,250,0.4)",
  UNCOMMON: "rgba(168,85,247,0.5)",
  RARE: "rgba(251,191,36,0.7)",
};

const RARITY_LABEL: Record<CollectionRarity, string> = {
  COMMON: "★",
  UNCOMMON: "★★",
  RARE: "★★★",
};

const CATEGORY_ORDER: CollectionCategory[] = [
  "creature",
  "food",
  "jewel",
  "tool",
  "nature",
];

// シーズンごとに月限定アイテムが登場する 3ヶ月を返す (spring: 3,4,5 など)
function monthsInSeason(season: CollectionSeason): number[] {
  switch (season) {
    case "spring": return [3, 4, 5];
    case "summer": return [6, 7, 8];
    case "fall":   return [9, 10, 11];
    case "winter": return [12, 1, 2];
  }
}

// JST 基準で「今月末までの残り日数（今日を含む）」を返す
function daysLeftInMonth(now: Date = new Date()): number {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth();
  const day = jst.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return daysInMonth - day + 1;
}

export default function ItemsContent({ fetchUrl = "/api/collection-items" }: Props = {}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<CollectionSeason | null>(null);
  const [selected, setSelected] = useState<ApiItem | null>(null);

  useEffect(() => {
    fetch(fetchUrl)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setData(d);
        setSeason((s) => s ?? d.currentSeason);
      })
      .finally(() => setLoading(false));
  }, [fetchUrl]);

  const grouped = useMemo(() => {
    if (!data || !season) return null;
    // カテゴリ別グリッドには通常アイテム (month === undefined) のみを配置。
    // 月限定はシーズン内の別セクションで表示する。
    const regular = data.items.filter((i) => i.season === season && i.month === undefined);
    const byCat: Record<CollectionCategory, ApiItem[]> = {
      creature: [],
      food: [],
      jewel: [],
      tool: [],
      nature: [],
    };
    for (const it of regular) byCat[it.category].push(it);
    return byCat;
  }, [data, season]);

  if (loading || !data || !season) return <LoadingSpinner />;

  const todayStr = todayStringJST();
  const isAcquiredToday = (lastAcquiredAt: string | null): boolean => {
    if (!lastAcquiredAt) return false;
    const jstDate = new Date(new Date(lastAcquiredAt).getTime() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return jstDate === todayStr;
  };

  // 表示中シーズンの通常/月限定を分けて集計 (母数分離で達成感の目減りを防ぐ)
  const seasonRegular = data.items.filter(
    (i) => i.season === season && i.month === undefined,
  );
  const seasonMonthly = data.items.filter(
    (i) => i.season === season && i.month !== undefined,
  );
  const ownedRegularInSeason = seasonRegular.filter((i) => i.owned).length;
  const ownedMonthlyInSeason = seasonMonthly.filter((i) => i.owned).length;

  // 全体でも「通常/月限定」を分けて表示
  const allRegular = data.items.filter((i) => i.month === undefined);
  const allMonthly = data.items.filter((i) => i.month !== undefined);
  const totalOwnedRegular = allRegular.filter((i) => i.owned).length;
  const totalOwnedMonthly = allMonthly.filter((i) => i.owned).length;
  const todayCount = data.items.filter((i) => i.owned && isAcquiredToday(i.lastAcquiredAt)).length;

  const currentMonth = data.currentMonth;
  const currentMonthlyItems = data.items
    .filter((i) => i.month === currentMonth)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const isCurrentSeasonTab = season === data.currentSeason;
  const showCurrentMonthPin = isCurrentSeasonTab && currentMonthlyItems.length > 0;
  const remainingDays = showCurrentMonthPin ? daysLeftInMonth() : 0;

  // 月別セクション用のデータ
  const monthlyGroups = monthsInSeason(season).map((m) => {
    const items = data.items
      .filter((i) => i.month === m)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    const owned = items.filter((i) => i.owned).length;
    let status: "past" | "current" | "future" = "past";
    if (m === currentMonth && getSeasonByMonth(currentMonth) === season) {
      status = "current";
    } else {
      // 今月と比較して未来/過去を判定 (境界の年をまたぐ winter は「シーズンが同じか」で判定)
      // 現在シーズンでない = 過去 or 未来。同じシーズン内では月番号比較で決める。
      if (season !== data.currentSeason) {
        // ざっくり: 未実装だが現在シーズン外は「過去 or 未来」ラベルは付けない
        status = "past";
      } else if (m > currentMonth || (season === "winter" && currentMonth < 12 && m === 12)) {
        status = "future";
      } else {
        status = "past";
      }
    }
    return { month: m, items, owned, status };
  });

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-1 text-center">
        🎁 コレクションアイテム
      </h1>
      <p className="text-quest-dim text-xs text-center mb-4">
        つうじょう <span className="text-quest-text font-bold">{totalOwnedRegular}</span> /{" "}
        {allRegular.length}
        <span className="mx-2 opacity-40">|</span>
        げんてい <span className="text-quest-text font-bold">{totalOwnedMonthly}</span> /{" "}
        {allMonthly.length}
        {todayCount > 0 && (
          <span className="ml-2 text-quest-mint">
            （きょう +{todayCount}）
          </span>
        )}
      </p>

      {/* シーズンタブ */}
      <div className="flex gap-1 mb-4 justify-center">
        {SEASON_ORDER.map((s) => {
          const isActive = s === season;
          const isCurrent = s === data.currentSeason;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSeason(s)}
              className={`flex-1 max-w-24 text-xs py-1.5 rounded-md font-bold tracking-wider transition-colors border ${
                isActive
                  ? "bg-quest-gold/20 text-quest-gold border-quest-gold/30"
                  : "text-quest-dim border-transparent hover:text-quest-text"
              }`}
            >
              {SEASON_EMOJI[s]} {SEASON_LABEL[s]}
              {isCurrent && (
                <span className="ml-1 text-[9px] text-quest-mint">今</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-quest-dim text-[11px] mb-4">
        {SEASON_LABEL[season]}: つうじょう {ownedRegularInSeason} / {seasonRegular.length}
        <span className="mx-1 opacity-40">・</span>
        げんてい {ownedMonthlyInSeason} / {seasonMonthly.length}
      </p>

      {/* 現在シーズンの最上部に「今月のげんてい」をピン留め */}
      {showCurrentMonthPin && (
        <div className="mb-6 border border-quest-gold/40 rounded-lg p-3 bg-quest-gold/5">
          <h2 className="text-xs font-bold text-quest-gold tracking-widest mb-2 flex items-center gap-2">
            ✨ {currentMonth}月のげんてい
            <span className="ml-auto text-[10px] text-quest-mint font-normal">
              のこり{remainingDays}日！
            </span>
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {currentMonthlyItems.map((it) => (
              <MonthlyThumb
                key={it.id}
                item={it}
                isNew={isAcquiredToday(it.lastAcquiredAt)}
                onClick={() => it.owned && setSelected(it)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 月別セクション (シーズン内 3ヶ月) */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-quest-dim tracking-widest mb-2">
          月げんてい
        </h2>
        {monthlyGroups.map(({ month: m, items, owned, status }) => (
          <div key={m} className="mb-3">
            <div className="text-[11px] text-quest-dim mb-1 flex items-center">
              <span className="mr-2">
                {m}月のげんてい {owned}/{items.length}
              </span>
              {status === "current" && (
                <span className="text-quest-mint text-[10px]">◀今月</span>
              )}
              {status === "future" && (
                <span className="text-quest-dim text-[10px]">{m}月になったらとうじょう！</span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {items.map((it) => (
                <MonthlyThumb
                  key={it.id}
                  item={it}
                  isNew={isAcquiredToday(it.lastAcquiredAt)}
                  showFuturePlaceholder={status === "future"}
                  onClick={() => it.owned && setSelected(it)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* カテゴリーごとに通常アイテムを表示 */}
      {grouped &&
        CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-5">
              <h2 className="text-xs font-bold text-quest-dim tracking-widest mb-2">
                {CATEGORY_LABEL[cat]}
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => it.owned && setSelected(it)}
                    disabled={!it.owned}
                    className={`bg-quest-card border rounded-lg p-2 flex flex-col items-center gap-1 text-center transition-transform ${
                      it.owned
                        ? "border-quest-border hover:scale-105 cursor-pointer"
                        : "border-transparent opacity-60"
                    }`}
                    style={{
                      borderColor: it.owned ? RARITY_COLOR_HEX[it.rarity] : undefined,
                    }}
                  >
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <Image
                        src={it.image}
                        alt={it.owned ? it.name : "未獲得"}
                        width={64}
                        height={64}
                        className="object-contain"
                        style={{
                          filter: it.owned ? undefined : "brightness(0) opacity(0.3)",
                        }}
                      />
                      {it.owned && isAcquiredToday(it.lastAcquiredAt) && (
                        <span className="absolute -top-1 -left-1 bg-quest-mint text-quest-bg text-[9px] font-bold rounded px-1 py-0.5 shadow">
                          NEW
                        </span>
                      )}
                      {it.owned && it.count > 1 && (
                        <span className="absolute -bottom-1 -right-1 bg-quest-gold text-quest-bg text-[9px] font-bold rounded-full px-1.5 py-0.5">
                          ×{it.count}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[10px] leading-tight truncate w-full"
                      style={{ color: it.owned ? undefined : "rgba(154,140,110,0.5)" }}
                    >
                      {it.owned ? it.name : "？？？"}
                    </p>
                    <span
                      className="text-[9px] px-1 rounded"
                      style={{
                        background: RARITY_COLOR_HEX[it.rarity],
                        opacity: it.owned ? 1 : 0.4,
                      }}
                    >
                      {RARITY_LABEL[it.rarity]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

      {/* 詳細モーダル */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-quest-card border border-quest-border rounded-2xl p-6 max-w-xs w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center">
              <Image
                src={selected.image}
                alt={selected.name}
                width={128}
                height={128}
                className="object-contain"
                style={{
                  filter: `drop-shadow(0 0 16px ${RARITY_COLOR_HEX[selected.rarity]})`,
                }}
              />
            </div>
            <h3 className="font-bold text-lg text-quest-text mb-1">{selected.name}</h3>
            <p className="text-[10px] text-quest-dim mb-1">
              {SEASON_LABEL[selected.season]} / {CATEGORY_LABEL[selected.category]} /{" "}
              {RARITY_LABEL[selected.rarity]}
            </p>
            {selected.month !== undefined && (
              <p className="inline-block text-[10px] text-quest-gold border border-quest-gold/40 rounded px-2 py-0.5 mb-3">
                ✨ {selected.month}月げんてい
              </p>
            )}
            <p className="text-xs text-quest-text mb-4 mt-2">{selected.description}</p>
            {selected.count > 1 && (
              <p className="text-[11px] text-quest-mint mb-3">
                これまでに {selected.count} 回ゲットしたよ！
              </p>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-quest-dim"
            >
              タップして閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 月限定アイテム用の小さめサムネイル (5列グリッド用)
function MonthlyThumb({
  item,
  isNew,
  showFuturePlaceholder = false,
  onClick,
}: {
  item: ApiItem;
  isNew: boolean;
  showFuturePlaceholder?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!item.owned}
      className={`bg-quest-card border rounded-md p-1.5 flex flex-col items-center gap-0.5 text-center transition-transform ${
        item.owned
          ? "border-quest-border hover:scale-105 cursor-pointer"
          : "border-transparent opacity-60"
      }`}
      style={{
        borderColor: item.owned ? RARITY_COLOR_HEX[item.rarity] : undefined,
      }}
    >
      <div className="relative w-12 h-12 flex items-center justify-center">
        <Image
          src={item.image}
          alt={item.owned ? item.name : "未獲得"}
          width={48}
          height={48}
          className="object-contain"
          style={{
            filter: item.owned ? undefined : "brightness(0) opacity(0.3)",
          }}
        />
        {item.owned && isNew && (
          <span className="absolute -top-1 -left-1 bg-quest-mint text-quest-bg text-[8px] font-bold rounded px-1 py-0.5 shadow">
            NEW
          </span>
        )}
        {item.owned && item.count > 1 && (
          <span className="absolute -bottom-1 -right-1 bg-quest-gold text-quest-bg text-[8px] font-bold rounded-full px-1 py-0.5">
            ×{item.count}
          </span>
        )}
      </div>
      <p
        className="text-[9px] leading-tight truncate w-full"
        style={{ color: item.owned ? undefined : "rgba(154,140,110,0.5)" }}
      >
        {item.owned ? item.name : showFuturePlaceholder ? "？？？" : "？？？"}
      </p>
    </button>
  );
}
