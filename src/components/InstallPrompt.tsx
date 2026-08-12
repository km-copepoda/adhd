'use client';
import { useEffect, useState } from 'react';

// beforeinstallprompt は lib.dom に型定義が存在しないブラウザ独自イベント
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt) return null;

  return (
    <button
      onClick={async () => {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') setPrompt(null);
      }}
      className="text-center text-quest-dim text-sm border border-quest-border rounded-xl py-3 hover:border-quest-gold/30 transition-colors"
    >
      📲 ホーム画面に追加する
    </button>
  );
}
