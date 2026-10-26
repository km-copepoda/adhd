const MAX_URL_LENGTH = 2048;
const PUBLIC_PATH_PREFIX = "/storage/v1/object/public/quest-photos/";
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** quest-photos バケットのアップロード先パス: `<childId>/<questId>_<ts>.<ext>` */
export function buildQuestPhotoPath(childId: string, questId: string, now: Date, ext: string): string {
  return `${childId}/${questId}_${now.getTime()}.${ext}`;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * quest-photos の公開 URL からバケット内のパスを取り出す。
 * 旧形式（フラット `<file>`）と新形式（`<childId>/<file>`）のみ受理し、
 * それ以外（別ホスト・query/hash・`.`/`..`・不正エンコード等）は null。
 * URL パーサは `..` や `\` を正規化してしまうため、パスは生の文字列から取り出して検証する。
 */
export function parseQuestPhotoPath(url: string, supabaseUrl: string): string | null {
  if (typeof url !== "string" || typeof supabaseUrl !== "string" || !url || !supabaseUrl) return null;
  if (url.length > MAX_URL_LENGTH) return null;
  if (url.includes("?") || url.includes("#") || url.includes("\\")) return null;

  const base = safeUrl(supabaseUrl);
  const target = safeUrl(url);
  if (!base || !target) return null;
  if (target.protocol !== base.protocol || target.hostname !== base.hostname || target.port !== base.port) {
    return null;
  }
  if (target.username || target.password) return null;

  const rawPath = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*/, "");
  if (!rawPath.startsWith(PUBLIC_PATH_PREFIX)) return null;

  const rawSegments = rawPath.slice(PUBLIC_PATH_PREFIX.length).split("/");
  if (rawSegments.length < 1 || rawSegments.length > 2) return null;

  const segments: string[] = [];
  for (const raw of rawSegments) {
    let seg: string;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (seg === "" || seg === "." || seg === "..") return null;
    if (seg.includes("/") || seg.includes("\\") || CONTROL_CHARS.test(seg)) return null;
    segments.push(seg);
  }
  return segments.join("/");
}

/**
 * 報告 API に渡された photoUrl が、対象の子どものフォルダ配下の quest-photos 公開 URL かを検証する。
 * 任意の外部 URL や他の子どものフォルダ・パストラバーサルを拒否する。
 */
export function isAllowedQuestPhotoUrl(url: string, childId: string, supabaseUrl: string): boolean {
  if (!childId) return false;
  const path = parseQuestPhotoPath(url, supabaseUrl);
  if (!path) return false;
  const [folder, file, ...rest] = path.split("/");
  return folder === childId && !!file && rest.length === 0 && !file.includes("..");
}
