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

## 2026-05-10: TaskStreak / isTaskStreakActive を repeatDays ベースの「前回出現日からの連続性」で判定

### 決定内容
- `src/lib/date.ts` に純粋関数 `previousScheduledDate(repeatDays, today): Date | null` を追加（today より厳密に過去で `repeatDays` に含まれる曜日のうち最も近い日付を返す。直近7日のみ走査）
- `isTaskStreakActive` のシグネチャを `(repeatDays, lastAchievedDate, todayStr?)` に変更し、判定を「`lastAchievedDate >= previousScheduledDate(repeatDays, today)`」に置き換え（`repeatDays` が空のとき / `lastAchievedDate` が null のときは false）
- `recordTaskStreak` のシグネチャを `(taskId, childId, questDate, repeatDays)` に変更し、連続加算条件を「`lastAchievedDate === previousScheduledDate(repeatDays, questDate)`」に変更（旧: 暦日上の昨日固定）
- `src/lib/approve.ts` の `QuestWithRelations.template` に `repeatDays: number[]` を追加し、`recordTaskStreak` 呼び出しに渡す
- 親タスク管理画面（`src/app/app/parent/(app)/tasks/page.tsx`）の `isTaskStreakActive` 呼び出しに `task.repeatDays` を渡す

### 理由
- 旧実装は「暦日上の昨日に達成したか」だけで判定していたため、月水金タスク（`repeatDays=[1,3,5]`）では金曜完了 → 土曜時点では active のまま、日曜になるとストリークが切れる扱いになっていた
- 実際の運用では「次の予定日（月曜）を逃すまではストリーク継続」が直感に合う。週末や休曜日を「無視」して、予定日同士の連続性を見るのが正しい
- 例: 月水金で金曜→月曜の連続完了は streak +1、月曜を逃して水曜に達成した場合は 1 にリセット（best は保持）

### やってはいけないこと
- `recordTaskStreak` を `repeatDays` 引数なしで呼ぶ（type error にしてある）
- `isTaskStreakActive(lastAchievedDate, today)` の旧2引数シグネチャで呼ぶ（同上）
- `previousScheduledDate` を別ファイルに重複実装する（`src/lib/date.ts` に集約）

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

## 2026-05-11: 親画面に「子供モード（child-view）」を導入（親が子供端末を持たない家庭向けの代理操作）

### 決定内容
- 親セッションのまま子供の画面を閲覧・操作できる「子供モード」を `/app/parent/child-view/*` 配下に追加
- ルーティング:
  - `/app/parent/child-view`               — 子供セレクター（家族内の CHILD 一覧から選択）
  - `/app/parent/child-view/[childId]/quests`  — クエスト一覧＋代理報告
  - `/app/parent/child-view/[childId]/monster` — 育成（読み取り専用）
  - **`/app/parent/child-view` は親の `(app)` グループの外に置く**（Sidebar / ParentBottomNav の親ナビは表示しない）
- 代理報告の仕様:
  - 親が子供モードからタスクを「報告」した瞬間に **REPORTED を経由せず一気に APPROVED に確定**する
  - `src/lib/approve.ts` の `approveQuestInstance` をそのまま呼ぶ（XP付与・進化チェック・ストリーク更新・バッジチェックが全部走る）
  - `deadlineBonusEarned` は通常の `POST /api/quests/[id]/report` と同じルール（子供の `reportDeadlineTime` と現在時刻で判定）
  - `approvalStamp` は親が選んだスタンプを許可、未指定でも可
  - 子供本人による報告との区別は **付けない**（履歴・掲示板上は通常の達成と同一に扱う）
- API:
  - 新規エンドポイントは `/api/parent/child-view/*` 配下に集約し、すべて **PARENT ロール限定 + `childId` が同一 family の CHILD であることを検証**
  - `GET /api/parent/child-view/children` — 家族内の CHILD 一覧
  - `GET /api/parent/child-view/quests/today?childId=X`
  - `POST /api/parent/child-view/quests/[id]/report-approve` — 代理報告→即承認
  - `GET /api/parent/child-view/monster-status?childId=X`
  - 検証ロジックは `src/lib/parentChildView.ts` の `resolveTargetChild(parent, childId)` に集約（family ownership + role チェック）
- 子供画面で動いていた以下の **副作用は子供モードでは無効化**（親セッションでの誤発火を防ぐため）:
  - `PushSubscriber`（子供の Push 購読が親端末に紐づくのを防ぐ）
  - `LoginStreakChecker`（モード切替だけでログインボーナスが付与されないように）
  - `BadgeUnlockToast`（子供画面以外で解除トーストを出さない）
  - Supabase Realtime 購読（親モードでは onload + 手動リロードのみ）
- BottomNav は **子供モード専用の派生コンポーネント** `ChildViewBottomNav` を新設し、リンク先を `/app/parent/child-view/[childId]/{quests,monster}` に差し替える（既存 `BottomNav` は変更しない）
- 既存子供 API（`/api/quests/today` 等）は **触らない**。親モードはあくまで別エンドポイント経由で参照する

### 理由
- 親端末しか持たない家庭でも、子供のタスク達成体験（XP・進化・バッジ・図鑑）を提供したい
- 既存子供 API のロールチェックを緩めると影響範囲が大きく、テスト負債と回帰リスクを抱える。**並走する別経路を新設**する方が境界が明確
- 親が代理で報告した直後に APPROVED にするのは、「親自身が見届けて報告している」という前提が成立しているため REPORTED→APPROVED の二段階に意味がない（承認待ちが溜まるだけ）
- 子供モードからは Push / LoginStreak / Realtime を一切起動しないことで、「親がモードを切り替えただけで子供向けの副作用が走る」事故を構造的に防ぐ

### やってはいけないこと
- 既存 `/api/quests/[id]/report` を PARENT ロールで受け付けるよう緩和する（**禁止**: 別経路 `/api/parent/child-view/quests/[id]/report-approve` を必ず使う）
- 子供モードページに `PushSubscriber` / `LoginStreakChecker` / `BadgeUnlockToast` / `BulletinLog` などの Realtime 購読を載せる
- `resolveTargetChild` を経由せずに `prisma.user.findUnique({ id: childId })` で直接子供を引いて操作する（family 跨ぎの読み取り事故が起きる）
- 代理報告フローで `approveQuestInstance` を経由せず、直接 `prisma.questInstance.update({ status: "APPROVED" })` を書く（XP付与・進化チェック・バッジチェック・掲示板ログが全部すっぽ抜ける）
- 代理報告に固有の `createdBy` 識別やスタンプ強制（履歴上は通常の達成と同一に扱う方針）

### MVP スコープ外（フェーズ B 以降）
- ~~ひろば（gathering）の子供モード表示~~ → **2026-05-14 にスコープへ取り込み**（下記「追加スコープ」参照）
- 代理スキップ申請（`SKIP_REPORTED → SKIPPED`）— 必要なら同じ「即 SKIPPED」パターンで追加可能だが、初期は対応しない

### 追加スコープ（2026-05-14 改）: ひろば（gathering）を読み取り専用で取り込み
- 子供モードナビに `🏕️ ひろば` タブを追加し、`/app/parent/child-view/[childId]/gathering` を新設
- **新規 API は作らない**。既存の `/api/gathering/current?childId=X` と `/api/gathering/board?childId=X` が既に PARENT ロール + family 検証付きで `?childId=` を受け付けているのでそのまま流用
- ページは既存 `<GatheringMemberList>` / `<GatheringBoard>` を再利用。Realtime 購読も既存のまま許可（read-only 受信のみで子供データを変更しないため、「子供モードでは副作用を起こさない」原則とは抵触しない）
- **エール送信 / グループ参加・脱退の UI は出さない**（子供本人の操作領域）。MVP の「親代理の操作対象は『達成報告のみ』」境界を保つ
- 元の「Realtime / Stamp 配送が絡むため別途」というスコープ外理由は、既存の `/app/parent/gathering`（家族全員から1人を選んで眺める形）が同じ API で既に動いていることが判明したため再評価し、流用に切り替えた

### 追加スコープ（2026-05-14 改 II）: 親代理転生（NORMAL 卵固定）
- `POST /api/parent/child-view/rebirth { childId }` を新設し、親モードから子供の `rebirthPending=true` を解除して転生サイクルを進められるようにする
- **使う卵は常に NORMAL（`rebirthEggBonus=null`）固定** — 親代理転生では卵選択 UI を出さない
- 理由:
  - 子供端末を持たない家庭では、stage3 で `rebirthPending=true` のまま親代理操作だけが続くと **以降のクエスト承認で進化チェックがスキップされ XP は加点される一方で進化が止まる**。親モード単体で 1 サイクルを完結できなくなるため、転生も代理可能にする必要がある
  - 一方で卵選択（勉強/体力/生活）の確率ボーナスは「子供が次サイクルで何になりたいか考える」体験（2026-04-04）。親が代わりに選ぶと子供の創造的判断を奪う構造になるため、**親代理は中立な NORMAL 卵で済ませる**（ボーナスを使い切りたい子供は自分で操作）
  - 既存 `/api/rebirth` は CHILD ロール限定なので拡張せず、子供モード経路 `/api/parent/child-view/*` に並走させる（child-view 設計の境界を維持）
- `usedEggBonuses` は **更新しない**（NORMAL 卵は使用済み記録の対象外）

### UI 微調整（2026-05-14）: 「親画面へ戻る」を下部ナビに集約
- 旧: 子供モードの上部バナーに「管理画面へ戻る」リンク
- 新: 下部ナビ `ChildViewBottomNav` に `🚪 親画面`（→ `/app/parent/tasks`）タブを追加し、上部バナーからリンクを撤去
- 理由: 戻るアクションは「クエスト / 育成 / ひろば」と並列の主導線。上部バナーから探す動線より下部ナビにまとめた方が指で到達しやすく、親モード中であることを示すバナー本来の役割（状態提示）に集中させられる

### 広場（BulletinLog）への書き込み — 親代理報告も子供本人と同等に発火する
- `MONSTER_EVOLVED` / `BADGE_UNLOCKED` / `STREAK_TITLE` は `approveQuestInstance` および `recordDailyAchievement` 経由で自動的に発火する（既存ロジックそのまま流用）
- `TASK_STARTED` / `TASK_PROGRESS_25/50/75` / `TASK_COMPLETE` は通常 `/api/quests/[id]/report` が発火するが、親代理経路では別ルートを通るため `report-approve` 内で **明示的に `after(() => triggerTaskProgressLog(child.id))` を呼ぶ**
- 趣旨: 広場（ひろば）は「子供の達成記録」であり、誰が代理で報告したかは関係ない。代理報告で進捗マイルストーンが落ちると「ひろばに反映されないルート」が生まれて社会的フィードバックが歪むため、子供本人の報告と同じ書き込みを必ず通す

## 2026-05-11: クエストタイム自動通知（JST 17:00 / 進捗連動メッセージ）の導入

