# QuestBoard
## ADHD タスク管理アプリ 企画設計書 v7
> v6からの主な変更：認証方式確定・進化システム改修（ステージ制+リセット）・XP値変更・実装状況の整理

---

## 0. v7 確定事項サマリー

| 項目 | v6 | v7（確定） |
|------|----|-----------|
| 認証方式 | 家族コード入力 → サイド選択 | **家族コード＋ユーザーコード（4桁）のID/PW方式** |
| 子どものアカウント作成 | 子どもが自分で作成 | **親側で作成（子どもはログインのみ）** |
| 進化システム | レベル制（ポイント蓄積・Lv1/3/7/15で進化） | **ステージ制（進化時ポイントリセット）** |
| XP値 | 未確定（実装は EASY=20, NORMAL=40, HARD=80） | **EASY=10, NORMAL=15, HARD=20** |
| モンスター名 | モンスターの名前 | **ユーザー名（表示名）として使用** |
| βテスト設計 | 2段階（A→B→C） | **変わらず** |
| モンスター図鑑 | Must | **変わらず（未実装）** |
| 写真添付 | Must | **変わらず（未実装）** |

---

## 1. 認証・アカウント設計（v7確定）

### 親の認証
| ステップ | 内容 |
|---------|------|
| Step1 | 親がメール＋パスワードでアカウント作成 |
| Step2 | 家族が自動作成、6桁の家族コードが発行される |
| Step3 | 親がタスク管理画面（/parent/tasks）にリダイレクト |

### 子どもの認証
| ステップ | 内容 |
|---------|------|
| Step1 | 親側で子どものアカウントを作成（名前・サイド設定） |
| Step2 | 4桁のユーザーコードが自動発行される |
| Step3 | 子どもが「家族コード」＋「ユーザーコード」でログイン |
| Step4 | 匿名認証セッションが発行され、子ども画面（/child/quests）にリダイレクト |

### ポイント
- **子どもの画面はログインのみ**（「はじめてのぼうけん」＝新規キャラ作成は削除済み）
- 異なるブラウザ/デバイスからでもコード入力でログイン可能（supabaseIdを更新）
- 家族コード内でユーザーコードはユニーク（`@@unique([familyId, childCode])`）

---

## 2. パラメータシステム（v7確定）

### 3パラメータ

| パラメータ | Emoji | 対応タスク例 |
|------------|-------|-------------|
| 📚 学力 | STUDY | 宿題・読書・勉強・塾など |
| 💪 体力 | STAMINA | 運動・お風呂・早寝・部活など |
| 🌿 生活力 | LIFE | 片付け・お手伝い・食事・早起きなど |

### XP値（v7で確定）

| 難易度 | 表示名 | 獲得XP |
|--------|--------|--------|
| EASY | かんたん | **10 pt** |
| NORMAL | ふつう | **15 pt** |
| HARD | むずかしい | **20 pt** |

---

## 3. 進化システム（v7改修）

### v6→v7の変更点
| 項目 | v6 | v7 |
|------|----|----|
| レベル計算 | 合計pt ÷ 10 = レベル | **廃止（ステージ制に変更）** |
| 進化閾値 | Lv1(10pt), Lv3(30pt), Lv7(70pt), Lv15(150pt) | **ステージ0→1: 10pt, 1→2: 30pt, 2→3: 70pt** |
| ポイント | 蓄積し続ける | **進化時に全パラメータを0にリセット** |
| 進化段階の管理 | レベルから算出 | **DBに `evolutionStage` を保存** |
| 最終進化(150pt) | あり | **なし（ステージ3が最終形態）** |

### 進化テーブル

| ステージ | ダークサイド🌑 | ライトサイド🌸 | 次の進化に必要なpt |
|---------|---------------|---------------|------------------|
| 0（初期） | 👾 シャドウ | 🐣 ヒヨコ | **10 pt** |
| 1 | 🧿 スペクター | 🦊 キツネ | **30 pt** |
| 2 | 😈 デーモン | 🦄 ユニコーン | **70 pt** |
| 3（最終） | 👑 真・魔王 | 🌟 スタースピリット | — |

