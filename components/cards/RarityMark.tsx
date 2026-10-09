"use client";

// The rarity mark: pure white brush lettering, tilted slightly, with a wide, dark outline in a deep shade of the
// card's element colour and a soft glow. The outline carries a light dry-brush texture (an SVG filter: horizontal noise cuts thin gaps, a
// little displacement roughens the edges); the white letters stay clean.
import { useId } from "react";
import type { Element } from "@/game/v2/types";
import type { Rarity } from "./rarity";

/** Deep shades of each element colour, so the outline reads as a dark rim around the white letters. */
const ELEMENT_INK: Record<Element, string> = {
  light: "#7c2d12",
  dark: "#3b0764",
  water: "#0c4a6e",
  fire: "#7f1d1d",
  wood: "#14532d",
};

/** Brighter element colours for the halo of light around the mark. */
const ELEMENT_GLOW: Record<Element, string> = {
  light: "#f59e0b",
  dark: "#8b5cf6",
  water: "#38bdf8",
  fire: "#ef4444",
  wood: "#22c55e",
};

export function RarityMark({ rarity, element, className = "" }: { rarity: Rarity; element: Element; className?: string }) {
  const id = useId().replace(/:/g, "");
  const ink = ELEMENT_INK[element];
  const glow = ELEMENT_GLOW[element];
  return (
    <>
      <svg aria-hidden className="absolute h-0 w-0">
        <filter id={`bristle-${id}`} x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.45" numOctaves="2" seed="7" result="streaks" />
          <feColorMatrix in="streaks" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 1.5" result="gaps" />
          <feComposite in="SourceGraphic" in2="gaps" operator="in" result="brushed" />
          <feTurbulence type="turbulence" baseFrequency="0.9" numOctaves="1" seed="3" result="grain" />
          <feDisplacementMap in="brushed" in2="grain" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <span
        aria-label={rarity}
        className={`pointer-events-none absolute z-20 -rotate-[15deg] whitespace-nowrap text-[1.6em] font-normal leading-none [font-family:var(--font-brush)] [filter:drop-shadow(0.04em_0.08em_0.06em_rgb(0_0_0/0.25))] ${className}`}
      >
        {/* A soft, translucent black halo just outside the outline */}
        <span
          aria-hidden
          className="absolute inset-0 text-transparent"
          style={{ WebkitTextStroke: "0.38em rgb(0 0 0 / 0.4)", filter: `url(#bristle-${id}) blur(0.02em)` }}
        >
          {rarity}
        </span>
        {/* Wide, dark outline in the element colour */}
        <span
          aria-hidden
          className="absolute inset-0 text-transparent"
          style={{ WebkitTextStroke: `0.26em ${ink}e6`, filter: `url(#bristle-${id}) drop-shadow(0 0 0.08em ${ink}cc) drop-shadow(0 0 0.18em ${glow}59) drop-shadow(0 0 0.35em ${glow}33)` }}
        >
          {rarity}
        </span>
        {/* Pure white letters on top, with a shadow cast down-right onto the outline */}
        <span className="relative text-white [text-shadow:0.03em_0.06em_0.04em_rgb(0_0_0/0.28)]">{rarity}</span>
      </span>
    </>
  );
}
