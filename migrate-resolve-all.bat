@echo off
REM 全マイグレーションを「適用済み」としてマークするスクリプト
REM 使用場面: supabase db reset 後など _prisma_migrations が空になった際に
REM DB にはすでにスキーマが存在するが Prisma の記録がない場合に使う

cd /d "%~dp0"
set PRISMA=node node_modules\prisma\build\index.js migrate resolve --applied

echo [1/14] 20260310152742_init
%PRISMA% 20260310152742_init

echo [2/14] 20260312000001_enable_realtime
%PRISMA% 20260312000001_enable_realtime

echo [3/14] 20260314000001_add_skip_reported_status
%PRISMA% 20260314000001_add_skip_reported_status

echo [4/14] 20260315142135
%PRISMA% 20260315142135

echo [5/14] 20260317000000_add_push_subscription
%PRISMA% 20260317000000_add_push_subscription

echo [6/14] 20260317000001_add_assigned_child_to_task
%PRISMA% 20260317000001_add_assigned_child_to_task

echo [7/14] 20260317000002_add_requested_date_to_task
%PRISMA% 20260317000002_add_requested_date_to_task

echo [8/14] 20260317000002_egg_stage_shift
%PRISMA% 20260317000002_egg_stage_shift

echo [9/14] 20260317000003_add_task_streak
%PRISMA% 20260317000003_add_task_streak

echo [10/14] 20260317000004_drop_rest_pass
%PRISMA% 20260317000004_drop_rest_pass

echo [11/14] 20260317000005_recreate_task_streak
%PRISMA% 20260317000005_recreate_task_streak

echo [12/14] 20260318000001_add_performance_indexes
%PRISMA% 20260318000001_add_performance_indexes

echo [13/14] 20260319000001_add_rejection_reason
%PRISMA% 20260319000001_add_rejection_reason

echo [14/14] 20260322000001_add_photo_fields
%PRISMA% 20260322000001_add_photo_fields

echo.
echo Done. Running migrate deploy to apply any truly new migrations...
node node_modules\prisma\build\index.js migrate deploy
