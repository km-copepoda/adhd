// @vitest-environment jsdom
//
// Issue #140 回帰確認: LP（src/components/lp/MonstersSection.tsx）経由の
// MonsterImageModal 表示は rubyEnabled の概念を持たず、常に漢字表記のまま
// 変わらないこと。LP は非ログイン公開ページであり rubyEnabled という設定自体が
// 存在しないため、本Issueでは一切触らない（Issue本文のスコープ外リストを参照）。

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { MonstersSection } from "@/components/lp/MonstersSection";
import { MONSTER_TABLE } from "@/lib/monsters";

// CSS Modules のクラス名オブジェクトはテストでは無関係なので空文字を返すダミーを渡す
const s = new Proxy({}, { get: () => "" }) as Record<string, string>;

describe("MonstersSection (LP) 回帰確認: rubyEnabled概念が無く常に漢字表記のまま", () => {
  it("stage1 モンスター（ラーン）をタップすると、通常表記の説明文がそのまま表示される", () => {
    render(<MonstersSection s={s} />);

    fireEvent.click(screen.getByAltText("ラーン"));

    const expectedDescription = MONSTER_TABLE["STUDY"].description;
    expect(screen.getByText(expectedDescription)).toBeTruthy();
    // かな表記データ（descriptionKana）は LP では使われないこと
    const kana = MONSTER_TABLE["STUDY"].descriptionKana;
    if (kana !== expectedDescription) {
      expect(screen.queryByText(kana)).toBeNull();
    }
  });
});
