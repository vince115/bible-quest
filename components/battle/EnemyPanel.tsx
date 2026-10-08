"use client";

import { motion } from "framer-motion";
import { CHARACTERS } from "@/game/data/characters";
import { GOLIATH_ACTIONS } from "@/game/data/goliath";
import { RULES } from "@/game/data/rules";
import type { BattleState } from "@/game/types";
import { FloatingFx, hitKey } from "./FloatingFx";
import { HpBar } from "./HpBar";

export function EnemyPanel({ battle }: { battle: BattleState }) {
  const { goliath, intent } = battle;
  const action = intent ? GOLIATH_ACTIONS[intent.actionId] : null;
  const enraged = !goliath.armored && !goliath.staggered;

  return (
    <section className="relative rounded-2xl border border-stone-700 bg-stone-900/80 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <motion.div
          key={hitKey(battle.fx, "goliath")}
          animate={{ x: [0, -10, 10, -6, 6, 0] }}
          transition={{ duration: 0.4 }}
          className={`relative flex h-24 w-24 shrink-0 items-center justify-center self-center rounded-2xl text-5xl ring-4 ${
            goliath.armored
              ? "bg-amber-900/60 ring-amber-500"
              : "bg-red-950 ring-red-600"
          }`}
        >
          🗿
          <FloatingFx fx={battle.fx} target="goliath" />
        </motion.div>

        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-stone-100">Goliath of Gath</h2>
            {goliath.armored ? (
              <span className="rounded bg-amber-600/30 px-2 py-0.5 text-xs font-semibold text-amber-300">
                🛡 ARMORED — max {RULES.armoredMaxDamage} dmg per hit
              </span>
            ) : (
              <span className="rounded bg-stone-700 px-2 py-0.5 text-xs font-semibold text-stone-300 line-through">
                Armor broken
              </span>
            )}
            {goliath.staggered && (
              <span className="rounded bg-sky-700/40 px-2 py-0.5 text-xs font-semibold text-sky-300">
                STAGGERED
              </span>
            )}
            {enraged && (
              <span className="rounded bg-red-700/40 px-2 py-0.5 text-xs font-semibold text-red-300">
                ENRAGED
              </span>
            )}
          </div>
          <HpBar hp={goliath.hp} max={RULES.goliathHp} color="bg-red-600" />
        </div>

        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 sm:w-64">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-red-300/70">
            Next action
          </div>
          {goliath.staggered ? (
            <div className="text-sm font-semibold text-sky-300">Staggered — will not act</div>
          ) : action ? (
            <>
              <div className="font-semibold text-red-200">{action.name}</div>
              <div className="text-xs text-red-200/80">
                {action.description}
              </div>
              {intent?.targetId && !(action.targetsDavid && intent.targetId === "david") && (
                <div className="mt-1 text-xs font-semibold text-red-300">
                  🎯 Target: {CHARACTERS[intent.targetId].name}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-stone-400">—</div>
          )}
        </div>
      </div>
    </section>
  );
}
