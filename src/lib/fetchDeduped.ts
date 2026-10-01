// 同時に飛ぶ同一 GET を1本にまとめる fetch ラッパー（クライアント専用）。
//
// 子供画面は layout 常駐コンポーネントとページが同じ API（monster-status など）を
// それぞれ別に呼ぶため、初回表示で同一 URL が複数同時に飛んでいた。
// 結果は保持しない（完了したら次の呼び出しは新しく fetch する）ので、
// 古いデータを返す心配はない。「いま飛んでいる最中の同一リクエスト」にだけ相乗りする。

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
    shared = request.finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, shared);
  }

  const response = await withAbort(shared, signal);
  // 共有 Response の body は誰も読まない。各呼び出しには clone を渡し、独立して json() を読めるようにする。
  // 本物の Response には必ず clone があるが、テストの fetch モック（{ ok, json } だけのオブジェクト）は
  // clone を持たないことがあるため、その場合は同じオブジェクトをそのまま返す。
  return typeof response.clone === "function" ? response.clone() : response;
}