### 決定内容
- 毎日 JST 17:00（UTC 08:00）に Vercel cron `/api/cron/quest-time-notify` を起動し、当日クエスト未完了の子供に Push を送る
- `User.questTimeNotifyEnabled Boolean @default(true)` を追加。親が「ファミリー管理」画面で子供ごとに ON/OFF できる安全弁とし、OFF の子は cron 対象から除外
- 進捗バケットは純粋関数 `getQuestTimeProgressBucket(done, total)` で算出: `NOT_STARTED`（0%）/ `EARLY`（1〜79%）/ `ALMOST`（80〜99%）/ `DONE`（100% または対象クエスト0件）
- メッセージプールは `src/lib/notifyMessages.ts` の `QUEST_TIME_MESSAGES` に NOT_STARTED / EARLY / ALMOST × 各3件以上を定義し、`buildQuestTimeNotification` がバケットに応じてランダム選択
- `DONE` の子（全完了済み・タスク0件）は Push を送らずスキップ（追い詰めない）
- 完了系の判定は既存の `computeCompletedCount`（REPORTED + APPROVED + SKIP_REPORTED + SKIPPED）と共通化し、進捗マイルストーンと食い違いが出ないようにする
- 親リマインド（`/api/push/notify-child`、2026-03-18 決定）はそのまま残し、本機能はそれを補完する自動トリガー（フェーズB の本実装）

### 既存方針との関係
- 2026-03-18「**自動タイムトリガー**: 夕方〇時になっても未完了タスクがある場合、親の操作なしに子供へ自動通知。Supabase Edge Functions または外部 Cron で実装予定（フェーズB以降）」を実装したもの
- cron は既存 `/api/cron/auto-approve` と同じ Vercel cron + `CRON_SECRET` パターンに揃え、Supabase Edge Functions は導入しない（運用・監視を1箇所に集約するため）
- 「冷たい定型文（『わかりました。』『あと少しですね』）禁止」をテストで担保し、子供向けトーン（「一緒にやろう」）を維持

### やってはいけないこと
- 通知文にタスク名や具体的なクエスト内容を入れる（プライバシー）。メッセージは進捗バケットに対する抽象的な励まし表現のみ
- `questTimeNotifyEnabled=false` の子に「うっかり」送らない（cron 対象を `where` 句で除外。アプリ内の他 Push 経路も同フラグを尊重したくなったら都度判断）
- 100%完了の子・対象クエスト0件の子に通知を送る（DONE 扱いで必ずスキップ）
- 深夜・早朝に走らせる（cron は JST 17:00 固定。範囲を変える場合は decisions.md を更新すること）

## 2026-05-22: 子供モードの「子供セレクター画面」のフッターを親フッター（ParentBottomNav）に統一

### 決定内容
- `/app/parent/child-view`（子供セレクター画面）のフッターを `ParentBottomNav` に統一する（タスク/承認/子供モード/完了/履歴/ひろば/家族 + ログアウト）
- 当初は単一の「親画面」戻りリンクのみの小フッターだったが、本決定で **親画面と同一の ParentBottomNav** に置き換える
- 一方、`/app/parent/child-view/[childId]/*`（クエスト/育成/ひろば）は引き続き `ChildViewBottomNav`（子供モード専用ナビ）を表示する — こちらは変更しない

### 理由
- セレクター画面は「子供を選ぶ＝まだ代理操作に入っていない親の管理画面の延長」と位置づけられる。親の主要導線（タスク/承認/完了/履歴/ひろば/家族）に戻りやすい方が親の運用負荷が小さい
- 2026-05-11 の方針「`/app/parent/child-view` 配下では親ナビを表示しない」は子供モード全体に一括適用していたが、**「子供を選ぶ前」と「子供として操作中」では認知モードが異なる**ため、セレクター画面だけ親ナビに戻す方が UX 上自然
- `ParentBottomNav` 内蔵の `PushSubscriber` は **親自身**の Push 購読であり、2026-05-11 で警戒した「子供の Push 購読が親端末に紐づく」事故は構造的に起こらない

### やってはいけないこと
- `[childId]/*` 配下に `ParentBottomNav` を載せる（`ChildViewBottomNav` と二重表示になる／代理操作中の認知モードと噛み合わない）
- セレクター画面に `ChildViewBottomNav` を併置する（`ChildViewBottomNav` は `childId` 前提）

## 2026-05-26: 親画面の carryOver 放置バッジを「N日間未完了」→「N回未完了」（出現回数ベース）に変更

### 決定内容
- `/api/tasks` GET の `oldestCarryOverPendingDate: Date|null` を **`carryOverMissedCount: number|null`** に置き換え
- 新フィールドは「最古の PENDING 日付から today までの inclusive 範囲で `repeatDays` に当たる出現回数」。pure 関数 `countScheduledOccurrences(from, to, repeatDays)` を `src/lib/date.ts` に追加して計算
- 親画面の `formatPendingCarryBadge` は `${N}回未完了` を返すよう変更（旧: `${N}日間未完了`／`昨日から未完了`）

### 理由
- 旧仕様では **週1タスクを1回落としただけで7日後に「7日間未完了」と表示される** 過剰反応があり、「タスクの粒度に対して何回放置したか」という感覚に合わなかった
- 2026-05-09 改で子供画面の「今日やる宣言」アイドル判定を **「直近 N 出現の連続非 APPROVED 数」** に揃えたのと同じ趣旨を、親画面のバッジ表示にも適用する
- carryOver タスクは仕様上「PENDING インスタンスが日をまたいで増殖しない」ため、出現回数は instance の数では数えられず、`repeatDays` を踏まえた暦範囲の走査で算出する必要がある
- isTemporary など `repeatDays` が空のタスクで stale PENDING がある場合は 1 にフォールバック（一度しか出現しないタスクなので）

### やってはいけないこと
- 旧フィールド `oldestCarryOverPendingDate` を後方互換のため復活させる（型変更なので新フィールド名のみを参照する）

## 2026-05-28: ごほうび（宝箱）システムの導入

### 決定内容
- ゲーム内報酬（XP・進化・バッジ）に加え、親が用意した「現実のごほうび」を確率抽選で結びつける宝箱機構を追加
- 詳細仕様は `docs/reword-system-design.md` を正本とする（DB スキーマ、状態遷移、抽選アルゴリズム、UI 構成）
- **既存の XP→進化ループを壊さない方針**: 宝箱は XP を消費しない／通貨も増やさない／写真ボーナス・期限ボーナス・進化確率には一切触らない
- 純粋関数 `src/lib/treasure.ts`（`drawTreasure`）と DB 操作 `src/lib/treasureService.ts`（生成・アンロック・キャンセル・開封）を 1 ファイル 1 責務で分離。テストは `treasure.test.ts` と `treasureService.test.ts` で完結
- 既存承認パス（`src/lib/approve.ts`）の最後に `unlockTreasuresOnApprove` を呼ぶだけで統合。`approveQuestInstance` と `approveSkipQuestInstance` の両方から呼ぶ（スキップ承認も親の意思表示として LOCKED→UNLOCKED の契機にする）
- 報告（`/api/quests/[id]/report`）・スキップ申請（`/api/quests/[id]/skip`）両方から宝箱生成を呼ぶ。`computeCompletedCount`（REPORTED+APPROVED+SKIP_REPORTED+SKIPPED）に揃え、進捗バケットと食い違わせない
- 差し戻し（`/api/approve/[id]` action=reject）後は同日進捗を再計算し、minTasks を割ったら LOCKED 全部 CANCELLED、minTasks は満たすが全完了でなくなったら ALL_COMPLETE のみ CANCELLED
- 自動承認 cron は `(childId, date)` で集約して 1 件のみ AUTO 宝箱を即 UNLOCKED で生成（仕様 3 章 / 4 章）
- 親代理経路（child-view からの報告 / 承認）は **宝箱対象外**: `isProxy=true` を渡して `generateTreasuresOnReport` を no-op にする。子供の自発的動機を阻害しないため

### やってはいけないこと
- 報告 API でカウントを `computeCompletedCount` 以外の集計関数で出す（進捗バケット・ストリーク・宝箱トリガーが食い違うと UX が崩れる）
- `approveQuestInstance` 内に宝箱生成ロジックを書く（生成は報告経路・自動承認 cron のみ。承認は LOCKED→UNLOCKED の遷移しか持たない）
- アイテム DELETE で物理削除する（`TreasureLog.itemId` FK が SET NULL で過去履歴の参照が失われる）。`isActive=false` のソフトデリート方針を維持
- 親代理経路で宝箱を生成する（`isProxy=true` 必須）

### 補足
- レア度・確率・天井閾値などのチューニングパラメータは `src/lib/treasure.ts` の定数（`RARITY_BASE_PROBABILITY`, `RARITY_BOOSTED_MULTIPLIER`, `PITY_THRESHOLD`）に集約。テストもこれらを使うので変更したら一箇所で完結する
- 「おすすめセット」のテンプレ20件は `src/lib/treasureTemplates.ts` に定義（純粋データ）。初期投入用 API `/api/treasures/import` でまとめて createMany する
- 子供画面の `getMissedExposureCount`（`src/lib/declaration.ts`）と統合する（あちらは個別 `QuestInstance` 履歴を見るロジック、こちらはテンプレートの `repeatDays` から算出するロジックで責務が違う）

## 2026-05-28: 親が宝箱プール未設定のときは宝箱を生成しない

### 決定内容
- `generateTreasuresOnReport` と `generateAutoApproveTreasure` の冒頭で `prisma.treasureItem.count({ where: { childId, isActive: true } })` を確認し、0 件なら早期 return（LOCKED / AUTO どちらも作らない）
- 結果として子供画面の `TreasureStock` は `locked=0 && unlocked=0` の分岐で何も表示されない → 親が設定するまで宝箱 UI 自体が存在しないクリーン状態に

### 理由
- 設計書セクション 18 で「宝箱プールが空のとき（全てハズレ演出になる。親に案内を出すか）」が未決事項として残っていた
- 旧挙動だと、親が一度も設定しない場合に子供が「あける」ボタンを連打しても**全部ハズレ演出**になり、子供は「何これ壊れてる？」、親は設定を促す合図もない、という二重に悪い UX に陥る
- 「ハズレ演出」は本来 *たまに出る* ものとして設計されている（モンスターのリアクションでネガティブ感を相殺する目的）。100% ハズレで連打されると演出が逆効果になる
- 「設定されていない＝そもそも宝箱機能が動いていない」と暗黙に伝えるほうが、初期セットアップ前の状態として自然
- 既に UNLOCKED 状態で残っている宝箱は引き続き開封可能（過去に設定→クリアの順だった場合の救済）。あくまで **新規生成のみ** をプール存在に依存させる

### やってはいけないこと
- プール空チェックを `openOldestTreasure` 側でも追加して既存 UNLOCKED の開封を塞ぐ（救済路線を壊す。過去ぶんは演出のみで完了させる方が自然）
- 親が後からプールをクリアした場合に既存 LOCKED を強制 CANCELLED する処理を入れる（差し戻し時の CANCEL とロジックが重なって状態遷移が複雑化する。手動で履歴クリアしたい場合は別途 admin 操作に切り出す）

