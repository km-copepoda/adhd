# アーキテクチャ決定記録

## 2026-03-11: 一時タスクの導入と画面別タスク作成権限

### 決定内容
- **親画面**: 通常タスク（繰り返し）と一時タスク（特定日1回）の両方を作成可能
- **子供画面**: 通常タスク（自分用の繰り返し）と一時タスク（今日だけ）の両方を自分で追加可能

### 実装方針
- 既存の `TaskTemplate` モデルに `isTemporary: Boolean`・`targetDate: DateTime?`・`createdBy: Role` を追加し、新モデルは作らない
- 一時タスクは `repeatDays = []`、`targetDate` で対象日を指定（未指定の場合は当日）
- `quests/today` API は `OR` 条件で通常タスク（曜日一致）と一時タスク（targetDate一致）を両方取得
- 子供は `createdBy = CHILD` で保存された一時タスクのみ削除可能（DELETE API で検証）
- 子供が通常タスクを追加する場合も同じ `/api/tasks` POST エンドポイントを使用（role チェックを緩和し、通常タスク作成は PARENT のみという制限を撤廃）

### 理由
- モデルを分けると QuestInstance の生成・承認フローを2箇所に書く必要が生じるため、既存 `TaskTemplate` を拡張する方が変更範囲が最小
- 子供の自発的なタスク追加を認めることで ADHD 向けの自己管理を促進するというプロジェクト趣旨に沿う

## 2026-03-12: 子供作成タスクの親承認フロー導入

### 決定内容
- 子供が作ったタスクは `createdBy === "CHILD"` のまま親が承認するまで「仮タスク」扱い
- 子供側: クエスト一覧に「仮」バッジで表示（通常どおり実施可能）
- 親側: タスク管理ページに「子供の申請中タスク」セクションを追加。「承認」で `createdBy: PARENT` に変更、「却下」で削除

### 理由
- 子供が自由にタスクを追加できる一方、親が管理・把握できるようにするバランスを取るため
- スキーマ変更なしで `createdBy` フィールドを承認状態のフラグとして流用できるため

## 2026-03-12: 仮タスク却下時のXP没収

### 決定内容
- 仮タスクは通常タスクと同じXP付与ルール（報告時に即時付与）
- 親がタスクテンプレートを「却下」（DELETE）した場合、REPORTED/APPROVED の完了済みクエストのXPを差し引き、QuestInstance を REJECTED に更新
- クエスト完了の「差し戻し」でも同様にXP差し引き（既存動作）

### 理由
- 親の監督権限を担保するため。却下されたタスクのXPを残すと、子供が恣意的なタスクでポイントを稼げてしまう

## 2026-03-12: XP付与タイミングを報告時→承認時に変更

### 決定内容
- XP（ポイント）は親の承認時に初めてDBに加算する（報告時には加算しない）
- 進化チェックも承認時に実行（報告時には行わない）
- 差し戻し時はステータス変更のみ（ポイント未付与のため差し引き不要）
- 育成画面の仮ポイント表示は REPORTED クエストからの動的計算で維持

### 理由
- 旧方式（報告時即加算＋進化チェック）では、未承認の仮ポイントで進化が発動してしまうバグがあった。承認後に初めてポイントを確定させることで、進化は承認済みポイントのみで判定される

## 2026-03-13: ストリーク機能の単一レコード方式

### 決定内容
- `Streak` モデルを子ユーザーごとに1レコードで管理（currentStreak, bestStreak, lastAchievedDate, restPassUsedAt）
- DailyAchievement ログテーブルは作らず、月間達成日数は `QuestInstance` の APPROVED + DISTINCT date から動的計算
- マイルストーンボーナスXPは3カテゴリ均等分配（端数は STUDY に加算）
- ストリーク更新は承認フロー（`approve/[id]`）に統合

### 理由
- 月間達成日数は既存の `QuestInstance` テーブルから取得可能であり、別テーブルを作ると二重管理になる
- 1子供1レコードの `upsert` パターンで書き込みコストが最小。ストリーク計算に必要な情報（最終達成日・連続日数・最高記録）はすべて1行に収まる
- 休息券の週次管理も `restPassUsedAt` 1フィールドで完結し、追加テーブル不要

## 2026-03-15: スキップに親承認フローを導入、ストリークにSKIPPEDも算入

### 決定内容
- スキップは即時確定ではなく、`PENDING → SKIP_REPORTED → SKIPPED` の親承認フローを経由する
- 承認センターに完了報告とスキップ申請の両方を表示（スキップ申請は赤系UIで区別）
- ストリーク達成カウントは `APPROVED + SKIPPED` の合計（親が承認したスキップも「その日のタスクに向き合った」として扱う）

### 理由
- 子供が親の確認なしにタスクをスキップできると、ストリーク維持のために安易にスキップする可能性がある
- 親が承認したスキップは「今日はできない」という正当な判断として、ストリーク継続を認めることでADHD特性への配慮と親の監督権限を両立

## 2026-03-15: Docker Compose の Windows 対応（network_mode: host 廃止）

### 決定内容
- `network_mode: host` を廃止し、`ports: ["3001:3001"]` でポートマッピング
- ホスト側サービス (Supabase: 54331, PostgreSQL: 54332) へのアクセスは `host.docker.internal` を使用
- `NEXT_PUBLIC_SUPABASE_URL` のビルドarg も `http://host.docker.internal:54331` に変更

### 理由
- `network_mode: host` は Linux 専用。Windows (Docker Desktop) では動作せず ERR_CONNECTION_REFUSED になる
- `host.docker.internal` は Docker Desktop (Win/Mac) がホスト側DNSに自動追加するため、ブラウザからもコンテナ内からも同じホスト名でアクセス可能

## 2026-03-16: タスクをユーザー（子供）単位で管理

### 決定内容
- `TaskTemplate` に `assignedChildId` フィールドを追加し、タスクをファミリー全体ではなく特定の子供に紐付ける
- 親がタスクを作成する際に対象の子供を指定（必須）
- 子供が自分でタスクを追加する場合は `assignedChildId = 自分のID` を自動設定
- `GET /api/tasks`（子供ロール）と `GET /api/quests/today` は `assignedChildId = 自分のID` でフィルタリング
- 親のタスク管理画面に子供セレクターを追加し、各タスクに対象子供名を表示

### 理由
- 従来は `familyId` でタスクをファミリー共有していたため、複数の子供がいる場合に全員同じタスクが見えてしまう問題があった
- 子供ごとに異なるタスクを管理できるよう、タスクを個人単位に変更

## 2026-03-17: 初期状態を卵（stage 0）からスタート

### 決定内容
- 子供ユーザーの初期 `evolutionStage = 0` を「たまご／やみのたまご」（🥚）とする
- 卵は 1 pt（タスク1個完了＋承認）で孵化し、最初のモンスター形態（旧 stage 0）へ進化
- `MONSTER_STAGES` に stage 0 = 卵（ptToEvolve: 1）を先頭挿入し、以降のステージを +1 シフト
- 既存ユーザーは `evolutionStage += 1` のマイグレーションで対応
- 孵化時の演出は「うまれた！」、以降の進化は従来通り「進化した！」

### 理由
- いきなりモンスターが生まれた状態だと愛着が湧きにくい。1タスクを消化して孵化させることで、モンスターへの愛着形成を促す

## 2026-03-17: 一日休み券（restPassUsedAt）廃止

### 決定内容
- `Streak.restPassUsedAt` カラムを削除し、`POST /api/streak/rest-pass` エンドポイントを廃止
- 子供画面の休息券UIも削除

### 理由
- スキップ承認フロー（`SKIP_REPORTED → SKIPPED`）が既に親承認でストリーク算入される仕組みを持つため、「一日休み」は全タスクのスキップ申請で代替可能。独立した休み券機構は重複

## 2026-03-17: Web Push 通知（二段構え方式）

