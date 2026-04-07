"use client";

import { useEffect, useState } from "react";
import { shouldShowInstallPrompt, dismissInstallPrompt } from "@/lib/ios-install";

export default function IOSInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(shouldShowInstallPrompt());
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    dismissInstallPrompt();
    setShow(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        borderTop: "1px solid rgba(139, 92, 246, 0.4)",
        padding: "16px",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* アプリアイコン */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt="QuestBoard"
          style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <p style={{ color: "#e2e8f0", fontWeight: "bold", fontSize: 14, margin: 0, marginBottom: 4 }}>
            ホーム画面に追加してアプリとして使えます
          </p>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            下のバーの{" "}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#7dd3fc" }}>
              <ShareIcon />
              {" "}共有ボタン
            </span>
            {" "}をタップして「<strong style={{ color: "#c4b5fd" }}>ホーム画面に追加</strong>」を選択
          </p>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
          }}
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
