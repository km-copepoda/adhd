type ReportHintParams = {
  hasQuests: boolean;
  anyReported: boolean;
  hasSeen: boolean;
};

export function shouldShowReportHint({ hasQuests, anyReported, hasSeen }: ReportHintParams): boolean {
  if (hasSeen) return false;
  if (!hasQuests) return false;
  if (anyReported) return false;
  return true;
}
