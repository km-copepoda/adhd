# 015: Docker環境でのSupabase認証修正（NEXT_PUBLIC_ビルド時インライン化対応）

## 概要
Docker環境（localhost:3001）でユーザー登録・ログインができない問題を修正。

## 原因
Next.jsの`NEXT_PUBLIC_`環境変数は**ビルド時にJSにインライン化**されるため、`docker-compose.yml`の`environment`で実行時に渡しても効果がない。

### 具体的な問題
1. **`NEXT_PUBLIC_SUPABASE_URL`**: ビルド時に`.env`の値がインライン化されるが、`.env`が存在しない場合は`undefined`になる
2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: 同上
3. **`host.docker.internal`問題**: 仮にenvironmentが効いたとしても、`NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54331`はブラウザ（クライアント側）から到達できない。`host.docker.internal`はDocker内部のDNSであり、ブラウザはホスト側で動くため解決不可

## 修正内容

### Dockerfile
- buildステージに`ARG`を追加:
  - `NEXT_PUBLIC_SUPABASE_URL`（デフォルト: `http://127.0.0.1:54331`）
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ENV`でARGの値を環境変数に反映し、`next build`時にインライン化される

### docker-compose.yml
- `build.args`セクションを追加し、ビルド時に`NEXT_PUBLIC_`変数を渡す
  - `NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54331"`（ブラウザ向け）
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabaseローカルのanon key
- `environment`から`NEXT_PUBLIC_`変数を削除（ビルド時にインライン化済みのため不要）

## ポイント
- **NEXT_PUBLIC_変数のルール**: ビルド時に確定する。実行時のenvironmentでは変更不可
- **URLの使い分け**:
  - ブラウザ向け（NEXT_PUBLIC_）: `http://127.0.0.1:54331`
  - サーバー向け（DATABASE_URLなど）: `host.docker.internal:54332`

## 変更ファイル
- **`Dockerfile`**: ARG/ENVで`NEXT_PUBLIC_`変数をビルド時に注入
- **`docker-compose.yml`**: `build.args`追加、environmentから`NEXT_PUBLIC_`変数を削除

## 確認結果
- `docker compose build --no-cache` → ビルド成功
- ビルド済みJS内に`http://127.0.0.1:54331`とanon keyが正しくインライン化されていることを確認
- `http://localhost:3001/login` → HTTP 200
