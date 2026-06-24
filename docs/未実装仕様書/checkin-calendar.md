# チェックインカレンダー 仕様書



作成日: 2026-06-23



## 概要



「学校から帰ったらまずアプリを開く」習慣を身につけるための機能。

親が設定した締切時刻までに子供がクエスト画面を開くと、その日のチェックインが成功となる。

月間カレンダーにスタンプが溜まっていく形式で、開いた瞬間にスタンプがポコッと押されるアニメーションで達成感を演出する。



**報酬はなし（表示のみ）。** 子供の反応を見てから報酬の追加を検討する。



---



## 1. 基本フロー



```

親が checkinDeadlineTime を設定（例: "16:00"）

 ↓

子供がクエスト画面を開く（/api/quests/today）

 ↓

 [締切前] → チェックイン成功 → スタンプ押下 → 連続日数+1

 [締切後] → チェックイン失敗 → スタンプなし（連続日数リセット）

 [未設定] → 機能OFF（何も起きない）

```



---



## 2. データモデル



### User テーブル（既存）に追加



| フィールド | 型 | デフォルト | 説明 |

|-----------|-----|----------|------|

| `checkinDeadlineTime` | `String?` | `null` | 締切時刻（例: "16:00"）。null = 機能OFF |



### Streak テーブル（既存）に追加



| フィールド | 型 | デフォルト | 説明 |

|-----------|-----|----------|------|

| `checkinCurrentStreak` | `Int` | `0` | チェックイン連続日数 |

| `checkinBestStreak` | `Int` | `0` | チェックイン最長連続日数 |

| `lastCheckinDate` | `DateTime? @db.Date` | `null` | 最後にチェックイン成功した日付 |



### CheckinLog テーブル（新規）



カレンダー表示のために日ごとの成功/失敗を記録する。



| フィールド | 型 | 説明 |

|-----------|-----|------|

| `id` | `String @id @default(cuid())` | |

| `childId` | `String` | FK → User |

| `date` | `DateTime @db.Date` | 対象日 |

| `success` | `Boolean` | true=締切前に開いた, false=失敗 |

| `checkedInAt` | `DateTime?` | 成功時の実際の時刻 |

| `createdAt` | `DateTime @default(now())` | |



- `@@unique([childId, date])` — 1日1レコード

- `@@index([childId])` — カレンダー取得用



---



## 3. チェックイン判定ロジック



### トリガー



子供がクエスト画面を開いたとき（`/api/quests/today` のレスポンス時）。



### 処理フロー



```ts

// 1. checkinDeadlineTime が未設定なら何もしない

// 2. 当日の CheckinLog が既にあれば何もしない（冪等）

// 3. 現在時刻(JST) < checkinDeadlineTime なら success=true

// 4. 現在時刻(JST) >= checkinDeadlineTime なら success=false

// 5. success=true の場合:

//  - lastCheckinDate が昨日 → checkinCurrentStreak + 1

//  - lastCheckinDate が昨日以外 → checkinCurrentStreak = 1

//  - checkinBestStreak を更新

//  - lastCheckinDate = today

// 6. CheckinLog を INSERT

```



### 失敗の記録タイミング



子供が締切後に画面を開いた場合はその時点で `success=false` を記録する。

**その日一度も開かなかった場合**は CheckinLog が存在しない。カレンダー表示時に「レコードなし = 失敗」として扱う。



### 連続日数のリセット



締切後に開いた場合、または前日に開かなかった場合に `checkinCurrentStreak` がリセットされる。

リセットは次回チェックイン判定時（翌日以降に画面を開いたとき）に行う。cronは不要。



---



## 4. 親の設定



### 設定場所



子供の設定画面（既存の `reportDeadlineTime` や `minTasksForStreak` と同じ場所）。



### UI



```

チェックイン締切時刻

 [16:00 ▼]  ← 時刻ピッカー

 ※ 設定するとチェックインカレンダーが子供画面に表示されます

```



### バリデーション



- 時刻フォーマット: "HH:MM"（00:00〜23:59）

- 空 or null = 機能OFF



---



## 5. 子供画面 — チェックインカレンダー



### 表示場所



クエスト画面（`/app/child/quests`）の上部。`checkinDeadlineTime` が設定されている場合のみ表示。



### カレンダーレイアウト



```

┌─ 6月 チェックイン ──────────────┐

│ 月 火 水 木 金 土 日    │

│             1   │

│ 2  3  4  5  6  7  8   │

│ 🌟 🌟 🌟 😢 🌟 🌟 🌟   │

│ 9 10 11 12 13 14 15   │

│ 🌟 🌟 🌟 🌟 🌟 -- --   │

│ 16 17 18 19 20 21 22   │

│ -- -- -- -- -- -- --   │

│ 23               │

│ 🌟 ← ポコッ！          │

│                 │

│ 🔥 6日連続！          │

└─────────────────────────────────┘

```



