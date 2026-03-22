@echo off
REM Prisma マイグレーション実行スクリプト
REM 使い方: migrate.bat
REM  - ローカル Supabase (port 54332) に未適用のマイグレーションを全て適用します
REM  - shadow DB を使わない migrate deploy を使用（supabase_realtime 問題を回避）

cd /d "%~dp0"
node node_modules\prisma\build\index.js migrate deploy
