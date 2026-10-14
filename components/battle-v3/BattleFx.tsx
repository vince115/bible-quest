"use client";

// Battle effects on the cards: the numbers that float up when someone is hurt, healed or shielded, and the shake of a
// card that was hit. Kept plain and in this file, so the look can be redone without touching the battle screen.
import { motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from "react";
import type { CharacterId, EnemyId } from "@/game/v2/types";
import type { Delta } from "@/game/v3/battleFx";

export interface Popup extends Delta {
  uid: number;
}

/** The numbers on screen right now. */
export const BattleFxContext = createContext<Popup[]>([]);

/** How long a number stays on screen. */
const LIFETIME_MS = 1000;

/** Keeps the numbers that are on screen: `add` puts some up, and each takes itself down again. */
export function usePopups() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const next = useRef(1);
  const add = useCallback((deltas: Delta[]) => {
    if (!deltas.length) return;
    const fresh = deltas.map((d) => ({ ...d, uid: next.current++ }));
    setPopups((all) => [...all, ...fresh]);
    window.setTimeout(() => setPopups((all) => all.filter((p) => !fresh.some((f) => f.uid === p.uid))), LIFETIME_MS);
  }, []);
  return { popups, add };
}

const COLOR: Record<Popup["kind"], string> = {
  damage: "text-red-500",
  block: "text-sky-300",
  heal: "text-emerald-400",
  shield: "text-sky-400",
};
const SIGN: Record<Popup["kind"], string> = { damage: "−", block: "−", heal: "+", shield: "+" };

/** The numbers floating over one card. */
export function FxNumbers({ id }: { id: CharacterId | EnemyId }) {
  const mine = useContext(BattleFxContext).filter((p) => p.id === id);
  return (
    <>
      {mine.map((p, i) => (
        <motion.span
          key={p.uid}
          aria-hidden
          initial={{ opacity: 0, y: 6, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], y: -44 - i * 18, scale: [0.6, 1.25, 1, 1] }}
          transition={{ duration: LIFETIME_MS / 1000, times: [0, 0.15, 0.7, 1], ease: "easeOut" }}
          className={`pointer-events-none absolute left-1/2 top-[28%] z-30 -translate-x-1/2 text-[2.2rem] font-black leading-none [-webkit-text-stroke:3px_rgb(0_0_0/0.75)] [paint-order:stroke_fill] ${COLOR[p.kind]}`}
        >
          {SIGN[p.kind]}
          {p.amount}
        </motion.span>
      ))}
    </>
  );
}

/** Shakes the element each time its card is hit (HP lost, or the shield took the blow). */
export function useHitShake(id: CharacterId | EnemyId, ref: RefObject<HTMLElement | null>) {
  const hits = useContext(BattleFxContext).filter((p) => p.id === id && (p.kind === "damage" || p.kind === "block"));
  const last = hits.length ? hits[hits.length - 1].uid : 0;
  useEffect(() => {
    if (!last) return;
    ref.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      { duration: 360, easing: "ease-out" },
    );
  }, [last, ref]);
}
