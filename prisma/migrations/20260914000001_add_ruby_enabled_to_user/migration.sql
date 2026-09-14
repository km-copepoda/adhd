-- Add rubyEnabled to User: ふりがな（ルビ）表示 ON/OFF。子供のクエスト画面での格言等の表示に使う。

ALTER TABLE "User" ADD COLUMN "rubyEnabled" BOOLEAN NOT NULL DEFAULT true;
