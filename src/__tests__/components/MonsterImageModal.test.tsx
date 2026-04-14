// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import MonsterImageModal from "@/components/MonsterImageModal";

// next/image を img タグにモック
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
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
});
