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
            // 本テストは rubyEnabled 無指定（かな表記非対象のため、空文字で従来表記を維持）
            nameKana: "",
            rarity: "COMMON",
            season: "summer",
            description: "夏の王様。つのがかっこいい",
            descriptionKana: "",
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
            nameKana: "",
            rarity: "COMMON",
            season: "summer",
            description: "夏の王様",
            descriptionKana: "",
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

  // ─── Issue #140: モンスター図鑑・コレクションアイテムの表示にrubyEnabledを配線 ──
  // TreasureOpenCutscene は自分で API を叩かない。呼び出し元が status API の
  // rubyEnabled を props で明示的に渡す設計。
  describe("rubyEnabled配線（Issue #140）", () => {
    const COLLECTION_ITEM = {
      id: "summer-01",
      name: "カブトムシ",
      nameKana: "かぶとむし",
      rarity: "COMMON" as const,
      season: "summer" as const,
      description: "夏の王様。つのがかっこいい",
      descriptionKana: "なつのおうさま。つのがかっこいい",
      image: "/collection-items/summer/カブトムシ.png",
      count: 1,
    };

    it("コレクションアイテム当選時: rubyEnabled=true でタイトル・説明がかな表記になり、漢字表記は表示されないこと", () => {
      render(
        <TreasureOpenCutscene
          result={{ item: null, collectionItem: COLLECTION_ITEM }}
          onClose={() => {}}
          rubyEnabled={true}
        />
      );

      expect(screen.getByText("かぶとむし")).toBeTruthy();
      expect(screen.queryByText("カブトムシ")).toBeNull();
      expect(screen.getByText("なつのおうさま。つのがかっこいい")).toBeTruthy();
      expect(screen.queryByText("夏の王様。つのがかっこいい")).toBeNull();
      const img = screen.getByRole("img") as HTMLImageElement;
      expect(img.alt).toBe("かぶとむし");
    });

    it("コレクションアイテム当選時: rubyEnabled=false で通常表記（漢字）になり、かな表記は表示されないこと", () => {
      render(
        <TreasureOpenCutscene
          result={{ item: null, collectionItem: COLLECTION_ITEM }}
          onClose={() => {}}
          rubyEnabled={false}
        />
      );

      expect(screen.getByText("カブトムシ")).toBeTruthy();
      expect(screen.queryByText("かぶとむし")).toBeNull();
      expect(screen.getByText("夏の王様。つのがかっこいい")).toBeTruthy();
      expect(screen.queryByText("なつのおうさま。つのがかっこいい")).toBeNull();
      const img = screen.getByRole("img") as HTMLImageElement;
      expect(img.alt).toBe("カブトムシ");
    });

    it("親ごほうび当選時: rubyEnabled=true でも item.title はかな化されずそのまま表示される", () => {
      render(
        <TreasureOpenCutscene
          result={{
            item: { id: "i1", title: "ガチャあたり！", rarity: "RARE" },
            collectionItem: null,
          }}
          onClose={() => {}}
          rubyEnabled={true}
        />
      );

      expect(screen.getByText("ガチャあたり！")).toBeTruthy();
    });
  });
});
