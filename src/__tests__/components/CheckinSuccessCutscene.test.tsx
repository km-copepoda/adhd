// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CheckinSuccessCutscene from "@/components/child/CheckinSuccessCutscene";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

describe("CheckinSuccessCutscene チェックイン成功演出", () => {
  it("「チェックイン成功！」のタイトルを表示する", () => {
    render(<CheckinSuccessCutscene currentStreak={1} onClose={() => {}} />);
    expect(screen.getByText("チェックイン成功！")).toBeTruthy();
  });

  it("currentStreak >= 2 なら『N日連続！』を表示する", () => {
    render(<CheckinSuccessCutscene currentStreak={5} onClose={() => {}} />);
    expect(screen.getByText(/5日連続/)).toBeTruthy();
  });

  it("currentStreak === 1 なら『連続スタート』など 1日目を強調する文言を表示する", () => {
    render(<CheckinSuccessCutscene currentStreak={1} onClose={() => {}} />);
    // 1日連続！はやや不自然なので「連続スタート」などの文言を許容
    const hasOne = screen.queryByText(/1日連続/);
    const hasStart = screen.queryByText(/連続スタート|今日から/);
    expect(hasOne || hasStart).toBeTruthy();
  });

  it("タップで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    const { container } = render(
      <CheckinSuccessCutscene currentStreak={3} onClose={onClose} />,
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it("currentStreak === 0 でもクラッシュせずタイトルを表示する（境界値）", () => {
    render(<CheckinSuccessCutscene currentStreak={0} onClose={() => {}} />);
    expect(screen.getByText("チェックイン成功！")).toBeTruthy();
  });
});
