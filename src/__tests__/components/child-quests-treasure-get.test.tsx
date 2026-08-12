// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

// QuestActionSheet をテスト用に差し替え: onReport / onSkip → onClose を即時に走らせる
vi.mock("@/components/QuestActionSheet", () => ({
  default: ({
    onReport,
    onSkip,
    onClose,
  }: {
    onReport: (id: string, c: string | null, p: string | null) => Promise<void>;
    onSkip: (id: string, reason: string) => Promise<void>;
    onClose: () => void;
  }) => (
    <div data-testid="quest-sheet">
      <button
        data-testid="trigger-report"
        onClick={async () => {
          await onReport("q1", null, null);
          onClose();
        }}
      >
        report
      </button>
      <button
        data-testid="trigger-skip"
        onClick={async () => {
          await onSkip("q1", "気分が乗らない");
          onClose();
        }}
      >
        skip
      </button>
    </div>
  ),
}));

vi.mock("@/components/MonsterMiniCard", () => ({ default: () => <div /> }));
vi.mock("@/components/child/TreasureStock", () => ({ default: () => <div /> }));

import ChildQuestsPage from "@/app/app/child/quests/page";

const quest = {
  id: "q1",
  date: "2026-05-29T00:00:00Z",
  status: "PENDING",
  comment: null,
  rejectionReason: null,
  approvalStamp: null,
  deadlineBonusEarned: false,
  photoUrl: null,
  hasDeadline: false,
  idleDays: 0,
  eligibleForDeclaration: false,
  declaredToday: false,
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

function setupFetch(opts: {
  reportResponse?: { treasureIds: string[] };
  skipResponse?: { treasureIds: string[] };
}) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/api/quests/today")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([quest]) });
    }
    if (url.includes("/api/users/me")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url.includes("/api/monster-status")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ evolutionStage: 0, evolutionPath: "", studyPt: 0, staminaPt: 0, lifePt: 0 }) });
    }
    if (url.includes(`/api/quests/q1/report`) && init?.method === "POST") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(opts.reportResponse ?? { treasureIds: [] }) });
    }
    if (url.includes(`/api/quests/q1/skip`) && init?.method === "POST") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(opts.skipResponse ?? { treasureIds: [] }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("child quests page - 宝箱ゲット演出", () => {
  it("report API が treasureIds を返したら、シートが閉じたあと「宝箱ゲット！」が表示される", async () => {
    const fetchMock = setupFetch({ reportResponse: { treasureIds: ["t1"] } });
    await act(async () => {
      render(<ChildQuestsPage />);
    });

    // クエストをタップしてシートを開く
    await waitFor(() => {
      expect(screen.getByText(/宿題/)).toBeTruthy();
    });

    // マウント時に fetchMonster が1回だけ呼ばれる（回帰テスト）
    const monsterStatusCalls = () =>
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/monster-status"));
    expect(monsterStatusCalls()).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByText(/宿題/));
    });
    await waitFor(() => {
      expect(screen.getByTestId("quest-sheet")).toBeTruthy();
    });

    // 報告→シート閉じ
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-report"));
    });

    await waitFor(() => {
      expect(screen.getByText("宝箱ゲット！")).toBeTruthy();
    });

    // 報告後も /api/monster-status は再取得されない（マウント時1回のまま）
    expect(monsterStatusCalls()).toHaveLength(1);
  });

  it("treasureIds が空なら宝箱ゲット演出は出ない", async () => {
    setupFetch({ reportResponse: { treasureIds: [] } });
    await act(async () => {
      render(<ChildQuestsPage />);
    });
    await waitFor(() => expect(screen.getByText(/宿題/)).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText(/宿題/));
    });
    await waitFor(() => expect(screen.getByTestId("quest-sheet")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-report"));
    });

    // 少し待っても表示されない
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("宝箱ゲット！")).toBeNull();
  });

  it("skip API が treasureIds を返したら、シートが閉じたあと「宝箱ゲット！」が表示される (report と対称)", async () => {
    setupFetch({ skipResponse: { treasureIds: ["t-all"] } });
    await act(async () => {
      render(<ChildQuestsPage />);
    });
    await waitFor(() => expect(screen.getByText(/宿題/)).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText(/宿題/));
    });
    await waitFor(() => expect(screen.getByTestId("quest-sheet")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-skip"));
    });

    await waitFor(() => {
      expect(screen.getByText("宝箱ゲット！")).toBeTruthy();
    });
  });
});