### 日付ごとの表示



| 状態 | 表示 | 条件 |

|------|------|------|

| 成功 | 🌟（スタンプ） | CheckinLog: success=true |

| 失敗 | 😢 | CheckinLog: success=false、またはレコードなし かつ 過去日 かつ checkinDeadlineTime 設定済み |

| 今日（未チェックイン・締切前） | ⭐（点滅/光る）| 当日 かつ CheckinLog なし かつ 現在時刻 < 締切 |

| 今日（未チェックイン・締切後） | 😢 | 当日 かつ CheckinLog なし かつ 現在時刻 >= 締切 |

| 未来 | `--` | 明日以降 |

| 機能ON以前 | 空欄 | checkinDeadlineTime 設定日より前 |



### スタンプアニメーション



今日の初回チェックイン成功時のみ、スタンプがポコッと押されるアニメーションを再生する。

レスポンスに `checkinJustNow: true` フラグを含めて、クライアント側で判定。



### 連続日数表示



カレンダー下部に「🔥 N日連続！」を表示。`checkinCurrentStreak` の値を使う。

0日の場合は非表示。



### 土日の扱い



土日もカウントする。学校がない日でも「アプリを開く習慣」として統一。



---



## 6. API 変更



### GET /api/quests/today（既存・変更）



レスポンスに以下を追加:



```json

{

 "checkin": {

  "enabled": true,

  "deadline": "16:00",

  "todayStatus": "success" | "fail" | "pending",

  "justNow": true,

  "currentStreak": 5,

  "bestStreak": 12

 }

}

```



- `enabled: false` の場合は `checkin` フィールド自体を省略してもよい

- `justNow: true` = この API 呼び出しでチェックイン成功が確定した（アニメーション表示用）



### GET /api/checkin/calendar（新規）



月間のチェックインログを取得。



```

GET /api/checkin/calendar?month=2026-06

```



レスポンス:



```json

{

 "year": 2026,

 "month": 6,

 "enabledSince": "2026-06-01",

 "logs": [

  { "date": "2026-06-01", "success": true },

  { "date": "2026-06-02", "success": true },

  { "date": "2026-06-04", "success": false }

 ],

 "currentStreak": 5,

 "bestStreak": 12

}

```



- `logs` には CheckinLog が存在する日のみ含む

- レコードなしの過去日はクライアント側で失敗扱い（`enabledSince` 以降の日のみ）



### PUT /api/users/[id]（既存・変更）



`checkinDeadlineTime` の更新を受け付ける。



---



## 7. 設計判断



### 過去の失敗を見せてよいか



既存方針（decisions.md）に「過去の失敗が長期間残る心理的負荷を回避」とあるが、

チェックインは「アプリを開くだけ」であり、タスクの未達成（やれなかった自分）とは性質が異なる。

自己否定に繋がりにくいため、1ヶ月分の成功/失敗をカレンダーで表示する。



### 報酬なし



以下の案を検討した結果、まずは表示のみで開始する:



| 検討した案 | 見送り理由 |

|-----------|-----------|

| XP +1 | カテゴリ（STUDY/STAMINA/LIFE）の偏り問題 |

| 宝箱 +1 | コレクションアイテムのインフレ |

| 宝箱ブースト | 効果が地味 |

| スタンプカード式報酬 | 既存システム（ストリーク・バッジ）と重複 |

| コレクションアイテム増量 | 画像制作コスト大、ワクワクの源泉ではない |



子供の反応を見てから報酬の追加を検討する。



### ストリーク判定との関係



チェックインはストリーク（タスク達成連続日数）とは独立。

チェックイン成功がストリーク判定に影響することはない。宝箱の出現条件にも含めない。



---



## 8. 影響範囲



| ファイル | 変更内容 |

|---------|---------|

| `prisma/schema.prisma` | User に `checkinDeadlineTime`、Streak に 3フィールド追加、CheckinLog モデル新規 |

| `src/lib/checkin.ts`（新規） | チェックイン判定・記録ロジック |

| `src/app/api/quests/today/route.ts` | チェックイン判定を呼び出し、レスポンスに `checkin` を追加 |

| `src/app/api/checkin/calendar/route.ts`（新規） | 月間カレンダーデータ取得 |

| `src/app/api/users/[id]/route.ts` | `checkinDeadlineTime` の更新対応 |

| `src/app/app/child/quests/page.tsx` | カレンダーコンポーネント表示 |

| `src/components/child/CheckinCalendar.tsx`（新規） | カレンダーUI + スタンプアニメーション |

| 親の子供設定画面 | `checkinDeadlineTime` 設定UI追加 |