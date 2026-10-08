"use client";

import { motion } from "framer-motion";

export function HpBar({
  hp,
  max,
  shield = 0,
  color = "bg-red-500",
}: {
  hp: number;
  max: number;
  shield?: number;
  color?: string;
}) {
  const pct = Math.max(0, (hp / max) * 100);
  return (
    <div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-stone-800 ring-1 ring-stone-700">
        <motion.div
          className={`h-full ${color}`}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-stone-400">
        <span>
          HP {hp}/{max}
        </span>
        {shield > 0 && <span className="text-sky-300">🛡 {shield}</span>}
      </div>
    </div>
  );
}
