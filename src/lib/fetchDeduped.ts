// 同時に飛ぶ同一 GET を1本にまとめる fetch ラッパー（クライアント専用）。
//
// 子供画面は layout 常駐コンポーネントとページが同じ API（monster-status など）を
// それぞれ別に呼ぶため、初回表示で同一 URL が複数同時に飛んでいた。
// 結果は保持しない（完了したら次の呼び出しは新しく fetch する）ので、
// 古いデータを返す心配はない。「いま飛んでいる最中の同一リクエスト」にだけ相乗りする。
//
// ただし「状態が変わった」ことを契機にした再取得（Realtime イベント・POST 直後など）は、
// イベント前に始まった進行中リクエストに相乗りすると更新前のデータを受け取ってしまう。
// そうした契機では invalidateDeduped() を呼び、以降の呼び出しが新しく fetch するようにする。

const inflight = new Map<string, Promise<Response>>();

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

/** 呼び出し側の signal だけを反応させる。共有 fetch 自体は止めない（他の呼び出しを巻き込まない）。 */
function withAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined | null): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * 進行中のリクエストを「相乗り不可」にする。以降の同一 URL の呼び出しは新しく fetch する
 * （そのあとに来た呼び出し同士は、その新しい1本に相乗りする）。
 * すでに相乗りして待っている呼び出しは、元のリクエストの結果をそのまま受け取る。
 * url を省略すると全 URL が対象。
 */
export function invalidateDeduped(url?: string): void {
  if (url === undefined) {
    inflight.clear();
    return;
  }
  const prefix = `${url}|`;
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

/** まとめてよいのは「GET かつ cache/signal 以外のオプションなし」のときだけ。 */
function isDedupable(init: RequestInit): boolean {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") return false;
  return Object.keys(init).every((k) => k === "cache" || k === "signal");
}

export async function fetchDeduped(url: string, init: RequestInit = {}): Promise<Response> {
  if (init.signal?.aborted) throw abortError();
  if (!isDedupable(init)) return fetch(url, init);

  const { signal, ...rest } = init;
  const key = `${url}|${rest.cache ?? ""}`;

  let shared = inflight.get(key);
  if (!shared) {
    const request = Object.keys(rest).length > 0 ? fetch(url, rest) : fetch(url);
    const tracked: Promise<Response> = request.finally(() => {
      // 無効化後に同じ key で新しいリクエストが登録されている場合は、それを消さない
      if (inflight.get(key) === tracked) inflight.delete(key);
    });
    shared = tracked;
    inflight.set(key, tracked);
  }

  const response = await withAbort(shared, signal);
  // 共有 Response の body は誰も読まない。各呼び出しには clone を渡し、独立して json() を読めるようにする。
  // 本物の Response には必ず clone があるが、テストの fetch モック（{ ok, json } だけのオブジェクト）は
  // clone を持たないことがあるため、その場合は同じオブジェクトをそのまま返す。
  return typeof response.clone === "function" ? response.clone() : response;
}
