"use client";

import { useCallback, useRef } from "react";
import type { ChangeEvent, CompositionEvent } from "react";

/**
 * ASCII text input 用ハンドラ群。
 *
 * 目的:
 * - PC: IME ON 状態で英字を入れるとブラウザと IME の二重発火で同じ値が二度反映される
 *   問題への対策（同一値での重複 setValue を抑止）。
 * - モバイル: Android Gboard 等は英字入力中も composition 状態を維持するため、
 *   composition 中の onChange を抑止すると入力できなくなる → 反映する。
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
  const lastValueRef = useRef<string | null>(null);

  const apply = useCallback(
    (raw: string) => {
      const next = transform(raw);
      if (lastValueRef.current === next) return;
      lastValueRef.current = next;
      setValue(next);
    },
    [setValue, transform],
  );

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      apply(e.target.value);
    },
    [apply],
  );

  const onCompositionStart = useCallback(() => {
    // composition 中も onChange で値を反映する設計のため、ここでは何もしない。
  }, []);

  const onCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLInputElement>) => {
      apply(e.currentTarget.value);
    },
    [apply],
  );

  return { onChange, onCompositionStart, onCompositionEnd };
}