### 決定内容
- アプリが表示中: Supabase Realtime によるリアルタイム更新（既存）
- アプリが非表示/閉じている: Web Push API（VAPID）で OS 通知
- Service Worker の `clients.matchAll()` で表示中ウィンドウを検出し、表示中の場合は OS 通知をスキップして二重通知を防ぐ
- 通知トリガー: 子供がタスク申請（`POST /api/tasks`）、クエスト完了報告（`/report`）、スキップ申請（`/skip`）
- 購読情報は `PushSubscription` テーブルに保存（endpoint でユニーク管理、410 Gone で自動削除）
- 購読登録は `PushSubscriber` クライアントコンポーネントで親レイアウト（`/parent/*`）にのみ追加

### 理由
- Realtime のみでは親がアプリを閉じている間に子供の報告を見逃す
- OS 通知のみでは起動中のアプリでも OS ポップアップが重複して UX が悪い
- `visibilityState` チェックによるスキップが最もシンプルな二重防止策

## 2026-03-18: 親→子 プッシュ通知（手動リマインド）

### 決定内容
- 親が子供の未完了タスクに対して手動でリマインド通知を送れる機能を追加
- 通知方向を子→親（既存）に加え、**親→子**も対応
- 子供側も `/api/push/subscribe` で購読登録可能にする（CHILD ロールを許可）
- `POST /api/push/notify-child` エンドポイントで親が特定の子供にリマインドを送信
- `sendPushToChild(childId, payload)` を `/lib/push.ts` に追加
- 通知内容: タスク名指定時「{タスク名}がまだ終わってないよ！」、未指定時は未完了タスク一覧を集約
- 子供側 `PushSubscriber` コンポーネントを child layout に追加

### 将来課題（未実装）
- **自動タイムトリガー**: 夕方〇時になっても未完了タスクがある場合、親の操作なしに子供へ自動通知。Supabase Edge Functions または外部 Cron で実装予定（フェーズB以降）

### 理由
- ADHD 特性上、具体的なタスク名を通知する方が行動に移しやすい（「画面見て」より「宿題をやろう！」の方が効果的）
- 親が状況に応じて送るタイミングを選べる手動方式をまず導入し、自動トリガーはフェーズB以降に検討

## 2026-03-15: 親画面「今日の完了タスク」にSKIPPEDも表示

### 決定内容
- `/parent/completed` 画面に `APPROVED` だけでなく `SKIPPED` のクエストも表示する
- スキップタスクはオレンジ枠＋「⏭ スキップ」ラベルで視覚的に区別し、XPは計上しない
- サマリー行に完了数とスキップ数を分けて表示

### 理由
- 親がスキップを承認した以上、その結果を完了一覧で確認できるのが自然。ストリークでもSKIPPEDを算入済みであり、「親が承認した今日の全アクション」を一覧できる方が監督しやすい

## 2026-03-22: 自動承認機能の導入

### 決定内容
- 親が承認し忘れた REPORTED/SKIP_REPORTED クエストを、翌日0時（JST）に自動承認する
- `Family` モデルに `autoApproveTime String @default("24:00")` を追加（将来の時刻カスタマイズ用）
- 承認ロジックを `src/lib/approve.ts` に抽出（`approveQuestInstance` / `approveSkipQuestInstance`）
- `POST /api/cron/auto-approve` エンドポイントで一括処理（`CRON_SECRET` で保護）
- Vercel cron: `0 15 * * *`（UTC 15:00 = JST 0:00）

### 理由
- XP は承認時付与のため、承認し忘れると子供の報酬が永遠に付与されない
- ADHD 特性上、フィードバックの遅延はモチベーション低下に直結する
- 子供のタスク締め切り設定はフェーズB以降の別機能として切り離す

## 2026-03-22: タスク報告への写真添付機能（Supabase Storage）

### 決定内容
- `TaskTemplate` に `requirePhoto Boolean @default(false)` を追加（写真必須フラグ）
- `QuestInstance` に `photoUrl String?` を追加（アップロードされた写真の公開URL）
- Supabase Storage バケット `quest-photos`（public）を使用
- 写真は子供のブラウザからクライアントサイドで直接 Storage にアップロード（APIを経由しない）
- アップロードパス: `{questId}_{timestamp}.{ext}`
- `requirePhoto=true` かつ `photoUrl` なしで報告した場合、APIは 400 を返す
- 親の承認画面でサムネイルを表示

### 理由
- ファイルアップロードをAPIサーバ経由にすると Next.js の request body サイズ制限に引っかかる可能性があり、Supabase Storage への直接アップロードが最小変更で済む
- パブリックバケットにすることで `<img src>` による表示が署名なしで可能。ファミリー専用アプリのため一般公開リスクは低い

## 2026-03-22: バー場サイド日付計算をJST基準に統一

### 決定内容
- `src/lib/date.ts` にJST日付ユーティリティ（`todayJST`, `dayOfWeekJST`, `monthStartJST`, `monthEndJST`, `todayRangeJST`)をついあk
- 全APIルートの `new Date(); setHours(0, 0, 0, 0)` パターンをJSTゆーりティティに置換

