// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ childId: "child-1" }),
}));

// QuestActionSheet をテスト用に差し替え:
//   - trigger-report: 親の onReport だけを呼ぶ（既存の refetch リグレッションテストが
//     「シートが mount されたまま」を観測するため、自動 close しない）
//   - trigger-close:  シートを閉じる（カットインの遷移トリガー）
vi.mock("@/components/QuestActionSheet", () => ({
  default: ({
    onReport,
    onClose,
  }: {
    onReport: (id: string, c: string | null, p: string | null) => Promise<void>;
    onClose: () => void;
  }) => (
    <div data-testid="quest-sheet">
      <button data-testid="trigger-report" onClick={() => onReport("q1", null, null)}>
        report
      </button>
      <button data-testid="trigger-close" onClick={() => onClose()}>
        close
      </button>
    </div>
  ),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
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

describe("ChildViewQuestsPage: モンスターミニカード（キャラクター・XP）表示", () => {
  it("monster-status から取得したデータで MonsterMiniCard を表示する（子供画面と同等のキャラ+XP表示）", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/parent/child-view/quests/today")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([baseQuest]) });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            name: "たろう",
            side: null,
            evolutionStage: 1,
            evolutionPath: "",
            collectedPaths: "[]",
            studyPt: 3,
            staminaPt: 1,
            lifePt: 0,
            rebirthEggBonus: null,
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    render(<ChildViewQuestsPage />);

    // 子供名と stageLabel（"stage 1 / 3"）がカードに出る
    await waitFor(() => expect(screen.getByText("たろう")).toBeTruthy());
    expect(screen.getByText(/stage 1 \/ 3/)).toBeTruthy();
  });

  it("代理報告 API が treasureIds を返したら、シートが閉じたあと「宝箱ゲット！」のカットインが表示される", async () => {
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/parent/child-view/quests/today")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([baseQuest]) });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "たろう" }) });
      }
      if (url.includes("/report-approve") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, treasureIds: ["log-xyz"] }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    await act(async () => {
      render(<ChildViewQuestsPage />);
    });
    await waitFor(() => expect(screen.getByText("宿題")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByText("宿題"));
    });
    await waitFor(() => expect(screen.getByTestId("quest-sheet")).toBeTruthy());

    // 報告 → シート閉じ → カットイン
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-report"));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-close"));
    });

    await waitFor(() => expect(screen.getByText("宝箱ゲット！")).toBeTruthy());
  });

  it("代理報告 API の treasureIds が空配列ならカットインは表示しない", async () => {
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/parent/child-view/quests/today")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([baseQuest]) });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "たろう" }) });
      }
      if (url.includes("/report-approve") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, treasureIds: [] }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    await act(async () => {
      render(<ChildViewQuestsPage />);
    });
    await waitFor(() => expect(screen.getByText("宿題")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText("宿題"));
    });
    await waitFor(() => expect(screen.getByTestId("quest-sheet")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-report"));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-close"));
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("宝箱ゲット！")).toBeNull();
  });

  it("monster-status の childId クエリパラメータに URL の childId を渡す", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/parent/child-view/quests/today")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            name: "たろう",
            side: null,
            evolutionStage: 0,
            evolutionPath: "",
            collectedPaths: "[]",
            studyPt: 0,
            staminaPt: 0,
            lifePt: 0,
            rebirthEggBonus: null,
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<ChildViewQuestsPage />);

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([u]) => typeof u === "string" && u.includes("/api/parent/child-view/monster-status?childId=child-1"))).toBe(true),
    );
  });
});
