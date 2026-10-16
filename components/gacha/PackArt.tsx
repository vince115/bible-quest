"use client";

// A booster pack: crimped foil wrapper, the pack's featured card in a window, its name below.
import { useT } from "@/game/locale";
import { asset } from "@/game/assets";
import type { PackKind } from "@/game/v3/gacha";
import { foilCss, packPicture } from "./packStyle";

/** Pack proportions, width : height. */
export const PACK_RATIO = "aspect-[9/14]";

export function PackArt({ pack, className = "" }: { pack: PackKind; className?: string }) {
  const t = useT();
  return (
    <div className={`relative w-full ${PACK_RATIO} overflow-hidden rounded-md shadow-[0_8px_24px_rgb(0_0_0/0.6)] ring-1 ring-black/50 ${className}`} style={{ background: foilCss(pack.id) }}>
      {/* The wrapper picture fills the whole pack, its crimped foil seals included. crossOrigin: the 3D stage fetches the same file as a texture
          with CORS, and a copy cached from a plain <img> request has no CORS header (the stage would then draw plain foil). */}
      {/* eslint-disable-next-line @next/next/no-img-element -- pack art is a plain file */}
      <img src={asset(packPicture(pack))} alt="" crossOrigin="anonymous" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-[9%] flex flex-col items-center gap-[2%] text-center text-white">
        <span className="text-[0.55em] font-bold uppercase tracking-[0.3em] opacity-90 [-webkit-text-stroke:2px_rgb(0_0_0/0.7)] [paint-order:stroke_fill]">Bible Quest</span>
        <span className="px-2 text-[1.5em] font-black leading-tight [-webkit-text-stroke:4px_rgb(0_0_0/0.75)] [paint-order:stroke_fill]">{t(`v3.pack.${pack.id}.name`)}</span>
      </div>
      {/* A shine that sweeps across the foil now and then */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: "bq-pack-shine 3.6s ease-in-out infinite" }} />
      </div>
    </div>
  );
}