### 理由
- Vercel(サーバ）はUTCで動作するため、`new Date().setHours(0, 0, 0, 0)` はUTC 0時 = JST 9字になる。結果、0時～9字の間に子供がアプリを開いても前日のタスクが表示され、当日のタスクが表示されないバグがあった

## 2026-03-25: パラメータ連動の進化パス分岐（確率的選択）

### 決定内容
- モンスター進化先を STUDY / STAMINA / LIFE の3系統39種に拡張（孵化直後に3系統分岐: stage1 x3 + stage2 x9 + stage3 x27）
- `evolutionPath` を User テーブルに追加（例: `"STUDY_STAMINA"` = ステージ3でSTAMINA方向に進化したSTUDY系）
- 進化先は確率的加重ランダム選択（`selectEvolutionPath`）: 最多パラメータが最大60%の確率で選ばれ、残り40%を2番目・3番目のパラメータ比率で配分
- 進化判定は毎回の進化で実施（経路は累積: `"" → "STUDY" → "STUDY_STAMINA" → "STUDY_STAMINA_LIFE"`）
- 卵（stage 0）→孵化（stage 1）はパス選択なし（`newPath = ""`）。stage 1以降から分岐
- 既存ユーザーは evolutionStage/evolutionPath/Pt を全リセット（MVP のため許容）
- `Side`（DARK/LIGHT）は廃止し、`evolutionPath` に一本化

### 理由
- 勉強ばかりしていても他系統のモンスターになる可能性を残すことで、多様な行動を促す
- 60%上限キャップにより「得意分野のモンスターになりやすいが、完全には固定されない」適度なランダム性を実現
- パス文字列（`"STUDY_STAMINA_LIFE"` など）でモンスターテーブルをO(1)参照可能で実装がシンプル

## 2026-03-25: Side（DARK/LIGHT）をキャラクタービジュアルセットに再活用

### 決定内容
- `Side` フィールド（DARK/LIGHT）を、モンスターのビジュアルセット（男の子/女の子）の選択に使用する
- DARK = 男の子用画像（現行の `public/monsters/*.webp`）
- LIGHT = 女の子用画像（`public/monsters/light/` に39体分のユニーク画像を作成済み）
- `MONSTER_TABLE_LIGHT` を `constants.ts` に追加。全エントリが `light/` の実画像を参照済み
- `getMonsterStage(stage, path, side?)` に `side` 引数を追加し、LIGHT のとき `MONSTER_TABLE_LIGHT` を参照

### 理由
- evolutionPath 導入時に Side を「進化パス決定」から切り離したが、DB・UI にフィールドは残存していた
- キャラ選択（男/女）の用途として再活用することで、既存の親画面「サイド選択UI」を活かせる
- 画像がない状態でも、テーブルの参照先を切り替えるだけで後から差し替え可能な構造にした

## 2026-03-28: 転生サイクルを60pt（約2週間）に調整

### 決定内容
- `REBIRTH_THRESHOLD` を 70 → 20 に変更
- 1サイクル合計: 1 + 10 + 30 + 20 = 61pt（7pt/日想定で約8〜10日、5pt/日で約12日）
- stage3→転生は直前の進化（30pt）より短い「スプリント」設計に変更

### 理由
- 旧値 70pt では stage3 だけで10〜14日かかり、ADHD 特性上フィードバックループが長すぎてダレる
- 転生を「短い達成感のスプリント」にすることで繰り返しのモチベーションを維持する

## 2026-03-28: 転生後の卵の孵化閾値を5ptに設定

### 決定内容
- 初回の卵: 1pt で孵化（変更なし）
- 転生後の卵（`collectedPaths.length > 0`）: 5pt で孵化（`REBIRTH_EGG_THRESHOLD = 5`）
- `checkEvolution` / `getXpInfo` に `isReborn` フラグを追加し、`approve.ts` と育成画面から渡す

### 理由
- 初回1ptは「すぐモンスターに会える」体験を維持するため変更しない
- 転生後は1ptだと孵化が瞬時に終わりすぎて達成感がない。5pt（1〜2日）程度の待機で次のサイクルへの期待感が生まれる
- 1サイクル合計: 5+10+30+20=65pt（初回のみ1+10+30+20=61pt）

## 2026-03-25: 転生システムとコレクション機能の導入

### 決定内容
- 最終形態（stage 3）で転生閾値に達すると「転生」→ 卵（stage 0）にリセット
- 転生しても過去に進化したモンスターの記録は collectedPaths（JSON配列）に保持
- 図鑑は「現在の進化パス」ではなく「コレクション全体」を表示する形式に刷新

### 理由
- 最終形態到達後もゲームを続ける動機を与える（繰り返しプレイのループ設計）
- コレクション要素により「全種類集めたい」という長期モチベーションを追加

## 2026-03-29: 写真オプショナル化とフラットXP制への移行

### 決定内容
- `TaskTemplate.requirePhoto` → `photoBonus`（写真必須フラグ → 写真ボーナスフラグ）。写真添付は常にオプションになった
- XPをフラット制に変更: タスク完了 +1（常時） / 期限内報告 +1 / 写真ボーナス付きタスクに写真添付 +1（最大3pt）
- `Family` に `reportDeadlineTime String?`（例: `"20:00"`）を追加。ファミリー単位で報告期限を設定可能（null=期限なし）
- `QuestInstance` に `deadlineBonusEarned Boolean @default(false)` を追加
  - PENDING → REPORTED（初回報告）時のみ判定・設定
  - REJECTED → REPORTED（差し戻し後再報告）では変更しない（子供が遅く却下されても期限ボーナスを保護）
- XP付与は承認時に `deadlineBonusEarned` + `photoUrl` 有無で確定（既存の承認時付与アーキテクチャを維持）
- XP_MAP（難易度別: EASY=1, NORMAL=3, HARD=5）を廃止。`difficulty` フィールドはUI表示用として残存（後に完全廃止）

### 理由
- 写真撮影は子供にとって心理的・物理的負荷が高く、タスク報告の障壁になっていた。インセンティブ設計（ボーナス）に変えることで、写真がないタスクも気軽に報告できるようにする
- 期限ボーナスをファミリー単位にしたことで、親がタスクごとに時刻を設定する負荷を排除
- `deadlineBonusEarned` フラグにより、親の承認/却下タイミングの影響を受けない公平な期限評価を実現

## 2026-03-29: difficulty フィールドの完全廃止

### 決定内容
- `TaskTemplate.difficulty`（EASY/NORMAL/HARD）と `enum Difficulty` を DB・スキーマ・コードから完全削除
- `XP_MAP`・`DIFFICULTY_LABEL` 定数を削除
- 難易度選択UIを親・子供両画面から削除
- `migration: DROP COLUMN difficulty / DROP TYPE Difficulty`

### 理由
- XP_MAP（難易度別 1/3/5pt）廃止後、`difficulty` はUI表示以外に用途がなくなった
- フラットXP制（+1/+1/+1）では難易度はプレイヤー体験に寄与しないと判断
- 不要なフィールドを残すと、親タスク作成フォームに「かんたん/ふつう/むずかしい」という意味のない選択肢が残り、UXが悪化する

## 2026-03-29: ログインストリーク機能の導入

### 決定内容
- `Streak` モデルに `loginCurrentStreak`, `loginBestStreak`, `lastLoginDate` を追加（既存の1レコードパターンを踏襲）
- 10日連続ログインごとに +1pt のボーナスを付与（反復マイルストーン: 10日, 20日, 30日...）
- XP分配は既存の `distributeBonus` を使用（端数は STUDY に加算）
- `POST /api/streak/login-check` エンドポイントを追加（CHILD ロールのみ）
- child layout に `LoginStreakChecker` コンポーネントを配置し、ページロード時に1回サイレント呼び出し

### 理由
- タスク達成ストリーク（`recordDailyAchievement`）はタスクをこなさないと伸びないが、「アプリを開く習慣」自体も ADHD 支援の観点から報酬として認める
- 10日サイクルにすることで ADHD 特性に合わせた短期フィードバックを実現しつつ、タスク達成 XP（最大3pt/日）に対してログインボーナスが過剰にならない頻度に抑える

## 2026-04-02: URLルーティング再構成（/app プレフィックス導入・LP用 / 確保）

### 決定内容
- 全アプリ画面に `/app/` プレフィックスを付与（例: `/parent/tasks` → `/app/parent/tasks`）
- 旧 `/`（ログイン選択画面）を `/login` に移動
- `/` をLP専用パスとして確保（ログイン済みでもリダイレクトしない）
- `/register` → `/app/register`

### 理由
- LPを `/` に配置するため、既存のアプリ画面と明確にパス分離する必要があった
- `/app/*` vs `/api/*` でUIとAPIのパスを対称的に区別できる

## 2026-04-01: LPモンスター表示方針の変更（スタイル選択・影・カウント更新）

### 決定内容
- モンスタービジュアルを「カッコいい系（ヒーロー）」と「かわいい系（どうぶつ）」の2スタイルからトグル選択で切り替えられるUIをLPに追加
- モンスター総数を39→77に更新（卵1 + 38種×2スタイル = 77種）
- LP上のモンスター進化ライン表示: 第二形態は各系統1種のみフル表示、残り2種はシルエット。第三形態は全種シルエット（謎を残してコレクション意欲を喚起）
- ADHD SECTIONに「時間の見える化」「ドーパミン多段報酬設計」「クエスト形式でのタスク開始促進」「ワーキングメモリ補完」「親子ポジティブ関わり増加」の5項目を追加（計11項目）

### 理由
- DARKスタイル（男の子/ヒーロー系）とLIGHTスタイル（女の子/どうぶつ系）の差異はコードベースに既存の仕様（decisions.md 2026-03-25）であったが、LPに反映されていなかった
- 第三形態全シルエット・第二形態部分シルエットにより「まだ見ぬモンスター」の存在をLPで示し、コレクション意欲を高める
- ADHD向け訴求を強化するため、「時間感覚の歪み対策」「ドーパミン報酬設計の多段化」「タスク開始障壁の低減」「ワーキングメモリ補完」「親子関係改善」の観点を追加

## 2026-04-04: LP 訴求対象を「ADHD向け」→「一般の子ども向け、ADHDにも効果的」に変更

### 決定内容
- ヒーローバッジ「ADHD 支援 × ゲーミフィケーション」→「子どもの習慣化 × ゲーミフィケーション」
- ADHD SUPPORT セクション → HABIT DESIGN（タイトル・nav・アンカー変更）
- 各ポイントの「ADHD特性上〜」表現を「子どもは〜」に汎用化
- ADHD は「集中しにくい・動き出しが苦手なお子さんにも特に効果的」として副次訴求に

### 理由
- ADHD を前面に出すと一般家庭に刺さらない。ゲーミフィケーションによる習慣化という汎用価値を主訴求にし、ADHDへの有効性は補足として残す

## 2026-04-04: 転生を手動化＋卵選択ボーナス

### 決定内容
- 転生は自動ではなく、子供が「転生する！」ボタンを押すことで発動する手動方式に変更
- 転生閾値到達時: `User.rebirthPending = true` にセット（ステージ・ポイントはそのまま保持）
- 子供画面: `rebirthPending = true` のとき転生ボタン（パルスアニメーション付き紫ボタン）を表示
- 転生ボタン押下 → 卵選択オーバーレイ（勉強の卵・体力の卵・生活力の卵）
- 卵選択後: `POST /api/rebirth { eggType }` → ステージリセット・`rebirthEggBonus` 保存
- キャンセルすると元の状態（stage 3 + 転生ボタン表示）に戻る（DB未変更）
- 卵ボーナス: 選択したカテゴリの進化パス選択確率に+20%加算（正規化）。次の転生まで全進化で適用

### 理由
- 自動転生だとタスク承認のタイミングで突然卵に戻り、達成感が得られない
- ボタンを押す行為そのものが「新サイクル開始」の儀式になり、ADHD特性に合ったドーパミン報酬になる
- 卵選択で「次どんなモンスターになりたいか」を考える体験を加えることで、次サイクルへのモチベーションを維持

## 2026-04-08: バッジ（実績）システムの導入

### 決定内容
- `UserBadge` テーブルを追加（userId, badgeId, unlockedAt）
- `TaskTemplate` に `originalCreatedBy` フィールドを追加（子供作成タスクが承認で `createdBy=PARENT` に変わった後も出元を追跡するため）
- バッジは100個定義。ADHD 特性に配慮し、夜ふかし系・努力なしで達成できるものは除外
- 実装方針:
  - `ALL_BADGES` 配列 + `BADGE_CONDITIONS` マップ（純粋関数）でバッジ条件を定義
  - `loadBadgeContext(childId)`: DB から必要データを集計して `BadgeContext` を構築
  - `checkAndUnlockBadges(childId)`: 上2つを組み合わせて新規解除バッジを DB に保存
- バッジチェックは承認フロー（`approve.ts`）とログインチェック（`login-check`）から **fire-and-forget** で呼び出す（バッジ処理の失敗が承認を妨げないよう）
- `GET /api/badges` エンドポイント: 全100バッジを未解除/解除済み+日時+isNew フラグ付きで返す
- 子供画面 `/app/child/badges` ページを追加（BottomNav の「集落」タブを「実績」に置き換え）

### 理由
- ADHD 特性に合わせた多段的な短期フィードバック（バッジ解除の達成感）を追加するため
- 純粋関数でバッジ条件を定義することで、TDD が容易になりテストカバレッジを確保できる

## 2026-04-16: 進化確率の下限（MIN_EVOLUTION_PROBABILITY = 15%）を導入

### 決定内容
- `computeEvolutionWeights` に `MIN_EVOLUTION_PROBABILITY = 0.15` を導入
- アルゴリズム: 0ptのパスへの不足分を上位パスから比例的に取る（支配パスの60%上限はそのまま保たれる）
  - 例: studyPt=5, staminaPt=0, lifePt=5 → STUDY=42.5%, STAMINA=15%, LIFE=42.5%
  - study全振り時: STUDY=60%, STAMINA=20%, LIFE=20%（floor不要なため変化なし）

### 理由
- スタミナタスクはカテゴリとして登録しづらく、0ptのまま進化を迎えるとSTAMINA系モンスターへの進化確率が0%になる
- 10%だとADHD特性上「ほぼゼロ」と認知的に切り捨てやすい
- 15%（約7回に1回）は「実感できる可能性」としてコレクション意欲につながる
- 20%だと努力差が小さくなり「どうせランダム」感が出るため15%が最適

## 2026-04-19: QuestInstance にタスク名スナップショットを追加

### 決定内容
- `QuestInstance` に `snapshotTitle String?`, `snapshotEmoji String?`, `snapshotCategory Category?` を追加
- QuestInstance 作成時（`quests/today` upsert および `push/notify-child` upsert）にテンプレートの値をコピーして保存
- API レスポンス（`quests/today`, `quests/history`, `quests/completed-today`）では `snapshotTitle ?? template.title` の形でスナップショット優先・テンプレートフォールバック
- 承認・報告・スキップのロジック（`approve.ts`, `report/route.ts`, `skip/route.ts`）でも同様にスナップショット優先でカテゴリ・タイトルを参照
- 既存レコードはスナップショットが null → テンプレート値にフォールバックするため後方互換

### 理由
- タスク名を変更すると過去のクエスト履歴の表示名まで変わってしまうバグがあった
- カテゴリもスナップショット化することで、承認時の XP 付与先カテゴリが変更前の分類を正しく保持する

## 2026-04-22: タスク持ち越し機能（carryOver フラグ）の導入

### 決定内容
- `TaskTemplate` に `carryOver Boolean @default(false)` を追加
- `carryOver=true` のタスクは、子供が未報告のまま日付が変わっても PENDING インスタンスを翌日以降も表示し続ける
- 「1テンプレート = アクティブな PENDING インスタンスは常に1つ」を保証: `quests/today` の upsert 前に既存 PENDING を確認し、存在する場合は新規作成をスキップ
- `quests/today` の最終 `findMany` を `OR[date=today, status=PENDING & carryOver=true]` に変更
- 持ち越し中はストリークは切れる（子供が何もしなかった事実は変わらない）。翌日以降に完了・承認されれば通常通り XP・ストリーク獲得可能

### 理由
- ADHD 特性上タスクを忘れること自体は避けられないため、タスクを消失させるより「まだやれる」状態を維持する方がモチベーション継続に有効
- スキップ機能（子供が「やらない」と意思表示）とは役割が明確に異なるため、別フラグで管理

## 2026-04-27: carryOver 後付け ON で浮上する stale クエストを REJECTED に自動降格

### 決定内容
- `src/lib/quests.ts` に `cleanupStaleCarryOverInstances({ childId, templates })` を追加
- carryOver=true テンプレートについて「直近 APPROVED/SKIPPED より日付が古い PENDING / REPORTED / SKIP_REPORTED」を `status=REJECTED, rejectionReason="STALE_CARRYOVER_CLEANUP"` に一括変換
- `ensureTodayQuests`（子供 quests/today・親 tasks 経由）と `GET /api/approve/pending` の双方から呼び出す遅延クリーンアップ方式
- 直近 APPROVED/SKIPPED が無いテンプレートは判定不能のため対象外（ensureTodayQuests の 1 インスタンス保証で新規発生は防がれる）

### 理由
- carryOver=false で運用していたタスクで日付別に積もった過去 PENDING が、carryOver を後から ON にした瞬間に `quests/today` の `OR: [{ date: today }, { status: PENDING, template: { carryOver: true } }]` で全件浮上し、子供がまとめて報告 → 親の承認待ちが大量発生するバグの恒久対策
- 3d1f3df では親管理画面の「持ち越し中バッジ」表示のみ stale を除外していたが、データ自体と他画面（子供のクエスト一覧・親の承認待ち）には反映されていなかった
- 過去データを REJECTED に降格する形を取るのは、REJECTED は `date < today` なら子供の今日のリストに出現しないため副作用が無く、履歴上も「却下」として説明可能（rejectionReason で由来を識別可）

## 2026-04-24: QuestInstance 生成ロジックを `ensureTodayQuests` に集約し、親画面アクセス時も materialize する

### 決定内容
- `quests/today` の「今日のテンプレート抽出 + carryOver PENDING チェック + upsert」ロジックを `src/lib/quests.ts` の `ensureTodayQuests({ childId, familyId })` に切り出し
- `GET /api/tasks`（親画面）でも、family 内の各 CHILD に対して `ensureTodayQuests` を呼ぶようにした
- 結果、子供が一度もアプリを開かなくても、親が管理画面を開いたタイミングで今日の QuestInstance が生成される

### 理由
- `carryOver` は「前日の PENDING を翌日に見せる」仕組みであり、そもそも前日に QuestInstance が作られていないと機能しない（pull 型設計の盲点）
- cron を導入せず実装コストを抑えるため、「親もしくは子のいずれかがアクセスした時点で materialize」に方針決定
- 共有ヘルパー化により `/api/tasks` と `/api/quests/today` の両方で整合性を保てる

---

## 2026-03-29: 報告期限をファミリー単位から子供単位に変更

### 決定内容
- `Family.reportDeadlineTime` を廃止し、`User.reportDeadlineTime String?` に移動
- 親は「メンバー管理」画面で子供ごとに報告期限時刻を設定する
- `PATCH /api/family/settings` は `{ childId, reportDeadlineTime }` を受け取り、指定の子供の `reportDeadlineTime` を更新
- `GET /api/family/code` のレスポンスで各メンバーに `reportDeadlineTime` を含める（トップレベルの `reportDeadlineTime` は削除）
- `POST /api/quests/[id]/report` は Family を別途クエリせず、`user.reportDeadlineTime` を直接参照

### 理由
- 同じファミリーに複数の子供がいる場合、年齢や生活リズムが異なるため一律の報告期限は不合理
- 子供Aは学校から帰る20時、子供Bは習い事で22時が妥当、といったケースを想定
- Family への JOIN が不要になり `report/route.ts` の実装がシンプルになった

## 2026-04-26: あつまり機能（場所×合言葉グループ＋自動掲示板）の導入

### 決定内容
- 子供向けに「場所」（公園10人 / 児童館30人 / 校庭50人）×「合言葉」でグループを組む機能を追加
- 合言葉は `normalizeSecretWord` で **ひらがな→カタカナ・英字→大文字に正規化**（最大10文字）し、表記ゆれで別グループになるのを防ぐ
- グループは `(location, secretWord)` の unique upsert で自動生成・自動合流。子供は同時に1グループまで（`GatheringMember.childId @unique`）
- 掲示板書き込みは **完全自動**。子供の手動投稿APIは設けない（トラブル防止）
  - タスク進捗: REPORT/SKIP のたびに `triggerTaskProgressLog` が走り、当日の達成率（REPORTED+SKIP_REPORTED+APPROVED+SKIPPED / total）を `getProgressMilestones` でマイルストーン化（START / 25 / 50 / 75 / 100%）
  - バッジ獲得・モンスター進化: `approve.ts` の承認フローから fire-and-forget でログ
  - ストリーク称号: `streak.ts` のマイルストーン分岐から fire-and-forget でログ
  - 転生: `/api/rebirth` の卵選択完了時にログ
- `BulletinLog` の unique は `[groupId, childId, type, date]`。**同一ユーザが同日に同じ種別を2回以上ログしても2件目以降は黙殺される設計**（同じバッジ・同じ進化は同日2回起きない想定 + 進捗マイルストーン再評価の冪等性）。`writeBulletinLog` 側は `try/catch` で unique 違反を握りつぶす
- 直近4日分（`LOG_RETENTION_DAYS = 4`）のみクライアントへ返却。古いログはトラブル材料になり得るため意図的に表示しない
- 掲示板に書き込む識別子は **`monsterName ?? name` の順で優先**。本名（`name`）はグループ外（他ファミリー）に晒さない。両方 null の場合はログをスキップ（`getDisplayName` が null を返したら return）
- 親画面 `/app/parent/gathering` から、参加中の子供のグループ掲示板を読み取り専用で閲覧可（子供セレクター付き）
- リアルタイム更新は `BulletinLog` を `supabase_realtime` publication に追加し、子供画面・親画面とも `postgres_changes` で INSERT を購読

### 理由
- ADHD 特性上「他のなかまも頑張っている」という社会的フィードバックがモチベーション維持に有効
- 子供同士の自由文投稿はトラブル（誹謗・煽り・個人情報露出）の温床になるため、書き込みは完全自動化
- タスク名はプライバシーの観点で **掲示板には載せない**。「頑張っている」「夢中」「もうすぐ」など抽象表現で進捗だけを伝える
- 直近4日に絞ることで、過去の失敗が長期間残る心理的負荷を回避

### やってはいけないこと
- 子供アクションでの掲示板書き込みAPIを追加する（仕様上禁止）
- 掲示板ログにタスク名や具体的な内容を載せる（プライバシー）
- `triggerXxxLog` を `await` で承認フローに組み込む（fire-and-forget で承認失敗を起こさない）

## 2026-04-28: 掲示板を日付グルーピング1ページ表示（直近4日）+ 種別ごとの絵文字バリエーション

### 決定内容
- `GET /api/gathering/board` は **直近4日分（today, -1, -2, -3）を `BulletinLog.date` で一括返却**。フィルタは `date >= today - 3日`、ソートは `date desc, createdAt desc`、最大200件
  - 旧仕様の `createdAt` ベース取得・`?date=` 単日タブ取得はいずれも廃止
- UI（`<GatheringBoard>`）は **タブを廃止し、日付ごとのセクション見出し**（`M/D（曜）の掲示板`、今日は `・きょう` 付き）でグループ表示。スクロールは1コンテナにまとめ、「上から順に新しい→古い」の単一ストリーム
- 日付グルーピング・絵文字マッピングは `src/lib/gathering.ts` の純粋関数 (`groupBulletinLogsByDate`, `getBulletinLogEmoji`) に切り出し（テスタブル化）
- 掲示板ログ種別ごとの絵文字を一意化:
  - `TASK_STARTED=🚀` / `TASK_PROGRESS_25=🌱` / `TASK_PROGRESS_50=💪` / `TASK_PROGRESS_75=⚡` / `TASK_COMPLETE=🎉`
  - `BADGE_UNLOCKED=🏅` / `STREAK_TITLE=👑` / `MONSTER_EVOLVED=🌟` / `MONSTER_REBORN=🐣`
- 参加メンバー一覧の `name` フォールバックを `name ?? monsterName ?? <種族名>` に変更し、`"なまえなし"` 文字列を撤廃（種族名は `getMonsterStage` から常に取得可能）

### 理由
- タブ切替は「今日と過去日を行き来する」操作コストがあり、ADHD 特性上「複数日を眺めて流れを掴む」用途に合わなかった。1スクロールで4日分を縦に追える方が「自分の積み重ね」を視覚的に実感しやすい
- 旧仕様では `TASK_*` がすべて ⚔️ で並び、視覚的に同じ書き込みが続いて見えてしまっていた。種別ごとに絵文字を分けることで、進捗段階・バッジ・進化・転生がパッと判別できるようになる
- `"なまえなし"` は親が `name` を未登録のときに出る不可解な表示で、「自分のモンスター」を識別する手がかりとして弱い。モンスター名にフォールバックすることで識別性が向上する

## 2026-04-28: 削除済みテンプレートの履歴に SKIPPED も残す

### 決定内容
- `GET /api/quests/history` の削除済みテンプレート（`isActive=false`）フィルタを変更
- 旧: `APPROVED` のみ表示
- 新: `APPROVED` または `SKIPPED` を表示（親が承認した過去の確定アクションは履歴に残す）
- `REPORTED`/`REJECTED`/`PENDING`/`SKIP_REPORTED` は引き続き非表示（親未承認のままタスクが消えた状態は履歴に残さない）

### 理由
- 親が繰り返しタスクを削除すると、過去にスキップ承認した日まで履歴から消えてしまうバグがあった
- スキップは `SKIP_REPORTED → SKIPPED` の親承認フローを経た「確定アクション」であり（2026-03-15 決定）、ストリークにも算入されている。これを履歴から消すのは整合性を欠く
- 一方、未承認のまま残った `REPORTED`/`PENDING` 等は「親が確定させていない状態」なので、テンプレート削除時に履歴から外す挙動は妥当として維持

## 2026-04-30: BulletinLog の unique に `key` を追加（同日に複数バッジ等を許可）

### 決定内容
- `BulletinLog` に `key String @default("")` カラムを追加し、unique を `[groupId, childId, type, date]` → `[groupId, childId, type, date, key]` に変更
- `key` の運用:
  - `BADGE_UNLOCKED`: バッジ名
  - `STREAK_TITLE`: 称号名
  - `MONSTER_EVOLVED`: 進化先モンスター名
  - `MONSTER_REBORN`: 卵タイプ
  - `TASK_*`: 空文字 `""`（同日マイルストーン重複は引き続き禁止）
- 2026-04-26 決定の「同一ユーザが同日に同じ種別を2回以上ログしても2件目以降は黙殺される設計」を **「同 type+key の組合せが重複した場合のみ黙殺」に修正**

### 理由
- 旧仕様は「同じバッジ・同じ進化は同日2回起きない想定」で同日同 type を1件に絞っていたが、**異なるバッジを同日に複数解除した場合まで unique 違反で握りつぶされ、掲示板に1件しか残らないバグ**になっていた
- `key` を unique に含めることで「同日に別バッジを複数件残す」「同日に異なる進化を複数件残す」が可能になり、掲示板の達成感フィードバックが正確になる
- TASK_* は `key=""` 固定なので、進捗マイルストーン再評価の冪等性は維持される

## 2026-05-02: main ブランチへのマージ元を develop のみに制限（GitHub Actions）

### 決定内容
- `.github/workflows/restrict-main-merge.yml` を追加し、`main` への PR は `head_ref === "develop"` でない場合に必ず fail させる
- GitHub の Branch protection rule で本ワークフローを `main` の Required status check に設定して強制する（リポジトリ管理者が UI 側で実施）

### 理由
- `feature/*` や `hotfix/*` から直接 `main` にマージされるとリリース履歴が乱れ、`develop` を通して統合する運用が崩れる
- GitHub には「マージ元ブランチを限定する」標準オプションが無いため、Actions のチェック + Required status check で実現する

### やってはいけないこと
- 例外的に `feature/*` から直接 `main` にマージしようとして本ワークフローを無効化する（必要なら `develop` に一旦マージして fast-forward する）

## 2026-05-02: ひろば「エールを送る」スタンプ機能の導入

### 決定内容
- グループ参加中の子供が、グループ全員に「エールを送る」スタンプを 1日1回 押せる機能を追加
- 新テーブル `Stamp { id, groupId, senderId, date(@db.Date), createdAt }` + `@@unique([senderId, date])` で1日1回制約を担保
- API `POST /api/gathering/stamp`（CHILD のみ）: グループ全メンバー（送信者除く）に対し、各受信者の **当日進捗** を判定して個別メッセージを生成し Web Push 配信
- API `GET /api/gathering/stamp/today`: 自分が今日送信済みかどうかを返す（UI のボタン disabled 制御用）
- 進捗状態 `NOT_STARTED | IN_PROGRESS | DONE` は `src/lib/gathering.ts` の純粋関数 `getStampProgressStatus(done, total)` で判定（既存 `getProgressMilestones` と同じ完了系定義: `REPORTED + SKIP_REPORTED + APPROVED + SKIPPED`）。`rebirthPending` 状態は判定に影響しない
- メッセージ生成は同じく純粋関数 `buildStampMessage(senderName, status)`
- リアルタイム配送: `Stamp` を `supabase_realtime` publication に追加し、子供クライアントは `groupId=eq.{自グループ}` で INSERT 購読 → 自分のクエスト配列から `getStampProgressStatus` を計算してトースト表示
- Web Push もサーバ側で同じ判定をして個別文面で送信（`sendPushToChild` 流用）
- **掲示板（BulletinLog）には記録しない** — トラブル時の長期残存を避けるためと、4日経過で消えると意図がぼやけるため

### 既存方針との関係
- 2026-04-26「子供アクションでの掲示板書き込みAPIを追加しない」の趣旨は **自由文によるトラブル防止**。プリセット文言のスタンプは趣旨内のため例外として `Stamp` API のみ追加
- 「掲示板にタスク名を載せない」は維持（メッセージは「スタートのきっかけにしよう」「その調子！」等の抽象表現のみ）

### やってはいけないこと
- スタンプ送信を掲示板（`BulletinLog`）に書き込む（仕様上、受信ログは残さない）
- スタンプを通じた自由文・写真などの送信機能を追加する（自由文禁止の趣旨に反する）
- メッセージ文言にタスク名・具体的な進捗数値を含める（プライバシー）

## 2026-05-05: 掲示板の表示時集約（TASK_*の最新だけ・同種別バーストは束ね）

### 決定内容
- `BulletinLog` のスキーマ・API・保存ロジックは変更せず、**クライアント表示時のみ**ログを集約する
- 集約は `src/lib/gathering.ts` の純粋関数2つで実装:
  - `coalesceTaskProgress(logs)`: 同一 (childId, dateStr) の `TASK_STARTED/PROGRESS_25/50/75/COMPLETE` は最新1件のみ表示。途中段階の縦積みを排除（入力は `date desc, createdAt desc` 順を仮定し、最初に出現したものを採用）
  - `coalesceBurst(logs, windowMs=300_000)`: 同一 (childId, type) が **隣接要素間 ≤5分** で並んだ場合、1エントリ `{ primary, items }` に束ねる。複数バッジを同時取得した際の縦伸びを抑える
- `<GatheringBoard>` は `groupBulletinLogsByDate` → `coalesceTaskProgress` → `coalesceBurst` の順に適用し、`items.length > 1` なら primary メッセージ末尾に `×N` を付記
- 表示時集約のみのため、DB ログは正確な時系列で残り、unique 制約 `(groupId, childId, type, date, key)` の整合性は無影響

### 理由
- 同じ子供の連続バッジ取得（同一承認で複数解除など）と、TASK_*の途中マイルストーン（START/25/50/75/COMPLETE）が重なって**画面が縦に大きく伸びる**問題があり、「他のなかまの頑張りを眺める」社会的フィードバックの目的が逆に損なわれていた
- スキーマや API を変えずに表示ロジックだけで解消できるため、2026-04-26 の「書き込みは完全自動」「直近4日分のみ表示」「タスク名は載せない」方針はすべてそのまま維持
- 2026-04-28 で確立した「1スクロールで時系列の流れを追う」設計とも整合（タブ復活ではなく、同種別バーストを1行に圧縮するだけ）

### やってはいけないこと
- API レスポンス段階で集約しない（DBログは正確な時系列を保つ。集約はクライアント表示時のみ）
- バースト束ねの時間窓を ms 単位で大きく取りすぎない（独立した2回の達成が同一バーストに混ざると体験が損なわれる）
- TASK_* の最新1件残しは「同 childId + 同日」単位で行う（子供が違う／日付が違う場合は独立して残す）

## 2026-05-06: LP に PAIN POINTS / BEFORE-AFTER / FAQ セクションを追加し ADHD 親への訴求を強化

### 決定内容
- LP（`/`）に新セクションを追加: PAIN POINTS（親の悩み共感）/ BEFORE-AFTER（使用前後の景色）/ FAQ
- HERO 直下に「ADHD 傾向のお子さんに特に効果的」「集中しにくい・動き出しが苦手なお子さんに」など訴求サブバッジを追加
- HABIT DESIGN セクションのサブコピーを ADHD 訴求寄りにチューニング（「ADHD 傾向のお子さんにも届く」等）
- VOICES（テスティモニアル）に ADHD 訴求の声を追加（3件→6件）
- LP 用データは `src/lib/lp.ts` に集約し、`PAIN_POINTS` / `BEFORE_AFTER` / `FAQ_ITEMS` / `HERO_SUB_TAGS` を純粋エクスポート（テストは `src/__tests__/lib/lp.test.ts`）
- 2026-04-04 の方針（主訴求は「子どもの習慣化」、ADHD は副次訴求）は維持。今回は ADHD 訴求を「副次のままより強く・具体的に」見せる強化

### 理由
- ADHD 傾向のお子さんを持つ親が LP を読んだときに「自分のことを言っている」と気づける具体悩み（先延ばし・忘れ物・叱りすぎ・シール台紙が続かない 等）を冒頭で提示し、共感→自分事化→FAQ で疑問解消→CTA という導線を整備
- データを純粋モジュールとして切り出すことで TDD 可能になり、コピーの追加・差し替えも UI ロジックを触らずに済む
- 一般家庭への汎用訴求を維持しつつ ADHD 親への訴求力だけを上げる、最も変更範囲の小さい構成

## 2026-05-07: LP に「ひろば × エール」セクションと安全性訴求を追加

### 決定内容
- LP に新セクション `#hiroba` を追加し、developで導入された 2026-04-26「ひろば」機能（場所×合言葉グループ＋自動掲示板）と 2026-05-02「エールを送る」機能を訴求対象として明示
- セクション構成: ひろば特徴4カード（場所×合言葉／自動掲示板／リアルタイム／親も閲覧可）→ CHEER スポットライト（エール仕様＋6 bullet）→ プライバシーボックス（タスク名なし／自由文API無し／4日のみ／表示名はモンスター名優先）
- BEFORE/AFTER に「孤独感」シーンを追加（ひろば／エールが「ひとりじゃない」体験を作るというストーリー）
- FAQ に2項目追加: 「他のお子さんとの交流は大丈夫？」「エールは何のためにあるの？」（自由文不可・直近4日のみ・トラブル発生余地なし、を強調）
- LP データに `HIROBA_FEATURES` / `CHEER_FEATURE` / `HIROBA_PRIVACY_NOTES` を `src/lib/lp.ts` に追加（テスト `src/__tests__/lib/lp.test.ts`）
- ナビに `#hiroba` リンクを追加

### 理由
- 「自分／うちだけが頑張ってる」という孤立感は ADHD 子育てで親が抱える大きな辛さの一つ。実装済みのひろば／エール機能はこれに直接効くのに LP で訴求できていなかった
- 一方、「他人の子と交流させて大丈夫？」というプライバシー懸念は親側の購入障壁になりやすい。実装の核（自由文 API 不在・タスク名非表示・直近4日・モンスター名表示）はそのままトラブル防止の根拠になるため、機能訴求とセットでプライバシー設計を見せ、安心感まで含めて1セクションで完結させる
- LP コピーに変更が入っても decisions.md（仕様規約）には影響しないが、LP セクションの増設は方針レベルの判断（孤独感対策・安全性訴求を主訴求に格上げ）を含むため記録を残す

## 2026-05-01: 掲示板ログのトリガーを fire-and-forget から `next/server` の `after()` に切り替え

### 決定内容
- 2026-04-26 で「fire-and-forget でログ」と決めていた `triggerXxxLog` 呼び出しをすべて `after(() => trigger().catch(() => {}))` に変更
- 影響箇所: `src/app/api/quests/[id]/report/route.ts`、`src/app/api/quests/[id]/skip/route.ts`、`src/app/api/rebirth/route.ts`、`src/lib/approve.ts`（`triggerMonsterEvolvedLog` / `triggerBadgeLog`）、`src/lib/streak.ts`（`triggerStreakTitleLog`）

### 理由
- Vercel など Serverless Functions は **レスポンスを返した瞬間に関数インスタンスが停止する**ため、`trigger().catch(() => {})` の Promise が完了しないことがあった
- 「タスクを全部終わらせたのに掲示板に 100% 完了メッセージが来ないことがある」という症状の再発防止
- `after()` は Next.js 15+ の標準 API で、レスポンス送信後にコールバックを確実に走らせる正規手段

### やってはいけないこと
- 新規に `triggerXxxLog(...).catch(() => {})` を書かない。必ず `after(() => triggerXxxLog(...).catch(() => {}))` で包む
- `await triggerXxxLog(...)` でレスポンスをブロックしない（ユーザ操作のレイテンシが伸びる）

## 2026-05-05: エール Push を DONE 受信者にスキップし、ひろばマウント時に未読再生

### 決定内容
- `POST /api/gathering/stamp`: 受信側ごとに当日進捗を判定し、`status === "DONE"` のときは `sendPushToChild` をスキップする。`Stamp` 行作成と Realtime 配信は変更なし
- 新規 `GET /api/gathering/stamps/received-today`: 自グループで自分宛・本日着の Stamp 一覧（自分送信は除外）を返却。レスポンス `{ stamps: [{ id, senderId, senderName }] }`
- `GatheringStampPanel` マウント時に `received-today` を取得し、`localStorage["gathering:seenStampIds"]`（直近100件保持）に未保存のIDのみトーストで再生。Realtime 受信時も seenIds に追加して二重表示を防ぐ
- DONE 判定はサーバ側 Push 配信とクライアント表示で同じ `getStampProgressStatus` を共有

### 理由
- 当日のクエストを全部終わらせている子に Push を飛ばすと、集中を切らさず終わらせた直後に通知音で割り込む UX 問題があった
- 一方 Push を完全停止だけだと、Realtime チャンネル subscribe 前に届いた Stamp に DONE の子が気づけず「DONE の子だけ社会的フィードバックを失う」という別問題が生まれる
- ひろばページのマウント時に過去 Stamp を再生することで、`Stamp` 行を「OS 通知＋Realtime＋次回ページ訪問時の補完」の三段配送に拡張し、DONE 受信者の体験を毀損せずに通知音だけ抑制できる
- 既読管理を localStorage にとどめたのは、当日4件以下の低頻度アクションで別端末ログイン時の重複表示が許容範囲だったため。`StampReceipt` テーブル追加はオーバーキル
- 2026-05-02 で決めた「個別メッセージで Push 配信」の例外条項として位置付け（自由文・タスク名露出などの禁止事項は維持）

### やってはいけないこと
- DONE 判定をクライアント側だけに置く（Push を抑制するためにサーバ側判定が必要）
- DONE 受信時に Realtime トーストや未読再生まで止める（ページを開いている／開いた人は気づける状態を維持する）
- localStorage の seenIds を無制限に肥大化させる（直近100件で trim、当日4日経過で API レスポンス側からも消える）

## 2026-05-07: エール送信を掲示板（BulletinLog）にも記録する（2026-05-02 の禁止条項を撤回）

### 決定内容
- `BulletinLogType` に `STAMP_SENT` を追加し、`POST /api/gathering/stamp` 成功時に `triggerStampSentLog(senderId)` を `after()` で呼んで掲示板に書き込む
- メッセージは `${displayName}がみんなにエールを送ったよ！`（既存の `getDisplayName` 流用＝monsterName 優先で本名は晒さない）
- 絵文字は `📣`（メガホン: みんなへの呼びかけを表す）
- `BulletinLog.key` は `"エール"` 固定。1日1回制約は `Stamp.@@unique([senderId, date])` で既に担保されているため、unique `[groupId, childId, type, date, key]` と衝突しない
- 既存の Push 配信・Realtime 配信・ひろばマウント時の未読再生（2026-05-02, 2026-05-05 決定）はそのまま維持。掲示板書き込みは追加分で、配送経路を増やす形

### 既存方針との関係
- 2026-05-02「やってはいけないこと: スタンプ送信を掲示板（BulletinLog）に書き込む」を **撤回**
- 2026-04-26「子供アクションでの掲示板書き込みAPIを追加しない」の趣旨は **自由文によるトラブル防止**。エール送信はプリセット文言のみ・送信先はグループ全員一斉のため、誰が誰に送ったかという個別性が無く、トラブル要因にならない
- 「掲示板にタスク名を載せない」「直近4日のみ表示」は維持

### 撤回の理由
- エールは全員一斉送信なので「誰が誰にエールを送らなかった」という選別による疎外は構造上発生しない
- プリセット文言なので自由文起因のトラブル（誹謗・煽り・個人情報露出）が起きない
- 元々の禁止理由「4日経過で消えると意図がぼやける」は、エールが当日限りの体験であることを踏まえると、むしろ4日残ることで「他の子も励まし合っている」社会的フィードバックを強化する効果が期待できる

### やってはいけないこと
- エール送信のメッセージにタスク名・具体的な進捗数値を含める（プライバシー）
- `key` を空文字 `""` にする（Stamp 側の1日1回制約と意味的に重複させない。`"エール"` 固定で読みやすさを維持）
- 既存の Push 抑制ロジック（DONE 受信者へは送らない / 2026-05-05 決定）を掲示板書き込みにも適用する（掲示板は全員に対する「送った事実」のフィードバックなので、受信側の進捗で間引かない）

## 2026-05-09: ひろば なかま一覧の表示識別子を `monsterName` + `speciesName` の2軸に再構成し API から `name` を除去

### 決定内容
- `GET /api/gathering/current` の `members[]` から `name`（本名フォールバック）フィールドを削除
- `members[]` は `id / monsterName / speciesName / monsterImage / evolutionStage / isMe` のみを返す
  - `monsterName`: `User.monsterName ?? <種族名>`（既存通り。スタンプ送信文言にも流用）
  - `speciesName`: `getMonsterStage().name`（種族名固定）
- `<GatheringMemberList>` の表示は **上=`monsterName`（太字）／下=`speciesName`（薄字）** とし、両者が同一文字列のときは下ラベルを非表示にして重複表示を防ぐ
- 2026-04-28「参加メンバー一覧の `name` フォールバックを `name ?? monsterName ?? <種族名>` に変更」のうち `name` 経路を **撤回**

### 理由
- 実装上 CHILD ロールの `User.name` をセットするコードパスが存在せず（親登録のみ `name = email の @ 前`）、CHILD は常に `name = null`。旧 API の `name = m.child.name ?? monsterName` は CHILD では常に `monsterName` に潰れ、上下ラベルが必ず同じ文字列になる表示バグの構造的原因だった
- 2026-04-26 の「本名 (`name`) はグループ外（他ファミリー）に晒さない」プライバシー方針と整合。API レスポンス自体に `name` を含めないことで、誤って本名が露出する経路を構造的にゼロにする
- なかま一覧の「上=愛称／下=種族名」の2軸は、スタンプ・掲示板で既に確立した `monsterName` 優先表示と一貫し、種族名表示でコレクション要素（種族の多様さ）も視認できる

### やってはいけないこと
- `/api/gathering/current` の `members[]` に `name`（本名フォールバック含む）を再追加する
- `<GatheringMemberList>` で `monsterName` と `speciesName` のどちらか片方しか表示しない（重複時の片方非表示は許容、ただし両者が異なる場合は両方表示）

## 2026-05-09: 「今日やる宣言ボーナス」の導入（放置タスク回避向け）

### 決定内容
- 3 日以上アイドル状態（最終 APPROVED から JST 換算で 3 日以上経過、または一度も APPROVED されていない場合は `template.createdAt` から 3 日以上経過）の今日のクエストに対して、子供画面で「今日やる」ボタンを表示する
- ボタンを押した事実だけを `QuestDeclaration { templateId, childId, date(@db.Date) }` に記録（unique `(templateId, childId, date)`）。XP もペナルティもこの時点では発生しない
- 同じ日のうちに当該クエストが APPROVED まで到達した場合、`approveQuestInstance` が `reportedAt` の JST 日付に対応する宣言を検索して、見つかれば `+DECLARATION_BONUS_XP (=1)` を加算する。carryOver タスクでも `quest.date` ではなく `reportedAt` 基準で照合するためマッチする
- 放置カウンタのリセット条件は **APPROVED のみ**（spec: 「スキップまたは未完了」両方を放置として扱う）。SKIPPED/SKIP_REPORTED/REPORTED/REJECTED/PENDING はカウンタを増やすだけ
- ボタンの表示対象ステータスは PENDING / REJECTED のみ（既に今日アクション済みの REPORTED/APPROVED/SKIPPED/SKIP_REPORTED には出さない）
- 子供画面では `sortQuestsForDeclaration` で「アイドル未完了 → その他未完了 → 完了済み」の順に並び替えて、放置タスクが画面上部に来るようにする
- 純粋関数（`getIdleDays`, `isEligibleForDeclaration`, `IDLE_DAYS_THRESHOLD`, `DECLARATION_BONUS_XP`, `sortQuestsForDeclaration`）は `src/lib/declaration.ts` と `src/lib/questProgress.ts` に分離してテスト容易にした

### 理由
- 得意なタスクだけ消化して苦手なタスクが永続的に放置されるパターン（ADHD 特性: 開始の神経回路が発火しづらい）への対策。放置タスクが目に入る状態を毎日作りつつ、操作ステップ追加・宣言ノルマ・親通知のいずれも増やさず「ペナルティなしのリマインド + 実行したら報われる」設計にまとめる
- XP 上乗せは「宣言だけして完了しない」形骸化を防ぐため、宣言と完了のコンボでのみ発火させる（spec: 宣言だけは 0pt）
- 放置判定の基準を「最終 APPROVED からの JST 日付差」に統一することで、carryOver タスクも非 carryOver タスクも同じ式で扱える（前者は instance.date が古いまま APPROVED されるため `approvedAt` ベースが必須）

### やってはいけないこと
- 宣言だけで XP を付与する（spec の形骸化防止条項）
- 宣言したのに未完了だった場合にペナルティ（XP 減・ストリーク折れ・親通知など）を発動する（spec のノーリスク条項）
- ボタン表示条件を「1 日 1 つに制限」する（spec: 自然と数が絞られるため不要）
- 宣言処理を承認フローの `await` で直列に組み込む（既存の `after()` 方針には反しないが、宣言ボーナス分の XP は承認時点で確定させたいので findUnique は同期的に呼ぶのが正しい）
- 放置カウンタのリセットを SKIPPED で行う（spec: スキップは放置として扱う）

## 2026-05-09 (改): 「今日やる宣言」の放置判定を「直近 N 出現の連続非 APPROVED 数」に変更

### 決定内容
- 同日の決定 (上記) で導入したアイドル判定基準を **暦日数ベース** から **「直近 N 出現の連鎖長」ベース** に変更
- `getMissedExposureCount({ allInstances, today, carryOver })`:
  - 通常タスク: date 降順の `QuestInstance` を上から走査し、最初の `APPROVED` までの非 APPROVED 件数を返す（今日のインスタンスも含む）
  - carryOver タスク: 連鎖最古の非 APPROVED `instance.date` から today までの暦日数（inclusive）を返す（carryOver は instance が増殖しないため）
- 閾値定数も `IDLE_DAYS_THRESHOLD` → `IDLE_EXPOSURE_THRESHOLD` (= 3) に改名
- API レスポンスは表示用に `idleDays`（最終 APPROVED からの暦日差）と判定結果 `eligibleForDeclaration` を分けて返す
- `/api/quests/today` の per-template 集計を `groupBy` から `findMany take=30 desc` ベースに切り替え（連鎖長の計算には個別の status 履歴が必要）

### 理由
- 旧仕様（暦日数 ≥ 3）では **週次タスクで 1 回スキップしただけで翌週いきなりボタンが出る** 過剰反応バグがあった。子供は週に 1 回しか機会がないのに、1 回の見送りで毎週リマインドされるのは spec の「ペナルティなし・ノーリスク」の趣旨に反する
- 新仕様（出現連鎖 ≥ 3）なら週次は 3 週連続見送り、毎日タスクは 3 日連続見送りでボタンが出るので「タスクの粒度に対して連続 3 回放置」という直感に揃う
- carryOver は `instance` が日をまたいで残るため出現が増えない。同じ概念を「instance.date 以来の暦日」で代替し、毎日見える状態が 3 日続いたら発火、と整合させた
- 表示用 `idleDays`（暦日）は別フィールドに切り出し、判定（`eligibleForDeclaration`）は出現連鎖、UI の「最後にやったのは X 日前」は暦日を使えるように分離した

### 関連既知の問題（未対応）
- `recordTaskStreak` / `isTaskStreakActive` (`src/lib/streak.ts`, `src/lib/date.ts`) も「today/yesterday の暦日連続」で判定しているため、**週次タスクをきちんと毎週完了しても TaskStreak が常に 1 にリセットされる** 同種のバグを抱えている。本決定の対象外として別チケットで扱う
