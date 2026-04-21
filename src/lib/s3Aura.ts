export type S3AuraConfig = {
  r: number;
  g: number;
  b: number;
  borderWidth: number;
  borderAlpha: number;
  bgAlpha: number;
  glow: boolean;
  pulse: boolean;
};

// Lv1〜5+ の stage3 カードオーラ設定（0 は未収集 = null）
const AURA_TABLE: (S3AuraConfig | null)[] = [
  null,
  { r: 167, g: 139, b: 250, borderWidth: 2, borderAlpha: 0.5,  bgAlpha: 0.05, glow: false, pulse: false }, // lv1 紫
  { r: 65,  g: 105, b: 225, borderWidth: 2, borderAlpha: 0.55, bgAlpha: 0.06, glow: false, pulse: false }, // lv2 ロイヤルブルー
  { r: 45,  g: 212, b: 191, borderWidth: 2, borderAlpha: 0.55, bgAlpha: 0.06, glow: false, pulse: false }, // lv3 ターコイズ
  { r: 163, g: 230, b: 53,  borderWidth: 2, borderAlpha: 0.55, bgAlpha: 0.06, glow: true,  pulse: false }, // lv4 黄緑
  { r: 251, g: 191, b: 36,  borderWidth: 3, borderAlpha: 0.7,  bgAlpha: 0.1,  glow: true,  pulse: true  }, // lv5+ ゴールド
];

export function getS3Aura(lv: number): S3AuraConfig | null {
  if (lv <= 0) return null;
  return AURA_TABLE[Math.min(lv, 5)];
}
