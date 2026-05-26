// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import QuestActionSheet, { type SheetQuest } from "@/components/QuestActionSheet";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/confetti", () => ({
  fireCompletionConfetti: vi.fn(),
}));

vi.mock("@/lib/imageUtils", () => ({
  compressImage: vi.fn(),
}));

function makeQuest(overrides: Partial<SheetQuest["template"]> = {}): SheetQuest {
  return {
    id: "q1",
    status: "PENDING",
    declaredToday: false,
    template: {
      title: "テストタスク",
      emoji: "📚",
      category: "STUDY",
      photoBonus: true,
      taskStreaks: [],
      ...overrides,
    },
  };
}

function renderSheet(quest: SheetQuest) {
  return render(
    <QuestActionSheet
      quest={quest}
      hasDeadline={false}
      questsCompleted={0}
      questsTotal={1}
      onReport={vi.fn()}
      onSkip={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

describe("QuestActionSheet 写真添付UI（カメラ/ギャラリー分離）", () => {
  it("photoBonus が true のとき、type=file の input が 2 つ存在する（カメラ用/ギャラリー用）", () => {
    const { container } = renderSheet(makeQuest());
    const inputs = container.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBe(2);
  });

  it("カメラ用 input は capture=environment を持つ", () => {
    const { container } = renderSheet(makeQuest());
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    const cameraInput = inputs.find((el) => el.getAttribute("capture") === "environment");
    expect(cameraInput).toBeTruthy();
    expect(cameraInput!.getAttribute("accept")).toBe("image/*");
  });

  it("ギャラリー用 input は capture 属性を持たない", () => {
    const { container } = renderSheet(makeQuest());
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    const galleryInput = inputs.find((el) => !el.hasAttribute("capture"));
    expect(galleryInput).toBeTruthy();
    expect(galleryInput!.getAttribute("accept")).toBe("image/*");
  });

  it("カメラボタンとギャラリーボタンの両方が表示される", () => {
    renderSheet(makeQuest());
    expect(screen.getByRole("button", { name: /カメラ/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /(ギャラリー|アルバム)/ })).toBeTruthy();
  });

  it("photoBonus が false のときは写真UIが表示されない", () => {
    const { container } = renderSheet(makeQuest({ photoBonus: false }));
    const inputs = container.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBe(0);
    expect(screen.queryByRole("button", { name: /カメラ/ })).toBeNull();
  });
});
