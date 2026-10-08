"use client";

interface Props {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** #164: 親が直接ごほうびを「使用済み」にする前の確認モーダル。 */
export default function TreasureUseConfirmModal({ title, onCancel, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ごほうびを使用済みにする"
        className="bg-quest-card border border-quest-border rounded-2xl p-5 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-medium mb-1">使用済みにしますか？</h2>
        <p className="text-xs text-quest-dim mb-4">
          「{title}」を承認なしで使用済みにします。取り消す場合は「使用を取り消す」から戻せます。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-sm border border-quest-border rounded-xl py-2.5 text-quest-dim"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 text-sm bg-quest-gold text-quest-bg rounded-xl py-2.5 font-bold"
          >
            使用済みにする
          </button>
        </div>
      </div>
    </div>
  );
}
