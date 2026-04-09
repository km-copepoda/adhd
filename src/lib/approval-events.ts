type Listener = () => void;

const listeners = new Set<Listener>();

/** usePendingCounts フックに承認完了を通知する */
export function notifyApprovalsUpdated(): void {
  listeners.forEach((cb) => cb());
}

/** 承認完了イベントのリスナーを登録する。戻り値で購読解除できる */
export function onApprovalsUpdated(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
