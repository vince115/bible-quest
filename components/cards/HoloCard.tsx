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
}: {
  element: Element;
  children: ReactNode;
  className?: string;
  effects?: boolean;
  foil?: number;
  touchTilt?: boolean;
  /** When given, the rarity decides the foil, the glare and how far the card tilts. */
  rarity?: Rarity;
}) {
  const look = rarity ? RARITY[rarity] : null;
  const foilStrength = look ? look.foil : foil;
  const maxTilt = look ? look.tilt : TILT;
  const glare = look ? look.glare : true;
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
        className={`relative aspect-[63/88] w-full select-none ${touchTilt ? "touch-none" : ""} overflow-hidden rounded-xs shadow-[0_20px_50px_-10px_rgb(0_0_0/0.8)] [transform-style:preserve-3d]`}
      >
        {children}
        {effects && foilStrength > 0 && <Foil element={element} strength={foilStrength} />}
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
