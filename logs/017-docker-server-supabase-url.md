# 017: Docker環境でのSupabase接続問題 → network_mode: hostで解決

## 概要
Docker環境でログイン後に307→304でログイン画面に戻される問題を修正。

## 原因
Next.jsのEdge Runtimeミドルウェアは**全ての`process.env`をビルド時にインライン化**する。
実行時の環境変数（`docker-compose.yml`のenvironment）は読めない。

### 試行錯誤の経緯
1. **`SUPABASE_URL`をenvironmentで渡す** → Edge Runtimeでは実行時envが読めずNG
2. **`SUPABASE_URL`をbuild ARGで渡す** → ミドルウェアに`host.docker.internal`がインライン化されるが、ブラウザからは`host.docker.internal`にアクセスできない（macOSホスト側で名前解決不可）
3. **ブラウザ向け（`127.0.0.1`）とサーバー向け（`host.docker.internal`）を分離** → Edge Runtimeバンドルにはブラウザ向けURL（`127.0.0.1`）のみインライン化されてしまう（`||`演算子でのフォールバックが効かない）

### 根本原因
**ブリッジネットワーク（デフォルト）ではコンテナ内の`127.0.0.1`はコンテナ自身を指す**ため、ホスト側のSupabaseに到達できない。クライアント（ブラウザ）とサーバー（ミドルウェア）で異なるURLを使う必要があるが、Edge Runtimeのインライン化の仕組み上、分離が困難。

## 最終的な解決策: `network_mode: host`

`network_mode: host`を使うことで、コンテナがホストのネットワークスタックを直接共有する。
- コンテナ内の`127.0.0.1`がホストの`127.0.0.1`と同じになる
- ブラウザもミドルウェアも同じ`http://127.0.0.1:54331`でSupabaseにアクセス可能
- URL分離の問題が根本的に解消される

### トレードオフ
- `ports`マッピングが使えない → `PORT=3001`環境変数でリッスンポートを直接変更
- ネットワーク分離がなくなる → ローカル開発用途では問題なし

## 変更ファイル

### docker-compose.yml
- `network_mode: host`を追加
- `ports`セクションを削除（host networkでは不要）
- `extra_hosts`を削除（host networkでは不要）
- `PORT=3001`をenvironmentに追加
- DATABASE_URL/DIRECT_URLを`127.0.0.1`に変更（host.docker.internal不要）
- SUPABASE_URL/SUPABASE_ANON_KEYをenvironmentから削除（ビルド時インライン化で解決）

### Dockerfile
- SUPABASE_URL/SUPABASE_ANONKEYのARG/ENVを削除（不要）
- NEXT_PUBLIC_変数のみbuild ARGで渡す

### src/lib/supabase/server.ts, middleware.ts
- `SUPABASE_URL`フォールバックを削除、`NEXT_PUBLIC_SUPABASE_URL`のみ使用に戻す
- network_mode: hostにより全環境で同じURLが使えるため

## 副次的な問題: Dockerディスク容量不足
- `No space left on device`でSupabase DBがunhealthyに
- `docker builder prune -f && docker image prune -f && docker volume prune -f`で約30GB回収
- Supabase再起動で復旧

## アクセス先まとめ
| サービス | URL |
|---------|-----|
| Next.js（dev） | http://localhost:3000 |
| Next.js（Docker） | http://localhost:3001 |
| Supabase API | http://127.0.0.1:54331 |
| Supabase Studio | http://127.0.0.1:54333 |
