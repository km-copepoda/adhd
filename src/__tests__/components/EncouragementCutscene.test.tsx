// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EncouragementCutscene from "@/components/child/EncouragementCutscene";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

describe("EncouragementCutscene エール受信演出", () => {
  it("「エールが届いた！」のタイトルを表示する", () => {
    render(
      <EncouragementCutscene description="ピカからエール！その調子、いっしょに頑張ろう！" onClose={() => {}} />,
    );
    expect(screen.getByText("エールが届いた！")).toBeTruthy();
  });

  it("📣 の絵文字を表示する", () => {
    render(<EncouragementCutscene description="テスト本文" onClose={() => {}} />);
    expect(screen.getByText("📣")).toBeTruthy();
  });

  it("description を表示する", () => {
    render(
      <EncouragementCutscene description="ピカからエール！その調子、いっしょに頑張ろう！" onClose={() => {}} />,
    );
    expect(
      screen.getByText("ピカからエール！その調子、いっしょに頑張ろう！"),
    ).toBeTruthy();
  });

  it("subtitle を指定した場合は表示する", () => {
    render(
      <EncouragementCutscene
        subtitle="ピカ、ガルからエール！"
        description="その調子、いっしょに頑張ろう！"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("ピカ、ガルからエール！")).toBeTruthy();
  });

  it("subtitle を省略した場合は表示しない（境界値）", () => {
    const { container } = render(
      <EncouragementCutscene description="テスト本文" onClose={() => {}} />,
    );
    // subtitle 用の要素が描画されていないこと（description のみ表示される）
    expect(container.textContent).not.toMatch(/undefined/);
    // subtitle 固有の文言が存在しないことを確認（description と重複しない文字列で判定）
    expect(screen.queryByText("ピカ、ガルからエール！")).toBeNull();
  });

  it("タップで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    const { container } = render(
      <EncouragementCutscene description="テスト本文" onClose={onClose} />,
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });
});
