// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ childId: "child-1" }),
}));

// QuestActionSheet を最小限のスタブに置換: trigger-report / trigger-skip / trigger-close
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
      <button data-testid="trigger-report" onClick={() => onReport("q1", null, null)}>
        report
      </button>
      <button data-testid="trigger-skip" onClick={() => onSkip("q1", "体調不良")}>
        skip
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
    // eslint-disable-next-line @next/next/no-img-element
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChildViewQuestsPage: 代理スキップ", () => {
  it("シートの onSkip 経由で /api/parent/child-view/quests/[id]/skip-approve に POST する", async () => {
    const fetchCalls: { url: string; init?: RequestInit }[] = [];
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      if (url.includes("/api/parent/child-view/quests/today")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([baseQuest]) });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "たろう" }) });
      }
      if (url.includes("/skip-approve") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, treasureIds: [] }) });
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
      fireEvent.click(screen.getByTestId("trigger-skip"));
      await Promise.resolve();
      await Promise.resolve();
    });

    const skipCall = fetchCalls.find((c) => c.url.includes("/skip-approve"));
    expect(skipCall).toBeTruthy();
    expect(skipCall!.url).toContain("/api/parent/child-view/quests/q1/skip-approve");
    expect(skipCall!.init?.method).toBe("POST");
    const body = JSON.parse(skipCall!.init!.body as string);
    expect(body).toMatchObject({ childId: "child-1", comment: "体調不良" });
  });

  it("代理スキップ成功後に refetch が走る（クエスト一覧が SKIPPED に置き換わる）", async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/parent/child-view/quests/today")) {
        fetchCount++;
        const status = fetchCount === 1 ? "PENDING" : "SKIPPED";
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ ...baseQuest, status }]),
        });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "たろう" }) });
      }
      if (url.includes("/skip-approve") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, treasureIds: [] }) });
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
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-skip"));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText("スキップ")).toBeTruthy());
  });
});

describe("ChildViewQuestsPage: 進化カットインのトリガー", () => {
  it("代理報告成功後に CustomEvent('child-view-monster-refresh') を dispatch する", async () => {
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/parent/child-view/quests/today")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([baseQuest]) });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "たろう" }) });
      }
      if (url.includes("/report-approve") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, treasureIds: [] }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    const events: string[] = [];
    const listener = (e: Event) => events.push(e.type);
    window.addEventListener("child-view-monster-refresh", listener);

    try {
      await act(async () => {
        render(<ChildViewQuestsPage />);
      });
      await waitFor(() => expect(screen.getByText("宿題")).toBeTruthy());
      await act(async () => {
        fireEvent.click(screen.getByText("宿題"));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("trigger-report"));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(events).toContain("child-view-monster-refresh");
    } finally {
      window.removeEventListener("child-view-monster-refresh", listener);
    }
  });

  it("代理スキップ成功後にも CustomEvent('child-view-monster-refresh') を dispatch する", async () => {
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/parent/child-view/quests/today")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([baseQuest]) });
      }
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "たろう" }) });
      }
      if (url.includes("/skip-approve") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, treasureIds: [] }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    const events: string[] = [];
    const listener = (e: Event) => events.push(e.type);
    window.addEventListener("child-view-monster-refresh", listener);

    try {
      await act(async () => {
        render(<ChildViewQuestsPage />);
      });
      await waitFor(() => expect(screen.getByText("宿題")).toBeTruthy());
      await act(async () => {
        fireEvent.click(screen.getByText("宿題"));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("trigger-skip"));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(events).toContain("child-view-monster-refresh");
    } finally {
      window.removeEventListener("child-view-monster-refresh", listener);
    }
  });
});
