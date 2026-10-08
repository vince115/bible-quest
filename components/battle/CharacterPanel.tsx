"use client";

import { motion } from "framer-motion";
import { CHARACTERS } from "@/game/data/characters";
import { RULES } from "@/game/data/rules";
import {
  basicAttackDamage,
  canSpendCourage,
  davidBonus,
  giantBonus,
  isSlingStoneReady,
  isTerrified,
  skillBlockReason,
  skillInfo,
} from "@/game/engine";
import type { BattleState, CharacterId, SkillId } from "@/game/types";
import { useT } from "@/game/locale";
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
  reviveMode,
  onRevive,
}: {
  battle: BattleState;
  id: CharacterId;
  locked: boolean;
  onSkill: (skill: SkillId) => void;
  onSpendCourage: () => void;
  /** A resurrection card is waiting for a target. */
  reviveMode: boolean;
  onRevive: () => void;
}) {
  const t = useT();
  const def = CHARACTERS[id];
  const c = battle.party[id];
  const fallen = c.hp <= 0;
  const terrified = isTerrified(c);
  const atk = basicAttackDamage(battle, id);
  const giant = giantBonus(battle);
  const bonus = davidBonus(battle);
  const skillParams = {
    ...RULES,
    slingDamage: RULES.slingDamage + bonus,
    slingStoneDamage: RULES.slingStoneDamage + bonus,
  };

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-2xl border p-3 transition ${
        fallen && reviveMode
          ? "border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-400"
          : fallen
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
            <span className="font-bold text-stone-100">{t(`char.${id}.name`)}</span>
            <span className="text-[11px] text-stone-400">
              {fallen ? t("ui.fallen") : terrified ? t("ui.terrified") : t("ui.atk", { n: atk })}
            </span>
          </div>
          <div className="text-[11px] text-stone-500">{t(`char.${id}.role`)}</div>
        </div>
      </div>

      <HpBar hp={c.hp} max={def.maxHp} shield={c.shield} color="bg-emerald-500" />

      {id === "david" && (
        <div
          className={`rounded-lg border px-2 py-1 text-[11px] leading-snug ${
            giant > 0 ? "border-amber-400/70 bg-amber-500/15 text-amber-200" : "border-stone-700 text-stone-500"
          }`}
        >
          <span className="font-semibold">⚔ {t("ui.giantName")}</span>
          {giant > 0 && <span className="ml-1 font-bold text-amber-300">+{giant}</span>}
          <div>{t("ui.giantDesc", RULES)}</div>
          {battle.youngWarrior && !fallen && (
            <div className="mt-0.5 font-semibold text-red-300">
              ⚡ {t("ui.youngWarriorActive", { n: RULES.youngWarriorBonus })}
            </div>
          )}
        </div>
      )}

      {fallen && reviveMode && (
        <button
          onClick={onRevive}
          className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-stone-950 hover:bg-emerald-400"
        >
          ✝ {t("ui.revive")}
        </button>
      )}

      {/* Fear */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-stone-400">
          {t("ui.fear")}
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
          title={t("ui.spendCourageHint")}
        >
          {t("ui.spendCourage")}
        </button>
      </div>

      {/* Skills: two per character, at most one per turn */}
      <div className="grid gap-2">
        {def.skills.map((skillId) => {
          const skill = skillInfo(battle, skillId);
          const reason = skillBlockReason(battle, id, skillId);
          const enabled = !locked && reason === null;
          const slingStone = skillId === "sling" && isSlingStoneReady(battle);
          return (
            <motion.button
              key={skillId}
              onClick={() => onSkill(skillId)}
              disabled={!enabled}
              whileTap={enabled ? { scale: 0.96 } : undefined}
              animate={
                slingStone && enabled
                  ? { boxShadow: ["0 0 0px #fbbf24", "0 0 18px #fbbf24", "0 0 0px #fbbf24"] }
                  : {}
              }
              transition={slingStone ? { repeat: Infinity, duration: 1.4 } : undefined}
              className={`rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed ${
                slingStone
                  ? "border-amber-400 bg-amber-500/20"
                  : "border-stone-600 bg-stone-800 enabled:hover:border-stone-400"
              }`}
            >
              <div className={`flex items-center justify-between ${enabled ? "" : "opacity-45"}`}>
                <span className={`text-sm font-bold ${slingStone ? "text-amber-300" : "text-stone-100"}`}>
                  {t(`skill.${skill.key}.name`)}
                </span>
                <span className="text-xs font-semibold text-yellow-300">⚡{skill.cost}</span>
              </div>
              <div className={`text-[11px] leading-snug text-stone-400 ${enabled ? "" : "opacity-45"}`}>
                {t(`skill.${skill.key}.desc`, skillParams)}
              </div>
              {reason && reason !== "ui.reason.over" && (
                <div className="mt-1 text-[10px] font-semibold text-rose-300/90">⛔ {t(reason)}</div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
