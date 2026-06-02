"use client";

import { useEffect, useState } from "react";
import { ShareIcon } from "./ShareIcon";

export function InstallGuideSection({ s }: { s: Record<string, string> }) {
  const [deferredPrompt, setDeferredPrompt] = useState<
    (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null
  >(null);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios =
      /iPhone|iPod/.test(ua) ||
      /iPad/.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua);
    setIsIos(ios);
    setIsAndroid(android);

    // すでにインストールされているか判定
    const standalone =
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

     // Android / Chrome のbeforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as typeof deferredPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  //インストール済みなら非表示
  if (isStandalone) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  return (
    <section id="install" className={`${s.section} ${s.installSection}`}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>INSTALL</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>
          ホーム画面に追加して、アプリとして使おう
        </p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={`${s.installCards} ${s.fadeIn}`}>
          {/* ---- iOS / iPad カード ---- */}
          <div className={`${s.installCard} ${isIos ? s.installCardHighlight : ""}`} >
            <div className={s.installCardIcon}>🍎</div>
            <div className={s.installCardTitle}>iPhone / iPad</div>
            <div className={s.installSteps}>
              <div className={s.installStep}>
                <span className={s.installStepNum}>1</span>
                <span>
                  <strong>Safari</strong> でこのページを開く
                </span>
              </div>
              <div className={s.installStep}>
                <span className={s.installStepNum}>2</span>
                <span>
                  画面下の{" "}
                  <span className={s.installShareIcon}>
                    <ShareIcon />
                  </span>{" "}
                  共有ボタンをタップ
                </span>
              </div>
              <div className={s.installStep}>
                <span className={s.installStepNum}>3</span>
                <span>
                  「<span className={s.installHighlightText}>ホーム画面に追加</span>」を選択
                </span>
              </div>
            </div>
            {isIos && (
              <div className={s.installHint} style={{ marginTop: 8, fontSize: 11 }}>
                ※「ホーム画面に追加」が見つからない場合は「もっと見る」をタップしてください
              </div>
            )}
          </div>

          {/* ---- Android カード ---- */}
          <div className={`${s.installCard} ${isAndroid ? s.installCardHighlight : ""}`} >
            <div className={s.installCardIcon}>🤖</div>
            <div className={s.installCardTitle}>Android</div>
            {deferredPrompt ? (
              <>
                <div className={s.installSteps}>
                  <div className={s.installStep}>
                    <span className={s.installStepNum}>✓</span>
                    <span>ワンタップでインストールできます</span>
                  </div>
                </div>
                <div className={s.installBtnWrap}>
                  <button
                    type="button"
                    className={s.installBtn}
                    onClick={handleInstallClick}
                  >
                    📲 今すぐインストール
                  </button>
                </div>
              </>
            ) : (
              <div className={s.installSteps}>
                <div className={s.installStep}>
                  <span className={s.installStepNum}>1</span>
                  <span>
                    <strong>Chrome</strong> でこのページを開く
                  </span>
                </div>
                <div className={s.installStep}>
                  <span className={s.installStepNum}>2</span>
                  <span>
                    右上の <strong>︙</strong> メニューをタップ
                  </span>
                </div>
                <div className={s.installStep}>
                  <span className={s.installStepNum}>3</span>
                  <span>
                    「<span className={s.installHighlightText}>ホーム画面に追加</span>」
                    または
                    「<span className={s.installHighlightText}>アプリをインストール</span>」
                    を選択
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className={`${s.installHint} ${s.fadeIn}`}>
          QuestBoard は PWA （Progressive Web App） です。<br />
          ストアからのダウンロードは不要。ブラウザからそのままインストールできます。
        </p>
      </div>
    </section>
  );
}
