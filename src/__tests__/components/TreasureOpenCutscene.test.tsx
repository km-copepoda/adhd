// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TreasureOpenCutscene from "@/components/child/TreasureOpenCutscene";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

describe("TreasureOpenCutscene ドット絵", () => {
  it("ハズレ時 + collectionItem 無し → /treasure/open1.png をフォールバック表示", () => {
    render(
      <TreasureOpenCutscene
        result={{ miss: true, pityTriggered: false, item: null, collectionItem: null }}
        onClose={() => {}}
      />
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/treasure/open1.png");
  });

  it("ハズレ時 + collectionItem あり → コレクションアイテムの画像と名前を表示", () => {
    render(
      <TreasureOpenCutscene
        result={{
          miss: true,
          pityTriggered: false,
          item: null,
          collectionItem: {
            id: "summer-01",
            name: "カブトムシ",
            rarity: "COMMON",
            season: "summer",
            description: "夏の王様。つのがかっこいい",
            image: "/collection-items/summer/カブトムシ.png",
            count: 1,
          },
        }}
        onClose={() => {}}
      />
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/collection-items/summer/");
    expect(screen.getByText("カブトムシ")).toBeTruthy();
    expect(screen.getByText(/夏のコレクションをゲット/)).toBeTruthy();
  });

  it("ハズレ時 + collectionItem の count >= 2 → ダブり表記", () => {
    render(
      <TreasureOpenCutscene
        result={{
          miss: true,
          pityTriggered: false,
          item: null,
          collectionItem: {
            id: "summer-01",
            name: "カブトムシ",
            rarity: "COMMON",
            season: "summer",
            description: "夏の王様",
            image: "/collection-items/summer/カブトムシ.png",
            count: 3,
          },
        }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/3個目/)).toBeTruthy();
  });

  it("あたり時は /treasure/open2.png を表示する", () => {
    render(
      <TreasureOpenCutscene
        result={{
          miss: false,
          pityTriggered: false,
          item: { id: "i1", title: "ごほうび", rarity: "RARE" },
        }}
        onClose={() => {}}
      />
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/treasure/open2.png");
  });

  it("あたり時もタイトル文字列を表示する", () => {
    render(
      <TreasureOpenCutscene
        result={{
          miss: false,
          pityTriggered: false,
          item: { id: "i1", title: "ガチャあたり！", rarity: "RARE" },
        }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("ガチャあたり！")).toBeTruthy();
  });
});
