"use client";

// A booster pack: crimped foil wrapper, the pack's featured card in a window, its name below.
import { useT } from "@/game/locale";
import { asset } from "@/game/assets";
import type { PackKind } from "@/game/v3/gacha";

/** Foil colours of each kind of pack. */
const FOIL: Record<string, string> = {
  beginnings: "linear-gradient(160deg,#6ee7a8 0%,#15803d 55%,#064e3b 100%)",
  exodus: "linear-gradient(160deg,#fcd34d 0%,#b45309 55%,#78350f 100%)",
  kingdom: "linear-gradient(160deg,#fda4af 0%,#be123c 55%,#881337 100%)",
  prophets: "linear-gradient(160deg,#fdba74 0%,#c2410c 55%,#7c2d12 100%)",
  exile: "linear-gradient(160deg,#a5b4fc 0%,#4338ca 55%,#1e1b4b 100%)",
  nativity: "linear-gradient(160deg,#f0abfc 0%,#a21caf 55%,#4a044e 100%)",
  ministry: "linear-gradient(160deg,#7dd3fc 0%,#0369a1 55%,#082f49 100%)",
  passion: "linear-gradient(160deg,#d6d3d1 0%,#57534e 55%,#1c1917 100%)",
  church: "linear-gradient(160deg,#fde68a 0%,#ca8a04 55%,#713f12 100%)",
};

/** Pack proportions, width : height. */
export const PACK_RATIO = "aspect-[9/14]";

export function PackArt({ pack, className = "" }: { pack: PackKind; className?: string }) {
  const t = useT();
  return (
    <div className={`relative w-full ${PACK_RATIO} overflow-hidden rounded-md shadow-[0_8px_24px_rgb(0_0_0/0.6)] ring-1 ring-black/50 ${className}`} style={{ background: FOIL[pack.id] ?? FOIL.passion }}>
      {/* Crimped top and bottom seals */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[7%] bg-black/20" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.28) 0 1.5px, transparent 1.5px 5px)" }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[5%] bg-black/20" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.28) 0 1.5px, transparent 1.5px 5px)" }} />
      <div className="absolute inset-x-[9%] top-[14%] h-[52%] overflow-hidden rounded-sm border-2 border-white/70 shadow-inner">
        {/* eslint-disable-next-line @next/next/no-img-element -- card art is a plain file */}
        <img src={asset(`/cards/${pack.featured}.jpg`)} alt="" draggable={false} className="h-full w-full object-cover object-top" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/35" />
      </div>
      <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center gap-[2%] text-center text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">
        <span className="text-[0.55em] font-bold uppercase tracking-[0.3em] opacity-80">Bible Quest</span>
        <span className="px-2 text-[1.25em] font-black leading-tight">{t(`v3.pack.${pack.id}.name`)}</span>
      </div>
      {/* A shine that sweeps across the foil now and then */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" style={{ animation: "bq-pack-shine 3.6s ease-in-out infinite" }} />
      </div>
    </div>
  );
}
