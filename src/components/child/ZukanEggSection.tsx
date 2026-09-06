"use client";

import Image from "next/image";
import { getRebirthEggImage } from "@/lib/monsterThemes/eggs";

function shadowPath(imagePath: string): string {
  return imagePath.replace("/monsters/", "/monsters/shadow/");
}

interface ZukanEggSectionProps {
  eggData: { image: string };
  usedEggs: Set<string>;
  /** 現在有効なモンスターテーマセット id。未指定・null・未知のIDは
   *  既定（dark/light相当）の卵画像にフォールバックする。 */
  monsterSetId?: string | null;
}

export default function ZukanEggSection({ eggData, usedEggs, monsterSetId = null }: ZukanEggSectionProps) {
  return (
    <div className="flex flex-col items-center mb-4">
      <div className="flex gap-2 justify-center flex-wrap">
        <div className="bg-quest-card border border-quest-border rounded-xl p-3 flex flex-col items-center gap-1 w-28">
          <Image
            src={eggData.image}
            alt="たまご"
            width={56}
            height={56}
            className="object-contain"
          />
          <p className="text-xs text-quest-text">🥚 たまご</p>
        </div>
        {[
          { img: "/monsters/egg-study.webp", label: "📚 勉強の卵", color: "rgba(96,165,250,0.3)", key: "STUDY" },
          { img: "/monsters/egg-stamina.webp", label: "💪 体力の卵", color: "rgba(248,113,113,0.3)", key: "STAMINA" },
          { img: "/monsters/egg-life.webp", label: "🌿 生活力の卵", color: "rgba(74,222,128,0.3)", key: "LIFE" },
        ].map((egg) => {
          const obtained = usedEggs.has(egg.key);
          const eggImg = getRebirthEggImage(egg.key, monsterSetId) ?? egg.img;
          return (
            <div
              key={egg.label}
              className="bg-quest-card border border-quest-border rounded-xl p-3 flex flex-col items-center gap-1 w-28"
              style={{ borderColor: obtained ? egg.color : "transparent" }}
            >
              <Image
                src={obtained ? eggImg : shadowPath(eggImg)}
                alt={egg.label}
                width={56}
                height={56}
                className="object-contain"
              />
              <p className="text-[10px] text-center" style={{ color: obtained ? "var(--quest-text)" : "rgba(154,140,110,0.5)" }}>
                {obtained ? egg.label : "？？？"}
              </p>
            </div>
          );
        })}
      </div>
      <div className="text-quest-dim/50 text-[11px] mt-2">▾ 孵化</div>
    </div>
  );
}
