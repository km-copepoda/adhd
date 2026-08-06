"use client";

import { useEffect, useRef } from "react";
import styles from "./lp.module.css";
import { HeroSection } from "@/components/lp/HeroSection";
import { PainSection } from "@/components/lp/PainSection";
import { HowItWorksSection } from "@/components/lp/HowItWorksSection";
import { FeaturesSection } from "@/components/lp/FeaturesSection";
import { MonstersSection } from "@/components/lp/MonstersSection";
import { HirobaSection } from "@/components/lp/HirobaSection";
import { TreasureSection } from "@/components/lp/TreasureSection";
import { HabitSection } from "@/components/lp/HabitSection";
import { PsychologySection } from "@/components/lp/PsychologySection";
import { BeforeAfterSection } from "@/components/lp/BeforeAfterSection";
import { ScreensSection } from "@/components/lp/ScreensSection";
import { InstallGuideSection } from "@/components/lp/InstallGuideSection";
import { VoicesSection } from "@/components/lp/VoicesSection";
import { FaqSection } from "@/components/lp/FaqSection";
import { CtaSection } from "@/components/lp/CtaSection";

export default function LpPage() {
  const lpRef = useRef<HTMLDivElement>(null);

  // Scroll fade-in via IntersectionObserver
  useEffect(() => {
    const root = lpRef.current;
    if (!root) return;
    const elements = root.querySelectorAll(`.${styles.fadeIn}`);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
          }
        });
      },
      { threshold: 0.1 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.lpRoot} ref={lpRef}>
      {/* ===== NAV ===== */}
      <nav className={styles.nav}>
        <a href="#" className={styles.navLogo}>QuestBoard</a>
        <ul className={styles.navLinks}>
          <li><a href="#pain">こんな悩み</a></li>
          <li><a href="#features">機能</a></li>
          <li><a href="#treasure">宝箱</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><a href="#install">インストール</a></li>
          <li>
            <a href="#cta" className={`${styles.btnOutline} ${styles.navCta}`}>
              はじめる
            </a>
          </li>
        </ul>
      </nav>

      <HeroSection s={styles} />
      <PainSection s={styles} />
      <HowItWorksSection s={styles} />
      <FeaturesSection s={styles} />
      <TreasureSection s={styles} />
      <MonstersSection s={styles} />
      <HirobaSection s={styles} />
      <HabitSection s={styles} />
      <PsychologySection s={styles} />
      <BeforeAfterSection s={styles} />
      <ScreensSection s={styles} />
      <InstallGuideSection s={styles} />
      <VoicesSection s={styles} />
      <FaqSection s={styles} />
      <CtaSection s={styles} />

      {/* ===== FOOTER ===== */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>QuestBoard</div>
        <p>© 2026 QuestBoard. All rights reserved.</p>
        <p style={{ marginTop: 8 }}>クエストをクリアして、モンスターを育てよう</p>
      </footer>
    </div>
  );
}
