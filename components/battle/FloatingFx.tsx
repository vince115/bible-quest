"use client";

import { motion } from "framer-motion";
import type { Fx, FxTarget } from "@/game/types";

const COLORS: Record<Fx["kind"], string> = {
  damage: "text-red-400",
  heal: "text-emerald-400",
  fear: "text-purple-400",
  shield: "text-sky-300",
  buff: "text-amber-300",
  miss: "text-stone-400",
};

export function FloatingFx({ fx, target }: { fx: Fx[]; target: FxTarget }) {
  const items = fx.filter((f) => f.target === target);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 flex flex-col items-center">
      {items.map((f, i) => (
        <motion.span
          key={f.id}
          className={`absolute text-lg font-bold drop-shadow ${COLORS[f.kind]}`}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: -48 - i * 4 }}
          transition={{ duration: 1.4, delay: i * 0.12, ease: "easeOut" }}
          style={{ marginTop: i * 22 }}
        >
          {f.text}
        </motion.span>
      ))}
    </div>
  );
}

/** Key that changes whenever the target is hit, used to retrigger a shake. */
export function hitKey(fx: Fx[], target: FxTarget): number {
  const hits = fx.filter((f) => f.target === target && f.kind === "damage");
  return hits.length ? hits[hits.length - 1].id : 0;
}
