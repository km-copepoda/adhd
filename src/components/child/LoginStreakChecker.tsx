"use client";

import { useEffect } from "react";

/** マウント時に1回だけログインストリークを記録するサイレントコンポーネント */
export default function LoginStreakChecker() {
  useEffect(() => {
    fetch("/api/streak/login-check", { method: "POST" }).catch(() => {
      // 失敗してもUXに影響させない
    });
  }, []);

  return null;
}
