// @vitest-environment jsdom
// Issue #190: onReport/onSkip の失敗時に成功演出を出さず、エラー表示して idle に戻す
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import QuestActionSheet, { type SheetQuest } from "@/components/QuestActionSheet";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
const confetti = vi.fn();
vi.mock("@/lib/confetti", () => ({ fireCompletionConfetti: (...a: unknown[]) => confetti(...a) }));
vi.mock("@/lib/imageUtils", () => ({ compressImage: vi.fn() }));

const QUEST: SheetQuest = {
  id: "q1",
  status: "PENDING",
  declaredToday: false,
  template: { title: "テスト", emoji: "📚", category: "STUDY", photoBonus: false, taskStreaks: [] },
};

function renderSheet(onReport: () => Promise<boolean>, onSkip: () => Promise<boolean> = vi.fn(), onClose = vi.fn()) {
  const utils = render(
    <QuestActionSheet
      quest={QUEST}
      hasDeadline={false}
      questsCompleted={0}
      questsTotal={1}
      onReport={onReport}
      onSkip={onSkip}
      onClose={onClose}
    />,
  );
  return { ...utils, onClose };
}

const ERROR_TEXT = /うまく送れなかったよ/;

describe("QuestActionSheet 送信失敗 (#190)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    confetti.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  async function clickReport() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /クエスト完了/ }));
    });
  }

  it("onReport が false のとき成功演出・紙吹雪を出さず、エラーを表示して再送できる", async () => {
    renderSheet(vi.fn().mockResolvedValue(false));
    await clickReport();
    expect(screen.getByRole("alert").textContent).toMatch(ERROR_TEXT);
    expect(confetti).not.toHaveBeenCalled();
    const btn = screen.getByRole("button", { name: /クエスト完了/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("onReport が reject しても「送信中...」で固まらずエラーを表示する", async () => {
    renderSheet(vi.fn().mockRejectedValue(new Error("offline")));
    await clickReport();
    expect(screen.queryByText("送信中...")).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(ERROR_TEXT);
    expect(confetti).not.toHaveBeenCalled();
  });

  it("onSkip が false のときエラーを表示し、成功表示にならない", async () => {
    const onSkip = vi.fn().mockResolvedValue(false);
    renderSheet(vi.fn(), onSkip);
    fireEvent.click(screen.getByRole("button", { name: /今日はスキップする/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ねむい" } });
    const submit = screen.getByRole("button", { name: /スキップを申請する/ });
    
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toMatch(ERROR_TEXT);
  });

  it("失敗後に再送して成功すると、エラーが消えて成功演出になり紙吹雪が出る", async () => {
    const onReport = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderSheet(onReport);
    await clickReport();
    expect(screen.getByRole("alert")).toBeTruthy();
    await clickReport();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(confetti).toHaveBeenCalledTimes(1);
  });

  it("成功時は 3 秒後に onClose が呼ばれる（境界: 2999ms では呼ばれない）", async () => {
    const { onClose } = renderSheet(vi.fn().mockResolvedValue(true));
    await clickReport();
    act(() => { vi.advanceTimersByTime(2999); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("成功後にアンマウントすると 3 秒タイマーが解除され onClose は呼ばれない", async () => {
    const { onClose, unmount } = renderSheet(vi.fn().mockResolvedValue(true));
    await clickReport();
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("成功後に手動で閉じるとタイマーが解除され onClose は 1 回だけ呼ばれる", async () => {
    const { onClose, container } = renderSheet(vi.fn().mockResolvedValue(true));
    await clickReport();
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
