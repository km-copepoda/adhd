import { describe, it, expect } from "vitest";
import { isAllowedQuestPhotoUrl, buildQuestPhotoPath, parseQuestPhotoPath } from "@/lib/questPhotoUrl";

const SUPA = "https://abc.supabase.co";
const CHILD = "child-1";
const base = `${SUPA}/storage/v1/object/public/quest-photos`;

describe("isAllowedQuestPhotoUrl", () => {
  it("自分のフォルダ配下のファイル URL は許可する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/q1_1700000000000.webp`, CHILD, SUPA)).toBe(true);
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/q1_1700000000000.jpg`, CHILD, SUPA)).toBe(true);
  });

  it("supabaseUrl の末尾スラッシュ有無どちらでも許可する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/a.jpg`, CHILD, `${SUPA}/`)).toBe(true);
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/a.jpg`, CHILD, SUPA)).toBe(true);
  });

  it("他の子どものフォルダは拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/child-2/a.jpg`, CHILD, SUPA)).toBe(false);
  });

  it("childId が前方一致するだけの別フォルダは拒否する（child-10 vs child-1）", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/child-10/a.jpg`, CHILD, SUPA)).toBe(false);
  });

  it("旧パス（フォルダなし）は拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/q1_1700000000000.webp`, CHILD, SUPA)).toBe(false);
  });

  it("別ホストは拒否する", () => {
    expect(
      isAllowedQuestPhotoUrl(
        `https://evil.example.com/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`,
        CHILD,
        SUPA,
      ),
    ).toBe(false);
    expect(
      isAllowedQuestPhotoUrl(`${SUPA}.evil.com/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`, CHILD, SUPA),
    ).toBe(false);
  });

  it("別バケットは拒否する", () => {
    expect(
      isAllowedQuestPhotoUrl(`${SUPA}/storage/v1/object/public/other-bucket/${CHILD}/a.jpg`, CHILD, SUPA),
    ).toBe(false);
  });

  it("ファイル名部分に .. を含む場合は拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/../child-2/a.jpg`, CHILD, SUPA)).toBe(false);
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/..a.jpg`, CHILD, SUPA)).toBe(false);
  });

  it("ファイル名部分に追加の / を含む場合は拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/sub/a.jpg`, CHILD, SUPA)).toBe(false);
  });

  it("%2F（大文字・小文字）を含む場合は拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/a%2Fb.jpg`, CHILD, SUPA)).toBe(false);
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/a%2fb.jpg`, CHILD, SUPA)).toBe(false);
  });

  it("? や # を含む場合は拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/a.jpg?x=1`, CHILD, SUPA)).toBe(false);
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/a.jpg#frag`, CHILD, SUPA)).toBe(false);
  });

  it("フォルダ直下でファイル名が空の URL は拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/`, CHILD, SUPA)).toBe(false);
  });

  it("supabaseUrl が空なら拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`, CHILD, "")).toBe(false);
  });

  it("childId が空なら拒否する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}//a.jpg`, "", SUPA)).toBe(false);
  });

  it("空文字・無関係な文字列は拒否する", () => {
    expect(isAllowedQuestPhotoUrl("", CHILD, SUPA)).toBe(false);
    expect(isAllowedQuestPhotoUrl("not a url", CHILD, SUPA)).toBe(false);
  });

  it("長さ 2048 は許可し、2049 以上は拒否する（境界値）", () => {
    const prefix = `${base}/${CHILD}/`;
    const ok = prefix + "a".repeat(2048 - prefix.length);
    const ng = prefix + "a".repeat(2049 - prefix.length);
    expect(ok.length).toBe(2048);
    expect(ng.length).toBe(2049);
    expect(isAllowedQuestPhotoUrl(ok, CHILD, SUPA)).toBe(true);
    expect(isAllowedQuestPhotoUrl(ng, CHILD, SUPA)).toBe(false);
  });
});

describe("buildQuestPhotoPath", () => {
  it("<childId>/<questId>_<ts>.<ext> を返す", () => {
    expect(buildQuestPhotoPath("child-1", "q1", new Date(1700000000000), "webp")).toBe(
      "child-1/q1_1700000000000.webp",
    );
    expect(buildQuestPhotoPath("child-1", "q1", new Date(1700000000000), "jpg")).toBe(
      "child-1/q1_1700000000000.jpg",
    );
  });

  it("生成したパスの公開 URL は isAllowedQuestPhotoUrl を通る", () => {
    const path = buildQuestPhotoPath("child-1", "q1", new Date(1700000000000), "webp");
    expect(isAllowedQuestPhotoUrl(`${base}/${path}`, "child-1", SUPA)).toBe(true);
  });
});

