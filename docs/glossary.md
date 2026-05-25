# Glossary — プロジェクト用語辞典

用語の揺れや混同を防ぐための辞書。`docs/decisions.md` / `prisma/schema.prisma` / `CLAUDE.md` を一次ソースとする。

---

## 1. ドメイン用語

| 用語 | 定義 |
|------|------|
| **Family** | 親＋子をまとめる単位。招待コード（`code`）で子供が参加する |
| **Role** | `PARENT` / `CHILD`（`enum Role`） |
| **TaskTemplate** | タスクの「設定」。繰り返し曜日・カテゴリ・写真ボーナス等を持つ |
| **QuestInstance** | 実際にその日発生した「実行単位」。テンプレートから日ごとに生成される |
| **カテゴリ** | `STUDY`（勉強）/ `STAMINA`（運動）/ `LIFE`（生活）（`enum Category`） |
| **Side** | モンスターの属性。`DARK`（かっこいい）/ `LIGHT`（かわいい）（旧表記：ダーク/ライト） |
| **監督者** | 親。子供のタスク承認・却下・スキップ承認の権限を持つ |

---

## 2. クエストのステータスと遷移

`enum QuestStatus`:

```
PENDING ──子供が報告──▶ REPORTED ──親が承認──▶ APPROVED
   │                        │
   │                        └──親が却下──▶ REJECTED ──子供が再報告──▶ REPORTED
   │
   └──子供がスキップ申請──▶ SKIP_REPORTED ──親が承認──▶ SKIPPED
                                 │
                                 └──親が却下──▶ PENDING
```

- `PENDING → SKIPPED` の直接遷移は**無い**（必ずスキップ申請を経由）
- 承認後は自動でXP付与・ストリーク更新・バッジチェック（`src/lib/approve.ts`）
- `autoApproveTime`（JST 0:00 既定）に到達した前日以前の `REPORTED` / `SKIP_REPORTED` は cron で自動承認される

---

## 3. 混同しやすいペア（今回の混乱ポイント含む）

### 3.1 スキップ vs 持ち越し（carryOver）

| | **スキップ（SKIPPED）** | **持ち越し（carryOver）** |
|---|---|---|
| 意味 | 子供が「今日はやらない」と**意思表示** | 子供が**忘れて放置**した未完了タスクを翌日以降も表示 |
| ステータス | `SKIP_REPORTED → SKIPPED` | `PENDING` のまま |
| トリガー | 子供のスキップ申請 | `TaskTemplate.carryOver = true` のまま日付を越える |
| XP | 付与なし | 翌日に完了すれば通常どおり付与 |
| ストリーク | **算入される**（親が承認した意思表示） | 切れる（未完了の事実は変わらない） |
| 親画面バッジ | `⏭ 昨日スキップ`（`lastSkippedDate`） | `🔁 N回未完了`（`carryOverMissedCount` = 最古PENDING〜今日の repeatDays 出現回数） |

### 3.2 TaskTemplate vs QuestInstance

| | TaskTemplate | QuestInstance |
|---|---|---|
| 役割 | タスクの**設計図** | 特定日の**実行単位** |
| 作成 | 親or子が定義 | `quests/today` アクセス時 or `ensureTodayQuests` で日次生成 |
| 寿命 | `isActive` フラグで論理削除 | 日ごとに作られる |
| タイトル保持 | `title` | `snapshotTitle`（変更耐性のためコピー保持）|

### 3.3 completedToday / lastSkippedDate / carryOverMissedCount

`/api/tasks` GET の親向け3フィールド。

| フィールド | true/値になる条件 |
|---|---|
| `completedToday: boolean` | 今日の QuestInstance が `APPROVED` または `SKIPPED` |
| `lastSkippedDate: Date\|null` | 過去7日間で最も新しい `SKIPPED` QuestInstance の日付 |
| `carryOverMissedCount: number\|null` | `carryOver=true` タスクで、今日より過去に残っている最古 `PENDING` の日付から今日までの inclusive 範囲で `repeatDays` に当たる日数（= 放置された出現回数）。stale PENDING なし or `repeatDays` 該当なしなら null |

### 3.4 isTemporary vs 通常タスク

| | 通常タスク | 一時タスク（`isTemporary=true`）|
|---|---|---|
| 繰り返し | `repeatDays` の曜日に毎回生成 | `targetDate` 指定の1日限り |
| carryOver 対応 | 可 | 不可（翌日消える） |
| 子供作成 | `requestedDate` を記録し申請当日のみ表示（親承認後は通常扱いに） | 親承認なしでその日実行 |

