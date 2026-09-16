// Issue #139: モンスター図鑑・コレクションアイテムのかなデータ層
// pickRuby(text, kana, enabled) の純粋関数テスト。
// 仕様: enabled && kana.length > 0 ? kana : text

import { describe, it, expect } from "vitest";
import { pickRuby } from "@/lib/ruby";

describe("pickRuby", () => {
  it("enabled=true でkanaが非空ならkanaを返す", () => {
    expect(pickRuby("text", "かな", true)).toBe("かな");
  });

  it("enabled=false ならkanaが非空でもtextを返す", () => {
    expect(pickRuby("text", "かな", false)).toBe("text");
  });

  it("enabled=true でもkanaが空文字ならtextにフォールバックする（既存RubyTextからの仕様改善点）", () => {
    expect(pickRuby("text", "", true)).toBe("text");
  });

  it("enabled=false かつkanaが空文字でもtextを返す", () => {
    expect(pickRuby("text", "", false)).toBe("text");
  });

  it("text と kana が同じ場合、enabled=true/false どちらでも同じ結果になる", () => {
    expect(pickRuby("同じ", "同じ", true)).toBe("同じ");
    expect(pickRuby("同じ", "同じ", false)).toBe("同じ");
  });
});
