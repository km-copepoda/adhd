export type SpinnerSize = "sm" | "md" | "lg";

export function getSpinnerSizeClass(size: SpinnerSize = "md"): string {
  const map: Record<SpinnerSize, string> = {
    sm: "w-6 h-6",
    md: "w-12 h-12",
    lg: "w-20 h-20",
  };
  return map[size];
}