### 3.5 isActive vs 削除

`isActive=false` は**論理削除**。レコードは残り、履歴やXPの整合性を保つ。物理削除は通常行わない。

---

## 4. 成長・ゲーム要素

### 4.1 XP / ポイント
- カテゴリ別に `studyPt` / `staminaPt` / `lifePt` を保持
- 1タスク承認で基本 +1pt、`期限内報告` +1pt、`photoBonus=true` かつ写真添付で +1pt（最大3pt）
- 計算は必ず `src/lib/xp.ts` の `calculateQuestXP()` を使う
- 承認の取り消し・差し戻し時はXPを回収（`APPROVED` のみ対象、`REPORTED` は未付与）

### 4.2 ストリーク
- **TaskStreak**: タスク単位のストリーク（`currentStreak` / `bestStreak`）
- **Streak**: 子供単位のストリーク（日全体）。`minTasksForStreak` 本以上達成で連続日カウント
- **ログインストリーク**: 連続ログイン日（`loginCurrentStreak` / `loginBestStreak`）
- `APPROVED + SKIPPED` の両方がストリーク算入対象（親承認スキップも「向き合った」扱い）

### 4.3 進化 / モンスター
- `evolutionStage`: 0（卵）→ 1 → 2 → 3（最終形態）
- `evolutionPath`: "STUDY" / "STAMINA" / "LIFE" の主パス
- 進化判定は必ず `src/lib/approve.ts` の `approveQuestInstance` を正規パターンとし、`rebirthPending` チェックと `isReborn` / `rebirthEggBonus` 引き渡しを忘れない（詳細は `CLAUDE.md` の進化処理規約）
- ステージ3到達でモンスター図鑑（`collectedPaths`）に追加

### 4.4 転生（Rebirth）
- `REBIRTH_THRESHOLD` に到達すると `rebirthPending=true`（ステージはまだリセットされない）
- ユーザ操作で卵を選択 → ボーナス適用して再スタート
- 既存の `collectedPaths` は保持（図鑑はリセットされない）

### 4.5 バッジ
- 実績。`UserBadge` で付与状況を保持
- 定義は `src/lib/badges.data.ts`、条件判定は `src/lib/badges.ts`

---

## 5. 技術ルール（ハマりやすい規約）

### 5.1 日付・タイムゾーン
- すべて **JST 基準**で扱う（`src/lib/date.ts` の `todayJST()` / `dayOfWeekJST()`）
- DB の `@db.Date` 型は「JST 日付を UTC 0:00 として保存」する規約
- 曜日取得は必ず `.getUTCDay()`（`.getDay()` はサーバ TZ 依存）
- `Date.UTC()` で構築した Date の操作は `getUTC*` 系で統一

### 5.2 Next.js 16 ミドルウェア
- エントリは `src/middleware.ts` ではなく **`src/proxy.ts`**
- エクスポート関数名は **`proxy`**（`middleware` だと Turbopack エラー）

### 5.3 ルーティング
| 役割 | ログイン | ホーム |
|------|---------|--------|
| 親   | `/app/parent/login` | `/app/parent/tasks` |
| 子   | `/app/child/login`  | `/app/child/quests` |

- 旧パス（`/parent/*`, `/child/*`, `/register`）は廃止済み

### 5.4 認証
- `getCurrentUser()` — ロール不問。null 返し
- `requireUser("PARENT"|"CHILD"?)` — 未認証/ロール不一致で `AuthError` を throw

### 5.5 モジュール分割
- `src/lib/` は 1ファイル1責務
- データ定義 / ビジネスロジック（純粋関数）/ DB操作 / インフラ / UIユーティリティ を混在させない
- バレルファイル（re-export だけ）は作らない

### 5.6 共有ロジックの集約先
| 領域 | 正規関数 |
|---|---|
| クエスト承認 | `src/lib/approve.ts` の `approveQuestInstance` / `approveSkipQuestInstance` |
| 今日のクエスト生成 | `src/lib/quests.ts` の `ensureTodayQuests` |
| XP 計算 | `src/lib/xp.ts` の `calculateQuestXP` |
| 進化判定 | `src/lib/evolution.ts` の `checkEvolution` |

---

## 6. 参照

- 方針の決定経緯: `docs/decisions.md`
- 運用ルール: `adhd/CLAUDE.md`
- スキーマ: `prisma/schema.prisma`
