import { describe, it, expect } from "vitest";
import { isAllowedQuestPhotoUrl, buildQuestPhotoPath } from "@/lib/questPhotoUrl";

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
