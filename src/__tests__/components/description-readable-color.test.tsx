// @vitest-environment jsdom
//
// Issue #160: コレクションの説明文を読みやすい色にする。
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: vi.fn(),
  }),
}));

import MonsterImageModal from "@/components/MonsterImageModal";
import CutsceneOverlay from "@/components/child/CutsceneOverlay";
import BadgesContent from "@/components/child/BadgesContent";
import ItemsContent from "@/components/child/ItemsContent";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});
afterEach(() => cleanup());

const modalProps = {
  image: "/m.webp",
  monsterName: "ラーン",
  stageLabel: "じゅくれんしゃ",
  onClose: vi.fn(),
};

function classes(el: Element): string[] {
  return (el.getAttribute("class") ?? "").split(/\s+/);
}

describe("MonsterImageModal: 説明文の色", () => {
  it("description は text-white/90 で text-white/80 ではない", () => {
    render(<MonsterImageModal {...modalProps} description="せつめい" />);
    const c = classes(screen.getByTestId("monster-modal-description"));
    expect(c).toContain("text-white/90");
    expect(c).not.toContain("text-white/80");
    expect(c).not.toContain("text-white/60");
  });

  it("境界値: description なしで lockedHint のみのとき text-white/80 以上", () => {
    render(<MonsterImageModal {...modalProps} lockedHint="ヒント" />);
    const c = classes(screen.getByTestId("monster-modal-locked-hint"));
    expect(c).toContain("text-white/80");
    expect(c).not.toContain("text-white/60");
    expect(screen.queryByTestId("monster-modal-description")).toBeNull();
  });
});

describe("CutsceneOverlay: デフォルト説明文の色", () => {
  it("description は text-quest-muted で透過 (/80) や quest-dim を使わない", () => {
    render(<CutsceneOverlay onClose={vi.fn()} title="T" description="せつめい" />);
    const c = classes(screen.getByText("せつめい"));
    expect(c).toContain("text-quest-muted");
    expect(c).not.toContain("text-quest-dim/80");
    expect(c).not.toContain("text-quest-dim");
  });

  it("境界値: descriptionClassName 指定時はそちらが優先される", () => {
    render(
      <CutsceneOverlay
        onClose={vi.fn()}
        title="T"
        description="せつめい"
        descriptionClassName="text-red-500"
      />,
    );
    const c = classes(screen.getByText("せつめい"));
    expect(c).toContain("text-red-500");
    expect(c).not.toContain("text-quest-muted");
  });
});

describe("BadgesContent: 実績説明の色", () => {
  beforeEach(() => {
    const badge = (id: string, unlocked: boolean) => ({
      id,
      name: `名前${id}`,
      description: `説明${id}`,
      emoji: "🏅",
      unlocked,
      unlockedAt: unlocked ? "2026-01-01T00:00:00Z" : null,
      isNew: false,
      progress: unlocked ? null : { current: 1, target: 5 },
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          badges: [badge("a", true), badge("b", false)],
          unlockedCount: 1,
          totalCount: 2,
          newlyUnlocked: [],
        }),
    }) as unknown as typeof fetch;
  });

  it("解放済み・未解放どちらの説明も text-quest-muted で 10px/quest-dim でない", async () => {
    render(<BadgesContent trackVisit={false} enableRealtime={false} />);
    for (const id of ["a", "b"]) {
      const el = await waitFor(() => screen.getByText(`説明${id}`));
      const c = classes(el);
      expect(c).toContain("text-quest-muted");
      expect(c).not.toContain("text-quest-dim");
      expect(c).not.toContain("text-[10px]");
    }
  });
});

describe("ItemsContent: 補足文の色", () => {
  function mock(rubyEnabled: boolean) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          currentSeason: "summer",
          currentMonth: 7,
          rubyEnabled,
          items: [
            {
              id: "s1", season: "summer", category: "creature", rarity: "COMMON",
              name: "カブトムシ", nameKana: "かぶとむし", description: "つよい",
              descriptionKana: "つよい", image: "/x.webp", owned: true, count: 1,
              firstAcquiredAt: null, lastAcquiredAt: null,
            },
            {
              id: "s2", season: "summer", category: "creature", rarity: "COMMON",
              name: "未所持", nameKana: "みしょじ", description: "", descriptionKana: "",
              image: "/y.webp", owned: false, count: 0,
              firstAcquiredAt: null, lastAcquiredAt: null,
            },
          ],
        }),
    }) as unknown as typeof fetch;
  }

  for (const ruby of [true, false]) {
    it(`件数の補足文(2か所)が text-quest-muted (rubyEnabled=${ruby})`, async () => {
      mock(ruby);
      const { container } = render(<ItemsContent />);
      await waitFor(() => expect(screen.getAllByText(/つうじょう/).length).toBeGreaterThan(0));
      const ps = Array.from(container.querySelectorAll("p")).filter((p) =>
        (p.textContent ?? "").includes("つうじょう"),
      );
      expect(ps.length).toBeGreaterThanOrEqual(2);
      for (const p of ps) {
        const c = classes(p);
        expect(c).toContain("text-quest-muted");
        expect(c).not.toContain("text-quest-dim");
      }
    });
  }

  it("境界値: 未所持アイテム名は演出色(rgba(154,140,110,0.5))を維持する", async () => {
    mock(true);
    render(<ItemsContent />);
    await waitFor(() => expect(screen.getAllByText("？？？").length).toBeGreaterThan(0));
    const el = screen.getAllByText("？？？")[0] as HTMLElement;
    expect(el.outerHTML.replace(/\s/g, "")).toContain("rgba(154,140,110,0.5)");
  });
});
