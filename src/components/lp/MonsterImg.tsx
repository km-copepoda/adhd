"use client";

import { useState } from "react";

export function MonsterImg({
  src,
  alt,
  fallback,
  style,
}: {
  src: string;
  alt: string;
  fallback: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span style={{ fontSize: "28px", ...style }}>{fallback}</span>
    );
  }
  return (
    // next/image はビルド時に固定 width/height を要求する最適化前提のコンポーネントで、
    // 画像読み込み失敗時に onError でフォールバック絵文字へ差し替えるこのユースケースとは相性が悪いため、
    // 意図的に生の <img> を使用する。
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
