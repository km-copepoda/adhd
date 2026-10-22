// @vitest-environment jsdom
// Issue #190 (Codex指摘): 代理報告の POST 成功後に再取得が失敗しても、報告は成功扱いにする
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ childId: "child-1" }) }));

vi.mock("@/components/QuestActionSheet", () => ({
  default: ({
    onReport,
    onSkip,
  }: {
    onReport: (id: string, c: string | null, p: string | null) => Promise<boolean>;
    onSkip: (id: string, reason: string) => Promise<boolean>;
  }) => (
    <div data-testid="quest-sheet">
      <button
        data-testid="trigger-report"
        onClick={async () => {
          document.body.dataset.reportResult = String(await onReport("q1", null, null));
        }}
      />
      <button
        data-testid="trigger-skip"
        onClick={async () => {
          document.body.dataset.skipResult = String(await onSkip("q1", "体調不良"));
        }}
      />
    </div>
  ),
}));
vi.mock("@/components/LoadingSpinner", () => ({ default: () => <div data-testid="loading-spinner" /> }));
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import ChildViewQuestsPage from "@/app/app/parent/child-view/[childId]/quests/page";

const quest = {
  id: "q1",
  date: "2026-05-10T00:00:00Z",
  status: "PENDING",
  comment: null,
  rejectionReason: null,
  approvalStamp: null,
  deadlineBonusEarned: false,
  photoUrl: null,
  hasDeadline: false,
  declaredToday: false,
  template: {
    id: "t1", title: "宿題", emoji: "📚", category: "STUDY", isTemporary: false,
    createdBy: "PARENT", photoBonus: false, taskStreaks: [],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  delete document.body.dataset.reportResult;
  delete document.body.dataset.skipResult;
});

function setup() {
  let postDone = false;
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      postDone = true;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }
    // POST 後の再取得 (一覧・モンスター状態) はネットワークエラーにする
    if (postDone) return Promise.reject(new TypeError("network"));
    if (url.includes("/quests/today")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([quest]) });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

describe("ChildViewQuestsPage: POST 成功後の再取得失敗", () => {
  it("報告 POST 成功後に再取得が reject しても onReport は true を返す", async () => {
    setup();
    render(<ChildViewQuestsPage />);
    await waitFor(() => expect(screen.getByTestId("quest-sheet")).toBeTruthy()).catch(() => {});
    // シートは activeQuest 経由でしか出ないので、カードを開く
    fireEvent.click(await screen.findByText("宿題"));
    fireEvent.click(await screen.findByTestId("trigger-report"));
    await waitFor(() => expect(document.body.dataset.reportResult).toBeDefined());
    expect(document.body.dataset.reportResult).toBe("true");
  });

  it("スキップ POST 成功後に再取得が reject しても onSkip は true を返す", async () => {
    setup();
    render(<ChildViewQuestsPage />);
    fireEvent.click(await screen.findByText("宿題"));
    fireEvent.click(await screen.findByTestId("trigger-skip"));
    await waitFor(() => expect(document.body.dataset.skipResult).toBeDefined());
    expect(document.body.dataset.skipResult).toBe("true");
  });
});
