"use client";

// A trading card that tilts toward the pointer, with a glare and an element foil that follow it.
// Our own take on the technique popularised by pokemon-cards-css (no code or art copied):
// pointer position → springs → CSS variables (--px, --py, --o) read by the foil and glare layers.
import { motion, useMotionTemplate, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";
import type { Element } from "@/game/v2/types";
import { RARITY, type Rarity } from "./rarity";

const SPRING = { stiffness: 180, damping: 18, mass: 0.6 };
/** Maximum tilt in degrees at the card's edge. */
const TILT = 16;

/** Foil pattern per element, laid over the card with colour-dodge. */
export const ELEMENT_FOIL: Record<Element, string> = {
  // ☀️ light: golden rays from the pointer over a rainbow sheen
  light: `repeating-conic-gradient(from 0deg at var(--px) var(--py), rgb(255 240 180 / 0) 0deg, rgb(255 236 160 / 0.6) 3deg, rgb(255 240 180 / 0) 8deg),
    linear-gradient(115deg, hsl(0 90% 70%), hsl(45 100% 70%), hsl(110 80% 70%), hsl(190 90% 70%), hsl(270 80% 72%), hsl(330 90% 70%), hsl(0 90% 70%))`,
  // 🌙 dark: violet star field
  dark: `radial-gradient(circle at 20% 30%, rgb(255 255 255 / 0.8) 0 1px, transparent 2px),
    radial-gradient(circle at 70% 60%, rgb(255 255 255 / 0.7) 0 1px, transparent 2px),
    radial-gradient(circle at 40% 80%, rgb(255 255 255 / 0.6) 0 1px, transparent 2px),
    linear-gradient(125deg, hsl(260 80% 40%), hsl(300 80% 55%), hsl(220 90% 50%), hsl(280 80% 45%))`,
  // 💧 water: ripples
  water: `repeating-radial-gradient(circle at var(--px) var(--py), rgb(180 230 255 / 0) 0 6px, rgb(180 230 255 / 0.5) 8px, rgb(180 230 255 / 0) 12px),
    linear-gradient(120deg, hsl(190 90% 60%), hsl(220 90% 65%), hsl(170 80% 60%), hsl(200 90% 60%))`,
  // 🔥 fire: embers
  fire: `repeating-linear-gradient(60deg, rgb(255 200 120 / 0) 0 10px, rgb(255 180 90 / 0.45) 12px, rgb(255 200 120 / 0) 16px),
    linear-gradient(120deg, hsl(10 95% 60%), hsl(40 100% 60%), hsl(350 90% 55%), hsl(25 100% 60%))`,
  // 🪙 metal: brushed steel with a moving glint
  metal: `repeating-linear-gradient(90deg, rgb(255 255 255 / 0) 0 3px, rgb(255 255 255 / 0.35) 4px, rgb(255 255 255 / 0) 6px),
    linear-gradient(115deg, hsl(210 15% 55%), hsl(45 30% 80%), hsl(200 20% 65%), hsl(220 15% 85%), hsl(210 15% 55%))`,
  // ⛰️ earth: strata
  earth: `repeating-linear-gradient(170deg, rgb(255 230 180 / 0) 0 9px, rgb(255 220 160 / 0.45) 11px, rgb(255 230 180 / 0) 15px),
    linear-gradient(120deg, hsl(35 70% 50%), hsl(25 60% 40%), hsl(45 80% 60%), hsl(30 60% 45%))`,
  // 🌿 wood: leaf veins
  wood: `repeating-linear-gradient(-45deg, rgb(200 255 180 / 0) 0 8px, rgb(200 255 180 / 0.45) 10px, rgb(200 255 180 / 0) 14px),
    linear-gradient(120deg, hsl(100 70% 55%), hsl(150 70% 50%), hsl(70 80% 55%), hsl(130 70% 50%))`,
};

/** UR: a cyan→magenta band at 115° that slides with the pointer (colour-dodge), after the classic holo-card pen. */
const UR_BAND =
  "linear-gradient(115deg, transparent 0%, transparent 25%, rgb(0 231 255 / 0.7) 45%, rgb(255 0 231 / 0.7) 55%, transparent 70%, transparent 100%)";

/** Where the figure stands on the card face (fractions): centre-line, head and feet. */
export type FigureArea = { x: number; top: number; bottom: number };
/** A texture layer for the lit-foil effect: a mask image and its tile size. */
type Tex = { image: string; size?: string };
const svgTile = (w: number, h: number, body: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;

/**
 * Lit textures by element (SSR and UR): each shows only where the light falls, tinted by a shifting rainbow and kept
 * off the figure. Drawn in CSS / small SVG tiles.
 */
export const ELEMENT_TEXTURES: Record<Element, Tex[]> = {
  // ☀️ light: rays of glory pouring down from above the card, a dashed ray between each pair of solid ones
  light: [
    {
      image: svgTile(
        63,
        88,
        "<path d='M31.5 -13L-115.2 18.2M31.5 -13L-113.4 25.8M31.5 -13L-111.2 33.4M31.5 -13L-108.5 40.8M31.5 -13L-105.5 48.0M31.5 -13L-102.2 55.1M31.5 -13L-98.4 62.0M31.5 -13L-94.3 68.7M31.5 -13L-89.9 75.2M31.5 -13L-85.1 81.4M31.5 -13L-80.0 87.4M31.5 -13L-74.6 93.1M31.5 -13L-68.9 98.5M31.5 -13L-62.9 103.6M31.5 -13L-56.7 108.4M31.5 -13L-50.2 112.8M31.5 -13L-43.5 116.9M31.5 -13L-36.6 120.7M31.5 -13L-29.5 124.0M31.5 -13L-22.3 127.0M31.5 -13L-14.9 129.7M31.5 -13L-7.3 131.9M31.5 -13L0.3 133.7M31.5 -13L8.0 135.2M31.5 -13L15.8 136.2M31.5 -13L23.6 136.8M31.5 -13L31.5 137.0M31.5 -13L39.4 136.8M31.5 -13L47.2 136.2M31.5 -13L55.0 135.2M31.5 -13L62.7 133.7M31.5 -13L70.3 131.9M31.5 -13L77.9 129.7M31.5 -13L85.3 127.0M31.5 -13L92.5 124.0M31.5 -13L99.6 120.7M31.5 -13L106.5 116.9M31.5 -13L113.2 112.8M31.5 -13L119.7 108.4M31.5 -13L125.9 103.6M31.5 -13L131.9 98.5M31.5 -13L137.6 93.1M31.5 -13L143.0 87.4M31.5 -13L148.1 81.4M31.5 -13L152.9 75.2M31.5 -13L157.3 68.7M31.5 -13L161.4 62.0M31.5 -13L165.2 55.1M31.5 -13L168.5 48.0M31.5 -13L171.5 40.8M31.5 -13L174.2 33.4M31.5 -13L176.4 25.8M31.5 -13L178.2 18.2' stroke='black' stroke-width='0.35'/><path d='M31.5 -13L-114.4 22.0M31.5 -13L-112.3 29.6M31.5 -13L-109.9 37.1M31.5 -13L-107.1 44.4M31.5 -13L-103.9 51.6M31.5 -13L-100.3 58.6M31.5 -13L-96.4 65.4M31.5 -13L-92.1 72.0M31.5 -13L-87.5 78.3M31.5 -13L-82.6 84.4M31.5 -13L-77.3 90.3M31.5 -13L-71.8 95.8M31.5 -13L-65.9 101.1M31.5 -13L-59.8 106.0M31.5 -13L-53.5 110.6M31.5 -13L-46.9 114.9M31.5 -13L-40.1 118.8M31.5 -13L-33.1 122.4M31.5 -13L-25.9 125.6M31.5 -13L-18.6 128.4M31.5 -13L-11.1 130.8M31.5 -13L-3.5 132.9M31.5 -13L4.2 134.5M31.5 -13L11.9 135.7M31.5 -13L19.7 136.5M31.5 -13L27.6 136.9M31.5 -13L35.4 136.9M31.5 -13L43.3 136.5M31.5 -13L51.1 135.7M31.5 -13L58.8 134.5M31.5 -13L66.5 132.9M31.5 -13L74.1 130.8M31.5 -13L81.6 128.4M31.5 -13L88.9 125.6M31.5 -13L96.1 122.4M31.5 -13L103.1 118.8M31.5 -13L109.9 114.9M31.5 -13L116.5 110.6M31.5 -13L122.8 106.0M31.5 -13L128.9 101.1M31.5 -13L134.8 95.8M31.5 -13L140.3 90.3M31.5 -13L145.6 84.4M31.5 -13L150.5 78.3M31.5 -13L155.1 72.0M31.5 -13L159.4 65.4M31.5 -13L163.3 58.6M31.5 -13L166.9 51.6M31.5 -13L170.1 44.4M31.5 -13L172.9 37.1M31.5 -13L175.3 29.6M31.5 -13L177.4 22.0M31.5 -13L179.0 14.3' stroke='black' stroke-width='0.3' stroke-dasharray='1 1'/>",
      ),
      size: "100% 100%",
    },
  ],
  // 🌙 dark: small four-pointed stars
  dark: [
    {
      image: svgTile(34, 34, "<g fill='none' stroke='black' stroke-width='0.9'><path d='M17 9l1.4 6.6L25 17l-6.6 1.4L17 25l-1.4-6.6L9 17l6.6-1.4z'/><path d='M5 3l.6 2.4L8 6l-2.4.6L5 9l-.6-2.4L2 6l2.4-.6z'/></g>"),
      size: "34px 34px",
    },
  ],
  // 💧 water: rolling waves
  water: [{ image: svgTile(36, 14, "<path d='M0 7Q9 1 18 7T36 7' stroke='black' stroke-width='1.1' fill='none'/>"), size: "36px 14px" }],
  // 🔥 fire: outlined S-shaped flames in rows — public/tex-fire.png, a seamless two-flame tile cut from the reference
  // pattern (its repeat measured so the edges meet), used as a mask
  fire: [{ image: "url(/tex-fire.png)", size: "44px 27px" }],
  // 🪙 metal: tumbling blocks — a honeycomb split into rhombi, so it reads as stacked cubes
  metal: [
    {
      image: svgTile(
        24,
        42,
        "<path d='M12 0L24 7V21L12 28L0 21V7ZM12 28V42M12 14L24 7M12 14L0 7M12 14V28M0 35L12 28L24 35M0 35V42M24 35V42M0 0V7M24 0V7' stroke='black' stroke-width='0.8' fill='none'/>",
      ),
      size: "24px 42px",
    },
  ],
  // ⛰️ earth: contour rings, like a map of the hills
  earth: [
    { image: "repeating-radial-gradient(circle at 18% 22%, #000 0 0.8px, transparent 0.8px 6px)" },
    { image: "repeating-radial-gradient(circle at 82% 78%, #000 0 0.8px, transparent 0.8px 6px)" },
  ],
  // 🌿 wood: little three-tier trees in staggered rows
  wood: [
    {
      image: svgTile(
        24,
        28,
        "<defs><path id='t' d='M6 0L9.5 4.5H7.8L11 8.5H8.8L12 12.5H7V14H5V12.5H0L3.2 8.5H1L4.2 4.5H2.5Z'/></defs><use href='#t' x='0' y='0'/><use href='#t' x='12' y='14'/><use href='#t' x='-12' y='14'/><use href='#t' x='24' y='0'/>",
      ),
      size: "24px 28px",
    },
  ],
};

/** A layer that shows `tint` only through the lines of `texture`, inside a soft spot of light under the pointer. */
function LitTexture({ texture, tint, spot, strength, keepOut }: { texture: Tex[]; tint: string; spot: number; strength: number; keepOut?: FigureArea }) {
  const light = `radial-gradient(circle at var(--px) var(--py), #000 0%, rgb(0 0 0 / 0.6) ${spot * 0.4}%, transparent ${spot}%)`;
  // A soft, figure-shaped hole so the texture stays in the background and never covers the character.
  const figure = keepOut
    ? `radial-gradient(ellipse 19% ${((keepOut.bottom - keepOut.top) / 2) * 112}% at ${keepOut.x * 100}% ${((keepOut.top + keepOut.bottom) / 2) * 100}%, transparent 0 78%, #000 100%)`
    : null;
  const lights = figure ? [light, figure] : [light];
  const mask = [...lights, ...texture.map((t) => t.image)].join(",");
  const size = [...lights.map(() => "100% 100%"), ...texture.map((t) => t.size ?? "auto")].join(",");
  // The spot (and the figure hole) cut out the union of the texture layers beneath them.
  const composite = [...lights.map(() => "intersect"), ...texture.map(() => "add")].join(",");
  const webkitComposite = [...lights.map(() => "source-in"), ...texture.map(() => "source-over")].join(",");
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
      style={{
        backgroundImage: tint,
        backgroundSize: "300% 300%",
        backgroundPosition: "var(--bgx) var(--bgy)",
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: size,
        WebkitMaskSize: size,
        maskComposite: composite,
        WebkitMaskComposite: webkitComposite,
        opacity: `calc(var(--o) * ${strength})`,
      }}
    />
  );
}
const REVERSE_RAINBOW =
  "linear-gradient(115deg, hsl(0 90% 70%), hsl(50 100% 70%), hsl(120 80% 70%), hsl(190 90% 70%), hsl(260 80% 75%), hsl(320 90% 72%), hsl(0 90% 70%))";

/** SSR: a soft rainbow sheen that glides across the card as it turns. */
const SSR_RAINBOW =
  "linear-gradient(115deg, transparent 20%, hsl(0 90% 72% / 0.55) 32%, hsl(45 100% 70% / 0.6) 40%, hsl(120 80% 70% / 0.55) 48%, hsl(195 90% 70% / 0.6) 56%, hsl(270 80% 75% / 0.55) 64%, transparent 76%)";

/** The foil layer; strength 0–1 sets how strongly it shows at full interaction. */
export function Foil({ element, strength = 1, className = "" }: { element: Element; strength?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 mix-blend-color-dodge ${className}`}
      style={{
        backgroundImage: ELEMENT_FOIL[element],
        backgroundSize: "100% 100%, 300% 300%",
        backgroundPosition: "center, var(--bgx) var(--bgy)",
        opacity: `calc((0.25 + var(--o, 0) * 0.75) * ${strength} * var(--foil, 1))`,
        filter: "brightness(0.85) contrast(1.4) saturate(1.2)",
      }}
    />
  );
}

/**
 * foil: strength of the foil over the whole card (lower it for full-art cards so the illustration keeps its colours).
 * touchTilt: false leaves touch gestures to the page (e.g. swiping a row of cards); only a mouse tilts the card.
 */
export function HoloCard({
  element,
  children,
  className = "",
  effects = true,
  foil = 0.25,
  touchTilt = true,
  rarity,
  figure,
}: {
  element: Element;
  children: ReactNode;
  className?: string;
  effects?: boolean;
  foil?: number;
  touchTilt?: boolean;
  /** When given, the rarity decides the foil, the glare and how far the card tilts. */
  rarity?: Rarity;
  /** Where the character stands, so the lit textures (UR, reverse holo) stay in the background. */
  figure?: FigureArea;
}) {
  const look = rarity ? RARITY[rarity] : null;
  const foilStrength = look ? look.foil : foil;
  const maxTilt = look ? look.tilt : TILT;
  const glare = look ? look.glare : true;
  const ur = rarity === "UR";
  const textured = rarity === "SSR" || rarity === "UR";
  const reduce = useReducedMotion();
  const px = useSpring(50, SPRING);
  const py = useSpring(50, SPRING);
  const o = useSpring(0, SPRING);
  const tilt = effects && !reduce;
  const rotateY = useTransform(px, (v) => (tilt ? ((v - 50) / 50) * maxTilt : 0));
  const rotateX = useTransform(py, (v) => (tilt ? ((50 - v) / 50) * maxTilt : 0));
  // The foil drifts against the pointer, so its colours shift as the card turns.
  const bgx = useTransform(px, (v) => `${100 - v}%`);
  const bgy = useTransform(py, (v) => `${100 - v}%`);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!effects || (!touchTilt && e.pointerType !== "mouse")) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    py.set(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    o.set(1);
  };
  const leave = () => {
    px.set(50);
    py.set(50);
    o.set(0);
  };

  return (
    <div className={`[perspective:900px] ${className}`}>
      <motion.div
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={leave}
        onPointerUp={(e) => e.pointerType !== "mouse" && leave()}
        onPointerCancel={leave}
        style={{
          rotateX,
          rotateY,
          "--px": useMotionTemplate`${px}%`,
          "--py": useMotionTemplate`${py}%`,
          "--o": effects ? o : 0,
          "--foil": effects ? 1 : 0,
          "--bgx": bgx,
          "--bgy": bgy,
        } as never}
        className={`relative aspect-[63/88] w-full select-none ${touchTilt ? "touch-none" : ""} overflow-hidden rounded-xs ${ur && effects ? "shadow-[-2px_-2px_3px_0_rgb(38_230_247/0.35),2px_2px_3px_0_rgb(247_89_228/0.35),0_0_5px_1px_rgb(255_231_89/0.25),0_20px_50px_-10px_rgb(0_0_0/0.8)]" : "shadow-[0_20px_50px_-10px_rgb(0_0_0/0.8)]"} [transform-style:preserve-3d]`}
      >
        {children}
        {effects && foilStrength > 0 && <Foil element={element} strength={foilStrength} />}
        {effects && textured && <LitTexture texture={ELEMENT_TEXTURES[element]} tint={REVERSE_RAINBOW} spot={rarity === "UR" ? 55 : 42} strength={0.85} keepOut={figure} />}
        {effects && rarity === "SSR" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
            style={{
              backgroundImage: SSR_RAINBOW,
              backgroundSize: "300% 300%",
              backgroundPosition: "var(--bgx) var(--bgy)",
              opacity: "calc(0.05 + var(--o) * 0.22)",
            }}
          />
        )}
        {effects && ur && (
          <>
            {/* The light band sweeps across as the card turns, strongest under the pointer. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
              style={{
                backgroundImage: UR_BAND,
                backgroundSize: "300% 300%",
                backgroundPosition: "var(--bgx) var(--bgy)",
                opacity: "calc(0.12 + var(--o) * 0.4)",
              }}
            />
          </>
        )}
        {effects && glare && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(farthest-corner circle at var(--px) var(--py), rgb(255 255 255 / 0.45) 8%, rgb(255 255 255 / 0.12) 30%, rgb(0 0 0 / 0.25) 90%)",
              opacity: "calc(var(--o) * 0.6)",
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
