// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import TemplateImportSection from "@/components/parent/TemplateImportSection";
import { TASK_TEMPLATES_BY_AGE } from "@/lib/categories";

const templates = TASK_TEMPLATES_BY_AGE.elementary_low;

function renderSection(remaining: number | null, existingTitles: string[] = []) {
  return render(
    <TemplateImportSection
      childId="c1"
      existingTitles={existingTitles}
      remainingSlots={remaining}
      onImported={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

function checkboxes() {
  return screen.getAllByRole("checkbox") as HTMLInputElement[];
}

describe("TemplateImportSection: 無料プランの残り枠による選択制限", () => {
  afterEach(() => cleanup());

  it("残り枠が null (無制限) なら全件選択でき、チェックボックスも無効にならない", () => {
    renderSection(null);
    expect(checkboxes().filter((c) => c.checked)).toHaveLength(templates.length);
    expect(checkboxes().some((c) => c.disabled)).toBe(false);
  });

  it("残り枠3なら初期選択は3件で、未選択のチェックボックスは無効になる", () => {
    renderSection(3);
    const boxes = checkboxes();
    expect(boxes.filter((c) => c.checked)).toHaveLength(3);
    for (const b of boxes.filter((c) => !c.checked)) expect(b.disabled).toBe(true);
    for (const b of boxes.filter((c) => c.checked)) expect(b.disabled).toBe(false);
    expect(screen.getByRole("button", { name: "3件を追加" })).toBeTruthy();
  });

  it("選択済みを外すと枠が空き、別のテンプレを選べる", () => {
    renderSection(3);
    const first = checkboxes().find((c) => c.checked)!;
    fireEvent.click(first);
    expect(checkboxes().filter((c) => c.checked)).toHaveLength(2);
    const unchecked = checkboxes().find((c) => !c.checked && !c.disabled)!;
    expect(unchecked).toBeTruthy();
    fireEvent.click(unchecked);
    expect(checkboxes().filter((c) => c.checked)).toHaveLength(3);
  });

  it("「未追加をすべて選択」も残り枠までしか選ばない", () => {
    renderSection(2);
    fireEvent.click(screen.getByRole("button", { name: "すべて解除" }));
    fireEvent.click(screen.getByRole("button", { name: "未追加をすべて選択" }));
    expect(checkboxes().filter((c) => c.checked)).toHaveLength(2);
  });

  it("残り枠0なら何も選択できず、追加ボタンは無効", () => {
    renderSection(0);
    expect(checkboxes().every((c) => !c.checked && c.disabled)).toBe(true);
    expect((screen.getByRole("button", { name: "0件を追加" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("残り枠が制限されているとき、あと何件選べるかを表示する", () => {
    renderSection(3);
    expect(screen.getByText(/あと0件/)).toBeTruthy();
  });
});
