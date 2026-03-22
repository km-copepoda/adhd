@echo off
REM Supabase Storage: quest-photos バケット作成 + RLS ポリシー設定
REM 使い方: storage-setup.bat
REM supabase db reset 後や初回セットアップ時に実行する

cd /d "%~dp0"
node node_modules\prisma\build\index.js db execute --file supabase/seed.sql
echo Storage setup done.