### 進化の仕組み
1. クエストが承認されると、対応カテゴリのパラメータにXPが加算される
2. 3パラメータの合計が現在のステージの閾値に達したかチェック
3. **閾値到達 → 進化！**
   - `evolutionStage` が +1
   - `studyPt`, `staminaPt`, `lifePt` がすべて **0にリセット**
4. リセット後、次のステージの閾値に向けて再びポイントを貯める

### 子ども画面での表示
- XPバー: 現在の合計pt / 進化に必要なpt（例: "15 / 30 pt 進化まで"）
- 最終形態の場合: 「最終形態」と表示、XPバーは非表示
- 次の進化先のEmoji・名前を表示

### v5/v6仕様との差異メモ
- v5/v6の「Lv15 最終進化 合計150pt」は省略。ステージ3（最終形態）に到達すれば完了
- v5/v6の「パラメータ割合による進化先分岐」は未実装（将来課題）
- v5/v6の「たまご（🥚）」ステージは省略。初期状態から既にモンスターが表示される

---

## 4. タスク設計（v6から変更なし）

### MVPで扱うタスクの種類
**定期タスクのみ。スポットタスクはフェーズ2。**

| 種類 | 作成者 | 承認フロー | 用途 |
|------|--------|-----------|------|
| 定期タスク | 親 | 完了申告→親が承認 | 毎日の習慣 |

### 権限の分担

| 権限 | 子ども | 親 |
|------|--------|-----|
| タスク内容 | 閲覧のみ | 作成・編集・削除 |
| カテゴリ | 閲覧のみ | 学力・体力・生活力を設定 |
| 難易度 | 閲覧のみ | かんたん・ふつう・むずかしいを設定 |
| 完了申告 | 申告できる | — |
| 承認 | — | 承認・差し戻し |

---

## 5. 現在の実装状況

### 実装済み（Phase A相当）

| 機能 | 画面/API | 状態 |
|------|---------|------|
| 親アカウント作成 | /register, /api/auth/register | 完了 |
| 親ログイン | /login, /api/auth/login | 完了 |
| 子どもログイン（コード認証） | /child/onboarding, /api/auth/child-rejoin | 完了 |
| 家族管理（コード表示・メンバー一覧） | /parent/family, /api/family/code | 完了 |
| タスク作成・編集・削除 | /parent/tasks, /api/tasks | 完了 |
| 今日のクエスト一覧 | /child/quests, /api/quests/today | 完了 |
| クエスト完了申告 | /api/quests/[id]/report | 完了 |
| 承認・差し戻し | /parent/approve, /api/approve/[id] | 完了 |
| モンスター表示（進化ゲージ付き） | /child/monster, /api/monster | 完了 |
| ルート保護（ミドルウェア） | middleware.ts | 完了 |
| ログアウト（親・子ども） | Sidebar / BottomNav | 完了 |

### 未実装（v5/v6にあるがMVPで未着手）

| 機能 | v5/v6での優先度 | 備考 |
|------|---------------|------|
| モンスター図鑑 | Must (v6) | 進化履歴・写真記録の閲覧画面 |
| 写真添付 | Must (v6) | タスクごとの写真必須設定＋撮影UI |
| ストリーク | Must (v5) | 連続日数カウント・称号・ボーナスpt |
| リアルタイム反映 | Must (v5) | Supabase Realtime（承認→即画面反映） |
| 自動承認 | Must (v5) | 締め切り2時間後に自動承認 |
| メール通知 | Should | 承認忘れ防止 |
| パラメータ割合による進化分岐 | Should | 学力系/体力系/生活力系の分岐 |
| まとめて全承認 | Must (v5) | 親の承認負荷軽減 |
| 仮反映（即時フィードバック） | Must (v5) | 完了申告時点でパラメータ仮反映 |
| カレンダー達成記録 | フェーズ2 | 1ヶ月以上データ蓄積後 |

---

## 6. DBスキーマ（v7現在）

