"use client";

import { useState } from "react";
import MonsterImageModal from "@/components/MonsterImageModal";

type Member = {
  id: string;
  monsterName: string;
  speciesName: string;
  monsterImage: string;
  evolutionStage: number;
  isMe: boolean;
};

export default function GatheringMemberList({ members }: { members: Member[] }) {
  const [selected, setSelected] = useState<Member | null>(null);

  if (members.length === 0) return null;

  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
      <h2 className="text-sm font-bold mb-3 text-quest-dim">
        👥 なかま <span className="text-quest-gold">{members.length}</span>人
      </h2>
      {/* 4列グリッド + 縦スクロール（30/50人でもUIが膨らみすぎないよう max-h で制限） */}
      <div className="grid grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-1">
        {members.map((m) => {
          const cellClassName = `flex flex-col items-center text-center rounded-lg p-1.5 border w-full ${
            m.isMe ? "border-quest-gold bg-quest-gold/10" : "border-transparent"
          }`;
          const content = (
            <>
              {m.monsterImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.monsterImage}
                  alt={m.monsterName}
                  className="w-14 h-14 object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="w-14 h-14 flex items-center justify-center text-2xl">
                  ❓
                </div>
              )}
              <span className="block text-[11px] font-bold leading-tight mt-1 truncate w-full">
                {m.monsterName}
              </span>
              {m.speciesName !== m.monsterName && (
                <span className="block text-[10px] text-quest-dim leading-tight truncate w-full">
                  {m.speciesName}
                </span>
              )}
            </>
          );

          // monsterImage が空（異常データ）はモーダルで next/image にエラーになるため拡大表示不可にする
          if (!m.monsterImage) {
            return (
              <div key={m.id} className={cellClassName}>
                {content}
              </div>
            );
          }

          return (
            <button
              key={m.id}
              type="button"
              aria-label={`${m.monsterName}を大きく表示`}
              onClick={() => setSelected(m)}
              className={`${cellClassName} bg-transparent`}
            >
              {content}
            </button>
          );
        })}
      </div>
      {selected ? (
        <MonsterImageModal
          image={selected.monsterImage}
          monsterName={selected.monsterName}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
