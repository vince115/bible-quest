"use client";

// A booster pack: crimped foil wrapper, the pack's featured card in a window, its name below.
import { useT } from "@/game/locale";
import { asset } from "@/game/assets";
import type { PackKind } from "@/game/v3/gacha";
import { foilCss, foilOf, packPicture } from "./packStyle";

/** Pack proportions, width : height. */
export const PACK_RATIO = "aspect-[9/14]";
/** The crimped foil seals at the head and foot, as a share of the pack's height (the 3D stage draws the same ones). */
export const SEAL_TOP = 0.07;
export const SEAL_BOTTOM = 0.05;

/** One crimped seal: the foil, finely ridged, with a bright lip along the picture side and the shadow it throws. */
function Seal({ id, top }: { id: string; top: boolean }) {
  const [light, mid, dark] = foilOf(id);
  const size = `${(top ? SEAL_TOP : SEAL_BOTTOM) * 100}%`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0"
      style={{
        [top ? "top" : "bottom"]: 0,
        height: size,
        backgroundImage: `repeating-linear-gradient(90deg, rgb(255 255 255 / 0.5) 0 1.2px, transparent 1.2px 2px, rgb(0 0 0 / 0.28) 2px 3.2px, transparent 3.2px 4px), linear-gradient(${top ? "180deg" : "0deg"}, ${dark}, ${top ? mid : light} 50%, ${top ? light : mid})`,
        boxShadow: `0 ${top ? 3 : -3}px 4px rgb(0 0 0 / 0.35)`,
        borderBottom: top ? "2px solid rgb(255 255 255 / 0.8)" : undefined,
        borderTop: top ? undefined : "2px solid rgb(255 255 255 / 0.8)",
      }}
    />
  );
}

export function PackArt({ pack, className = "" }: { pack: PackKind; className?: string }) {
  const t = useT();
  return (
    <div className={`relative w-full ${PACK_RATIO} overflow-hidden rounded-md shadow-[0_8px_24px_rgb(0_0_0/0.6)] ring-1 ring-black/50 ${className}`} style={{ background: foilCss(pack.id) }}>
      {/* The wrapper picture fills the whole pack, its crimped foil seals included */}
      {/* eslint-disable-next-line @next/next/no-img-element -- pack art is a plain file */}
      <img src={asset(packPicture(pack))} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <Seal id={pack.id} top />
      <Seal id={pack.id} top={false} />
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
