import { describe, it, expect } from "vitest";
import { calcScale, MAX_WIDTH, MAX_HEIGHT, JPEG_QUALITY } from "@/lib/imageUtils";

describe("imageUtils", () => {
  it("MAX_WIDTH と MAX_HEIGHT が公開されていること", () => {
    expect(MAX_WIDTH).toBeGreaterThan(0);
    expect(MAX_HEIGHT).toBeGreaterThan(0);
  });

  it("JPEG_QUALITY が 0〜1 の範囲であること", () => {
    expect(JPEG_QUALITY).toBeGreaterThan(0);
    expect(JPEG_QUALITY).toBeLessThanOrEqual(1);
  });

  describe("calcScale", () => {
    it("最大サイズ以下の画像はスケール 1.0 を返すこと", () => {
      expect(calcScale(800, 600)).toBe(1);
    });

    it("幅が MAX_WIDTH を超える場合、縦横比を維持したスケールを返すこと", () => {
      const scale = calcScale(MAX_WIDTH * 2, MAX_WIDTH);
      const w = Math.round(MAX_WIDTH * 2 * scale);
      const h = Math.round(MAX_WIDTH * scale);
      expect(w).toBe(MAX_WIDTH);
      expect(h).toBe(MAX_WIDTH / 2);
    });

    it("高さが MAX_HEIGHT を超える場合、縦横比を維持したスケールを返すこと", () => {
      const scale = calcScale(MAX_HEIGHT, MAX_HEIGHT * 2);
      const w = Math.round(MAX_HEIGHT * scale);
      const h = Math.round(MAX_HEIGHT * 2 * scale);
      expect(w).toBe(MAX_HEIGHT / 2);
      expect(h).toBe(MAX_HEIGHT);
    });

    it("幅と高さが両方超える場合、制約が厳しい方のスケールを返すこと", () => {
      // 幅 MAX_WIDTH*3, 高さ MAX_HEIGHT*2 → 高さ制約の方が厳しい
      const scale = calcScale(MAX_WIDTH * 3, MAX_HEIGHT * 2);
      const h = Math.round(MAX_HEIGHT * 2 * scale);
      expect(h).toBeLessThanOrEqual(MAX_HEIGHT);
      const w = Math.round(MAX_WIDTH * 3 * scale);
      expect(w).toBeLessThanOrEqual(MAX_WIDTH);
    });

    it("スケールは 1.0 を超えないこと（拡大しない）", () => {
      expect(calcScale(100, 100)).toBe(1);
      expect(calcScale(1, 1)).toBe(1);
    });
  });
});
