const MAX_URL_LENGTH = 2048;

/** quest-photos バケットのアップロード先パス: `<childId>/<questId>_<ts>.<ext>` */
export function buildQuestPhotoPath(childId: string, questId: string, now: Date, ext: string): string {
  return `${childId}/${questId}_${now.getTime()}.${ext}`;
}

/**
 * 報告 API に渡された photoUrl が、対象の子どものフォルダ配下の quest-photos 公開 URL かを検証する。
 * 任意の外部 URL や他の子どものフォルダ・パストラバーサルを拒否する。
 */
export function isAllowedQuestPhotoUrl(url: string, childId: string, supabaseUrl: string): boolean {
  if (!supabaseUrl || !childId || typeof url !== "string") return false;
  if (url.length > MAX_URL_LENGTH) return false;

  const prefix = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/quest-photos/${childId}/`;
  if (!url.startsWith(prefix)) return false;

  const fileName = url.slice(prefix.length);
  if (fileName.length === 0) return false;
  if (/[/?#]/.test(fileName) || fileName.includes("..") || /%2f/i.test(fileName)) return false;
  return true;
}
