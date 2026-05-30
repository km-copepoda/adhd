# ファミリー画面のJSONパースエラーを修正

**日時:** 2026-03-11

## 問題
`/parent/family` を開くと `Failed to execute 'json' on 'Response': Unexpected end of JSON input` → 修正後は `HTTP 500` エラーが発生。

## 根本原因
`prisma db push` + `prisma generate` でスキーマに `childCode` フィールドを追加したが、
**devサーバー（Turbopack）が古いPrismaクライアントのキャッシュ**を使い続けていた。

APIの `select: { childCode: true }` でPrismaが `Unknown field 'childCode'` エラーを投げていた。

```
Unknown field `childCode` for select statement on model `User`.
Available options are marked with ?.
```

## 修正内容

### 変更: `src/app/api/family/code/route.ts`
- GET ハンドラ全体を try-catch で囲み、エラー時もJSONレスポンスを返すように変更
- エラーメッセージをレスポンスに含めてデバッグしやすく

### 変更: `src/app/parent/family/page.tsx`
- fetch のエラーハンドリング改善（500時もJSONボディを読んでからconsole.error）
- 画面がクラッシュしない（familyがnullのまま「メンバーはまだいません」表示）

### 対処: devサーバー再起動が必要
- `prisma generate` を再実行済み
- devサーバー再起動で新しいPrismaクライアントが読み込まれ、`childCode`が認識される

## 教訓
`prisma db push` / `prisma generate` 後は devサーバーの再起動が必要。
Turbopackはモジュールキャッシュを保持するため、Prisma generated clientの変更が反映されない。
