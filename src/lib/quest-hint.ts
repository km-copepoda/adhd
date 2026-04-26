type ReportHintParams = {
  hasQuests: boolean;
  anyReported: boolean;
  hasSeen: boolean;
  hasEverReported: boolean;
};

export function shouldShowReportHint({ hasQuests, anyReported, hasSeen, hasEverReported }: ReportHintParams): boolean {
  if (hasSeen) return false;
  if (hasEverReported) return false;
  if (!hasQuests) return false;
  if (anyReported) return false;
  return true;
}
