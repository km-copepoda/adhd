type RubyTextProps = {
  text: string;
  kana: string;
  enabled: boolean;
  className?: string;
};

/**
 * 通常表記（`text`）とひらがな・カタカナのみの読み下し表記（`kana`）を、
 * `enabled` に応じてまるごと差し替えて表示する共有コンポーネント。
 *
 * インラインルビ（`<ruby><rt>`）ではなく表記全体の差し替え方式を採る。
 */
export default function RubyText({ text, kana, enabled, className }: RubyTextProps) {
  return <span className={className}>{enabled ? kana : text}</span>;
}
