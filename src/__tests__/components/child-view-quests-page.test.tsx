// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ childId: "child-1" }),
}));

// QuestActionSheet をテスト用に差し替え: onReport をボタンで叩けるようにする
vi.mock("@/components/QuestActionSheet", () => ({
  default: ({ onReport }: { onReport: (id: string, c: string | null, p: string | null) => Promise<void> }) => (
    <div data-testid="quest-sheet">
      <button data-testid="trigger-report" onClick={() => onReport("q1", null, null)}>
        report
      </button>
    </div>
  ),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

import ChildViewQuestsPage from "@/app/app/parent/child-view/[childId]/quests/page";

const baseQuest = {
  id: "q1",
  date: "2026-05-10T00:00:00Z",
  status: "PENDING",
  comment: null,
  rejectionReason: null,
  approvalStamp: null,
  deadlineBonusEarned: false,
  photoUrl: null,
  hasDeadline: false,
  template: {
    id: "t1",
    title: "宿題",
    emoji: "📚",
    category: "STUDY",
    isTemporary: false,
    createdBy: "PARENT",
    photoBonus: false,
    taskStreaks: [],
  },
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ChildViewQuestsPage 代理報告後のモーダル挙動（回帰防止）", () => {
  it("代理報告後の refetch 中に LoadingSpinner で画面全体が unmount されないこと（モーダルが消えて再表示するバグの回避）", async () => {
    // refetch 用 fetch を遅延させて、その間の DOM 状態を観測する
    let resolveRefetch: (() => void) | null = null;
    let fetchCount = 0;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/parent/child-view/quests/today")) {
        fetchCount++;
        if (fetchCount === 1) {
          // 初回ロード: 即返す
          return Promise.resolve({ ok: true, json: () => Promise.resolve([baseQuest]) });
        }
        // 代理報告後の refetch: わざと未解決にしてその間の DOM を観測する
        return new Promise((resolve) => {
          resolveRefetch = () =>
            resolve({ ok: true, json: () => Promise.resolve([{ ...baseQuest, status: "APPROVED" }]) });
        });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "たろう" }) });
      }
      if (url.includes("/report-approve")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    render(<ChildViewQuestsPage />);

    // 初回ロード完了を待つ（クエスト表示）
    await waitFor(() => expect(screen.getByText("宿題")).toBeTruthy());

    // クエスト名をクリックしてシート（モック）を開く
    fireEvent.click(screen.getByText("宿題"));
    expect(screen.getByTestId("quest-sheet")).toBeTruthy();

    // 報告ボタンを発火（fetch refetch が hanging になる）
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-report"));
      // microtask を流して handleReport の await 二段を進める
      await Promise.resolve();
      await Promise.resolve();
    });

    // refetch 中: LoadingSpinner が DOM に出ていない（=ページが unmount されていない）こと
    expect(screen.queryByTestId("loading-spinner")).toBeNull();
    // モーダルも引き続き mount されている（success state を見せ続けるため）
    expect(screen.queryByTestId("quest-sheet")).toBeTruthy();

    // refetch を完了させて後処理
    await act(async () => {
      resolveRefetch?.();
      await Promise.resolve();
    });
  });
});
