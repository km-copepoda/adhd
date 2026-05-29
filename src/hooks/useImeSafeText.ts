"use client";

import { useCallback, useRef } from "react";
import type { ChangeEvent, CompositionEvent } from "react";

/**
 * 日本語 IME の合成 (composition) 中に発火する onChange を抑止し、
 * 確定 (compositionend) 時のみ値を反映する text input 用ハンドラ群。
 *
 * IME がオンの状態で英字を入力するとブラウザと IME の二重発火で
 * 文字が重複入力される問題があり、ファミリーコード等の ASCII 入力欄で発生する。
 * このフックを `<input>` に展開すれば防げる。
 *
 * @example
 *   const [code, setCode] = useState("");
 *   const handlers = useImeSafeText(setCode, (raw) => raw.toUpperCase().slice(0, 6));
 *   <input value={code} {...handlers} inputMode="text" />
 */
export function useImeSafeText(
  setValue: (next: string) => void,
  transform: (raw: string) => string = (v) => v,
) {
  const composingRef = useRef(false);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (composingRef.current) return;
      setValue(transform(e.target.value));
    },
    [setValue, transform],
  );

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      setValue(transform(e.currentTarget.value));
    },
    [setValue, transform],
  );

  return { onChange, onCompositionStart, onCompositionEnd };
}
