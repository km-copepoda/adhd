# 010: Docker起動対応

## 概要
Next.jsアプリをDockerコンテナで起動できるようにした。

## 変更内容

### 新規ファイル
- **`Dockerfile`**: マルチステージビルド（deps → build → runner）
  - Node 22 Alpine ベース
  - standalone出力を使用（軽量イメージ）
  - Prisma生成済みクライアントをコピー
  - 非rootユーザー（nextjs:1001）で実行
- **`docker-compose.yml`**: Next.jsアプリのサービス定義
  - ポート3000で公開
  - `.env`ファイルを読み込み
  - `host.docker.internal`でホストのSupabaseに接続
- **`.dockerignore`**: ビルドコンテキストから除外するファイル

### 変更ファイル
- **`next.config.ts`**: `output: "standalone"` を追加（Docker用に最適化されたビルド出力）

## 使い方

### ビルド＆起動
```bash
# Supabaseが起動していることを確認
supabase start

# Dockerイメージをビルド
docker compose build

# 起動
docker compose up
```

### 個別ビルド
```bash
docker build -t questboard .
docker run -p 3000:3000 --env-file .env questboard
```

## アーキテクチャ
- **Next.jsアプリ**: Dockerコンテナ内で実行
- **Supabase（PostgreSQL + Auth）**: ホスト側で `supabase start` で別途起動
- コンテナからホストへの接続は `host.docker.internal` を使用

## ビルド確認
- `docker build -t questboard .` → 成功
- イメージサイズ: Alpine + standalone で軽量

## 注意事項
- Prisma v7ではクライアント生成先が `src/generated/prisma`（旧 `.prisma` ディレクトリは不使用）
- `.env`ファイルはコンテナにマウントする（イメージに含めない）
- Supabaseはホスト側で起動する前提（docker-compose.ymlには含めていない）
