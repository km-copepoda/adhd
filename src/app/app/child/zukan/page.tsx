"use client";

// 図鑑ページ本体は `src/components/child/ZukanContent.tsx` に移動。
// `/app/child/collection` のタブからも同じ内容を表示するため共有化している。
// このルート（旧パス）は通知リンクや既存ブックマーク救済のため残置。

import ZukanContent from "@/components/child/ZukanContent";

export default function ZukanPage() {
  return <ZukanContent />;
}
