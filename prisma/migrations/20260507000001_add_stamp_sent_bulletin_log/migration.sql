-- Add STAMP_SENT to BulletinLogType so that "エールを送る" actions
-- are recorded on the gathering board (key="エール", 1日1回 制約は Stamp 側で担保済み).

ALTER TYPE "BulletinLogType" ADD VALUE 'STAMP_SENT';
