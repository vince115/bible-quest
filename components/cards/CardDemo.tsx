"use client";

// /card-demo: try the holographic character cards on their own.
import { useState } from "react";
import { CHARACTER_ELEMENT, PARTY_ORDER } from "@/game/v2/data";
import { useT } from "@/game/locale";
import type { Ornament } from "./CardFrame";
import { CharacterCardFace, hasArt } from "./CharacterCardFace";
import { HoloCard } from "./HoloCard";

export function CardDemo() {
  const t = useT();
  const [effects, setEffects] = useState(true);
  const [ornament, setOrnament] = useState<Ornament>("dove");
  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_30%,#3b2f1a_0%,#1c1917_55%,#0c0a09_100%)] px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-bold">{t("v3.demo.title")}</h1>
        <p className="mt-1 text-sm text-stone-400">{t("v3.demo.hint")}</p>
      </div>
      <div className="flex max-w-full snap-x snap-mandatory gap-6 overflow-x-auto px-2 py-4 lg:overflow-visible">
        {PARTY_ORDER.map((id) => (
          <HoloCard
            key={id}
            element={CHARACTER_ELEMENT[id]}
            effects={effects}
            foil={hasArt(id) ? 0.08 : 0.25}
            className="w-[280px] shrink-0 snap-center text-[13px] sm:w-[320px] sm:text-[15px]"
          >
            <CharacterCardFace id={id} ornament={ornament} />
          </HoloCard>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {(["dove", "lily"] as Ornament[]).map((o) => (
          <button
            key={o}
            onClick={() => setOrnament(o)}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${ornament === o ? "border-amber-300 bg-amber-500 text-stone-950" : "border-stone-500 text-stone-300"}`}
          >
            {t(`v3.demo.frame.${o}`)}
          </button>
        ))}
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
