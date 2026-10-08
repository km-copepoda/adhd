"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { invalidateDeduped } from "@/lib/fetchDeduped";
import TreasureOpenCutscene from "@/components/child/TreasureOpenCutscene";
import {
  RARITY_BADGE_CLASS,
  formatChildRarity,
  type TreasureRarity,
} from "@/lib/treasureRarity";
import { SEASON_LABEL, type CollectionRarity } from "@/lib/collectionItems";
import { formatTreasureOpenedAt } from "@/lib/treasureHistory";
import { pickRuby } from "@/lib/ruby";

type Rarity = TreasureRarity;

const COLLECTION_RARITY_STARS: Record<CollectionRarity, string> = {
  COMMON: "★",
  UNCOMMON: "★★",
  RARE: "★★★",
};

/** #151: ごほうび使用申請の親承認フロー用ステータス */
type TreasureUseStatus = "UNUSED" | "USE_REQUESTED" | "USED";

interface OpenedLog {
  id: string;
  openedAt: string;
  boosted: boolean;
  item: { id: string; title: string; rarity: Rarity } | null;
  collectionItem: {
    id: string;
    name: string;
    nameKana: string;
    season: "spring" | "summer" | "fall" | "winter";
    rarity: Rarity;
    image: string;
  } | null;
  fulfilled?: boolean;
  useStatus?: TreasureUseStatus;
}

type TreasureTab = "boxes" | "rewards";

interface StatusResponse {
  locked: number;
  unlocked: number;
  opened: OpenedLog[];
  // #127: ごほうび一覧は開封履歴（opened, 50件上限）と独立した在庫リスト。
  // 実ごほうび当選のみ・保持期間内。古い API 応答互換のため optional。
  rewards?: OpenedLog[];
  /** Issue #140: 非 boolean（undefined/null/文字列/数値）は true（かな表示）にフォールバックする */
  rubyEnabled?: unknown;
}

