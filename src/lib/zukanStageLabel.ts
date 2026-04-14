/** 進化パス文字列（例: "STUDY_STAMINA"）から図鑑用ステージラベルを返す */
export function getZukanStageLabel(path: string): string {
  const depth = path.split("_").length;
  return `第${depth}形態`;
}
