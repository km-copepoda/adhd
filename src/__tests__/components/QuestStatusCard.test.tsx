// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import QuestStatusCard from "@/components/child/QuestStatusCard";
import type { TreasureCountdown } from "@/lib/treasureCountdown";

const noneCountdown: TreasureCountdown = { kind: "none" };

describe("QuestStatusCard", () => {
  it("completedCount=3, totalCount=5 → 完了数表記に 3 と 5 を含む", () => {
    render(
      <QuestStatusCard
        completedCount={3}
        totalCount={5}
        provisionalPt={0}
        confirmedPt={0}
        countdown={noneCountdown}
      />,
    );
    // "3 / 5" のような完了数表記全体を確認
    expect(document.body.textContent).toMatch(/3\s*\/\s*5/);
  });

  it("進捗バーの style.width が 60%", () => {
    render(
      <QuestStatusCard
        completedCount={3}
        totalCount={5}
        provisionalPt={0}
        confirmedPt={0}
        countdown={noneCountdown}
      />,
    );
    const bar = screen.getByTestId("quest-progress-bar");
    expect(bar.style.width).toBe("60%");
  });

  it("境界値 totalCount=0 → widthが 0%（NaN%にならない）", () => {
    render(
      <QuestStatusCard
        completedCount={0}
        totalCount={0}
        provisionalPt={0}
        confirmedPt={0}
        countdown={noneCountdown}
      />,
    );
    const bar = screen.getByTestId("quest-progress-bar");
    expect(bar.style.width).toBe("0%");
    expect(bar.style.width).not.toContain("NaN");
  });

  it("境界値 completedCount === totalCount → widthが 100%", () => {
    render(
      <QuestStatusCard
        completedCount={4}
        totalCount={4}
        provisionalPt={0}
        confirmedPt={0}
        countdown={noneCountdown}
      />,
    );
    const bar = screen.getByTestId("quest-progress-bar");
    expect(bar.style.width).toBe("100%");
  });

  it("provisionalPt=0 かつ confirmedPt=0 → pt表示を出さない", () => {
    render(
      <QuestStatusCard
        completedCount={1}
        totalCount={3}
        provisionalPt={0}
        confirmedPt={0}
        countdown={noneCountdown}
      />,
    );
    expect(screen.queryByTestId("quest-provisional-pt")).toBeNull();
    expect(screen.queryByTestId("quest-confirmed-pt")).toBeNull();
  });

  it("provisionalPt>0 のみ → 仮ptだけ表示する", () => {
    render(
      <QuestStatusCard
        completedCount={1}
        totalCount={3}
        provisionalPt={2}
        confirmedPt={0}
        countdown={noneCountdown}
      />,
    );
    expect(screen.getByTestId("quest-provisional-pt").textContent).toMatch(/2/);
    expect(screen.queryByTestId("quest-confirmed-pt")).toBeNull();
  });

  it("confirmedPt>0 のみ → 本ptだけ表示する", () => {
    render(
      <QuestStatusCard
        completedCount={1}
        totalCount={3}
        provisionalPt={0}
        confirmedPt={4}
        countdown={noneCountdown}
      />,
    );
    expect(screen.getByTestId("quest-confirmed-pt").textContent).toMatch(/4/);
    expect(screen.queryByTestId("quest-provisional-pt")).toBeNull();
  });

  it("countdown kind: to_streak → 対応文言が treasure-countdown 内に出る", () => {
    const countdown: TreasureCountdown = {
      kind: "to_streak",
      remaining: 2,
      text: "宝箱出現まであと 2 個！",
    };
    render(
      <QuestStatusCard
        completedCount={1}
        totalCount={5}
        provisionalPt={0}
        confirmedPt={0}
        countdown={countdown}
      />,
    );
    expect(screen.getByTestId("treasure-countdown").textContent).toContain(
      "宝箱出現まであと 2 個！",
    );
  });

  it("countdown kind: to_all_complete → 対応文言が treasure-countdown 内に出る", () => {
    const countdown: TreasureCountdown = {
      kind: "to_all_complete",
      remaining: 1,
      text: "レア確率UPの宝箱まであと 1 個！",
    };
    render(
      <QuestStatusCard
        completedCount={4}
        totalCount={5}
        provisionalPt={0}
        confirmedPt={0}
        countdown={countdown}
      />,
    );
    expect(screen.getByTestId("treasure-countdown").textContent).toContain(
      "レア確率UPの宝箱まであと 1 個！",
    );
  });

  it("countdown kind: all_done → 対応文言が treasure-countdown 内に出る", () => {
    const countdown: TreasureCountdown = {
      kind: "all_done",
      messageIndex: 0,
      text: "ぜんぶ達成！すごいね！",
    };
    render(
      <QuestStatusCard
        completedCount={5}
        totalCount={5}
        provisionalPt={0}
        confirmedPt={0}
        countdown={countdown}
      />,
    );
    expect(screen.getByTestId("treasure-countdown").textContent).toContain(
      "ぜんぶ達成！すごいね！",
    );
  });

  it("countdown kind: none（今日のタスク0件）→ カウントダウン行を描画しない", () => {
    render(
      <QuestStatusCard
        completedCount={0}
        totalCount={0}
        provisionalPt={0}
        confirmedPt={0}
        countdown={noneCountdown}
      />,
    );
    expect(screen.queryByTestId("treasure-countdown")).toBeNull();
  });

  it("children に渡した宝箱スロットが描画される", () => {
    render(
      <QuestStatusCard
        completedCount={1}
        totalCount={3}
        provisionalPt={0}
        confirmedPt={0}
        countdown={noneCountdown}
      >
        <div data-testid="treasure-slot-content">宝箱スロット</div>
      </QuestStatusCard>,
    );
    expect(screen.getByTestId("treasure-slot-content")).toBeTruthy();
  });
});
