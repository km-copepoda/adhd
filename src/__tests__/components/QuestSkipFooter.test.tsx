// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import QuestSkipFooter from "@/components/questAction/QuestSkipFooter";
import { SKIP_REASON_TEMPLATES } from "@/lib/skipReasonTemplates";

function renderFooter(overrides: Partial<React.ComponentProps<typeof QuestSkipFooter>> = {}) {
  const props = {
    showSkip: true,
    skipReason: "",
    isSubmitting: false,
    onShowSkip: vi.fn(),
    onCancelSkip: vi.fn(),
    onSkipReasonChange: vi.fn(),
    onSkipSubmit: vi.fn(),
    ...overrides,
  };
  const utils = render(<QuestSkipFooter {...props} />);
  return { ...props, container: utils.container };
}

describe("QuestSkipFooter スキップ理由テンプレート", () => {
  it("showSkip=true のとき、テンプレートボタンが全て表示される", () => {
    renderFooter();
    for (const tmpl of SKIP_REASON_TEMPLATES) {
      // ボタン名にラベル本文が含まれていることを確認（絵文字は任意）
      expect(screen.getByRole("button", { name: new RegExp(tmpl.label) })).toBeTruthy();
    }
  });

  it("showSkip=false のとき、テンプレートボタンは表示されない", () => {
    renderFooter({ showSkip: false });
    for (const tmpl of SKIP_REASON_TEMPLATES) {
      expect(screen.queryByRole("button", { name: new RegExp(tmpl.label) })).toBeNull();
    }
  });

  it("テンプレートボタンを押すと onSkipReasonChange がテンプレート文言で呼ばれる", () => {
    const props = renderFooter();
    const first = SKIP_REASON_TEMPLATES[0];
    const btn = screen.getByRole("button", { name: new RegExp(first.label) });
    fireEvent.click(btn);
    expect(props.onSkipReasonChange).toHaveBeenCalledWith(first.label);
  });

  it("isSubmitting=true のときテンプレートボタンは disabled", () => {
    renderFooter({ isSubmitting: true });
    for (const tmpl of SKIP_REASON_TEMPLATES) {
      const btn = screen.getByRole("button", { name: new RegExp(tmpl.label) }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    }
  });

  it("入力欄と申請ボタンは従来通り併存する（手入力もできる）", () => {
    renderFooter();
    // 入力欄は placeholder で識別
    expect(screen.getByPlaceholderText(/理由を入力/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /スキップを申請する/ })).toBeTruthy();
  });

  it("拡張されたスキップフォームは狭いビューポートでもスクロール可能（overflow-y-auto + max-h）", () => {
    // Codex P2 指摘: シートの max-h-[85dvh] を超えると input/申請ボタンが操作不能になる
    const { container } = renderFooter();
    const input = container.querySelector('input[placeholder="理由を入力（必須）"]');
    expect(input).toBeTruthy();
    // 拡張フォームのルート div（.space-y-2）を探す
    let el: Element | null = input;
    let expandedRoot: Element | null = null;
    while (el && el.parentElement) {
      el = el.parentElement;
      if (el.className && typeof el.className === "string" && el.className.includes("space-y-2")) {
        expandedRoot = el;
        break;
      }
    }
    expect(expandedRoot).toBeTruthy();
    expect(expandedRoot!.className).toMatch(/overflow-y-auto/);
    expect(expandedRoot!.className).toMatch(/max-h-/);
  });
});

describe("SKIP_REASON_TEMPLATES データ", () => {
  it("最低3件のテンプレートを含む（幼児がテンプレを選べる意義がある件数）", () => {
    expect(SKIP_REASON_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it("各テンプレートは非空の label を持つ", () => {
    for (const tmpl of SKIP_REASON_TEMPLATES) {
      expect(tmpl.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("label に重複がない", () => {
    const labels = SKIP_REASON_TEMPLATES.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
