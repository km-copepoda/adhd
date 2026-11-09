-- #184: 期限切れ行の掃除（updatedAt での範囲削除）用インデックス。
-- 20261022000001_child_rejoin_attempt は Preview DB に適用済みのため編集せず、
-- 追加マイグレーションとして分離している。IF NOT EXISTS により適用済み環境・新規環境の両方で安全。

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChildRejoinAttempt_updatedAt_idx" ON "ChildRejoinAttempt"("updatedAt");
