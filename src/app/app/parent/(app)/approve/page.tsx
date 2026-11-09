"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORY_LABEL, REJECTION_REASONS, APPROVAL_STAMPS } from "@/lib/categories";
import { subscribeFamilyRealtime } from "@/lib/parentRealtime";
import type { Category, QuestStatus } from "@/types";
import { formatReportedTime, tomorrowStringJST } from "@/lib/date";
import LoadingSpinner from "@/components/LoadingSpinner";
import { xpRangeLabel, calcActualXP } from "@/lib/xp";
import { notifyApprovalsUpdated } from "@/lib/approval-events";
import { confirmPlanLimitOrAlert } from "@/lib/apiError";
import TreasureUseApprovalCard, {
  type PendingTreasureUse,
} from "@/components/parent/TreasureUseApprovalCard";

type PendingQuest = {
  id: string;
  kind: "quest";
  templateId: string;
  date: string;
  status: QuestStatus;
  comment: string | null;
  photoUrl: string | null;
  deadlineBonusEarned: boolean;
  reportedAt: string;
  declaredToday: boolean;
  child: { name: string; monsterName: string; side: string; reportDeadlineTime: string | null };
  template: {
    title: string;
    emoji: string;
    category: Category;
    isTemporary: boolean;
    photoBonus: boolean;
  };
};

// #151: 承認センターは「クエスト報告/スキップ申請」と「ごほうび使用申請」が kind で判別しつつ合流する
type PendingItem = PendingQuest | PendingTreasureUse;

type RejectModalState = {
  quest: PendingQuest;
  selectedReason: string;
  otherComment: string;
};

const ACTION_ERROR_MESSAGE = "処理に失敗しました。通信状況を確認して、もう一度お試しください";

const getTomorrowStr = () => tomorrowStringJST();

