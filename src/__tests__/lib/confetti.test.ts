import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfetti = vi.hoisted(() => vi.fn());
vi.mock("canvas-confetti", () => ({
  default: mockConfetti,
}));

import { fireCompletionConfetti } from "@/lib/confetti";

describe("fireCompletionConfetti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("通常完了時に confetti を1回呼ぶ", () => {
    fireCompletionConfetti(false);
    expect(mockConfetti).toHaveBeenCalledTimes(1);
  });

  it("通常完了時は中央から発射する", () => {
    fireCompletionConfetti(false);
    expect(mockConfetti).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { x: 0.5, y: 0.6 },
      })
    );
  });

  it("全クリア時は最初の呼び出しで particleCount が通常より多い", () => {
    fireCompletionConfetti(false);
    const normalCount = mockConfetti.mock.calls[0][0].particleCount as number;
    mockConfetti.mockClear();

    fireCompletionConfetti(true);
    const allDoneCount = mockConfetti.mock.calls[0][0].particleCount as number;
    expect(allDoneCount).toBeGreaterThan(normalCount);
  });

  it("全クリア時はタイマー後に左右からも発射する", () => {
    fireCompletionConfetti(true);
    expect(mockConfetti).toHaveBeenCalledTimes(1);

    vi.runAllTimers();
    expect(mockConfetti).toHaveBeenCalledTimes(3);

    const leftCall = mockConfetti.mock.calls[1][0];
    const rightCall = mockConfetti.mock.calls[2][0];
    expect(leftCall.origin.x).toBe(0);
    expect(rightCall.origin.x).toBe(1);
  });

  it("デフォルト引数（引数なし）は通常完了として扱う", () => {
    fireCompletionConfetti();
    expect(mockConfetti).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(mockConfetti).toHaveBeenCalledTimes(1);
  });

  it("confetti のカラーにゴールドが含まれる", () => {
    fireCompletionConfetti(false);
    const args = mockConfetti.mock.calls[0][0];
    expect(args.colors).toEqual(expect.arrayContaining(["#FFD700"]));
  });
});
