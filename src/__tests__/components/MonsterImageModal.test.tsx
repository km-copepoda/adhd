// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import MonsterImageModal from "@/components/MonsterImageModal";

// next/image を img タグにモック
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; [key: string]: unknown }) => (
    <img src={props.src} alt={props.alt} />
  ),
}));

beforeAll(() => {
  // jsdom では dialog をサポートしていないため polyfill
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

const defaultProps = {
  image: "/monsters/dark/STUDY_ラーン.webp",
  monsterName: "ラーン",
  stageLabel: "じゅくれんしゃ",
  onClose: vi.fn(),
};

describe("MonsterImageModal", () => {
  it("モンスター画像が表示される", () => {
    render(<MonsterImageModal {...defaultProps} />);
    const img = screen.getByAltText("ラーン");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("/monsters/dark/STUDY_ラーン.webp");
  });

  it("モンスター名が表示される", () => {
    render(<MonsterImageModal {...defaultProps} />);
    expect(screen.getByText("ラーン")).toBeTruthy();
  });

  it("ステージラベルが表示される", () => {
    render(<MonsterImageModal {...defaultProps} />);
    expect(screen.getByText("じゅくれんしゃ")).toBeTruthy();
  });

  it("背景オーバーレイをクリックすると onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<MonsterImageModal {...defaultProps} onClose={onClose} />);
    const overlay = screen.getByTestId("monster-modal-overlay");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("閉じるボタンをクリックすると onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<MonsterImageModal {...defaultProps} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: /閉じる|close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("画像エリアをクリックしても onClose が呼ばれない（伝播しない）", () => {
    const onClose = vi.fn();
    render(<MonsterImageModal {...defaultProps} onClose={onClose} />);
    const img = screen.getByAltText("ラーン");
    fireEvent.click(img);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("description が渡されたときに本文が表示される", () => {
    render(
      <MonsterImageModal
        {...defaultProps}
        description="大きな眼鏡をかけ、常に分厚い本を抱えた小さな浮遊霊。"
      />,
    );
    expect(
      screen.getByText("大きな眼鏡をかけ、常に分厚い本を抱えた小さな浮遊霊。"),
    ).toBeTruthy();
  });

  it("description なしなら本文の DOM は現れない（既存互換）", () => {
    render(<MonsterImageModal {...defaultProps} />);
    expect(screen.queryByTestId("monster-modal-description")).toBeNull();
  });

  // ─── Issue #94: 未解放 stage3 の説明文プレースホルダ（lockedHint prop）──────
  it("lockedHint が渡されたときに解放条件ヒントが表示される", () => {
    render(
      <MonsterImageModal
        {...(defaultProps as typeof defaultProps & { lockedHint?: string })}
        lockedHint="あと3回進化させると せつめいが 読めるよ"
      />,
    );
    const hint = screen.getByTestId("monster-modal-locked-hint");
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain("あと3回進化させると せつめいが 読めるよ");
  });

  it("lockedHint も description も無ければヒント・本文どちらの DOM も現れない（既存互換）", () => {
    render(<MonsterImageModal {...defaultProps} />);
    expect(screen.queryByTestId("monster-modal-locked-hint")).toBeNull();
    expect(screen.queryByTestId("monster-modal-description")).toBeNull();
  });

  it("description が渡されているときは description を表示し、lockedHint の DOM は出さない", () => {
    render(
      <MonsterImageModal
        {...defaultProps}
        description="大きな眼鏡をかけ、常に分厚い本を抱えた小さな浮遊霊。"
      />,
    );
    expect(
      screen.getByText("大きな眼鏡をかけ、常に分厚い本を抱えた小さな浮遊霊。"),
    ).toBeTruthy();
    expect(screen.queryByTestId("monster-modal-locked-hint")).toBeNull();
  });
});