describe("parseQuestPhotoPath（#235 アカウント削除の Storage 削除対象抽出）", () => {
  it("新形式 <childId>/<file> を返す（2 セグメント）", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}/q1_1700000000000.webp`, SUPA)).toBe(
      `${CHILD}/q1_1700000000000.webp`,
    );
  });

  it("旧形式（フラット <file>）を返す（1 セグメント）", () => {
    expect(parseQuestPhotoPath(`${base}/q1_1700000000000.webp`, SUPA)).toBe("q1_1700000000000.webp");
  });

  it("supabaseUrl の末尾スラッシュ有無どちらでも同じ結果", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a.jpg`, `${SUPA}/`)).toBe(`${CHILD}/a.jpg`);
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a.jpg`, SUPA)).toBe(`${CHILD}/a.jpg`);
  });

  it("パーセントエンコードされたファイル名は decode 後のパスを返す", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}/%E5%86%99%E7%9C%9F.jpg`, SUPA)).toBe(`${CHILD}/写真.jpg`);
  });

  it("例外を投げず null を返す: 空・非文字列・無関係な文字列", () => {
    expect(parseQuestPhotoPath("", SUPA)).toBeNull();
    expect(parseQuestPhotoPath("not a url", SUPA)).toBeNull();
    expect(parseQuestPhotoPath(undefined as unknown as string, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(null as unknown as string, SUPA)).toBeNull();
  });

  it("supabaseUrl が空・不正なら null", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a.jpg`, "")).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a.jpg`, "not a url")).toBeNull();
  });

  it("別ホスト・サフィックス偽装・別ポート・別プロトコルは null", () => {
    expect(
      parseQuestPhotoPath(`https://evil.example.com/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`, SUPA),
    ).toBeNull();
    expect(
      parseQuestPhotoPath(`${SUPA}.evil.com/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`, SUPA),
    ).toBeNull();
    expect(
      parseQuestPhotoPath(`https://abc.supabase.co:8443/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`, SUPA),
    ).toBeNull();
    expect(
      parseQuestPhotoPath(`http://abc.supabase.co/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`, SUPA),
    ).toBeNull();
  });

  it("username / password 付き URL は null", () => {
    expect(
      parseQuestPhotoPath(`https://user:pass@abc.supabase.co/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`, SUPA),
    ).toBeNull();
    expect(
      parseQuestPhotoPath(`https://user@abc.supabase.co/storage/v1/object/public/quest-photos/${CHILD}/a.jpg`, SUPA),
    ).toBeNull();
  });

  it("別バケット・署名付き URL など quest-photos 公開 URL でないものは null", () => {
    expect(parseQuestPhotoPath(`${SUPA}/storage/v1/object/public/other-bucket/${CHILD}/a.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${SUPA}/storage/v1/object/sign/quest-photos/${CHILD}/a.jpg`, SUPA)).toBeNull();
  });

  it("query / hash を含むものは null", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a.jpg?x=1`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a.jpg#frag`, SUPA)).toBeNull();
  });

  it("バケット直下のパスが空（フォルダ/ファイル名なし）は null", () => {
    expect(parseQuestPhotoPath(`${base}/`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/`, SUPA)).toBeNull();
  });

  it("3 セグメント以上は null", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}/sub/a.jpg`, SUPA)).toBeNull();
  });

  it("リテラルの . / .. セグメントは URL パーサに正規化される前に null（別フォルダへ化けさせない）", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}/../child-2/a.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/../a.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/./a.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/./a.jpg`, SUPA)).toBeNull();
  });

  it("エンコードされた . / .. / / / \ セグメントは null", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}/%2e%2e`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/%2E%2E/a.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/%2e`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a%2Fb.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a%2fb.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a%5Cb.jpg`, SUPA)).toBeNull();
  });

  it("バックスラッシュ・空セグメント（//）・制御文字を含むものは null", () => {
    expect(parseQuestPhotoPath(`${base}/${CHILD}\\a.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}//a.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}//a.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a%00.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a%0A.jpg`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/a%7F.jpg`, SUPA)).toBeNull();
  });

  it("decodeURIComponent が失敗する不正なエンコードは例外にせず null", () => {
    expect(() => parseQuestPhotoPath(`${base}/${CHILD}/%E0%A4%A`, SUPA)).not.toThrow();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/%E0%A4%A`, SUPA)).toBeNull();
    expect(parseQuestPhotoPath(`${base}/${CHILD}/%`, SUPA)).toBeNull();
  });

  it("長さ 2048 は受理し、2049 以上は null（境界値）", () => {
    const prefix = `${base}/`;
    const ok = prefix + "a".repeat(2048 - prefix.length);
    const ng = prefix + "a".repeat(2049 - prefix.length);
    expect(ok.length).toBe(2048);
    expect(ng.length).toBe(2049);
    expect(parseQuestPhotoPath(ok, SUPA)).toBe("a".repeat(2048 - prefix.length));
    expect(parseQuestPhotoPath(ng, SUPA)).toBeNull();
  });

  it("buildQuestPhotoPath が作ったパスの公開 URL を往復できる", () => {
    const p = buildQuestPhotoPath("child-1", "q1", new Date(1700000000000), "webp");
    expect(parseQuestPhotoPath(`${base}/${p}`, SUPA)).toBe(p);
  });
});

describe("isAllowedQuestPhotoUrl は parseQuestPhotoPath 導入後も挙動維持（#235）", () => {
  it("旧形式（1 セグメント）の報告 URL は引き続き拒否する（parser は返すが isAllowed は false）", () => {
    expect(parseQuestPhotoPath(`${base}/q1_1700000000000.webp`, SUPA)).not.toBeNull();
    expect(isAllowedQuestPhotoUrl(`${base}/q1_1700000000000.webp`, CHILD, SUPA)).toBe(false);
  });

  it("2 セグメントで先頭が childId のときのみ許可する", () => {
    expect(isAllowedQuestPhotoUrl(`${base}/${CHILD}/a.jpg`, CHILD, SUPA)).toBe(true);
    expect(isAllowedQuestPhotoUrl(`${base}/child-2/a.jpg`, CHILD, SUPA)).toBe(false);
  });
});
