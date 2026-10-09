"use client";

// The rarity mark: pure white brush lettering, tilted, with a wide outline in the rarity's metal (bronze, silver,
// gold, neon rainbow), a translucent black halo and a soft glow. Drawn as SVG text so the outline can be a gradient.
import { useId } from "react";
import type { Element } from "@/game/v2/types";
import type { Rarity } from "./rarity";

/** Outline metal per rarity: gradient stops (top to bottom) and the glow colour. */
const METAL: Record<Rarity, { stops: string[]; glow: string }> = {
  N: { stops: ["#d6d3d1", "#78716c", "#a8a29e", "#44403c"], glow: "#a8a29e" },
  R: { stops: ["#f3c58f", "#b8733a", "#e2a364", "#5a2e12"], glow: "#d08a4a" },
  SR: { stops: ["#ffffff", "#9ca3af", "#e5e7eb", "#4b5563"], glow: "#cbd5e1" },
  SSR: { stops: ["#fff3b0", "#f59e0b", "#fde68a", "#92400e"], glow: "#fbbf24" },
  UR: { stops: ["#ff2fd0", "#ffe600", "#2dff6a", "#00e5ff", "#6a5cff"], glow: "#c084fc" },
};

// element is kept in the signature for callers; the outline now follows the rarity, like the frame ornaments.
export function RarityMark({ rarity, className = "" }: { rarity: Rarity; element?: Element; className?: string }) {
  const id = useId().replace(/:/g, "");
  const metal = METAL[rarity];
  const ur = rarity === "UR";
  // Each letter gets ~62 units; the text is fitted to that width so the SVG box matches it exactly.
  const width = rarity.length * 62 + 36;
  const text = {
    x: 18,
    y: 78,
    fontSize: 80,
    textLength: width - 36,
    lengthAdjust: "spacingAndGlyphs" as const,
    style: { fontFamily: "var(--font-brush)" },
  };
  return (
    <svg
      aria-label={rarity}
      viewBox={`0 0 ${width} 100`}
      className={`pointer-events-none absolute z-20 -rotate-[15deg] overflow-visible [filter:drop-shadow(0.04em_0.08em_0.06em_rgb(0_0_0/0.25))] ${className}`}
      style={{ height: "2.1em", width: `${(width / 100) * 2.1}em` }}
    >
      <defs>
        <linearGradient id={`metal-${id}`} x1="0" y1="0" x2={ur ? "1" : "0"} y2="1">
          {metal.stops.map((c, i) => (
            <stop key={i} offset={i / (metal.stops.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
        <filter id={`bristle-${id}`} x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.45" numOctaves="2" seed="7" result="streaks" />
          <feColorMatrix in="streaks" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 1.5" result="gaps" />
          <feComposite in="SourceGraphic" in2="gaps" operator="in" result="brushed" />
          <feTurbulence type="turbulence" baseFrequency="0.9" numOctaves="1" seed="3" result="grain" />
          <feDisplacementMap in="brushed" in2="grain" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {/* Translucent black halo */}
      <text {...text} fill="none" stroke="rgb(0 0 0 / 0.4)" strokeWidth="30" strokeLinejoin="round">
        {rarity}
      </text>
      {/* Metal outline at 30% opacity, with the brush texture and a glow (UR's neon keeps cycling) */}
      <g
        className={ur ? "bq-animated" : undefined}
        style={{
          filter: `url(#bristle-${id}) drop-shadow(0 0 4px ${metal.glow}99) drop-shadow(0 0 9px ${metal.glow}55)`,
          animation: ur ? "bq-prism 4s linear infinite" : undefined,
        }}
      >
        <text {...text} fill="none" stroke={`url(#metal-${id})`} strokeOpacity="0.3" strokeWidth="20" strokeLinejoin="round">
          {rarity}
        </text>
      </g>
      {/* Pure white letters */}
      <text {...text} fill="#ffffff">
        {rarity}
      </text>
    </svg>
  );
}
