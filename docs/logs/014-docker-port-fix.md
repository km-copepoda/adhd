# 014: Docker接続エラー修正（ポート競合＋環境変数不足）

## 概要
Docker起動時に2つの問題があり、localhost:3000でアプリにアクセスできなかった。

## 問題1: `.env`ファイルが存在しない
- `.gitignore`で`.env*`が除外されており、worktreeに`.env`ファイルがなかった
- `docker-compose.yml`の`env_file: - .env`が`.env`を要求するため、`docker compose up`が失敗

### 対応
- `.env`ファイルを作成（DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY）
- `.env.example`を新規作成（git管理用テンプレート）

## 問題2: `NEXT_PUBLIC_SUPABASE_ANON_KEY`が未設定
- `docker-compose.yml`の`environment`セクションに`NEXT_PUBLIC_SUPABASE_ANON_KEY`がなかった
- Supabaseクライアント（client.ts, server.ts, middleware.ts）がこの環境変数を必要とする

### 対応
- `docker-compose.yml`のenvironmentに`NEXT_PUBLIC_SUPABASE_ANON_KEY`を追加

## 問題3: ポート3000の競合
- ホスト側で`next dev`（next-server v16.1.6, PID 46751）がポート3000を占有
- Dockerコンテナもホストのポート3000にマッピング（`3000:3000`）しようとして競合
- コンテナ内部ではポート3000で正常にリッスンしていたが、ホスト側から接続できない状態

### 対応
- `docker-compose.yml`のポートマッピングを`3001:3000`に変更
- Dockerアプリには`http://localhost:3001`でアクセス

## 変更ファイル
- **`docker-compose.yml`**: ポートを`3001:3000`に変更、`NEXT_PUBLIC_SUPABASE_ANON_KEY`をenvironmentに追加
- **`.env`**: 新規作成（Supabase接続情報）
- **`.env.example`**: 新規作成（git管理用テンプレート）

## アクセス先まとめ
| サービス | URL |
|---------|-----|
| Next.js（dev） | http://localhost:3000 |
| Next.js（Docker） | http://localhost:3001 |
| Supabase API | http://127.0.0.1:54331 |
| Supabase Studio | http://127.0.0.1:54333 |
