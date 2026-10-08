"use client";

import { motion } from "framer-motion";
import { CHARACTERS } from "@/game/data/characters";
import { RULES } from "@/game/data/rules";
import {
  basicAttackDamage,
  canSpendCourage,
  canUseSkill,
  isSlingStoneReady,
  isTerrified,
  skillInfo,
} from "@/game/engine";
import type { BattleState, CharacterId } from "@/game/types";
import { FloatingFx, hitKey } from "./FloatingFx";
import { HpBar } from "./HpBar";

const PORTRAIT: Record<CharacterId, { emoji: string; ring: string }> = {
  david: { emoji: "🪨", ring: "ring-amber-400 bg-amber-900/40" },
  samuel: { emoji: "📜", ring: "ring-violet-400 bg-violet-900/40" },
  jonathan: { emoji: "🛡️", ring: "ring-sky-400 bg-sky-900/40" },
};

export function CharacterPanel({
  battle,
  id,
  locked,
  onSkill,
  onSpendCourage,
}: {
  battle: BattleState;
  id: CharacterId;
  locked: boolean;
  onSkill: () => void;
  onSpendCourage: () => void;
}) {
  const def = CHARACTERS[id];
  const c = battle.party[id];
  const fallen = c.hp <= 0;
  const terrified = isTerrified(c);
  const skill = skillInfo(battle, id);
  const slingStone = id === "david" && isSlingStoneReady(battle);
  const skillEnabled = !locked && canUseSkill(battle, id);
  const atk = basicAttackDamage(battle, id);

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-2xl border p-3 transition ${
        fallen
          ? "border-stone-800 bg-stone-950 opacity-50"
          : terrified
            ? "border-purple-600 bg-purple-950/40"
            : "border-stone-700 bg-stone-900/80"
      }`}
    >
      <div className="flex items-center gap-3">
        <motion.div
          key={hitKey(battle.fx, id)}
          animate={{ x: [0, -6, 6, -3, 0] }}
          transition={{ duration: 0.35 }}
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl ring-2 ${PORTRAIT[id].ring}`}
        >
          {fallen ? "✝" : PORTRAIT[id].emoji}
          <FloatingFx fx={battle.fx} target={id} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold text-stone-100">{def.name}</span>
            <span className="text-[11px] text-stone-400">
              {fallen ? "Fallen" : terrified ? "Terrified" : `ATK ${atk}`}
            </span>
          </div>
          <div className="text-[11px] text-stone-500">{def.role}</div>
        </div>
      </div>

      <HpBar hp={c.hp} max={def.maxHp} shield={c.shield} color="bg-emerald-500" />

      {/* Fear */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-stone-400">
          Fear
          {Array.from({ length: RULES.maxFear }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${
                i < c.fear ? "bg-purple-500 shadow-[0_0_6px] shadow-purple-500" : "bg-stone-700"
              }`}
            />
          ))}
        </div>
        <button
          onClick={onSpendCourage}
          disabled={locked || !canSpendCourage(battle, id)}
          className="rounded-md border border-orange-500/50 px-2 py-0.5 text-[11px] font-semibold text-orange-300 enabled:hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-30"
          title="Spend 1 Courage to remove 1 Fear (no Energy cost)"
        >
          −1 Fear (1 🔥)
        </button>
      </div>

      {/* Skill */}
      <motion.button
        onClick={onSkill}
        disabled={!skillEnabled}
        whileTap={skillEnabled ? { scale: 0.96 } : undefined}
        animate={slingStone && skillEnabled ? { boxShadow: ["0 0 0px #fbbf24", "0 0 18px #fbbf24", "0 0 0px #fbbf24"] } : {}}
        transition={slingStone ? { repeat: Infinity, duration: 1.4 } : undefined}
        className={`rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
          slingStone
            ? "border-amber-400 bg-amber-500/20"
            : "border-stone-600 bg-stone-800 enabled:hover:border-stone-400"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-sm font-bold ${slingStone ? "text-amber-300" : "text-stone-100"}`}>
            {skill.name}
          </span>
          <span className="text-xs font-semibold text-yellow-300">⚡{skill.cost}</span>
        </div>
        <div className="text-[11px] leading-snug text-stone-400">{skill.description}</div>
        {c.skillUsed && !fallen && <div className="mt-1 text-[10px] text-stone-500">Used this turn</div>}
      </motion.button>
    </div>
  );
}
