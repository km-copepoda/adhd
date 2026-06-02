// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useImeSafeText } from "@/hooks/useImeSafeText";

type ChangeEv = { target: { value: string } };
type CompositionEv = { currentTarget: { value: string } };

describe("useImeSafeText", () => {
  it("通常の onChange (IME無し) は setValue を呼ぶ", () => {
    const setValue = vi.fn();
    const { result } = renderHook(() => useImeSafeText(setValue));
    act(() => {
      result.current.onChange({ target: { value: "abc" } } as unknown as ChangeEv as never);
    });
    expect(setValue).toHaveBeenCalledWith("abc");
  });

  it("compositionStart 後の onChange でも setValue を呼ぶ (モバイル IME 対応)", () => {
    // モバイル (Android Gboard 等) では英字入力中も composition 状態が維持されるため、
    // composition 中の onChange を完全抑止すると入力できなくなる。
    const setValue = vi.fn();
    const { result } = renderHook(() => useImeSafeText(setValue));
    act(() => {
      result.current.onCompositionStart();
    });
    act(() => {
      result.current.onChange({ target: { value: "A" } } as unknown as ChangeEv as never);
    });
    expect(setValue).toHaveBeenCalledWith("A");
  });

  it("同じ値での連続 setValue は重複しない (PC IME 二重発火対策)", () => {
    // IME ON 状態で英字を入れたとき、onChange と compositionEnd で同じ値が二重発火しても
    // setValue は 1 回だけになる。
    const setValue = vi.fn();
    const { result } = renderHook(() => useImeSafeText(setValue));
    act(() => {
      result.current.onCompositionStart();
    });
    act(() => {
      result.current.onChange({ target: { value: "A" } } as unknown as ChangeEv as never);
    });
    act(() => {
      result.current.onCompositionEnd({ currentTarget: { value: "A" } } as unknown as CompositionEv as never);
    });
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith("A");
  });

  it("compositionEnd で確定値を setValue する", () => {
    const setValue = vi.fn();
    const { result } = renderHook(() => useImeSafeText(setValue));
    act(() => {
      result.current.onCompositionStart();
    });
    act(() => {
      result.current.onCompositionEnd({ currentTarget: { value: "A" } } as unknown as CompositionEv as never);
    });
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith("A");
  });

  it("compositionEnd 後の onChange は再び通常動作する", () => {
    const setValue = vi.fn();
    const { result } = renderHook(() => useImeSafeText(setValue));
    act(() => {
      result.current.onCompositionStart();
    });
    act(() => {
      result.current.onCompositionEnd({ currentTarget: { value: "A" } } as unknown as CompositionEv as never);
    });
    setValue.mockClear();
    act(() => {
      result.current.onChange({ target: { value: "AB" } } as unknown as ChangeEv as never);
    });
    expect(setValue).toHaveBeenCalledWith("AB");
  });

  it("transform が指定されていれば onChange / compositionEnd 双方に適用される", () => {
    const setValue = vi.fn();
    const transform = (s: string) => s.toUpperCase().slice(0, 3);
    const { result } = renderHook(() => useImeSafeText(setValue, transform));

    act(() => {
      result.current.onChange({ target: { value: "abcdef" } } as unknown as ChangeEv as never);
    });
    expect(setValue).toHaveBeenLastCalledWith("ABC");

    act(() => {
      result.current.onCompositionStart();
    });
    act(() => {
      result.current.onCompositionEnd({ currentTarget: { value: "xyz123" } } as unknown as CompositionEv as never);
    });
    expect(setValue).toHaveBeenLastCalledWith("XYZ");
  });
});
