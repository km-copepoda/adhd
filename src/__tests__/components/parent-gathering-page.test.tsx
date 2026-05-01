// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/components/GatheringMemberList", () => ({
  default: () => <div data-testid="member-list" />,
}));

vi.mock("@/components/GatheringBoard", () => ({
  default: () => <div data-testid="board" />,
}));

import ParentGatheringPage from "@/app/app/parent/(app)/gathering/page";

describe("親 ひろば画面 (旧ギルド／旧あつまり)", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            members: [
              { id: "c1", role: "CHILD", name: "たろう", monsterName: "ラーン" },
              { id: "c2", role: "CHILD", name: "", monsterName: "ジムル" },
              { id: "p1", role: "PARENT", name: "親", monsterName: null },
            ],
          }),
        });
      }
      if (url.includes("/api/gathering/current")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("h1 が「ひろば」を含む（旧ギルド）", async () => {
    render(<ParentGatheringPage />);
    await waitFor(() => {
      const text = screen.getByRole("heading", { level: 1 }).textContent ?? "";
      expect(text).toContain("ひろば");
      expect(text).not.toContain("ギルド");
    });
  });

  it("子供セレクターは 🧒 と monsterName を表示する", async () => {
    render(<ParentGatheringPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /🧒.*ラーン/ })).toBeTruthy();
    });
  });

  it("monsterName が無ければ name にフォールバックする", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            members: [
              { id: "c1", role: "CHILD", name: "たろう", monsterName: null },
              { id: "c2", role: "CHILD", name: "はなこ", monsterName: null },
            ],
          }),
        });
      }
      if (url.includes("/api/gathering/current")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    render(<ParentGatheringPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /🧒.*たろう/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /🧒.*はなこ/ })).toBeTruthy();
    });
  });
});
