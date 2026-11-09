// @vitest-environment jsdom
import { render, screen, fireEvent, act } from "@testing-library/react";
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
    childId: "child-1",
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

describe("QuestActionSheet 自動クローズのタイマー (#191)", () => {
  it("成功後 3 秒以内にアンマウントされたら onClose は呼ばれない", async () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { unmount } = render(
        <QuestActionSheet
          quest={makeQuest({ photoBonus: false })}
          hasDeadline={false}
          questsCompleted={0}
          questsTotal={1}
          onReport={vi.fn().mockResolvedValue(true)}
          onSkip={vi.fn()}
          onClose={onClose}
        />
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /報告|完了|やった/ }));
      });
      unmount();
      vi.advanceTimersByTime(3500);
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("QuestActionSheet アップロードパス (#218)", () => {
  it("写真は <childId>/<questId>_<ts>.<ext> のパスでアップロードされる", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const { createClient } = await import("@/lib/supabase/client");
    const { compressImage } = await import("@/lib/imageUtils");

    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn((p: string) => ({ data: { publicUrl: `https://x.supabase.co/${p}` } }));
    vi.mocked(createClient).mockReturnValue({
      storage: { from: () => ({ upload, getPublicUrl }) },
    } as unknown as ReturnType<typeof createClient>);
    vi.mocked(compressImage).mockResolvedValue(new File(["x"], "a.webp", { type: "image/webp" }));
    URL.createObjectURL = vi.fn(() => "blob:preview");

    const onReport = vi.fn().mockResolvedValue(undefined);
    const quest = { ...makeQuest(), childId: "child-1" } as SheetQuest;
    const { container } = render(
      <QuestActionSheet
        quest={quest}
        hasDeadline={false}
        questsCompleted={0}
        questsTotal={1}
        onReport={onReport}
        onSkip={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByText("⚔ クエスト完了！"));

    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(upload.mock.calls[0][0]).toMatch(/^child-1\/q1_\d+\.webp$/);
    await waitFor(() => expect(onReport).toHaveBeenCalled());
    expect(onReport.mock.calls[0][2]).toMatch(/\/child-1\/q1_\d+\.webp$/);
  });
});
