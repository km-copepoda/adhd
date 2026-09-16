// @vitest-environment jsdom
//
// Issue #140: モンスター図鑑・コレクションアイテムの表示にrubyEnabledを配線する。
// 対象: src/components/child/ItemsContent.tsx
//
// 前提: /api/collection-items 系のレスポンスに rubyEnabled が追加され、各アイテムには
// 既に（Issue #139）nameKana/descriptionKana が乗っている。
// rubyEnabled に応じてサムネイル alt・グリッドラベル・詳細モーダルの名前と説明が
// かな表記/漢字表記に切り替わることを期待する（通常アイテム・月限定アイテムの両方）。
// 未獲得アイテムは rubyEnabled に関わらず「？？？」/「未獲得」のまま変わらないこと。
//
// 実装がまだ存在しないため、これらのテストはすべて Red（失敗）になる想定。

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

import ItemsContent from "@/components/child/ItemsContent";

const REGULAR_NAME = "カブトムシ";
const REGULAR_KANA = "かぶとむし";
const REGULAR_DESC = "夏の王様。つのがかっこいい";
const REGULAR_DESC_KANA = "なつのおうさま。つのがかっこいい";

const MONTHLY_NAME = "七夕飾り";
const MONTHLY_KANA = "たなばたかざり";

function mockApiResponse(rubyEnabled: unknown) {
  const body: Record<string, unknown> = {
    currentSeason: "summer",
    currentMonth: 7,
    items: [
      {
        id: "summer-01",
        season: "summer",
        category: "creature",
        rarity: "COMMON",
        name: REGULAR_NAME,
        nameKana: REGULAR_KANA,
        description: REGULAR_DESC,
        descriptionKana: REGULAR_DESC_KANA,
        image: "/x.webp",
        owned: true,
        count: 1,
        firstAcquiredAt: null,
        lastAcquiredAt: null,
      },
      {
        id: "summer-02",
        season: "summer",
        category: "creature",
        rarity: "COMMON",
        name: "未獲得くん",
        nameKana: "みかくとくくん",
        description: "",
        descriptionKana: "",
        image: "/y.webp",
        owned: false,
        count: 0,
        firstAcquiredAt: null,
        lastAcquiredAt: null,
      },
      {
        id: "m07-01",
        season: "summer",
        category: "creature",
        rarity: "COMMON",
        name: MONTHLY_NAME,
        nameKana: MONTHLY_KANA,
        description: "",
        descriptionKana: "",
        image: "/z.webp",
        month: 7,
        owned: true,
        count: 1,
        firstAcquiredAt: null,
        lastAcquiredAt: null,
      },
    ],
  };
  if (rubyEnabled !== "OMIT") {
    body.rubyEnabled = rubyEnabled;
  }
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ItemsContent: rubyEnabled配線（Issue #140）", () => {
  it("rubyEnabled=true のとき、通常アイテムのグリッドラベル・altがかな表記になり、漢字表記は表示されないこと", async () => {
    mockApiResponse(true);
    render(<ItemsContent />);

    await waitFor(() => expect(screen.getByText(REGULAR_KANA)).toBeTruthy());
    expect(screen.queryByText(REGULAR_NAME)).toBeNull();
    expect(screen.getByAltText(REGULAR_KANA)).toBeTruthy();
    expect(screen.queryByAltText(REGULAR_NAME)).toBeNull();
  });

  it("rubyEnabled=false のとき、通常表記（漢字）が表示され、かな表記は表示されないこと", async () => {
    mockApiResponse(false);
    render(<ItemsContent />);

    await waitFor(() => expect(screen.getByText(REGULAR_NAME)).toBeTruthy());
    expect(screen.queryByText(REGULAR_KANA)).toBeNull();
    expect(screen.getByAltText(REGULAR_NAME)).toBeTruthy();
    expect(screen.queryByAltText(REGULAR_KANA)).toBeNull();
  });

  it("境界値: rubyEnabled が未指定のとき、trueにフォールバックしてかな表記になること", async () => {
    mockApiResponse("OMIT");
    render(<ItemsContent />);

    await waitFor(() => expect(screen.getByText(REGULAR_KANA)).toBeTruthy());
    expect(screen.queryByText(REGULAR_NAME)).toBeNull();
  });

  it("月限定アイテムのラベル・altもrubyEnabledに応じて切り替わること", async () => {
    mockApiResponse(true);
    render(<ItemsContent />);

    await waitFor(() => expect(screen.getByText(MONTHLY_KANA)).toBeTruthy());
    expect(screen.queryByText(MONTHLY_NAME)).toBeNull();
    expect(screen.getByAltText(MONTHLY_KANA)).toBeTruthy();
  });

  it("未獲得アイテムはrubyEnabledに関わらず「？？？」表示のまま変わらないこと", async () => {
    mockApiResponse(true);
    render(<ItemsContent />);

    await waitFor(() => expect(screen.getByText(REGULAR_KANA)).toBeTruthy());
    expect(screen.getAllByText("？？？").length).toBeGreaterThan(0);
    expect(screen.getByAltText("未獲得")).toBeTruthy();
  });

  it("詳細モーダルの名前・説明もrubyEnabledに応じて切り替わること（true）", async () => {
    mockApiResponse(true);
    render(<ItemsContent />);

    await waitFor(() => expect(screen.getByAltText(REGULAR_KANA)).toBeTruthy());
    fireEvent.click(screen.getByAltText(REGULAR_KANA).closest("button")!);

    await waitFor(() => expect(screen.getByText(REGULAR_DESC_KANA)).toBeTruthy());
    expect(screen.queryByText(REGULAR_DESC)).toBeNull();
  });

  it("詳細モーダルの名前・説明もrubyEnabledに応じて切り替わること（false）", async () => {
    mockApiResponse(false);
    render(<ItemsContent />);

    await waitFor(() => expect(screen.getByAltText(REGULAR_NAME)).toBeTruthy());
    fireEvent.click(screen.getByAltText(REGULAR_NAME).closest("button")!);

    await waitFor(() => expect(screen.getByText(REGULAR_DESC)).toBeTruthy());
    expect(screen.queryByText(REGULAR_DESC_KANA)).toBeNull();
  });
});