interface TreasureOpenResult {
  item: { id: string; title: string; rarity: Rarity } | null;
  collectionItem: {
    id: string;
    name: string;
    nameKana: string;
    rarity: Rarity;
    season: "spring" | "summer" | "fall" | "winter";
    description: string;
    descriptionKana: string;
    image: string;
    count: number;
  } | null;
  remainingUnlocked: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ChildTreasuresPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<TreasureOpenResult | null>(null);
  const [tab, setTab] = useState<TreasureTab>("boxes");
  const [pendingUseRequestId, setPendingUseRequestId] = useState<string | null>(null);
  // #151: 誤タップ防止の確認モーダル対象（承認後の巻き戻しは親のみ可能なため、送信前に一段挟む）
  const [confirmUseTarget, setConfirmUseTarget] = useState<{ id: string; title: string } | null>(null);
  const useRequestLock = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/treasures/status", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as StatusResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleOpen = async () => {
    if (opening) return;
    if (!data || data.unlocked <= 0) return;
    setOpening(true);
    try {
      const res = await fetch("/api/treasures/open", { method: "POST" });
      if (!res.ok) return;
      const json = (await res.json()) as TreasureOpenResult;
      setResult(json);
      // BottomNav バッジを即時更新するため通知
      invalidateDeduped("/api/treasures/status");
      window.dispatchEvent(new CustomEvent("treasure-changed"));
    } finally {
      setOpening(false);
    }
  };

  // #151: ごほうび一覧タブでの使用申請（一方向・楽観更新 + 失敗ロールバック）。
  // 子は UNUSED -> USE_REQUESTED のみ操作でき、取り消しはできない（承認/却下は親の責務）。
  // #127: 一覧の描画元は rewards なので opened と rewards の両方に反映する。
  const applyUseStatus = (d: StatusResponse | null, id: string, value: TreasureUseStatus) =>
    d
      ? {
          ...d,
          opened: d.opened.map((o) => (o.id === id ? { ...o, useStatus: value } : o)),
          rewards: d.rewards?.map((o) => (o.id === id ? { ...o, useStatus: value } : o)),
        }
      : d;

  const requestUse = async (id: string) => {
    if (useRequestLock.current) return;
    useRequestLock.current = true;
    setPendingUseRequestId(id);
    setData((d) => applyUseStatus(d, id, "USE_REQUESTED"));
    try {
      const res = await fetch(`/api/child/treasures/use-request/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setData((d) => applyUseStatus(d, id, "UNUSED"));
      }
    } catch {
      setData((d) => applyUseStatus(d, id, "UNUSED"));
    } finally {
      useRequestLock.current = false;
      setPendingUseRequestId(null);
    }
  };

  // #151: 「つかう」タップ時はまず確認モーダルを挟み、確定操作でのみ requestUse を呼ぶ
  const confirmRequestUse = () => {
    if (!confirmUseTarget) return;
    const id = confirmUseTarget.id;
    setConfirmUseTarget(null);
    void requestUse(id);
  };

  if (loading) return <LoadingSpinner />;
  if (!data) {
    return (
      <div className="p-6 text-center text-quest-dim text-sm">
        宝箱データを読み込めませんでした。
      </div>
    );
  }

  const hits = data.opened.filter((o) => o.item !== null);
  const collectionWins = data.opened.length - hits.length;
  // #127: ごほうび一覧は履歴上限に縛られない rewards を使う（無ければ opened から算出）
  const rewardList = data.rewards ?? hits;
  const canOpen = data.unlocked > 0 && !opening;
  // Issue #140: 非 boolean（undefined/null/文字列/数値）は true（かな表示）にフォールバックする
  const rubyEnabled = typeof data.rubyEnabled === "boolean" ? data.rubyEnabled : true;

  return (
    <div className="p-4 pb-8">
      <h1 className="text-xl font-bold mb-4 text-center">宝箱</h1>

      <div className="bg-quest-card border border-quest-border rounded-2xl p-5 mb-6 flex flex-col items-center">
        <div className="w-40 h-40 mb-3">
          <Image
            src="/treasure/closed.png"
            alt="閉じた宝箱"
            width={160}
            height={160}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex gap-4 text-sm mb-4">
          <div className="flex items-center gap-1">
            <span aria-hidden>🔒</span>
            <span className="font-bold tabular-nums">{data.locked}</span>
            <span className="text-quest-dim text-xs">{pickRuby("おうちの人のOKまち", "おうちのひとのOKまち", rubyEnabled)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden>🔓</span>
            <span className="font-bold tabular-nums text-quest-gold">{data.unlocked}</span>
            <span className="text-quest-dim text-xs">あけられる</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          disabled={!canOpen}
          className="rounded-lg bg-quest-gold py-2.5 px-5 text-sm font-bold text-quest-bg shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {opening ? "ひらいてる..." : "あける"}
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab("boxes")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
            tab === "boxes"
              ? "bg-quest-gold text-quest-bg"
              : "bg-quest-card border border-quest-border text-quest-dim"
          }`}
        >
          📦 たからばこ
        </button>
        <button
          type="button"
          onClick={() => setTab("rewards")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
            tab === "rewards"
              ? "bg-quest-gold text-quest-bg"
              : "bg-quest-card border border-quest-border text-quest-dim"
          }`}
        >
          🎁 ごほうび一覧
        </button>
      </div>

      {tab === "rewards" && (
        <>
          <h2 className="text-sm font-bold text-quest-dim mb-2">🎁 ごほうび一覧</h2>
          {rewardList.length === 0 ? (
            <p className="text-center text-quest-dim text-xs py-6">
              まだもらったごほうびはありません。
            </p>
          ) : (
            <ul className="space-y-2">
              {rewardList.map((o) => {
                const useStatus: TreasureUseStatus = o.useStatus ?? (o.fulfilled ? "USED" : "UNUSED");
                return (
                  <li
                    key={o.id}
                    className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3"
                  >
                    <span className="text-3xl" aria-hidden>🎁</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{o.item!.title}</div>
                      <div className="text-[11px] text-quest-dim">
                        {formatTreasureOpenedAt(o.openedAt)}
                        {useStatus === "USED" && (
                          <span className="ml-2 text-quest-mint">✅ つかったよ</span>
                        )}
                        {useStatus === "USE_REQUESTED" && (
                          <span className="ml-2 text-quest-gold">⏳ しんせいちゅう</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded ${RARITY_BADGE_CLASS[o.item!.rarity]}`}
                    >
                      {formatChildRarity(o.item!.rarity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmUseTarget({ id: o.id, title: o.item!.title })}
                      disabled={useStatus !== "UNUSED" || pendingUseRequestId === o.id}
                      className={`text-xs px-3 py-1.5 rounded font-bold transition-colors disabled:opacity-50 ${
                        useStatus === "UNUSED"
                          ? "bg-quest-gold text-quest-bg"
                          : "bg-quest-card border border-quest-border text-quest-dim"
                      }`}
                    >
                      {useStatus === "USED"
                        ? "つかったよ"
                        : useStatus === "USE_REQUESTED"
                          ? "しんせいちゅう"
                          : "つかう"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === "boxes" && (
      <>
      <h2 className="text-sm font-bold text-quest-dim mb-2">これまでの宝箱</h2>
      {data.opened.length === 0 ? (
        <p className="text-center text-quest-dim text-xs py-6">
          まだ宝箱を開けていません。
        </p>
      ) : (
        <>
          <div className="text-xs text-quest-dim mb-2">
            ぜんぶで <span className="font-bold text-quest-text">{data.opened.length}</span>{" "}
            個（ごほうび {hits.length}・コレクション {collectionWins}）
          </div>
          <ul className="space-y-2">
            {data.opened.map((o) => (
              <li
                key={o.id}
                className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center" aria-hidden>
                  {o.item ? (
                    <span className="text-3xl">🎁</span>
                  ) : o.collectionItem ? (
                    <Image
                      src={o.collectionItem.image}
                      alt={pickRuby(o.collectionItem.name, o.collectionItem.nameKana ?? "", rubyEnabled)}
                      width={40}
                      height={40}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl">🏆</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">
                    {o.item
                      ? o.item.title
                      : o.collectionItem
                        ? pickRuby(o.collectionItem.name, o.collectionItem.nameKana ?? "", rubyEnabled)
                        : "コレクションアイテム"}
                  </div>
                  <div className="text-[11px] text-quest-dim">
                    {o.collectionItem && (
                      <span className="mr-2">
                        {SEASON_LABEL[o.collectionItem.season]}・{COLLECTION_RARITY_STARS[o.collectionItem.rarity]}
                      </span>
                    )}
                    {formatDate(o.openedAt)}
                    {o.boosted && <span className="ml-2 text-quest-gold">★ ボーナス</span>}
                  </div>
                </div>
                {o.item && (
                  <span className={`text-[11px] px-2 py-0.5 rounded ${RARITY_BADGE_CLASS[o.item.rarity]}`}>
                    {formatChildRarity(o.item.rarity)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      </>
      )}

      {result && (
        <TreasureOpenCutscene
          result={result}
          rubyEnabled={rubyEnabled}
          onClose={() => {
            setResult(null);
            void fetchStatus();
          }}
        />
      )}

      {/* #151: 使用申請の確認モーダル（誤タップ防止。申請後は親の却下でしか戻せないため） */}
      {confirmUseTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-[60] p-4"
          onClick={() => setConfirmUseTarget(null)}
        >
          <div
            className="bg-quest-card border border-quest-border rounded-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium mb-1">つかっていい？</h2>
            <p className="text-xs text-quest-dim mb-4">
              「{confirmUseTarget.title}」を つかっていい？ おうちのひとに きいてみるよ。
              しんせいしたら とりけせないよ。
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmUseTarget(null)}
                className="flex-1 text-sm border border-quest-border rounded-xl py-2.5 text-quest-dim"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmRequestUse}
                className="flex-1 text-sm bg-quest-gold text-quest-bg rounded-xl py-2.5 font-bold"
              >
                つかう
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
