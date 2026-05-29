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

  it("compositionStart 後の onChange は setValue を呼ばない (IME 中)", () => {
    const setValue = vi.fn();
    const { result } = renderHook(() => useImeSafeText(setValue));
    act(() => {
      result.current.onCompositionStart();
    });
    act(() => {
      result.current.onChange({ target: { value: "あ" } } as unknown as ChangeEv as never);
    });
    expect(setValue).not.toHaveBeenCalled();
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
