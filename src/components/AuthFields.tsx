"use client";

import { useId, useState } from "react";

const INPUT_CLASS =
  "w-full bg-quest-card border border-quest-border rounded-xl px-4 py-3 text-sm text-quest-text placeholder:text-quest-dim focus:outline-none focus:border-quest-gold/50";

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minLength?: number;
};

/** ラベル(sr-only)付きメールアドレス入力 */
export function EmailField({ label, value, onChange, placeholder }: Omit<FieldProps, "minLength">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className={INPUT_CLASS}
      />
    </div>
  );
}

/** ラベル(sr-only)付きパスワード入力 + 表示/非表示トグル */
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  minLength,
  autoComplete = "current-password",
}: FieldProps & { autoComplete?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          minLength={minLength}
          className={`${INPUT_CLASS} pr-14`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
          className="absolute right-1 top-1/2 -translate-y-1/2 min-h-10 px-3 text-xs text-quest-muted hover:text-quest-gold"
        >
          {visible ? "隠す" : "表示"}
        </button>
      </div>
    </div>
  );
}
