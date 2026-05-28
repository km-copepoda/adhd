// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TreasureGetCutscene from "@/components/child/TreasureGetCutscene";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

describe("TreasureGetCutscene 宝箱ゲット演出", () => {
  it("閉じた宝箱のドット絵 (/treasure/closed.png) を表示する", () => {
    render(<TreasureGetCutscene count={1} onClose={() => {}} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/treasure/closed.png");
  });

  it("「宝箱ゲット！」のタイトルを表示する", () => {
    render(<TreasureGetCutscene count={1} onClose={() => {}} />);
    expect(screen.getByText("宝箱ゲット！")).toBeTruthy();
  });

  it("複数個取得時は個数を表示する", () => {
    render(<TreasureGetCutscene count={3} onClose={() => {}} />);
    expect(screen.getByText(/3/)).toBeTruthy();
  });

  it("タップで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    const { container } = render(
      <TreasureGetCutscene count={1} onClose={onClose} />
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });
});
