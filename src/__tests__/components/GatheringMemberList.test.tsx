// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import GatheringMemberList from "@/components/GatheringMemberList";

describe("GatheringMemberList", () => {
  it("monsterName と speciesName が異なれば両方表示する（上=愛称, 下=種族名）", () => {
    render(
      <GatheringMemberList
        members={[
          {
            id: "c1",
            name: "ピカちゃん",
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

  it("name と speciesName が同じ文字列のときはラベルを重複表示しない", () => {
    // monsterName 未設定で name が species にフォールバックするケース。
    // 旧実装は m.name と m.monsterName の両方に同じ文字列を流して重複表示していた。
    render(
      <GatheringMemberList
        members={[
          {
            id: "c1",
            name: "ぴかぴかドラゴン",
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
            name: "たろう",
            monsterName: "たろう",
            speciesName: "たろう",
            monsterImage: "/m.webp",
            evolutionStage: 0,
            isMe: false,
          },
          {
            id: "c2",
            name: "はなこ",
            monsterName: "ジムル",
            speciesName: "ジムル",
            monsterImage: "/m2.webp",
            evolutionStage: 1,
            isMe: false,
          },
        ]}
      />,
    );
    // c1: name === species → "たろう" は1回のみ
    expect(screen.getAllByText("たろう")).toHaveLength(1);
    // c2: name !== species → 両方表示される
    expect(screen.getByText("はなこ")).toBeTruthy();
    expect(screen.getByText("ジムル")).toBeTruthy();
  });
});
