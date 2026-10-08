"use client";

import { motion } from "framer-motion";
import { GOLIATH_ACTIONS } from "@/game/data/goliath";
import { RULES } from "@/game/data/rules";
import type { BattleState } from "@/game/types";
import { useT } from "@/game/locale";
import { FloatingFx, hitKey } from "./FloatingFx";
import { HpBar } from "./HpBar";

export function EnemyPanel({ battle }: { battle: BattleState }) {
  const t = useT();
  const { goliath, intent } = battle;
  const action = intent ? GOLIATH_ACTIONS[intent.actionId] : null;
  const enraged = !goliath.armored;

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
            <h2 className="text-xl font-bold text-stone-100">{t("ui.goliath")}</h2>
            {goliath.armored ? (
              <span className="rounded bg-amber-600/30 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {t("ui.armored", { n: RULES.armoredMaxDamage })}
              </span>
            ) : (
              <span className="rounded bg-stone-700 px-2 py-0.5 text-xs font-semibold text-stone-300 line-through">
                {t("ui.armorBroken")}
              </span>
            )}
            {enraged && (
              <span className="rounded bg-red-700/40 px-2 py-0.5 text-xs font-semibold text-red-300">
                {t("ui.enraged")}
              </span>
            )}
          </div>
          <HpBar hp={goliath.hp} max={RULES.goliathHp} color="bg-red-600" />
        </div>

        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 sm:w-64">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-red-300/70">
            {t("ui.nextAction")}
          </div>
          {action ? (
            <>
              <div className="font-semibold text-red-200">{t(`action.${action.id}.name`)}</div>
              <div className="text-xs text-red-200/80">
                {t(`action.${action.id}.desc`, { ...action })}
              </div>
              {intent?.targetId && !(action.targetsDavid && intent.targetId === "david") && (
                <div className="mt-1 text-xs font-semibold text-red-300">
                  {t("ui.target", { char: intent.targetId })}
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
