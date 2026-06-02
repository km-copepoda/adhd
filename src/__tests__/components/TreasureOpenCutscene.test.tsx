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

describe("TreasureOpenCutscene", () => {
  it("親ごほうび当選時は /treasure/open2.png + タイトルを表示", () => {
    render(
      <TreasureOpenCutscene
        result={{
          item: { id: "i1", title: "ガチャあたり！", rarity: "RARE" },
          collectionItem: null,
        }}
        onClose={() => {}}
      />
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/treasure/open2.png");
    expect(screen.getByText("ガチャあたり！")).toBeTruthy();
  });

  it("コレクション獲得時はアイテムの画像と名前を表示 (初回)", () => {
    render(
      <TreasureOpenCutscene
        result={{
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

  it("コレクション獲得時 count >= 2 → ダブり表記", () => {
    render(
      <TreasureOpenCutscene
        result={{
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

  it("item も collectionItem も無いとき null を返す (防御)", () => {
    const { container } = render(
      <TreasureOpenCutscene
        result={{ item: null, collectionItem: null }}
        onClose={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
