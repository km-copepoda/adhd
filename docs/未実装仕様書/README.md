# 未実装仕様書

**このディレクトリの仕様はまだ実装されていない（または一部のみ実装）**。最終検証: 2026-08-05。

| ファイル | 状態 | 内容 |
|---------|------|------|
| [analytics-setup.md](analytics-setup.md) | 完全未実装 | Vercel Analytics 導入（`@vercel/analytics` 未インストール） |
| [weekly-report-email.md](weekly-report-email.md) | 完全未実装 | 週次レポートメール（Resend + React Email、月曜7時 Cron） |
| [monetization-plan.md](monetization-plan.md) | 完全未実装 | マネタイズ設計（フリーミアム + 買い切りセット + ストア対応） |
| [monster-theme-sets.md](monster-theme-sets.md) | 完全未実装 | 買い切りモンスターテーマセット11種の全429体の名前・説明 |
| [single-user-app.md](single-user-app.md) | 完全未実装 | シングルユーザーToDoアプリ（別アプリ）。親承認なしの自己管理版 |

## 運用ルール

- 実装が完了したら、内容を `docs/実装済み仕様書/` の該当機能ファイルに反映し、このディレクトリからは `docs/資料系/開発ログ/` へ移動する
- 廃案になった仕様も `docs/資料系/開発ログ/` へ移動する

## アーカイブ済み（実装完了・廃案）

以下は `docs/資料系/開発ログ/` に移動済み:

- `checkin-calendar.md` → 実装完了（現仕様: `docs/実装済み仕様書/13_チェックイン.md`。月間カレンダー→直近7日ストリップに変更）
- `treasure-collection-items.md` → 実装完了（現仕様: `docs/実装済み仕様書/07_宝箱・コレクション.md`、マスターデータ: `src/lib/collectionItems.ts`）
- `reword-system-design.md` / `reward-system-design.md` → 実装完了（現仕様: `docs/実装済み仕様書/07_宝箱・コレクション.md`。reword が新版、reward は旧版）
- `badge-deprecation.md` → 廃案（badge-redesign 案が採用された）
- `monthly-limited-collection-items.md` → 実装完了（マスターデータ: `src/lib/collectionItems.ts` に60種定義済み）
- `design-tone-and-manner.md` → `docs/資料系/` に移動（デザイン参考資料）
- `decisions.md` → `docs/資料系/` に移動（設計判断記録）
