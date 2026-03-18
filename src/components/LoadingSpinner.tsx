import { getSpinnerSizeClass, SpinnerSize } from "@/lib/spinner";

interface Props {
  size?: SpinnerSize;
}

export default function LoadingSpinner({ size = "md" }: Props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div
        className={`${getSpinnerSizeClass(size)} rounded-full border-4 border-quest-border border-t-quest-gold animate-spin`}
      />
    </div>
  );
}
