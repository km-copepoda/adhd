"use client";

type ChildOption = {
  id: string;
  monsterName: string | null;
};

type Props = {
  childOptions: ChildOption[];
  selectedChildId: string | null;
  onSelect: (childId: string) => void;
};

export default function ChildSelector({ childOptions, selectedChildId, onSelect }: Props) {
  if (childOptions.length <= 1) return null;
  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
      {childOptions.map((child) => {
        const name = child.monsterName || "名前未設定";
        return (
          <button
            key={child.id}
            onClick={() => onSelect(child.id)}
            className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
              selectedChildId === child.id
                ? "bg-quest-gold/15 border border-quest-gold text-quest-gold"
                : "bg-quest-card border border-quest-border text-quest-dim hover:text-quest-text",
            ].join(" ")}
          >
            🧒 {name}
          </button>
        );
      })}
    </div>
  );
}
