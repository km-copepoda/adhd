// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TaskForm, { type FormData, type FormMode } from "@/components/parent/TaskForm";

function makeForm(overrides: Partial<FormData> = {}): FormData {
  return {
    title: "",
    category: "STUDY",
    repeatDays: [1, 2, 3, 4, 5],
    targetDate: "",
    photoBonus: false,
    carryOver: false,
    assignedChildId: "child-1",
    ...overrides,
  };
}

function renderForm(props: {
  form?: Partial<FormData>;
  formMode?: FormMode;
  editingId?: string | null;
  onFormChange?: (updater: (f: FormData) => FormData) => void;
  onFormModeChange?: (mode: FormMode) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
} = {}) {
  return render(
    <TaskForm
      form={makeForm(props.form)}
      formMode={props.formMode ?? "regular"}
      editingId={props.editingId ?? null}
      isEditingPending={false}
      childName="たろう"
      onFormChange={props.onFormChange ?? vi.fn()}
      onFormModeChange={props.onFormModeChange ?? vi.fn()}
      onSubmit={props.onSubmit ?? vi.fn()}
      onCancel={props.onCancel ?? vi.fn()}
    />
  );
}

describe("TaskForm テンプレート開閉", () => {
  it("初期状態ではテンプレート一覧は表示されない", () => {
    renderForm();
    // 年齢グループタブが見えていない（=テンプレート一覧が閉じている）
    expect(screen.queryByText("小学低・中学年")).toBeNull();
  });

  it("テンプレートトグルボタンを押すと一覧が表示される", () => {
    renderForm();
    const toggle = screen.getByRole("button", { name: /テンプレートから選ぶ/i });
    fireEvent.click(toggle);
    // 年齢グループラベルが現れる
    expect(screen.getByText("小学低・中学年")).toBeTruthy();
  });

  it("一覧表示中にもう一度トグルを押すと閉じる", () => {
    renderForm();
    const toggle = screen.getByRole("button", { name: /テンプレートから選ぶ/i });
    fireEvent.click(toggle);
    expect(screen.getByText("小学低・中学年")).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByText("小学低・中学年")).toBeNull();
  });

  it("テンプレートを選択するとフォームのタイトルとカテゴリが更新される", () => {
    let current = makeForm();
    const onFormChange = vi.fn((updater: (f: FormData) => FormData) => {
      current = updater(current);
    });
    renderForm({ onFormChange });

    fireEvent.click(screen.getByRole("button", { name: /テンプレートから選ぶ/i }));

    // 最初のテンプレートをクリック（onFormChangeが呼ばれることを確認）
    const buttons = screen.getAllByRole("button");
    const tplBtn = buttons.find((b) => /^[📚💪🌱]/u.test(b.textContent ?? ""));
    expect(tplBtn).toBeTruthy();
    fireEvent.click(tplBtn!);
    expect(onFormChange).toHaveBeenCalled();
    expect(current.title.length).toBeGreaterThan(0);
  });

  it("編集モードではテンプレートトグルボタンは表示されない", () => {
    renderForm({ editingId: "task-1", form: { title: "既存タスク" } });
    expect(screen.queryByRole("button", { name: /テンプレートから選ぶ/i })).toBeNull();
  });
});

describe("TaskForm carryOver トグルの表示", () => {
  it("通常モードでは carryOver トグルが表示される", () => {
    renderForm({ formMode: "regular" });
    expect(screen.getByText(/未完了を翌日に持ち越す/)).toBeTruthy();
  });

  it("一時タスクモードでも carryOver トグルが表示される", () => {
    renderForm({ formMode: "temporary" });
    expect(screen.getByText(/未完了を翌日に持ち越す/)).toBeTruthy();
  });

  it("一時タスクモードで carryOver トグルを押すと onFormChange が呼ばれ、値が反転する", () => {
    let current = makeForm({ carryOver: false });
    const onFormChange = vi.fn((updater: (f: FormData) => FormData) => {
      current = updater(current);
    });
    renderForm({ formMode: "temporary", form: { carryOver: false }, onFormChange });
    // トグル説明文の親ラッパー内のボタンを取得（ラベルの近傍にあるボタン）
    const label = screen.getByText(/未完了を翌日に持ち越す/);
    const toggleBtn = label.parentElement?.parentElement?.querySelector("button");
    expect(toggleBtn).toBeTruthy();
    fireEvent.click(toggleBtn!);
    expect(onFormChange).toHaveBeenCalled();
    expect(current.carryOver).toBe(true);
  });
});