## 2026-05-28: 「渡したよ」フロー廃止 + 子の「ごほうび履歴」を実績ページに統合

### 決定内容
- **A**: 子供画面のごほうび履歴の表示場所は **実績ページ（`/app/child/badges`）にタブ追加**。「🏅 実績 / 🎁 ごほうび」のトップタブで切替。`TreasureHistoryList` コンポーネントを `src/components/child/` に切り出し
- **B**: 親が「渡したよ」を確定する操作は廃止。`/api/treasures/fulfill/[id]` ルートと `TreasureLog.fulfilled` カラムを削除（マイグレーション `20260528000001_drop_treasure_log_fulfilled`）。`/api/treasures/pending` は「もらったごほうび履歴」として残し、`fulfilled` フィルタを外して `openedAt desc / take: 100` に
- 親ページ `/app/parent/treasures/pending` はタイトルを「もらったごほうび」に変更し、「渡したよ」ボタン削除

### 理由
- **A**: モンスターページに入れるとパラメータ系統と混線、独立タブはボトムナビが既に過密。「実績＝集めたもの一覧」というユーザー認知に対し、バッジもごほうびも「集めたもの」で同居が自然。実装的にも `/api/treasures/status` が既存
- **B**: 「渡したよ」を機能として持つと、親は確定ボタンを押すだけの作業になり、ごほうびが事務化する。**実際の受け渡しは親子のリアルなコミュニケーションに任せる**方が本来の目的（親子の関わりを増やす）に沿う。親は履歴で「いつ何をもらったか」を把握できれば十分

### 同時に決定（チューニング値）
- **C**: ストック上限は設けない（表示時に 99+ にクランプする予定はあるが、内部は無制限）
- **D**: 天井（pity）回数は 5 のまま運用開始。実データを見てから調整
- **E**: 重複アイテム制御は入れない（独立抽選のまま）。小規模プールで除外を入れると体感が悪化するため
- **F**: ハズレ演出メッセージはコード内定数（`TreasureOpenCutscene.tsx` の `MISS_MESSAGES`）。DB 化は親が編集する明確なニーズが見えてから

### やってはいけないこと
- 「渡したよ」を復活させる際に `fulfilled` カラムを再追加してマイグレーションを巻き戻す（履歴データが既に投入されていたら状態遷移が壊れる。復活させるなら別フィールド名で）
- 「ごほうび」タブを **独立ナビタブ** として追加する（ボトムナビの枠が逼迫しているため。実績ページのタブ切替に統合する設計を維持）
- ごほうび履歴 API を別途新設する（`/api/treasures/status` の `opened` を流用。重複 API は作らない）

## 2026-05-29: 宝箱抽選を「レア度ごと独立抽選 + プールから均等選択」に変更

### 決定内容
- `drawTreasure` の抽選を **「各アイテムを独立に rng() < prob で判定」から「各レア度ごとに 1 回だけ rng() < prob を判定し、当たったレア度のプール内アイテムから均等に 1 個選ぶ」** に変更
- 当たりレア度のアイテムがプールに無ければ次に低い当たりレア度に降格、いずれも無ければハズレ
- 確率値（COMMON 1/7, UNCOMMON 1/14, RARE 1/28、boosted 時 2 倍）と天井（pityCount ≥ 5）の挙動は据え置き

### 理由
- 旧実装は **プールサイズに比例して当たり率が跳ね上がる**（COMMON が 10 個あれば「少なくとも 1 個当たる確率」は 1 - (6/7)^10 ≈ 79%）。「1/7 ≈ 14%」と説明している UI/設計書と挙動が乖離し、「ほぼ毎回当たる」状態になっていた
- 親がプールに大量のアイテムを設定したくなる UX を、間欠強化が壊れない形でサポートするため、確率の主軸を **レア度 × プール存在チェック** に切り替える
- 同レア度内のアイテム選択は均等抽選で「どれが出るか」のサプライズを残す（設計目的: 間欠強化 / Variable Ratio）

### やってはいけないこと
- 確率を「アイテム個別 × 独立判定」に戻す（プールサイズで当たり率が増える挙動はバグとして撤去済み）
- 当たりレア度がプールに無いときに、それより上のレア度に「自動昇格」させる（レア度の意味が崩れる。降格のみ許可）

## 2026-05-29: 宝箱履歴の子画面表示は直近1週間に制限 / 開封時刻も併記

### 決定内容
- 子画面のごほうび履歴（`/app/child/badges` → 「ごほうび」タブ）は **直近 7日（`TREASURE_HISTORY_RETENTION_DAYS`）以内に開封した宝箱のみ** を表示する
- フィルタは API 層 (`/api/treasures/status`) で `where.openedAt: { gte: cutoff }` で行う（クライアントに古いレコードを送らない）
- 履歴の各行に **JST 「M/D H:mm」 の開封時刻** を表示する（日付だけだと「今日何回あけたか」が分からなかった）
- 純粋関数は `src/lib/treasureHistory.ts`（`getTreasureHistoryCutoff` / `isWithinTreasureHistoryWindow` / `formatTreasureOpenedAt`）に集約し、子・親両画面で共用

### 理由
- 「過去にもらったごほうび」を毎日眺める使い方ではなく、**直近の達成感を見せる** ことが本来の目的。古い履歴が積もると新鮮味が薄れる
- 親画面（`/app/parent/treasures/pending`）は履歴用途が中心なので 1週間制限は掛けない（既存の 100件・`openedAt desc` を維持）
- DB レコード自体は残す（将来の集計・分析に使えるかも知れない）。**表示だけ** を絞る

### やってはいけないこと
- 親画面 (`/api/treasures/pending`) に同じ 7日制限を入れる（履歴トラッキング用途を壊す）
- DB の `TreasureLog` を物理削除して履歴を縮める（集計・問い合わせの根拠が消える）

## 2026-05-29: 親「ごほうび」ナビにトップタブを追加（設定 / もらった履歴）

### 決定内容
- 親画面 `/app/parent/treasures` （プール設定）と `/app/parent/treasures/pending` （受領履歴）の上部に共通の **トップタブ** (`ParentTreasureTabs`) を追加
- サイドバー・ボトムナビは `/app/parent/treasures` の 1エントリのみのまま（ナビ枠を増やさない）

### 理由
- 履歴ページが Push 通知のリンク先としてしか到達できず、「子供が宝箱から何を引いたか」を能動的に確認する導線が無かった
- 子供画面の実績ページ（`🏅 実績 / 🎁 ごほうび`）と同じトップタブ パターンに揃えることで、親子で UI 概念が一致する
- サイドバー・ボトムナビに項目を増やすと枠が逼迫する（過去決定 2026-05-28 B 参照）

### やってはいけないこと
- サイドバー・ボトムナビに「もらった履歴」を独立エントリとして追加する（枠逼迫の方針に反する）

## 2026-05-30: 子画面トンマナ規約 (`docs/design-tone-and-manner.md`) を採用 / 第一弾は宝箱・ひろば

### 決定内容
- 子画面（および親側の関連画面）の UI は `docs/design-tone-and-manner.md` を**正本**とする
- 第一弾として **同仕様書セクション 6 の指摘箇所**（宝箱周りのライトカラー / disabled / `rounded-full` / `text-white` / ひろばのエラー文言）を修正
- 宝箱レア度ラベル＆バッジクラスは 4ファイル（子・親 双方）で重複していたため `src/lib/treasureRarity.ts` に集約し、**禁止クラスの混入をユニットテストで防止**

### 採用したダーク向け配色（レア度バッジ）
- COMMON: `bg-blue-500/10 text-blue-300 border border-blue-500/40`
- UNCOMMON: `bg-purple-500/10 text-purple-300 border border-purple-500/40`
- RARE: `bg-quest-gold/15 text-quest-gold border border-quest-gold/50`

