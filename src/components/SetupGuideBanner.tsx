"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSetupGuideSteps, shouldShowSetupGuide, SETUP_GUIDE_STORAGE_KEY } from "@/lib/setup-guide";

export default function SetupGuideBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SETUP_GUIDE_STORAGE_KEY) === "true";
    if (shouldShowSetupGuide(seen)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(SETUP_GUIDE_STORAGE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  const steps = getSetupGuideSteps();

  return (
    <div className="mb-6 bg-quest-card border border-quest-gold/30 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-quest-gold font-bold text-base">🎉 ようこそ！まずはこの3ステップで始めよう</h2>
          <p className="text-quest-dim text-xs mt-0.5">初回セットアップガイド</p>
        </div>
        <button
          onClick={dismiss}
          className="text-quest-dim hover:text-quest-text text-lg leading-none ml-4 flex-shrink-0"
          aria-label="ガイドを閉じる"
        >
          ✕
        </button>
      </div>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.step} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-quest-gold/20 border border-quest-gold/40 text-quest-gold text-xs font-bold flex items-center justify-center">
              {s.step}
            </span>
            <div className="flex-1">
              <Link
                href={s.href}
                className="text-quest-gold text-sm font-medium hover:underline"
              >
                {s.title} →
              </Link>
              <p className="text-quest-dim text-xs mt-0.5">{s.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        onClick={dismiss}
        className="mt-4 w-full text-xs text-quest-dim hover:text-quest-text border border-quest-border rounded-lg py-2 hover:border-quest-gold/20 transition-colors"
      >
        わかった！閉じる
      </button>
    </div>
  );
}
