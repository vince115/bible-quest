"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CHARACTERS, PARTY_ORDER } from "@/game/data/characters";
import type { BattleState } from "@/game/types";

export function ResultOverlay({ battle, onRetry }: { battle: BattleState; onRetry: () => void }) {
  const victory = battle.result === "victory";
  const survivors = PARTY_ORDER.filter((id) => battle.party[id].hp > 0);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className={`w-full max-w-md rounded-2xl border-2 p-6 text-center ${
          victory ? "border-amber-400 bg-stone-900" : "border-red-700 bg-stone-950"
        }`}
      >
        <div className="text-5xl">{victory ? "👑" : "💀"}</div>
        <h2 className={`mt-2 text-3xl font-bold ${victory ? "text-amber-300" : "text-red-400"}`}>
          {victory ? "Victory" : "Defeat"}
        </h2>
        <p className="mt-2 text-sm text-stone-300">
          {victory
            ? "“The battle is the LORD's.” Goliath has fallen."
            : "Goliath stands over the fallen champions of Israel."}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-2 text-left text-sm">
          <dt className="text-stone-400">Turns</dt>
          <dd className="text-right text-stone-100">{battle.turn}</dd>
          <dt className="text-stone-400">Goliath HP</dt>
          <dd className="text-right text-stone-100">{battle.goliath.hp}</dd>
          <dt className="text-stone-400">Armor</dt>
          <dd className="text-right text-stone-100">{battle.goliath.armored ? "Intact" : "Broken"}</dd>
          <dt className="text-stone-400">Survivors</dt>
          <dd className="text-right text-stone-100">
            {survivors.length ? survivors.map((id) => CHARACTERS[id].name).join(", ") : "None"}
          </dd>
        </dl>

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={onRetry}
            className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-stone-950 hover:bg-amber-400"
          >
            Fight Again
          </button>
          <Link
            href="/"
            className="rounded-xl border border-stone-600 px-5 py-2 font-semibold text-stone-200 hover:bg-stone-800"
          >
            Title
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
