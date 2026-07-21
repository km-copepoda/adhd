# 未実装仕様書

**このディレクトリの仕様はまだ実装されていない（または一部のみ実装）**。コードと突き合わせて検証済み（最終検証: 2026-07-05）。

| ファイル | 状態 | 内容 |
|---------|------|------|
| [analytics-setup.md](analytics-setup.md) | 完全未実装 | Vercel Analytics 導入（`@vercel/analytics` 未インストール） |
| [weekly-report-email.md](weekly-report-email.md) | 完全未実装 | 週次レポートメール（Resend + React Email、月曜7時 Cron） |
| [badge-redesign.md](badge-redesign.md) | **部分実装** | バッジ100個の再設計。新規10個が未実装、削除予定9個が残存。詳細はファイル冒頭の「実装状況」を参照 |
| [refactoring-plan.md](refactoring-plan.md) | 未着手 | コード＋DBスキーマのリファクタリング計画（Phase 1〜5、expand-contract 方式のスキーマ移行含む） |
| [monthly-limited-collection-items.md](monthly-limited-collection-items.md) | 完全未実装 | 月限定コレクションアイテム60種（各月5個）。抽選プール・UI・バッジ判定への影響を含む設計 |

## 運用ルール

- 実装が完了したら、内容を `docs/実装済み仕様書/` の該当機能ファイルに反映し、このディレクトリからは `docs/資料系/開発ログ/` へ移動する
- 廃案になった仕様も `docs/資料系/開発ログ/` へ移動する

## アーカイブ済み（実装完了・廃案）

以下は `docs/資料系/開発ログ/` に移動済み:

- `checkin-calendar.md` → 実装完了（現仕様: `docs/実装済み仕様書/13_チェックイン.md`。月間カレンダー→直近7日ストリップに変更）
- `treasure-collection-items.md` → 実装完了（現仕様: `docs/実装済み仕様書/07_宝箱・コレクション.md`、マスターデータ: `src/lib/collectionItems.ts`）
- `reword-system-design.md` / `reward-system-design.md` → 実装完了（現仕様: `docs/実装済み仕様書/07_宝箱・コレクション.md`。reword が新版、reward は旧版）
- `badge-deprecation.md` → 廃案（badge-redesign 案が採用された）
