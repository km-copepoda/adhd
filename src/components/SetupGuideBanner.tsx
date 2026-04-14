"use client";

import Link from "next/link";
import { getSetupGuideSteps, isSetupComplete } from "@/lib/setup-guide";
import type { SetupProgress } from "@/lib/setup-guide";

type Props = {
  progress: SetupProgress;
};

export default function SetupGuideBanner({ progress }: Props) {
  if (isSetupComplete(progress)) return null;

  const steps = getSetupGuideSteps();

  return (
    <div className="mb-6 bg-quest-card border border-quest-gold/30 rounded-xl p-5">
      <div className="mb-3">
        <h2 className="text-quest-gold font-bold text-base">🎉 ようこそ！セットアップを完了しよう</h2>
        <p className="text-quest-dim text-xs mt-0.5">すべて完了すると自動で消えます</p>
      </div>
      <ol className="space-y-3">
        {steps.map((s) => {
          const done = progress[s.progressKey];
          return (
            <li key={s.step} className="flex gap-3 items-start">
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center transition-colors ${
                  done
                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                    : "bg-quest-gold/20 border-quest-gold/40 text-quest-gold"
                }`}
              >
                {done ? "✓" : s.step}
              </span>
              <div className="flex-1">
                {done ? (
                  <p className={`text-sm font-medium line-through text-quest-dim`}>{s.title}</p>
                ) : (
                  <Link href={s.href} className="text-quest-gold text-sm font-medium hover:underline">
                    {s.title} →
                  </Link>
                )}
                <p className="text-quest-dim text-xs mt-0.5">{s.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