```prisma
model Family {
  id        String         @id @default(cuid())
  code      String         @unique        // 6桁家族コード
  users     User[]
  tasks     TaskTemplate[]
}

model User {
  id             String          @id @default(cuid())
  supabaseId     String          @unique
  role           Role            // PARENT | CHILD
  name           String?         // 親の名前
  side           Side?           // DARK | LIGHT
  monsterName    String?         // ユーザー名（表示名）
  childCode      String?         // 4桁ユーザーコード
  evolutionStage Int             @default(0)  // 進化段階 0-3
  studyPt        Int             @default(0)  // 進化ごとにリセット
  staminaPt      Int             @default(0)  // 進化ごとにリセット
  lifePt         Int             @default(0)  // 進化ごとにリセット
  familyId       String?
  family         Family?         @relation(...)
  quests         QuestInstance[]
  @@unique([familyId, childCode])
}

model TaskTemplate {
  id         String          @id @default(cuid())
  title      String
  emoji      String          @default("⚔️")
  category   Category        // STUDY | STAMINA | LIFE
  difficulty Difficulty      // EASY | NORMAL | HARD
  repeatDays Int[]           // 曜日（0=日〜6=土）
  isActive   Boolean         @default(true)
  familyId   String
  family     Family          @relation(...)
  quests     QuestInstance[]
}

model QuestInstance {
  id         String       @id @default(cuid())
  date       DateTime     @db.Date
  status     QuestStatus  // PENDING | REPORTED | APPROVED | REJECTED
  comment    String?
  templateId String
  template   TaskTemplate @relation(...)
  childId    String
  child      User         @relation(...)
  reportedAt DateTime?
  approvedAt DateTime?
  @@unique([templateId, childId, date])
}
```

---

## 7. 技術スタック（v7現在）

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router, Turbopack) | 16.1.6 |
| 言語 | TypeScript | 5.x |
| CSS | Tailwind CSS | v4 |
| DB/認証 | Supabase (Docker ローカル開発) | — |
| ORM | Prisma (PrismaPg adapter) | v7.4.2 |
| DB | PostgreSQL | — |

### 注意事項
- **Prismaスキーマ変更後**は `prisma generate` + `.next` キャッシュ削除 + devサーバー再起動が必須（Turbopackがキャッシュする）
- 親認証: Supabase Auth（メール+パスワード）
- 子ども認証: Supabase Auth（匿名認証）+ コードベース認証

---

## 8. βテスト設計（v6から変更なし）

### フェーズA：〜2週間「そもそも毎日開くか」

| 計測指標 | 目標値 |
|---------|--------|
| DAU（毎日起動） | 5家族中4家族 |
| タスク完了申告率 | 50%以上 |
| モンスター図鑑の閲覧回数 | 1日1回以上 |

### フェーズB：〜1ヶ月「親の承認フローが機能するか」

| 計測指標 | 目標値 |
|---------|--------|
| 親の手動承認率 | 70%以上 |
| 子どもの承認待ちによる離脱 | 観察 |
| 承認後の子どもの反応 | 定性ヒアリング |

### フェーズC：1ヶ月以降「ズル防止が機能するか」
- 写真なし承認の頻度
- タスク内容の妥当性
- 子どもの「やってないのにやった」申告

---

## 9. 次の開発優先度（v7時点）

### 高優先（βテスト開始に必要）
1. **親側での子どもアカウント作成UI** — 現在APIはあるがUIがない
2. **ストリーク** — 継続のモチベーション設計の核
3. **リアルタイム反映** — 承認→即反映はv5で「絶対に削ってはいけない」と明記

### 中優先（フェーズA中に追加）
4. モンスター図鑑（進化履歴閲覧）
5. まとめて全承認
6. 自動承認（締め切り2時間後）

### 低優先（フェーズB以降）
7. 写真添付
8. メール通知
9. パラメータ割合による進化分岐
10. カレンダー達成記録

---

*v7 --- 実装状況反映版。v6からの設計変更を確定し、現在のコードベースと一致させた。*
