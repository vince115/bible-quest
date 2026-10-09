"use client";

// Ornate card border: a deep metallic band with a sheen that follows the pointer (--px from HoloCard), and gold floral
// ornaments laid over it as a 9-slice border image. The ornaments are the project's own artwork (public/cards/frame-*.png,
// navy paper keyed out), so they sit on any element colour.
import type { ReactNode } from "react";
import { RARITY, type Rarity } from "./rarity";

export type Ornament = "dove" | "lily";

/** The corner pieces are 34% of the ornament image; the middles repeat to fill each edge. */
const SLICE = 34;
/**
 * Face inset (padding, % of the card width), just inside the ornament's inner gold line (7.8% of the image).
 * cqw below is measured inside this padding, so it is scaled back to card widths.
 */
const INSET = 4.5;
const cardW = (pct: number) => `${(pct * 100) / (100 - 2 * INSET)}cqw`;

/**
 * Gallery-frame moulding profile across the band, outer edge → picture: a dark outer lip with a highlight, a groove,
 * a low, soft rise, a shadowed cove, and a bright gilded bevel right at the picture's edge.
 */
const MOULDING = [
  "rgb(0 0 0 / 0.95) 0%",
  "rgb(255 255 255 / 0.45) 9%",
  "rgb(0 0 0 / 0.75) 20%",
  "rgb(255 255 255 / 0.12) 46%",
  "rgb(0 0 0 / 0.8) 72%",
  "rgb(255 255 255 / 0.85) 90%",
  "rgb(0 0 0 / 0.7) 100%",
].join(", ");
/**
 * The four sides of the band, each a trapezoid so they meet on the diagonals like a picture frame. light: the gallery
 * lamp is above the frame, so the top rail is brightest and the bottom rail darkest.
 */
const FRAME_SIDES = [
  { name: "top", toward: "to bottom", light: "rgb(255 255 255 / 0.18)", box: (w: string) => ({ top: 0, left: 0, right: 0, height: w }), clip: (w: string) => `polygon(0 0, 100% 0, calc(100% - ${w}) 100%, ${w} 100%)` },
  { name: "bottom", toward: "to top", light: "rgb(0 0 0 / 0.3)", box: (w: string) => ({ bottom: 0, left: 0, right: 0, height: w }), clip: (w: string) => `polygon(${w} 0, calc(100% - ${w}) 0, 100% 100%, 0 100%)` },
  { name: "left", toward: "to right", light: "rgb(255 255 255 / 0.06)", box: (w: string) => ({ top: 0, bottom: 0, left: 0, width: w }), clip: (w: string) => `polygon(0 0, 100% ${w}, 100% calc(100% - ${w}), 0 100%)` },
  { name: "right", toward: "to left", light: "rgb(0 0 0 / 0.12)", box: (w: string) => ({ top: 0, bottom: 0, right: 0, width: w }), clip: (w: string) => `polygon(0 ${w}, 100% 0, 100% 100%, 0 calc(100% - ${w}))` },
];

/**
 * fill: cover the parent (fixed-aspect cards); false lets the content set the height.
 * rarity: decides the ornaments (none for N), a running gold sheen (SSR+) and a prismatic frame (UR).
 * ornament: overrides the rarity's ornament (the card demo compares frames).
 */
export function CardFrame({
  frame,
  rarity = "SR",
  ornament,
  fill = true,
  children,
}: {
  frame: string;
  rarity?: Rarity;
  ornament?: Ornament;
  fill?: boolean;
  children: ReactNode;
}) {
  const look = RARITY[rarity];
  const art = look.ornament ? (ornament ?? look.ornament) : null;
  return (
    <div className={`${fill ? "absolute inset-0" : "relative"} bg-gradient-to-br [container-type:inline-size] ${frame}`} style={{ padding: `${INSET}%` }}>
      {/* Metallic sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
        style={{
          backgroundImage:
            "conic-gradient(from 200deg at 50% 50%, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.55), rgb(0 0 0 / 0.35), rgb(255 255 255 / 0.45), rgb(0 0 0 / 0.3), rgb(255 255 255 / 0.1))",
        }}
      />
      {/* A band of light that slides across the border as the card turns */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage: "linear-gradient(105deg, transparent 38%, rgb(255 255 255 / 0.7) 50%, transparent 62%)",
          backgroundSize: "260% 100%",
          backgroundPosition: "var(--px, 50%) 0",
          opacity: "calc(0.25 + var(--o, 0) * 0.6)",
        }}
      />
      {/* Picture-frame moulding: each side shades from dark at the outer edge to light at the face, mitred at the corners */}
      {FRAME_SIDES.map((side) => (
        <div
          key={side.name}
          aria-hidden
          className="pointer-events-none absolute mix-blend-hard-light"
          style={{
            ...side.box(cardW(INSET)),
            clipPath: side.clip(cardW(INSET)),
            backgroundImage: `linear-gradient(${side.light}, ${side.light}), linear-gradient(${side.toward}, ${MOULDING})`,
          }}
        />
      ))}
      {/* UR: prismatic frame cycling through the colours */}
      {look.prism && (
        <div
          aria-hidden
          className="bq-animated pointer-events-none absolute inset-0 mix-blend-color"
          style={{ backgroundImage: "conic-gradient(from 0deg, #f87171, #facc15, #4ade80, #38bdf8, #a78bfa, #f472b6, #f87171)", animation: "bq-prism 6s linear infinite" }}
        />
      )}
      {/* SSR+: a gold sheen that keeps running along the frame */}
      {look.sheen && (
        <div
          aria-hidden
          className="bq-animated pointer-events-none absolute inset-0 mix-blend-overlay"
          style={{
            backgroundImage: "linear-gradient(115deg, transparent 40%, rgb(255 236 170 / 0.95) 50%, transparent 60%)",
            backgroundSize: "250% 100%",
            animation: "bq-sheen 3.6s ease-in-out infinite",
          }}
        />
      )}
      {/* Bevel: light outer edge, dark groove */}
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.5),inset_0_0_0_3px_rgb(0_0_0/0.25)]" />

      {/* The face, with a thin gold inlay */}
      <div className="relative h-full rounded-[0.6%] shadow-[0_0_0_1px_rgb(255_235_180/0.8),0_0_0_2.5px_rgb(60_35_5/0.6)]">
        {children}
        {/* The picture sits recessed behind the moulding */}
        <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_1.2cqw_2cqw_rgb(0_0_0/0.55),inset_0_0_1cqw_rgb(0_0_0/0.4)]" />
      </div>

      {/* Gold floral ornaments over the border and the face's corners (none on N cards) */}
      {art && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 drop-shadow-[0_1px_1px_rgb(0_0_0/0.7)]"
          style={{
            borderStyle: "solid",
            borderColor: "transparent",
            borderWidth: cardW(look.ornamentSize),
            borderImage: `url(/cards/frame-${art}.png) ${SLICE}% / ${cardW(look.ornamentSize)} round`,
          }}
        />
      )}
    </div>
  );
}
