"use client";

// /card-demo: every card, highest rarity first, to compare frames and effects.
import { useState } from "react";
import { CHARACTER_ELEMENT, ENEMY_ELEMENT } from "@/game/v2/data";
import type { CharacterId, EnemyId } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { CharacterCardFace } from "./CharacterCardFace";
import { EnemyCardFace } from "./EnemyCardFace";
import { HoloCard } from "./HoloCard";
import { CARD_RARITY, type Rarity } from "./rarity";

const RARITY_ORDER: Rarity[] = ["N", "R", "SR", "SSR", "UR"];

const CARDS: { id: CharacterId | EnemyId; enemy?: boolean }[] = [
  { id: "david" },
  { id: "goliath", enemy: true },
  { id: "samuel" },
  { id: "jonathan" },
  { id: "adam" },
  { id: "eve" },
  { id: "bearer", enemy: true },
  { id: "archer", enemy: true },
];

export function CardDemo() {
  const t = useT();
  const [effects, setEffects] = useState(true);
  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_30%,#3b2f1a_0%,#1c1917_55%,#0c0a09_100%)] px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-bold">{t("v3.demo.title")}</h1>
        <p className="mt-1 text-sm text-stone-400">{t("v3.demo.hint")}</p>
      </div>
      <div className="flex max-w-full snap-x snap-mandatory gap-6 overflow-x-auto px-2 py-4">
        {CARDS.map(({ id, enemy }) => (
          <div key={id} className="flex shrink-0 snap-center flex-col items-center gap-2">
            <HoloCard
              element={enemy ? ENEMY_ELEMENT[id as EnemyId] : CHARACTER_ELEMENT[id as CharacterId]}
              effects={effects}
              rarity={CARD_RARITY[id]}
              className="w-[280px] text-[13px] sm:w-[300px] sm:text-[14px]"
            >
              {enemy ? <EnemyCardFace id={id as EnemyId} /> : <CharacterCardFace id={id as CharacterId} />}
            </HoloCard>
            <span className="text-sm font-black tracking-widest text-amber-200">{CARD_RARITY[id]}</span>
          </div>
        ))}
      </div>
      {/* Every rarity on one card, including R and UR which no card uses yet */}
      <div className="text-center">
        <h2 className="text-lg font-bold">{t("v3.demo.rarities")}</h2>
      </div>
      <div className="flex max-w-full snap-x snap-mandatory gap-6 overflow-x-auto px-2 py-4">
        {RARITY_ORDER.map((r) => (
          <div key={r} className="flex shrink-0 snap-center flex-col items-center gap-2">
            <HoloCard element={CHARACTER_ELEMENT.david} effects={effects} rarity={r} className="w-[220px] text-[10.3px] sm:w-[240px] sm:text-[11.2px]">
              <CharacterCardFace id="david" rarity={r} />
            </HoloCard>
            <span className="text-sm font-black tracking-widest text-amber-200">{r}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setEffects(!effects)}
          className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${effects ? "border-amber-300 bg-amber-500 text-stone-950" : "border-stone-500 text-stone-300"}`}
        >
          {effects ? t("v3.demo.effectsOn") : t("v3.demo.effectsOff")}
        </button>
      </div>
    </main>
  );
}
