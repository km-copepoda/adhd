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
  it("ハズレ時は /treasure/open1.png を表示する", () => {
    render(
      <TreasureOpenCutscene
        result={{ miss: true, pityTriggered: false, item: null }}
        onClose={() => {}}
      />
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/treasure/open1.png");
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