export default function ApprovePage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyEnabled, setCopyEnabled] = useState<Record<string, boolean>>({});
  const [copyDates, setCopyDates] = useState<Record<string, string>>({});
  const [rejectModal, setRejectModal] = useState<RejectModalState | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [stampModal, setStampModal] = useState<PendingQuest | null>(null);
  const [selectedStamp, setSelectedStamp] = useState<string>("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const busyRef = useRef<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkBusyRef = useRef(false);
  // 確認ダイアログを開いた時点の対象を固定する。実行時の items ではなく、これを送信する
  const [bulkTargets, setBulkTargets] = useState<{ kind: PendingItem["kind"]; id: string }[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchPending();

    // 自分の家族の子供の行だけを購読する（全家庭の変更で再取得しない）
    const unsubRealtime = subscribeFamilyRealtime(
      "approve-changes",
      ["QuestInstance", "TreasureLog"],
      refreshPending,
    );

    const onVisible = () => { if (document.visibilityState === "visible") refreshPending(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubRealtime();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function refreshPending() {
    const res = await fetch("/api/approve/pending");
    if (res.ok) setItems(await res.json());
  }

  async function fetchPending() {
    try {
      const res = await fetch("/api/approve/pending");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }

  // 処理中 id の管理。state だけだと同一 tick 内の連打を弾けないため ref を併用する
  function beginBusy(id: string): boolean {
    if (busyRef.current.has(id)) return false;
    busyRef.current.add(id);
    setBusyIds(new Set(busyRef.current));
    return true;
  }

  function endBusy(id: string) {
    busyRef.current.delete(id);
    setBusyIds(new Set(busyRef.current));
  }

  /** 成功したら true。失敗時は actionError を設定して false */
  async function handleAction(quest: PendingQuest, action: "approve" | "reject", rejectionReason?: string, rejectionComment?: string, stamp?: string): Promise<boolean> {
    if (!beginBusy(quest.id)) return false;
    try {
      return await runAction(quest, action, rejectionReason, rejectionComment, stamp);
    } catch {
      setActionError(ACTION_ERROR_MESSAGE);
      return false;
    } finally {
      endBusy(quest.id);
    }
  }

  async function runAction(quest: PendingQuest, action: "approve" | "reject", rejectionReason?: string, rejectionComment?: string, stamp?: string): Promise<boolean> {
    setActionError(null);
    const res = await fetch(`/api/approve/${quest.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "quest", action, rejectionReason, rejectionComment, ...(stamp ? { stamp } : {}) }),
    });
    if (!res.ok) {
      setActionError(ACTION_ERROR_MESSAGE);
      // 他端末で処理済みの場合などに備えて一覧は最新化する
      fetchPending();
      return false;
    }

    // スキップ承認 + 一時タスク + コピーオン の場合、翌日にコピー
    let copyRes: Response | null = null;
    if (
      action === "approve" &&
      quest.status === "SKIP_REPORTED" &&
      quest.template.isTemporary &&
      copyEnabled[quest.id]
    ) {
      const targetDate = copyDates[quest.id] ?? getTomorrowStr();
      // 上限到達で失敗しても、既に完了した承認処理は取り消さず、コピー失敗のみ後で通知する
      copyRes = await fetch(`/api/tasks/${quest.templateId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate }),
      });
    }

    // 承認結果の同期 (通知・一覧再取得) は、コピーの成否に関わらず必ず実行する。
    // confirmPlanLimitOrAlert は上限到達時に /app/parent/plan へ遷移する可能性があり、
    // location.href 代入後に JS 実行が止まる想定に暗黙に依存しないため、遷移判定より先に行う
    // (Issue #148 v2差分6番)。
    notifyApprovalsUpdated();
    fetchPending();

    if (copyRes) {
      await confirmPlanLimitOrAlert(copyRes);
    }
    return true;
  }

  async function handleTreasureUseAction(item: PendingTreasureUse, action: "approve" | "reject") {
    if (!beginBusy(item.id)) return;
    try {
      setActionError(null);
      const res = await fetch(`/api/approve/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "treasure_use", action }),
      });
      if (!res.ok) {
        setActionError(ACTION_ERROR_MESSAGE);
        fetchPending();
        return;
      }
      notifyApprovalsUpdated();
      fetchPending();
    } catch {
      setActionError(ACTION_ERROR_MESSAGE);
    } finally {
      endBusy(item.id);
    }
  }

  function openRejectModal(quest: PendingQuest) {
    setRejectModal({ quest, selectedReason: "", otherComment: "" });
  }

  async function submitReject() {
    if (!rejectModal) return;
    const { quest, selectedReason, otherComment } = rejectModal;
    // 失敗時はモーダルと入力内容を残す
    const ok = await handleAction(quest, "reject", selectedReason, otherComment);
    if (ok) setRejectModal(null);
  }

  async function handleBulkApprove() {
    if (bulkBusy || bulkBusyRef.current) return;
    bulkBusyRef.current = true;
    setBulkBusy(true);
    setActionError(null);
    try {
      const bulkItems = bulkTargets ?? [];
      if (bulkItems.length === 0) return;
      const res = await fetch("/api/approve/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: bulkItems }),
      });
      if (!res.ok) {
        setActionError(ACTION_ERROR_MESSAGE);
        fetchPending();
        return;
      }
      setBulkTargets(null);
      notifyApprovalsUpdated();
      fetchPending();
    } catch {
      setActionError(ACTION_ERROR_MESSAGE);
    } finally {
      bulkBusyRef.current = false;
      setBulkBusy(false);
    }
  }

  const canSubmitReject = rejectModal && rejectModal.selectedReason &&
    (rejectModal.selectedReason !== "その他" || rejectModal.otherComment.trim());

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-quest-gold text-2xl tracking-wider">
            ✅ 承認センター
          </h1>
          <p className="text-quest-dim text-sm mt-1">
            {items.length}件の報告が承認待ちです
          </p>
        </div>
        {items.length > 0 && !bulkTargets && (
          <button onClick={() => setBulkTargets(items.map((i) => ({ kind: i.kind, id: i.id })))} className="btn-gold text-sm">
            ✓ まとめて承認
          </button>
        )}
      </div>

      {bulkTargets && bulkTargets.length > 0 && (
        <div className="mb-6 rounded-xl border border-quest-gold/30 bg-quest-card p-4">
          <p className="text-sm mb-3">{bulkTargets.length}件をまとめて承認します。よろしいですか？</p>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkTargets(null)}
              disabled={bulkBusy}
              className="flex-1 text-sm border border-quest-border rounded-xl py-2.5 text-quest-dim disabled:opacity-40"
            >
              やめる
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={bulkBusy}
              className="flex-1 btn-gold text-sm py-2.5 disabled:opacity-50"
            >
              {bulkBusy ? "承認中..." : "承認する"}
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-4 text-sm text-red-400">{actionError}</p>
      )}

      <div className="flex flex-col gap-4">
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-4xl" aria-hidden>🎉</span>
            <p className="text-quest-text text-sm font-bold">全部確認できました！おつかれさま</p>
            <p className="text-quest-muted text-sm">承認待ちの報告はありません</p>
            <Link
              href="/app/parent/tasks"
              className="mt-3 inline-flex items-center justify-center min-h-10 px-5 rounded-xl border border-quest-gold/40 text-quest-gold text-sm hover:bg-quest-gold/10 transition-colors"
            >
              タスクへ戻る
            </Link>
          </div>
        )}
        {items.map((item) => {
          if (item.kind === "treasure_use") {
            return (
              <TreasureUseApprovalCard
                key={item.id}
                item={item}
                onApprove={(t) => handleTreasureUseAction(t, "approve")}
                onReject={(t) => handleTreasureUseAction(t, "reject")}
              />
            );
          }
          const quest = item;
          const cat = CATEGORY_LABEL[quest.template.category];
          const isSkipRequest = quest.status === "SKIP_REPORTED";
          const showCopyOption = isSkipRequest && quest.template.isTemporary;
          return (
            <div
              key={quest.id}
              className={`bg-quest-card border rounded-xl p-5 transition-colors ${
                isSkipRequest
                  ? "border-red-400/20 hover:border-red-400/40"
                  : "border-quest-border hover:border-quest-gold/30"
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-3xl">{isSkipRequest ? "😴" : quest.template.emoji}</div>
                <div className="flex-1">
                  <p className="text-sm text-quest-dim">
                    {isSkipRequest ? "😴" : "🧒"} {quest.child.monsterName || quest.child.name} からの{isSkipRequest ? "スキップ申請" : "報告"}
                    <span className="ml-2 text-xs opacity-60">🕐 {formatReportedTime(quest.reportedAt)}</span>
                  </p>
                  <p className="text-base font-medium mt-1">{quest.template.title}</p>
                  <p className="text-xs text-quest-dim mt-1">
                    {cat.emoji} {cat.name}{!isSkipRequest && <> · {xpRangeLabel(!!quest.child.reportDeadlineTime, quest.template.photoBonus, quest.declaredToday)}</>}
                  </p>
                </div>
              </div>
              {quest.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={quest.photoUrl}
                  alt="報告写真"
                  className="w-full h-40 object-cover rounded-xl mb-4 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setPhotoModal(quest.photoUrl); }}
                />
              )}
              {quest.comment && (
                <div className={`rounded-lg p-3 mb-4 text-sm ${
                  isSkipRequest ? "bg-red-400/5 text-red-400/70" : "bg-quest-bg text-quest-dim"
                }`}>
                  💬 {quest.comment}
                </div>
              )}
              {showCopyOption && (
                <div
                  className="flex items-center gap-2 mb-4 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    id={`copy-${quest.id}`}
                    checked={copyEnabled[quest.id] ?? false}
                    onChange={(e) =>
                      setCopyEnabled((prev) => ({ ...prev, [quest.id]: e.target.checked }))
                    }
                    className="accent-orange-400"
                  />
                  <label htmlFor={`copy-${quest.id}`} className="text-xs text-orange-300 cursor-pointer">
                    📅 次の日に送る
                  </label>
                  {copyEnabled[quest.id] && (
                    <input
                      type="date"
                      className="ml-auto text-xs bg-quest-bg border border-quest-border rounded-lg px-2 py-1 text-quest-text"
                      value={copyDates[quest.id] ?? getTomorrowStr()}
                      min={getTomorrowStr()}
                      onChange={(e) =>
                        setCopyDates((prev) => ({ ...prev, [quest.id]: e.target.value }))
                      }
                    />
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(quest, "approve")}
                  disabled={busyIds.has(quest.id)}
                  className={`flex-1 text-sm py-2 text-center rounded-xl disabled:opacity-50 ${
                    isSkipRequest
                      ? "bg-red-400/10 text-red-400 border border-red-400/30"
                      : "btn-gold"
                  }`}
                >
                  {isSkipRequest ? "✓ スキップを承認" : `✓ 承認 (+${calcActualXP(quest.deadlineBonusEarned, quest.template.photoBonus, !!quest.photoUrl, quest.declaredToday)}pt)`}
                </button>
                {!isSkipRequest && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedStamp(""); setStampModal(quest); }}
                    className="text-quest-gold/70 text-sm border border-quest-gold/30 rounded-xl px-3 py-2 hover:border-quest-gold/60 hover:text-quest-gold transition-colors"
                    title="スタンプ付きで承認"
                  >
                    ⭐
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); openRejectModal(quest); }}
                  className="text-quest-dim text-sm border border-quest-border rounded-xl px-4 py-2 hover:border-red-400/30 hover:text-red-400"
                >
                  差し戻し
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 写真モーダル */}
      {photoModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={() => setPhotoModal(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoModal}
            alt="報告写真"
            className="max-w-full max-h-full object-contain rounded-xl cursor-pointer"
          />
        </div>
      )}

      {/* 差し戻しモーダル */}
      {rejectModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-[60] p-4"
          onClick={() => setRejectModal(null)}
        >
          <div
            className="bg-quest-card border border-quest-border rounded-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium mb-1">差し戻し理由を選んでください</h2>
            <p className="text-xs text-quest-dim mb-4">
              {rejectModal.quest.child.monsterName || rejectModal.quest.child.name} の「{rejectModal.quest.template.title}」
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {REJECTION_REASONS[rejectModal.quest.template.category].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setRejectModal((s) => s ? { ...s, selectedReason: reason } : s)}
                  className={`text-left text-sm px-4 py-2.5 rounded-xl border transition-colors ${
                    rejectModal.selectedReason === reason
                      ? "border-red-400/50 bg-red-400/10 text-red-300"
                      : "border-quest-border text-quest-dim hover:border-red-400/30"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            {rejectModal.selectedReason === "その他" && (
              <textarea
                value={rejectModal.otherComment}
                onChange={(e) => setRejectModal((s) => s ? { ...s, otherComment: e.target.value } : s)}
                placeholder="理由を入力してください（必須）"
                className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-red-400/30 resize-none h-16 mb-4"
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 text-sm border border-quest-border rounded-xl py-2.5 text-quest-dim"
              >
                キャンセル
              </button>
              <button
                onClick={submitReject}
                disabled={!canSubmitReject || busyIds.has(rejectModal.quest.id)}
                className="flex-1 text-sm bg-red-400/10 border border-red-400/30 text-red-300 rounded-xl py-2.5 disabled:opacity-40"
              >
                差し戻す
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スタンプ選択モーダル */}
      {stampModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-[60] p-4"
          onClick={() => setStampModal(null)}
        >
          <div
            className="bg-quest-card border border-quest-border rounded-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium mb-1">スタンプを選んで承認</h2>
            <p className="text-xs text-quest-dim mb-4">
              {stampModal.child.monsterName || stampModal.child.name} の「{stampModal.template.title}」
            </p>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {APPROVAL_STAMPS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedStamp((s) => s === emoji ? "" : emoji)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${
                    selectedStamp === emoji
                      ? "border-quest-gold/60 bg-quest-gold/10 text-quest-gold"
                      : "border-quest-border text-quest-dim hover:border-quest-gold/30"
                  }`}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-[10px]">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStampModal(null)}
                className="flex-1 text-sm border border-quest-border rounded-xl py-2.5 text-quest-dim"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  const ok = await handleAction(stampModal, "approve", undefined, undefined, selectedStamp || undefined);
                  if (ok) setStampModal(null);
                }}
                disabled={busyIds.has(stampModal.id)}
                className="flex-1 btn-gold text-sm py-2.5 disabled:opacity-50"
              >
                {selectedStamp ? `${selectedStamp} 承認する` : "✓ 承認する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