### 理由
- `bg-*-100` 等のライトカラーは `quest-bg` (#07080f) のダーク背景上で浮き、世界観を壊していた
- レア度カラーを 4ファイルに散らすと「1ヶ所直しても他で再発」が起きるため、定数化＋禁止クラステストで**規約違反をリポジトリ全体から構造的に排除**する
- ひろば等のエラー文言が「〜してください」調だったため、子向けトーンに揃えた（仕様書 セクション 4）

### やってはいけないこと
- レア度バッジ用クラスを各ファイルに直書きで戻す（中央定数 `RARITY_BADGE_CLASS` を使う）
- `bg-*-100` / `bg-*-200` / `bg-gray-300` 等ライトカラーを子・親画面の塗りに使う（ボーダー単独の `border-*-300` も避ける）
- 主要アクションボタンに `text-white` を当てる（`bg-quest-gold` 上は `text-quest-bg` で十分なコントラストが取れる）

### 残課題（別タスクで対応）
- `text-white` の網羅修正（バッジ・カットイン演出など、本コミットでは触っていない箇所がある）
- ボタン padding `py-2.5 px-5` への全体統一
- 他ページのライトカラー監査（仕様書「各所」）

## 2026-05-30: 子フッター再設計 — コレクションは「図鑑+実績」で先行実装

### 決定内容
- 子 BottomNav を 5タブ + ログアウトの構成に整理
  - クエスト / 育成 / 宝箱 / ひろば / **🏆 コレクション** + 🚪 ログアウト
- 新規 `/app/child/collection` ページ: **「📖 図鑑」「🏅 実績」の2タブ**
- 旧 `/app/child/zukan` `/app/child/badges` は **残置**（リダイレクトせず）
- 図鑑本体 → `src/components/child/ZukanContent.tsx` に抽出
- 実績本体 → `src/components/child/BadgesContent.tsx` に抽出（旧ページのサブタブ「実績/ごほうび」は維持）
- BottomNav の旧「図鑑」「実績」バッジを **コレクションタブの 1バッジに OR 合成**
- `/app/child/collection` 訪問時にも `lastSeenBadgeUnlockedCount` 等を既読化

### 仕様書からの逸脱と理由
- **コレクション = 図鑑 + 実績**（仕様書原案は「図鑑 + 宝箱アイテム」）
  - `treasure-collection-items` spec が未実装なため、アイテムタブを今出してもスタブにしかならない
  - 一方、バッジ廃止 spec も未確定なので「実績」コンテンツの新しい行き場が必要だった
  - 2タブ構成で「コレクション = 集めたもの」というユーザー認知に整合
  - 後続 (`treasure-collection-items` 実装後) で「アイテム」タブを追加するだけで仕様書原案の形に戻せる
- **ログアウトは BottomNav に残置**（仕様書原案は「別の場所に移動」）
  - 子向けに「設定画面 or プロフィール」相当のページがまだ無く、新規ページを作るほどの設定項目もない
  - 親側は family ページに集約済みだが、子に対応するページが無いため判断保留
  - 5タブ + ログアウト = 6項目で当面の認知負荷は許容範囲

### やってはいけないこと
- `/app/child/zukan` `/app/child/badges` を即時 redirect / 削除する（外部リンクや既存通知のリンク先を壊す。badge-deprecation spec で計画的に処理する）
- BottomNav に「コレクション」を 6タブ目として追加するときに既存タブを残す（タブ過密の方針に反する。図鑑・実績の独立タブは必ず外す）
- BadgesContent の中に「ごほうび履歴」タブを混ぜる（旧ページ側のサブタブ責務であり、コレクションページ側には不要）

## 2026-05-30: 親モード（child-view）に「宝箱」「コレクション」を追加 / 親代理で開封も可能

### 決定内容
- `ChildViewBottomNav` を 3タブ（クエスト/育成/ひろば）から 5タブ（**+宝箱 +コレクション**）に拡張
  - 🎁 宝箱 → `/app/parent/child-view/[childId]/treasures`
  - 🏆 コレクション → `/app/parent/child-view/[childId]/collection`（📖 図鑑 / 🏅 実績 の 2タブ。子画面と同じ構成）
- 子画面コンポーネント `ZukanContent` `BadgesContent` に `fetchUrl` / `trackVisit` / `enableRealtime` props を追加し、親モードからは下記オプションで再利用:
  - `fetchUrl` → child-view 経路（`/api/parent/child-view/{monster,badges}?childId=X`）
  - `trackVisit=false` → 親モードでは `lastSeenCollectedCount` / `lastSeenBadgeUnlockedCount` を更新しない（**親端末の localStorage が子供画面 BottomNav のバッジ既読化に影響しないように**）
  - `enableRealtime=false` → 親モードでは Supabase Realtime 購読を張らない（2026-05-11 の方針：子供モードでは副作用を起こさない）
- 親代理経路の宝箱 API を 4本新設（既存 CHILD 専用 API は触らない）:
  - `GET /api/parent/child-view/treasures/status?childId=X` — `/api/treasures/status` の親代理版
  - `POST /api/parent/child-view/treasures/open` (body `{ childId }`) — `/api/treasures/open` の親代理版。当たり時の **親への Push は送らない**（親自身の操作なので二重通知になる）
  - `GET /api/parent/child-view/badges?childId=X` — `/api/badges` の親代理版（`checkAndUnlockBadges` も親代理で実行）
  - `GET /api/parent/child-view/monster?childId=X` — `/api/monster` の親代理版（図鑑描画用に `collectedPaths` `monsterLevels` `usedEggBonuses` を返す）
- 宝箱履歴の **7日制限** は親モードでも維持（親 child-view は子画面の延長という認知）。親画面 `/app/parent/treasures/pending` の「履歴トラッキング100件」とは別物
- 親モードでも開封演出は `TreasureOpenCutscene` を再利用。`treasure-changed` カスタムイベントは発火しない（子供 BottomNav バッジは子供端末で管理）

### 理由
- 2026-05-11 「親端末しか持たない家庭でも、子供のタスク達成体験（XP・進化・バッジ・図鑑）を提供したい」の自然な拡張
  - これまで親モードに無かった「宝箱を開ける」と「図鑑/実績を眺める」を追加することで、子供端末ゼロの家庭でも 1サイクルが完結する
- 当初は「閲覧のみ・開封不可」案も検討したが、**開封できないと親代理経路では宝箱が永久に UNLOCKED で溜まり続ける**（生成は 2026-05-28 で `isProxy=true` no-op だが、子供本人の報告で生成されたものは閉じたまま）。子供端末がない家庭では開けようがないため、**開封も親代理で可能にする** に倒した
- 2026-05-28「親代理経路（child-view からの報告/承認）は宝箱対象外」は **生成** の話。開封は別物として扱う（生成は「子供が何かを達成した瞬間の動機付け」、開封は「すでに獲得した宝の楽しみ方」で性質が異なる）
- 親自身への Push 通知を切るのは、親が自分の操作結果を自分宛に通知すると `/app/parent/treasures/pending` への誘導が冗長になるため
- `enableRealtime=false` / `trackVisit=false` は 2026-05-11 で確立した「子供モードでは副作用を起こさない」原則の継続適用

### やってはいけないこと
- 既存 `/api/treasures/status` `/api/treasures/open` `/api/badges` `/api/monster` を PARENT ロールで受け付けるよう緩和する（**禁止**: child-view 経路 `/api/parent/child-view/*` を必ず使う。境界を維持する）
- 親代理開封経路 (`/api/parent/child-view/treasures/open`) で親に Push を送る（二重通知になる）
- ZukanContent / BadgesContent から `fetchUrl` 等の新 props を取り去って親側を独立 page にコピペ実装する（既に親モード対応の責務をコンポーネント側に閉じ込めてある。子画面と同じ UI を二箇所で保守したくない）
- 親モードで `lastSeenCollectedCount` / `lastSeenBadgeUnlockedCount` / `treasure-changed` イベントなど **子供 BottomNav 用の既読フラグ** を更新する（親端末の localStorage が子供画面のバッジ表示に干渉する）
- 親モードで Supabase Realtime を購読する（2026-05-11 で警戒した子供向け副作用の親端末発火事故が起こる）

## 2026-05-30: 親フッター再整理 — 「完了 + 履歴」を「📊 記録」タブに統合

### 決定内容
- 親 BottomNav / Sidebar から「🏆 完了」「📅 履歴」の独立タブを外し、**「📊 記録」1タブ**に集約
- 新規 `/app/parent/records` ページ: **「🏆 今日」「📅 過去」の2タブ**
- 旧 `/app/parent/completed` `/app/parent/history` は **残置**（リダイレクトせず）
- 完了タスク本体 → `src/components/parent/CompletedContent.tsx` に抽出
- 履歴本体 → `src/components/parent/HistoryContent.tsx` に抽出
- 旧ページは抽出済みコンポーネントを呼ぶだけの薄ラッパに

### 理由
- 親 BottomNav が 8タブ + PushSubscriber で過密化しており、2026-05-30 子フッター再設計と同じ「タブ過密回避」の方針を適用
- 「今日の完了」と「過去の記録」は **同じ振り返り軸**（やったことを見る）で認知統合しやすい
- 子の `/app/child/collection` と同じ「2サブタブで統合」パターンを踏襲することで実装・UX に一貫性
- PushSubscriber は **意図的にフッターに残置**: 購読オフのユーザに最も目立つ位置で通知許可を促し続けたい（設定画面に隠さない）

### やってはいけないこと
- `/app/parent/completed` `/app/parent/history` を即時 redirect / 削除する（外部リンクやブックマークを壊す）
- ParentBottomNav / Sidebar に「完了」「履歴」を独立タブとして復活させる（タブ過密の方針に反する）
- PushSubscriber をフッターから外して「ファミリー」ページ等の奥に移動する（通知許可率が落ちる）


## 2026-05-30: 親代理 report-approve でも宝箱を生成する（即 UNLOCKED / AUTO trigger）

### 決定内容
- 2026-05-28 の「親代理経路（child-view からの報告 / 承認）は宝箱対象外」方針を **部分的に覆し**、`/api/parent/child-view/quests/[id]/report-approve` で APPROVED 確定後に **`generateAutoApproveTreasure` を呼ぶ** ように変更
- 仕様は auto-approve cron と完全に揃える:
  - `trigger="AUTO"`・`status="UNLOCKED"`（即開封可能 / 親自身が開封 API で開けられる）
  - 同日に 1個のみ（既に AUTO があれば作らない冪等性は `generateAutoApproveTreasure` 側に内蔵）
  - 親プールが空なら作らない / `reportedCount >= minTasks` を満たさなければ作らない
- 計算は `computeCompletedCount` で報告APIと同じ集計に統一（REPORTED + APPROVED + SKIP_REPORTED + SKIPPED）
- 子供本人セルフ報告経路の `generateTreasuresOnReport`（STREAK / ALL_COMPLETE で LOCKED 生成）は **触らない**。子供セルフ体験は LOCKED→承認待ち→UNLOCKED→開封の段階的演出を維持する

### 理由
- MVP ヒアリングで「親端末しか持たない家庭で子供モードを使わせるとき、『あと一個で宝箱出るよ！』という声かけのコミュニケーション・モチベーションが欲しい」という意見が複数上がった
- 2026-05-30（同日）で「親モードでも宝箱を開封できる」を追加したが、**生成側が止まっていると親代理経路では永久に開けるものが現れない**矛盾が残っていた（子供本人の報告で生まれた LOCKED は別経路で承認されないと UNLOCKED にならない / cron は当日終わりまで走らない）
- `trigger="AUTO"` を再利用するのが最小コスト:
  - cron との競合は `findFirst({ trigger: "AUTO" })` で既に防がれている（先に親が出していたら cron は出さない / 逆も同様）
  - 1日1個・即 UNLOCKED の体験仕様は auto-approve と同等で説明コストが低い
- 2026-05-28 の「子供の自発的動機を阻害しない」原則は、**子供端末がある家庭で親が代理ショートカットしないため**の境界。**親端末しかない家庭ではそもそも『子供の自発的動機を阻害する余地が存在しない』** ため、原則の対象外と判断
- LOCKED にしてしまうと「親が報告 → 親が承認 → でも UNLOCKED にならない（同セッション内で二段階を踏まない）」のような分岐になるか、`unlockTreasuresOnApprove` のシーケンスを書き換える必要があり、シンプルさを失う

### やってはいけないこと
- 親代理経路で `generateTreasuresOnReport`（LOCKED 生成）を呼ぶ。LOCKED は「子供セルフ報告 → 親承認待ち」の段階的演出専用。親代理経路は即 UNLOCKED 一本に統一する
- 新しい trigger 値（例: "PROXY"）を作る。`trigger="AUTO"` を共有することで cron との冪等性が成り立つ。トリガーを分けると同日に 2個出る穴ができる
- minTasks 判定を route 層でスキップして常に `generateAutoApproveTreasure` を呼ぶ。関数内部でも判定はされるが、route 層で早期 return することで「あと N 個で宝箱」状態を把握しやすくする / DB ラウンドトリップを節約する
- 親代理開封経路 (`/api/parent/child-view/treasures/open`) で親に Push を送る（2026-05-30 既決定の通り。生成と開封が同一セッション内で完結するため二重通知になる）

### 該当箇所
- `src/app/api/parent/child-view/quests/[id]/report-approve/route.ts` — `approveQuestInstance` 直後に `generateAutoApproveTreasure` を呼ぶ
- 集計は `computeCompletedCount` を共有（`src/lib/questProgress.ts`）。cron と同じセマンティクス

## 2026-05-30: 宝箱抽選を「レア度ごと独立抽選」から「排他的単発抽選」に変更

### 決定内容
- `drawTreasure` を **「rng を 1 回だけ消費して RARE / UNCOMMON / COMMON / MISS を排他選択」** に変更（2026-05-29 の「レア度ごと独立 3 回抽選」を撤廃）
  - u in [0, 1/28) → RARE
  - u in [1/28, 1/28 + 1/14) → UNCOMMON
  - u in [1/28 + 1/14, 1/4) → COMMON
  - u in [1/4, 1) → MISS
- 個別レート（1/7, 1/14, 1/28）は据え置き。**実出力レートとして保証**:
  - 28 回引けば期待値 COMMON 4 / UNCOMMON 2 / RARE 1 / MISS 21
  - 合計 hit 率 = 1/7 + 1/14 + 1/28 = 7/28 = **25%**（旧 23.25% と僅差だが、個別レートが名目値と一致する）
- boosted は各レア度幅を 1.5 倍（合計 hit 率 25% → 37.5%）
- 当選レア度がプールに無い場合の **降格ルール / 昇格禁止 は据え置き**（2026-05-29 のまま）
- 天井（pity）の挙動も据え置き

### 理由
- 旧「独立 3 回抽選」では UI/設計書で「COMMON = 1/7 = 14.3%」と書きつつ、実出力の COMMON 採用率は ~12.8%（UNCOMMON/RARE に負ける分が引かれる）と乖離していた
- ユーザ要望: 「28 回引いたら COMMON 4 / UNCOMMON 2 / RARE 1 ぐらいの比率で出てほしい」
  - これは「個別レート = 実出力」が成立する排他選択モデルでないと達成できない
  - 独立抽選では UNCOMMON 採用率 = (1/14)(1 - 1/28) で必ず名目値より低くなる構造的欠陥
- 排他選択にすることで、説明（「COMMON は 1/7」）と実挙動が一致する。MVP ヒアリングで親に「どれぐらいで出ますか？」と聞かれた時に名目値で答えればよくなる
- 旧仕様の「複数ヒット時は最高レアを採用」はそもそも排他選択では発生しないので消える

### やってはいけないこと
- 「独立抽選」に戻す（個別レート名目値と実出力が乖離する）
- 当選レア度のアイテムがプールに無いとき、より高いレア度に「自動昇格」する（2026-05-29 既決定。レア度の意味が崩れる）
- rng 消費順を変える（テストが seq() で順序前提のため。`1 回目 = rarity 判定 / 2 回目 = tier 内アイテム選択 or 天井ピック`）

### 該当箇所
- `src/lib/treasure.ts` — `drawTreasure`
- `src/__tests__/lib/treasure.test.ts` — 5000 試行の統計テストで 3σ 範囲内を保証

## 2026-05-31: auto-approve cron は AUTO 宝箱を生成しない（2026-05-28 を部分撤回）

### 決定内容
- `/api/cron/auto-approve` から `generateAutoApproveTreasure` の呼び出しを削除する
- レスポンスからも `autoTreasures` フィールドを廃止する
- `trigger="AUTO"` 自体は **親代理 report-approve (`/api/parent/child-view/quests/[id]/report-approve`) 専用** として存続させる

### 理由
- cron が拾うのは status が REPORTED / SKIP_REPORTED のクエストで、これらは子セルフ報告経路 (`/api/quests/[id]/report` または `/api/quests/[id]/skip`) を通っているため **同日に STREAK / ALL_COMPLETE が LOCKED で必ず立っている**
- `approveQuestInstance` 内の `unlockTreasuresOnApprove` がそれらを UNLOCKED に切り替えるので、cron が追加で AUTO を作ると **同日 3 個** になる（STREAK + ALL_COMPLETE + AUTO）。**親が承認しなかった日のほうが、親が承認した日より宝箱が多くなる** という放置インセンティブが生まれていた
- cron の AUTO は当初「自動承認になった日の慰めの 1個」として導入したが (2026-05-28)、子セルフ経路の STREAK / ALL_COMPLETE と役割が完全に重なる。`generateAutoApproveTreasure` 側で「同日の treasureLog 全般」を見て重複防止する案もあったが、cron 経路でそもそも呼ばないほうがシンプル

### 影響範囲
- 2026-05-28: 「自動承認 cron は `(childId, date)` で集約して 1 件のみ AUTO 宝箱を即 UNLOCKED で生成」→ **撤回**
- 2026-05-30: 「親代理 report-approve でも宝箱を生成する（`trigger="AUTO"` 共有）」→ **そのまま有効**（cron 側が AUTO を作らなくなるので、`findFirst({ trigger: "AUTO" })` の冪等性は引き続き機能する。むしろ衝突相手が消えただけ）

### やってはいけないこと
- `generateAutoApproveTreasure` 関数そのものを削除する（親代理 report-approve がまだ使っている）
- 親代理経路の AUTO 生成もまとめて消す（親端末しかない家庭の唯一の宝箱経路。decisions.md 2026-05-30 の前提）

### 該当箇所
- `src/app/api/cron/auto-approve/route.ts` — `generateAutoApproveTreasure` インポートと呼び出しを削除
- `src/__tests__/api/cron/auto-approve.test.ts` — `mockGenerateAuto` が呼ばれないことを担保するテストに反転

## 2026-05-31: TreasureTrigger.AUTO を PROXY にリネーム（2026-05-30 の「PROXY 禁止」を打ち消し）

### 決定内容
- Prisma enum `TreasureTrigger` の値 `AUTO` を `PROXY` に変更
- 関数名 `generateAutoApproveTreasure` を `generateProxyTreasure` にリネーム
- マイグレーション: `ALTER TYPE "TreasureTrigger" RENAME VALUE 'AUTO' TO 'PROXY'`（PostgreSQL 10+ の機能で既存データもそのまま新名に切り替わる）

### 理由
- 同日 cron の AUTO 生成を撤回した結果、`trigger="AUTO"` を立てる経路は **親代理 report-approve のみ** になった。「AUTO」の名前が「自動承認」を連想させて実態と乖離している（「これは cron が立てるやつ？」と誤読されかねない）
- 親代理を `isProxy` フラグや `parentChildView` モジュール名で既に表現しているため、`PROXY` という命名は既存のコード語彙に整合する
- 2026-05-30:1129「新しい trigger 値（例: "PROXY"）を作る」は「やってはいけないこと」と明記していたが、その禁止理由は **「cron と冪等性を共有するために AUTO を流用する」** であり、2026-05-31 で cron 経路が消えた以上、この禁止は失効

### やってはいけないこと
- 旧 AUTO 名のまま放置する（実装読解時の混乱の温床）
- `ALTER TYPE` を使わず `DROP TYPE` → 再作成する形のマイグレーションを書く（既存データを失う）
- enum 名 `TreasureTrigger` 自体を変更する（無関係な型名変更で diff が肥大化する）

### 該当箇所
- `prisma/schema.prisma` — enum 値
- `prisma/migrations/20260531000001_rename_treasure_trigger_auto_to_proxy/migration.sql`
- `src/lib/treasureService.ts` — `generateProxyTreasure`・`trigger: "PROXY"`
- `src/app/api/parent/child-view/quests/[id]/report-approve/route.ts` — 呼び出し元
- テスト 3 ファイル（cron / report-approve / treasureService）

## 2026-05-31: 宝箱ハズレ枠を「コレクションアイテム」に置き換え（季節制 80種）

### 決定内容
- 仕様 `docs/未実装仕様書/treasure-collection-items.md` を実装。宝箱のハズレ枠（drawTreasure が MISS を返す経路）で **必ず季節コレクションアイテムを 1個付与** する
- 抽選フローは「ごほうび抽選 → MISS → コレクション抽選」の二段構成。`drawTreasure`（src/lib/treasure.ts）は無改変。`openOldestTreasure` 内で MISS を受けた時のみ `drawCollectionItem` を回す
- マスターデータ（80種 = 春/夏/秋/冬 × 20種）は **コード管理** (`src/lib/collectionItems.ts`)。DB には子供の所持実績（`UserCollectionItem`）だけ保存
- シーズン判定は **JST 月初境界**: 3/1 春, 6/1 夏, 9/1 秋, 12/1 冬。`getSeasonForDate()` / `getCurrentSeason()` が `src/lib/date.ts` の JST 規約に従い計算
- コレクション抽選確率は **COMMON 60% / UNCOMMON 30% / RARE 10%** の排他選択（rng 1回で tier を決定 → 2回目で tier 内 uniform 選択）。当選 tier にアイテムが無ければ低 tier に降格（treasure.ts と同じ規約）
- 開封演出 `TreasureOpenCutscene` はハズレ時に コレクションアイテムの画像・名前・カテゴリー・ダブり回数（n 個目）を描画。初獲得 (count=1) と 2回目以降を文言で区別
- コレクション閲覧 UI は `/app/child/collection` を 2タブ（図鑑 + 実績）から **3タブ（図鑑 + 🎁 アイテム + 実績）** に拡張。親代理 `/app/parent/child-view/[childId]/collection` も同形（child-view 経路 API `/api/parent/child-view/collection-items` 経由）
- API `GET /api/collection-items` は **全 80 種をマスター扱いで返し**、各アイテムに `owned/count/firstAcquiredAt/lastAcquiredAt` を merge して返す。未所持はクライアント側でシルエット表示

### 仕様書との差分（解釈の固定）
- 仕様書セクション 3 の表は「COMMON 10 / UNCOMMON 6 / RARE 4」と書かれているが、各カテゴリーの **具体的なアイテムリスト** は「COMMON 2 / UNCOMMON 1 / RARE 1」× 5カテゴリー = **10/5/5** になっている。実装は**具体アイテムリストを正**として 10/5/5 採用。抽選確率 60/30/10 はプール内件数とは独立なので運用影響なし
- 春・冬のアイテム画像は未制作のため `public/collection-items/dummy.png`（宝箱画像を流用）を共通配置。画像差し替えは `src/lib/collectionItems.ts` の `image:` フィールド更新のみで済む
- アイテム ID は `{season}-{NN}`（例 `summer-01`〜`summer-20`）。表示名は仕様書の日本語名そのまま

### 理由
- ADHD 特性（拒絶感受性・可変報酬への反応）から「開けたら必ず何か手に入る」体験を担保するため。旧仕様の MISS 演出は「モンスターがうれしそう」など慰めのみで、空振り感が残っていた
- 季節制（3ヶ月ローテーション・常時 20種だけ）により「期限つきの動機」と「レア感維持」を両立。子のオーナーシップを段階的に成長させられる
- マスターをコード管理にしたのは: (a) 親 UI を作らない（保護者の管理負担ゼロ）、(b) 季節ロテーションが自動、(c) 画像と文言の更新がデプロイサイクルに同期する、ため
- `openOldestTreasure` に統合したのは: (a) 抽選 RNG を 1 経路に集約し再現性を保つ、(b) 親代理開封ルートも同じ関数を通るので **自動的に親モードでも機能する**（追加実装ゼロ）
- 子の Push 通知は **当たり（既存）のみ送る**。ハズレでも何か出るからといってコレクションアイテム獲得を Push すると親への通知が無限増殖するため

### やってはいけないこと
- 親が編集する「アイテムマスター UI」を作る（仕様外。保護者の運用負担が増え MVP の趣旨に反する）
- HIT 時にも併せてコレクションアイテムを付与する（コレクションは「ハズレでも手に入る慰め」が起源。HIT 報酬の二重化は当たりの価値を薄める）
- pity 発動による HIT 昇格時にコレクション付与する（pity は MISS を HIT に書き換える機構。pity 発動 = HIT 扱いなので付与しない）
- `drawTreasure` の戻り値を変えてコレクション抽選を埋め込む（treasure.ts は純粋関数 1ファイル 1責務を保つ。コレクション抽選は別ファイル `collectionDraw.ts`）
- 親本人への Push をハズレ→コレクション獲得で送る（親代理開封でも、子セルフ開封の親宛 Push でも、コレクション獲得は通知対象外）
- `UserCollectionItem` の `season` カラムを集計の主キーとして使う（季節判定の正本はあくまで `itemId` プレフィックスとマスター。`season` は獲得当時のスナップショットで、将来仕様変更時の再分類にも対応できるように冗長保持しているだけ）

### 該当箇所
- 純粋データ: `src/lib/collectionItems.ts`（80種マスター + season/category/rarity ヘルパ）
- 純粋ロジック: `src/lib/collectionDraw.ts`（60/30/10 排他抽選）
- DB 操作: `src/lib/collectionService.ts`（`awardCollectionItem` upsert / `getOwnedCollection`）
- 統合: `src/lib/treasureService.ts` `openOldestTreasure` — MISS 経路で `drawCollectionItem` → `awardCollectionItem`
- API: `src/app/api/treasures/open/route.ts` + `src/app/api/parent/child-view/treasures/open/route.ts`（レスポンスに `collectionItem`） / `src/app/api/collection-items/route.ts` + child-view variant
- UI: `src/components/child/TreasureOpenCutscene.tsx`（MISS 演出差し替え） / `src/components/child/ItemsContent.tsx`（新タブ本体） / 子・親 collection ページに「🎁 アイテム」タブ
- スキーマ: `prisma/schema.prisma` `UserCollectionItem` + `prisma/migrations/20260531000002_add_user_collection_item/migration.sql`
- 画像: `public/collection-items/{summer,fall}/*.png`（仕様書由来）+ `public/collection-items/dummy.png`（春冬の暫定）

## 2026-05-31: 親プール未設定でも宝箱を生成する（2026-05-28 を撤回）

### 決定内容
- `generateTreasuresOnReport` と `generateProxyTreasure` の冒頭の `poolSize === 0` 早期 return を削除
  - プール未設定の家庭でも、子供がクエストを報告すれば STREAK / ALL_COMPLETE / PROXY 宝箱が通常通り生成される
  - 開封結果は必ずハズレ枠 → 季節コレクションアイテム獲得（プール空時の `openOldestTreasure` は既に MISS 経路でコレクション付与する仕様）
- 子 BottomNav の「宝箱タブ非表示」分岐を撤廃し、**常に表示** に変更
  - `hasTreasurePool` state と `treasureHasPool` の localStorage キャッシュも削除（不要になった）
  - `hasPool` フィールドは API レスポンスに残置（将来の親向け案内バナー用に保留）
- 履歴表示の文言を整理（子 treasures ページ / 親代理 treasures ページ / `TreasureHistoryList`）
  - 集計: 「あたり X・からっぽ Y」→ 「ごほうび X・コレクション Y」
  - 各行タイトル: 「からっぽ…でもうれしい！」→ 「🎁 コレクションアイテム」
  - `alt` テキストも「はずれ」→「コレクション」
- 開封演出 `TreasureOpenCutscene` の `collectionItem` 欠落時フォールバックも「からっぽ…」→「宝箱をひらいた！」に修正（防御コード。本来は API が必ず `collectionItem` を返すので到達しない）

### 理由
- 2026-05-28「親プール未設定なら宝箱を生成しない」の根拠だった『100% ハズレ演出になる悪 UX』はコレクションアイテム導入（同日 2026-05-31 別エントリ）で解消した
  - ハズレ枠 = 季節コレクションアイテム獲得という確定報酬になっており、もはや「壊れてる？」状態にはならない
- プール未設定家庭でも子供がクエストを完了したら宝箱体験ができることで、初期セットアップ前から動機付けが働く
  - 親が後からごほうびを設定するきっかけも、子供が「宝箱から○○取れたよ！」と話すことで自然に生まれる
- BottomNav 宝箱タブの「あとから現れる」フリッカー対策（localStorage キャッシュ）は、常時表示に変えたことで不要

### やってはいけないこと
- `openOldestTreasure` の MISS 経路でコレクションアイテム付与をスキップする（プール 0 でハズレ確定するケースが「真のハズレ」に戻り、本決定の前提が崩れる）
- 親プール未設定家庭で BottomNav 宝箱タブを再び隠す（コレクション獲得経路が見えなくなる）
- `hasPool` API フィールドの計算自体を削除する（将来「ごほうび未設定ですよ」案内バナーに使い得るので、判定だけ残す）
- 「あたり X・からっぽ Y」「からっぽ…でもうれしい！」など旧文言を復活させる（「外れではない」というメッセージが揺らぐ）

### 該当箇所
- `src/lib/treasureService.ts` — `generateTreasuresOnReport` / `generateProxyTreasure`（`poolSize === 0` の早期 return を削除）
- `src/components/child/BottomNav.tsx` — `hasTreasurePool` state とフィルタ撤廃
- `src/app/app/child/treasures/page.tsx` + `src/app/app/parent/child-view/[childId]/treasures/page.tsx` + `src/components/child/TreasureHistoryList.tsx` — 履歴文言
- `src/components/child/TreasureOpenCutscene.tsx` — フォールバック文言
- テスト 3 ファイル（treasureService / BottomNav 表示 / Cutscene は既存維持）

## 2026-05-31: 「ハズレ」概念を廃止 — `OpenTreasureResult.miss` フィールド削除

### 決定内容
- `OpenTreasureResult` (および /api/treasures/open レスポンス) から `miss: boolean` フィールドを削除
  - 「親ごほうび当選」「コレクション獲得」の 2つは `item !== null` / `collectionItem !== null` で完全に区別できるため、`miss` は冗長
- `TreasureOpenCutscene` の描画分岐を `result.miss` チェックから `result.item ? ... : result.collectionItem ? ... : null` の素直な分岐に書き換え
  - `collectionItem` 欠落フォールバック (旧 API 互換用の「からっぽ…」防御) を撤去 — 新 API では必ず `item` か `collectionItem` のどちらかが入る
- Push 通知の判定を `if (!result.miss && ...)` → `if (result.item && ...)` に
- 履歴行アイコンを `/treasure/open1.png`（からっぽの宝箱絵）から **🏆 絵文字** に置き換え（コレクションは「獲得」であり「空」のビジュアルは誤り）
- 史料的コメント・テスト名から「ハズレ」「MISS」表現を「親ごほうび不当選」「コレクション獲得」「外れ枠」等に置換

### 理由
- 「外れ」「miss」という名前は『何ももらえなかった』を含意してしまい、コレクション獲得が必ず付く現仕様と認知不整合
- `miss` が `item === null` と必ず一致するため、フィールドが冗長で True Source が二箇所に分かれていた（API 経由でずれが生じ得る）
- 子画面の演出も「ごほうび当選 vs コレクション獲得」の 2 ステートで素直に書ける方が後続変更に強い
- 旧アイコン `/treasure/open1.png`（空の宝箱）は「何も入っていない」表現で、新仕様の「必ず何か出る」と矛盾。絵文字（🎁 ごほうび / 🏆 コレクション）で意味的に区別する

### やってはいけないこと
- `miss` を別名（`hasReward` 反転 / `isCollection` 等）で復活させる（同じ True Source 二重化問題が再発）
- `TreasureOpenCutscene` で「ごほうび」と「コレクション」の表示を 1つの分岐に合体させる（表示要素・配色・サブタイトル文言が異なるので分けたほうが読みやすい）
- `/treasure/open1.png` ファイル自体を削除する（他の場所での参照が将来発生し得るので残置 — ただし新たに参照を増やさない）
- TreasureLog.itemId === null を「ハズレ」と説明するコメントを残す（旧名残でユーザに「外れ」を連想させる）

### 該当箇所
- `src/lib/treasureService.ts` — `OpenTreasureResult.miss` 削除、`drawnItem === null` 判定に統一
- `src/app/api/treasures/open/route.ts` + child-view variant — レスポンスから `miss` 削除、Push 判定を `result.item` ベースに
- `src/components/child/TreasureOpenCutscene.tsx` — 分岐を item/collectionItem ベースに、フォールバック撤去
- `src/components/child/TreasureStock.tsx` + 子・親代理 treasures ページ — 型から `miss` 削除、履歴アイコンを emoji 化
- テスト 6 ファイル（treasureService / open route / child-view open / TreasureOpenCutscene / TreasureStock / 子・親代理 treasures page / treasures/status）から `miss` の mock/assertion 撤去



## 2026-05-31: コレクションアイテム獲得をひろば通知＋履歴・図鑑に反映

### 決定内容
- **ひろば通知**: 宝箱開封で新規（count===1）コレクションアイテムを獲得したとき、`BulletinLog` に `COLLECTION_ITEM_OBTAINED` を書き込む。実績バッジ獲得と同等扱い。
  - メッセージ: `${子供名}は${季節}の${★}コレクション「${アイテム名}」を手に入れた！`
  - ダブり獲得（count>=2）は通知しない（ノイズになるため）
  - 同日内で別アイテムを複数獲得した場合はすべて通知（unique key = collectionItemId）
- **宝箱履歴の表示**: 親ごほうび不当選行を「コレクションアイテム」と一律表示するのをやめ、**獲得した具体的アイテムを表示**する（画像 + 名前 + 季節 + ★）。
  - そのために `TreasureLog.collectionItemId` カラムを追加（マスター id 例 "summer-01" を保存、FK は無し）
  - `/api/treasures/status` と child-view 版でマスター解決した `collectionItem` を `opened[]` に含める
- **コレクションタブの "今日獲得" 表示**: `ItemsContent` で `lastAcquiredAt` を JST 比較し、本日獲得のアイテムに **NEW バッジ** を表示。ヘッダーにも「きょう +N」を併記。

### 理由
- 宝箱を開封したとき「コレクションアイテム」とだけ書かれていても**何が出たか履歴で見返せず**、コレクション収集の楽しみが半減していた。具体アイテムを保存・表示することで、宝箱を開ける度の体験を後から振り返れる
- ひろば通知（実績バッジと同じ位置付け）により、コレクション獲得が **グループ内で共有される達成イベント** に格上げされる。1日に複数獲得した場合の通知重複を避けるため、初獲得のみに限定
- 「今日もう手に入れた / これから取りに行く」が一目で分かるよう、NEW バッジで認知負荷を下げる。ヘッダーの「きょう +N」は集計的視点を与える

### やってはいけないこと
- ダブり獲得もひろば通知する（ノイズになる。badge / 進化など他の "新規イベント" 通知パターンと整合性が崩れる）
- `TreasureLog.collectionItemId` に外部キー制約を張る（マスターは `src/lib/collectionItems.ts` のコード管理。シーズン仕様改廃時の DB マイグレーションが面倒になる）
- 履歴 UI で旧「🏆 コレクションアイテム」ジェネリック表示に戻す（具体アイテム表示が無いと、収集体験のフィードバックループが切れる）
- NEW バッジを「初獲得（count===1）のみ」にする（同じアイテムをダブり獲得した日も "今日の獲得実績" としてはハイライトしたい。「今日 acquired」== `lastAcquiredAt` JST 一致 で判定）

### 該当箇所
- スキーマ: `prisma/schema.prisma` `TreasureLog.collectionItemId` + `prisma/migrations/20260531000003_add_treasurelog_collection_item_id/migration.sql`
- ひろば: `src/lib/gathering.ts`（`COLLECTION_ITEM_OBTAINED` 型 + メッセージ + 絵文字 🎴）/ `src/lib/bulletinLog.ts`（`triggerCollectionItemLog`）
- 統合: `src/lib/treasureService.ts` `openOldestTreasure` — `collectionItemId` を保存し、count===1 のとき trigger
- API: `src/app/api/treasures/status/route.ts` + child-view 版 — `opened[]` に `collectionItem` (name/season/rarity/image) を含める
- UI: `src/app/app/child/treasures/page.tsx` + 親代理版 + `src/components/child/TreasureHistoryList.tsx` — 履歴行に具体アイテム表示
- UI: `src/components/child/ItemsContent.tsx` — NEW バッジ + ヘッダー「きょう +N」


## 2026-05-31: コレクション獲得通知をダブり獲得でも飛ばす（同日同 entry の 2026-05-31 を部分撤回）

### 決定内容
- `openOldestTreasure` の「初獲得 (count===1) のみ `triggerCollectionItemLog` を呼ぶ」ガードを撤去
- `triggerCollectionItemLog(childId, itemId, count)` に count を必須で渡す
- BulletinLog の `key` を `${itemId}#${count}` に変更し、同日同 itemId のダブり獲得でも unique 制約と衝突しないように
- `writeBulletinLog` に `customKey?: string` パラメータを追加（extra と独立に key を上書き可能）
- 同 entry「やってはいけないこと: ダブり獲得もひろば通知する」を撤回

### 理由
- ノイズ懸念で初獲得のみに絞っていたが、子供視点では **獲得イベント自体がお祝い**であり、ダブりだから黙る意味は薄い
- ひろば UI 側の `coalesceBurst` がバースト書き込みを 1 エントリにまとめてくれるので、連打開封で 5 件並ぶこともない（視覚的にはコレクション 1 件＋カウンタ）
- 「自分の獲得が必ずひろばに出る」という挙動の一貫性のほうが、子供に「予測可能性」を与える


## 2026-05-31: STREAK と PROXY を相互排他に（混合家庭の宝箱重複を解消）

### 決定内容
- `generateProxyTreasure` の冪等性チェックを **PROXY 単独 → STREAK / ALL_COMPLETE / PROXY (非 CANCELLED) のいずれか** に拡張
- `generateTreasuresOnReport` で STREAK を生成する際、**当日 PROXY 既存なら STREAK もスキップ**（has=`{STREAK | PROXY}` で判定）
- ALL_COMPLETE は引き続き「全タスク完了のボーナス枠」として PROXY と共存可

### 理由
- ユーザー報告: 子供がセルフ報告で STREAK を得た日に、親が child-view からタスク報告すると **PROXY が追加で出てしまい、全タスク完了前に 2 個目の宝箱がもらえてしまう** バグ
- 2026-05-30 で PROXY 導入時の意図は「親しか端末を持たない家庭でも 1 日 1 個宝箱を補填する」フォールバック枠。子供セルフ報告で既に STREAK が出ているなら PROXY は冗長
- 対称性のため、逆方向（PROXY 先発 → 子セルフ報告で STREAK 追加）も塞ぐ
- ALL_COMPLETE は「全タスク完了の追加ボーナス」という独立した意味を持つので、PROXY と共存させて子の達成感を尊重

### やってはいけないこと
- `generateProxyTreasure` の existing チェックを PROXY 単独に戻す（混合家庭で重複再発）
- `generateTreasuresOnReport` で PROXY を has に含めない（同じく重複再発）
- ALL_COMPLETE まで PROXY との共存を禁止する（純粋セルフ家庭との挙動差が広がりすぎる）

### 該当箇所
- `src/lib/treasureService.ts` — `generateProxyTreasure` の where に `trigger: { in: [...] }` + `status: { not: "CANCELLED" }`、`generateTreasuresOnReport` の STREAK 判定に PROXY を加算
- `src/__tests__/lib/treasureService.test.ts` — STREAK→PROXY 抑制 / PROXY→STREAK 抑制 / PROXY+ALL_COMPLETE 共存 の 3 ケース追加


## 2026-05-31: 「渡したよチェック」を親メモとして復活（2026-05-28 撤回）

### 決定内容
- `TreasureLog.fulfilled: Boolean @default(false)` カラムを復活（2026-05-28 で `20260528000001_drop_treasure_log_fulfilled` で削除したものを再追加）
- `POST /api/treasures/fulfill/[id]` 復活: PARENT only / 同 family の TreasureLog のみ操作可 / body `{ fulfilled: boolean }` で双方向トグル可（誤チェック復旧用）
- 親 `/app/parent/treasures/pending` の各行に「渡した / 取り消し」ボタンを追加。「✅ 渡し済み / ⏳ まだ渡してない」表示も併設
- **子画面・子向け API には fulfilled を露出させない**（旧 2026-05-28 で懸念された「事務化」リスクを子側だけ完全に避ける）
- コレクション獲得行 (`itemId=null`) は実物受け渡しが無いので `fulfill` API は 400 を返す

### 理由
- MVP で「子供は『まだもらってない』親は『あげた』」という水掛け論が複数家庭で観測された。実物の受け渡しを忘れること自体は親も子も普通だが、揉めるとごほうび制度の信頼を毀損する
- 2026-05-28 で削除した理由「親が確定ボタンを押すだけの作業になりごほうびが事務化する」は **子供から見える形** だと強く効くが、**親 only の親メモ** なら催促圧力にならず、親が自分の記憶を補助するメモとして機能する
- 子供は宝箱開封の喜びだけ覚えていればよく、親が「あれそういえばまだ渡してないな」と思い出して動くきっかけ（コミュニケーション）になることが期待される

### やってはいけないこと
- 子画面・子向け API (`/api/treasures/status` 等) で fulfilled を露出する（事務化リスクが直接戻ってくる、催促のきっかけを子供側に与えてしまう）
- コレクション獲得行に fulfilled を意味付ける（実物が無いので無意味）
- 親に「未受領 N 件」プッシュ通知を送る（親メモ＝任意の補助ツールとして提供し、義務化させない）

### 該当箇所
- `prisma/schema.prisma` — `TreasureLog.fulfilled` 復活
- `prisma/migrations/20260531000005_restore_treasurelog_fulfilled/migration.sql`
- `src/app/api/treasures/fulfill/[id]/route.ts` — 新規 (PARENT only / family スコープ / item not null チェック)
- `src/app/api/treasures/pending/route.ts` — レスポンスに `fulfilled` 追加
- `src/app/app/parent/(app)/treasures/pending/page.tsx` — 渡した/取り消しトグル
- テスト 2 ファイル: `src/__tests__/api/treasures/fulfill.test.ts` + `src/__tests__/components/parent-treasures-pending-fulfill.test.tsx`

## 2026-06-02: 宝箱の天井(pity)システムを廃止（5回連続ハズレ→強制ピック を撤回）

### 決定内容
- `drawTreasure` から `pityCount` / `nextPityCount` / `pityTriggered` / `PITY_THRESHOLD` を撤廃。MISS は常に MISS のまま返す
- `User.treasurePityCount` カラムを削除（マイグレーション `20260602000001_drop_user_treasure_pity_count`）
- `OpenTreasureResult` / `/api/treasures/open` / `/api/parent/child-view/treasures/open` のレスポンスから `pityTriggered` / `nextPityCount` を削除
- `TreasureOpenCutscene` の親ごほうび当選サブタイトルは固定で「宝箱をひらいた！」（旧: 天井発動時のみ「ようやくキタ！」を出していた分岐を撤去）

### 理由
- pity は元々「何度引いても外れだけが続くのは UX として辛い」を救済するための仕組みだった
- 2026-05-31 のコレクションアイテム導入で「親ごほうび不当選 → 必ず季節コレクションアイテム獲得」に変わったため、**そもそも“何ももらえない外れ”が発生しなくなった**
- すなわち pity が救済しようとしていた状況が構造的に消滅 → pity の存在意義も消える
- 「5回連続 MISS で親ごほうびを強制ピックする」挙動が残っていると、本来コレクション枠の確定取得だったはずの引きが pity 発動で親ごほうびに上書きされてしまい、コレクション獲得頻度が説明と乖離する副作用がある

### やってはいけないこと
- 「ハズレ続き救済」を別形で復活させる（例: コレクションのレア確定）。本決定の核心は「もはや救済が要らない」点であって、別経路で代替を作るとコレクションの素直な確率設計が崩れる
- `treasurePityCount` カラム削除のためのデータバックフィルを書く（カラムが消えるだけで他に参照する箇所は無い）
- `drawTreasure` の戻り値に `nextPityCount` 互換のフィールドを残す（API True Source を二箇所に持つ問題が再発する。呼び出し側は draw 結果のみで分岐する）

### 該当箇所
- `src/lib/treasure.ts` — `drawTreasure` から pity 関連を除去
- `src/lib/treasureService.ts` — `openOldestTreasure` から `treasurePityCount` の読み書きを除去 / `OpenTreasureResult` 縮小
- `src/app/api/treasures/open/route.ts` + child-view variant — レスポンスから `pityTriggered` 削除
- `src/components/child/TreasureOpenCutscene.tsx` — サブタイトル分岐撤去
- `src/components/child/TreasureStock.tsx` + 子・親代理 treasures ページ — 型から `pityTriggered` 削除
- `prisma/schema.prisma` — `User.treasurePityCount` 削除
- `prisma/migrations/20260602000001_drop_user_treasure_pity_count/migration.sql`
- テスト 5 ファイル（treasure / treasureService / open route / child-view open / TreasureOpenCutscene / TreasureStock / child・parent treasures page）から pity 関連 mock/assertion を撤去

---

## 2026-06-03: 実績100バッジの全面見直し（序盤を絞り中盤からの達成感を強化）

### 決定
- 100個のバッジ定義（`src/lib/badges.data.ts`）を全面リバランス。総数100個は維持
- 「ようこそ系」を旧10個 → 3個に縮小: `first_quest` / `first_hatch` / `first_self_approved` のみ
- 旧 `first_approval` `first_photo` `first_self_task` `first_skip` `first_retry` `first_evo2` `first_evo3` `deadline_first` `morning_first` `afternoon_first` `quick_first` `perfect_first` は廃止
- 旧 `approval_*`（10/30/50/100/200）を廃止し `quest_*` に統合（条件が `approvedCount` で完全重複していたため）
- 累計クエスト系を 9段階に拡張: `quest_10 / 25 / 50 / 100 / 200 / 300 / 500 / 750 / 1000`
- 中盤閾値を全体的に底上げ:
  - `streak_3` 廃止 → `streak_5` から開始（5/10/14/21/30/50/100）
  - `login_3` 廃止 → `login_7` から開始（7/14/30/60/100/200）
  - `xp_10/30` 廃止 → `xp_50` から開始（50/100/300/500/1000）
  - `photo_5` 廃止 → `photo_15` から開始（15/30/60/100/200）
  - `monday_5 → monday_10` / `weekend_10 → weekend_20` / `month_end → month_end_10` / `spring 10→15日` / `summer/autumn/winter 15→20日`
  - `skip_aware` 5→10回 / `retry_5 → retry_10` / `triple_crown` 10→25日
  - `morning_first/morning_7` 廃止 → `morning_10/30/60`、`afternoon_first` 廃止 → `afternoon_15/50`、`quick_first` 廃止 → `quick_10/30`
  - `perfect_first` 廃止 → `perfect_5` から開始（5/15/30/50）
  - `day_3quests` 廃止 → `day_4quests / day_6quests`
- 終盤バッジを新設: `week_5x10` `week_7x5` `month_perfect_x3` `month_15x6` `rebirth_10` `habit_60` `milestone_90` `streak_50` `streak_100` `login_60` `login_100` `login_200` 等
- 既存ユーザが旧IDで解錠していた `UserBadge` レコードは UI 上は表示されなくなる（`ALL_BADGES` ベースで描画するため）。DB上は残置で問題なし

### 理由
- 旧設計では「初回◯◯」系が10個＋低閾値の累計系が多数あり、最初の1〜数クエストで5〜10個が一気に解放される状態だった。「次に何の実績を狙おう」というモチベが生まれず、序盤の達成感が逆に薄くなっていた
- 序盤を `first_quest`（初回承認時）と `first_hatch`（初進化時）の最大2個に絞ることで、最初の解放が「珍しい・嬉しい」体験になる
- 中盤閾値の引き上げで、解放ペースをゆるやかに長期化。終盤バッジを追加して 100/200/500/1000 級の長期目標も用意

### やってはいけないこと
- 「廃止IDをDBから一括削除する」マイグレーションを書く（既存ユーザが過去に何を解錠したかの記録自体は残しておく方が安全。UI 描画は `ALL_BADGES` 経由なので未定義IDは自然に非表示になる）
- 旧IDを別名で再導入する（`first_photo` → `photo_1` 等）。閾値を上げてもバッジ自体の数が増え 100 個縛りを破る
- `BadgeContext` フィールドを新規追加して条件を細分化する（既存フィールドで十分賄える設計にしてあり、`loadBadgeContext` の集計コストを増やさない方針）

### 該当箇所
- `src/lib/badges.data.ts` — `ALL_BADGES` と `BADGE_CONDITIONS` を全面書き換え
- `src/__tests__/lib/badges.test.ts` — 旧IDの境界テストを新IDに置換、序盤同時解放数（初回承認で1個・初進化同時で2個）を境界テスト化
- `BadgeContext` 型・`loadBadgeContext` は無変更（既存フィールドで全条件を表現可能）

---

## 2026-06-03: 宝箱・コレクションアイテム・転生卵を実績の対象に追加（100バッジ維持）

### 決定
- 同日の実績全面見直しの直後フォロー。**badge 設計以降に追加された3システム**（宝箱 / 季節コレクションアイテム / 転生卵ボーナス）がバッジで一切拾えていなかった抜けを埋める
- 中盤の冗長バッジ8個を削除し、新システム向け8個を追加して **総数100個を維持**
- 削除: `quest_750` / `streak_50` / `login_60` / `login_200` / `photo_60` / `deadline_25` / `morning_60` / `afternoon_50`
- 追加（宝箱3個）:
  - `treasure_first` — はじめて宝箱を開けた（`treasureOpenedCount >= 1`）
  - `treasure_25` — 累計25個開封（`treasureOpenedCount >= 25`）
  - `treasure_rare` — RARE 当選（`rareTreasureCount >= 1`）
- 追加（コレクションアイテム4個）:
  - `item_first` — はじめて季節アイテム獲得（`collectionItemCount >= 1`）
  - `item_30` — 30種獲得（distinct itemId 単位）
  - `season_complete` — 春/夏/秋/冬のいずれか1シーズン（20種）制覇
  - `item_80_all` — 全80種制覇（`hasAllCollectionItems`）
- 追加（転生卵1個）:
  - `rebirth_egg_used` — 転生卵ボーナスを1回以上使った（`usedEggBonuses.length >= 1`）
- `BadgeContext` に6フィールド追加: `treasureOpenedCount` / `rareTreasureCount` / `collectionItemCount` / `collectionSeasonsComplete` / `hasAllCollectionItems` / `rebirthEggUsed`
- `loadBadgeContext` に Prisma クエリを2つ追加: `prisma.treasureLog.findMany({ status: "OPENED" })`（item.rarity 付き）と `prisma.userCollectionItem.findMany`。`User.usedEggBonuses` (JSON文字列) は既存ユーザクエリで取得

### 理由
- 宝箱・コレクションアイテム・転生卵は実績設計後に追加された主要システムで、子供の体験面積を大きく占めるようになったにもかかわらず「実績ページで集める対象」として登場していなかった
- 旧設計では `quest_750`(500-1000の間) / `streak_50`(30-100の間) / `login_60`(30-100の間) など、隣接バッジと数値が近接して達成感の差分が薄いものがあった。これらと入れ替えて意味のあるバッジ密度を確保
- `collectionItemCount` は **distinct itemId 数** で実装。`UserCollectionItem.count`（同一アイテムのダブり）は使わない（「30個集めた」のユーザ体感は「30種類集めた」が自然）

### やってはいけないこと
- `treasure_first` / `item_first` を「ようこそ系」と同じ序盤同時解放に持っていく（これらは「初回宝箱開封」「初回コレクション獲得」のタイミングで個別に発火する設計。`first_quest` と同時には起きないので問題なし）
- `treasureOpenedCount` を全 `TreasureLog` でカウントする（LOCKED / UNLOCKED / CANCELLED を含めると未開封の宝箱が混入し「累計25個開封」の意味が壊れる。必ず `status: "OPENED"` で絞る）
- `season_complete` を「現シーズン中の獲得」とする（マスターは `src/lib/collectionItems.ts` で 4シーズン × 20種固定。各シーズン20種揃ったかを判定すれば良い）
- `collectionItemCount` の閾値を上げて「30 → 50」等にする（80種マスターの半分以上を要求するとペース感が崩れる。30は4シーズン中1シーズン以上のボリュームに相当する適切な中盤目標）

### 該当箇所
- `src/lib/badges.data.ts` — `BadgeContext` に6フィールド追加、`ALL_BADGES` から8個削除＋8個追加、`BADGE_CONDITIONS` 同期
- `src/lib/badges.ts` — `loadBadgeContext` に `treasureLog` / `userCollectionItem` 集計と `usedEggBonuses` 判定を追加
- `src/__tests__/lib/badges.test.ts` — 新バッジ8個の境界テストと、削除バッジ8個の不在テストを追加

---

## 2026-06-03: バッジ即時解錠フック + 進捗ヒント UI

### 決定
- **即時解錠**: `checkAndUnlockBadges + triggerBadgeLog` を以下3つのAPIルートに `after()` で fire-and-forget 追加
  - `POST /api/treasures/open`（子: 宝箱開封）— `treasure_first` `treasure_25` `treasure_rare` `item_first` `item_30` `season_complete` `item_80_all` の即時発火
  - `POST /api/parent/child-view/treasures/open`（親代理: 宝箱開封）— 同上を子のIDで判定
  - `POST /api/rebirth`（子: 転生）— `rebirth_egg_used` 即時発火
- **進捗ヒント**:
  - `src/lib/badges.data.ts` に純粋関数 `getBadgeProgress(badgeId, ctx): { current, target } | null` を新規追加。ブール条件（hasXxx・OR条件）は null、数値条件は `{current, target}` を返す
  - `GET /api/badges` および親代理 `GET /api/parent/child-view/badges` のレスポンスで各バッジに `progress` フィールドを含める
  - `BadgesContent.tsx` の `BadgeCard` で **未解錠 + 進捗あり** のバッジに「あと N で解錠」ヒント＋進捗バーを表示

### 理由
- 旧設計では宝箱・コレクション・転生卵バッジが追加されただけで、解錠フックが承認フロー / `/api/badges` 訪問の2経路にしかなく、即時感がなかった（次に承認イベントが起きるまで掲示板にもトーストにも流れない）
- 進捗ヒントは ADHD 児童向けという文脈で特に重要。未解錠バッジが完全にブラックボックスだと「次に何をすれば良いか」が分からず、達成動機が削がれる

### やってはいけないこと
- `checkAndUnlockBadges` をクライアントから直接呼ぶ（API ルートの `after()` 経由でのみ。クライアントから呼ぶ経路を作ると認証・整合性チェックを再実装する羽目になる）
- `loadBadgeContext` の重複呼び出しを「重複だから」と排除しようと、`checkAndUnlockBadges` のシグネチャを `{ newBadges, ctx }` に変更する（既存6箇所の呼び出し全てを修正する破壊的変更になる。`/api/badges` の二重ロード（~50ms）はバッジページ訪問頻度から見て許容コスト）
- 進捗ヒントの target をクライアント側のハードコードで持つ（バッジ閾値変更時に二重メンテになる。必ず `getBadgeProgress` 経由でサーバから配信する）
- ブール系バッジ（`collection_all`, `multi_tasker`, `hasComeback*` 等）に無理やり `{ current, target }` をひねり出して「あと 0 / 1 で解錠」と表示する（条件が複合的で 0/1 トグルなので「あと N」表現が成立しない）

### 該当箇所
- `src/app/api/treasures/open/route.ts` + `src/app/api/parent/child-view/treasures/open/route.ts` + `src/app/api/rebirth/route.ts` — `after()` フック追加
- `src/lib/badges.data.ts` — `BadgeProgress` 型と `getBadgeProgress` / `BADGE_PROGRESS_MAP` 追加
- `src/lib/badges.ts` — `getBadgeProgress` / `BadgeProgress` を re-export
- `src/app/api/badges/route.ts` + `src/app/api/parent/child-view/badges/route.ts` — `loadBadgeContext` 並列ロードして各バッジに `progress` を付加
- `src/lib/badgeFilter.ts` — `BadgeData` 型に `progress?` フィールド追加
- `src/components/child/BadgesContent.tsx` — `ProgressHint` サブコンポーネント追加、未解錠バッジに表示
- テスト: `treasures/open.test.ts` / `parent/child-view/treasures-open.test.ts` / `rebirth.test.ts` / `badges/route.test.ts` / `parent/child-view/badges.test.ts` / `lib/badges.test.ts`



