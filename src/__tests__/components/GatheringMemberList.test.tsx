// @vitest-environment jsdom
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import GatheringMemberList from "@/components/GatheringMemberList";

// MonsterImageModal が next/image を使うため、GatheringMemberList 経由のレンダリングでもモックが必要
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; [key: string]: unknown }) => (
    <img src={props.src} alt={props.alt} />
  ),
}));

describe("GatheringMemberList", () => {
  it("monsterName と speciesName が異なれば両方表示する（上=愛称, 下=種族名）", () => {
    render(
      <GatheringMemberList
        members={[
          {
            id: "c1",
            monsterName: "ピカちゃん",
            speciesName: "ぴかぴかドラゴン",
            monsterImage: "/m.webp",
            evolutionStage: 1,
            isMe: true,
          },
        ]}
      />,
    );
    expect(screen.getByText("ピカちゃん")).toBeTruthy();
    expect(screen.getByText("ぴかぴかドラゴン")).toBeTruthy();
  });

  it("monsterName と speciesName が同じ文字列のときはラベルを重複表示しない", () => {
    // monsterName 未設定で種族名にフォールバックしているケース
    render(
      <GatheringMemberList
        members={[
          {
            id: "c1",
            monsterName: "ぴかぴかドラゴン",
            speciesName: "ぴかぴかドラゴン",
            monsterImage: "/m.webp",
            evolutionStage: 1,
            isMe: true,
          },
        ]}
      />,
    );
    expect(screen.getAllByText("ぴかぴかドラゴン")).toHaveLength(1);
  });

  it("メンバーごとに上下ラベルが必ず異なる（同じ文字列が2つ縦に並ばない）", () => {
    render(
      <GatheringMemberList
        members={[
          {
            id: "c1",
            monsterName: "たろう",
            speciesName: "たろう",
            monsterImage: "/m.webp",
            evolutionStage: 0,
            isMe: false,
          },
          {
            id: "c2",
            monsterName: "ジムル",
            speciesName: "ジムジムドラゴン",
            monsterImage: "/m2.webp",
            evolutionStage: 1,
            isMe: false,
          },
        ]}
      />,
    );
    // c1: monsterName === speciesName → "たろう" は1回のみ
    expect(screen.getAllByText("たろう")).toHaveLength(1);
    // c2: monsterName !== speciesName → 両方表示される
    expect(screen.getByText("ジムル")).toBeTruthy();
    expect(screen.getByText("ジムジムドラゴン")).toBeTruthy();
  });

  describe("モンスタータップでの拡大モーダル表示", () => {
    const members = [
      {
        id: "c1",
        monsterName: "ピカちゃん",
        speciesName: "ぴかぴかドラゴン",
        monsterImage: "/m1.webp",
        evolutionStage: 1,
        isMe: false,
      },
      {
        id: "c2",
        monsterName: "ジムル",
        speciesName: "ジムジムドラゴン",
        monsterImage: "/m2.webp",
        evolutionStage: 2,
        isMe: true,
      },
      {
        id: "c3",
        monsterName: "たまご",
        speciesName: "たまご",
        monsterImage: "/egg.webp",
        evolutionStage: 0,
        isMe: false,
      },
      {
        id: "c4",
        monsterName: "ふめい",
        speciesName: "ふめい",
        monsterImage: "",
        evolutionStage: 1,
        isMe: false,
      },
    ];

    it("初期表示ではモーダルが描画されていない", () => {
      render(<GatheringMemberList members={members} />);
      expect(screen.queryByTestId("monster-modal-overlay")).toBeNull();
    });

    it("友達のセルをタップするとモーダルが開き、monsterImage と monsterName が表示される", () => {
      render(<GatheringMemberList members={members} />);
      fireEvent.click(
        screen.getByRole("button", { name: "ピカちゃんを大きく表示" }),
      );
      const overlay = screen.getByTestId("monster-modal-overlay");
      expect(
        within(overlay).getByAltText("ピカちゃん").getAttribute("src"),
      ).toBe("/m1.webp");
      expect(within(overlay).getByText("ピカちゃん")).toBeTruthy();
    });

    it("自分のセルをタップしてもモーダルが開く", () => {
      render(<GatheringMemberList members={members} />);
      fireEvent.click(screen.getByRole("button", { name: "ジムルを大きく表示" }));
      expect(screen.getByTestId("monster-modal-overlay")).toBeTruthy();
    });

    it("卵（evolutionStage: 0）のセルをタップしてもモーダルが開き、卵画像が表示される", () => {
      render(<GatheringMemberList members={members} />);
      fireEvent.click(screen.getByRole("button", { name: "たまごを大きく表示" }));
      const overlay = screen.getByTestId("monster-modal-overlay");
      expect(
        within(overlay).getByAltText("たまご").getAttribute("src"),
      ).toBe("/egg.webp");
    });

    it("複数メンバーがいるとき、2人目をタップするとモーダルには2人目の画像と名前だけが出る（取り違えがない）", () => {
      render(<GatheringMemberList members={members} />);
      fireEvent.click(screen.getByRole("button", { name: "ジムルを大きく表示" }));
      const overlay = screen.getByTestId("monster-modal-overlay");
      expect(within(overlay).getByText("ジムル")).toBeTruthy();
      expect(within(overlay).queryByText("ピカちゃん")).toBeNull();
    });

    it("モーダルに speciesName（種族名）のテキストが出ない", () => {
      render(<GatheringMemberList members={members} />);
      fireEvent.click(
        screen.getByRole("button", { name: "ピカちゃんを大きく表示" }),
      );
      const overlay = screen.getByTestId("monster-modal-overlay");
      expect(within(overlay).queryByText("ぴかぴかドラゴン")).toBeNull();
    });

    it("× ボタンを押すとモーダルが閉じる", () => {
      render(<GatheringMemberList members={members} />);
      fireEvent.click(
        screen.getByRole("button", { name: "ピカちゃんを大きく表示" }),
      );
      fireEvent.click(screen.getByRole("button", { name: /閉じる/ }));
      expect(screen.queryByTestId("monster-modal-overlay")).toBeNull();
    });

    it("オーバーレイをタップするとモーダルが閉じる", () => {
      render(<GatheringMemberList members={members} />);
      fireEvent.click(
        screen.getByRole("button", { name: "ピカちゃんを大きく表示" }),
      );
      fireEvent.click(screen.getByTestId("monster-modal-overlay"));
      expect(screen.queryByTestId("monster-modal-overlay")).toBeNull();
    });

    it("閉じたあとに別のメンバーをタップすると、そのメンバーで開き直す", () => {
      render(<GatheringMemberList members={members} />);
      fireEvent.click(
        screen.getByRole("button", { name: "ピカちゃんを大きく表示" }),
      );
      fireEvent.click(screen.getByRole("button", { name: /閉じる/ }));
      fireEvent.click(screen.getByRole("button", { name: "ジムルを大きく表示" }));
      const overlay = screen.getByTestId("monster-modal-overlay");
      expect(within(overlay).getByText("ジムル")).toBeTruthy();
    });

    it("monsterImage が空文字のメンバーはタップ対象のボタンとして描画されない", () => {
      render(<GatheringMemberList members={members} />);
      expect(
        screen.queryByRole("button", { name: "ふめいを大きく表示" }),
      ).toBeNull();
    });
  });

  describe("境界値", () => {
    it("メンバー0人では何も描画しない", () => {
      const { container } = render(<GatheringMemberList members={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("メンバー1人だけでもタップで開く", () => {
      render(
        <GatheringMemberList
          members={[
            {
              id: "solo",
              monsterName: "ひとり",
              speciesName: "ひとり",
              monsterImage: "/solo.webp",
              evolutionStage: 1,
              isMe: true,
            },
          ]}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "ひとりを大きく表示" }));
      expect(screen.getByTestId("monster-modal-overlay")).toBeTruthy();
    });
  });
});
