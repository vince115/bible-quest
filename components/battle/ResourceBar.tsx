"use client";

import { RULES } from "@/game/data/rules";
import { battlePhase, isEmboldened } from "@/game/engine";
import type { BattleState } from "@/game/types";

const PHASES = ["Fear", "Faith", "Break Armor", "Defeat Goliath"];

function Meter({
  label,
  value,
  max,
  fill,
  marker,
  note,
}: {
  label: string;
  value: number;
  max: number;
  fill: string;
  marker?: number;
  note?: string;
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-semibold text-stone-200">{label}</span>
        <span className="text-stone-400">
          {value}/{max} {note && <span className="ml-1 text-amber-300">{note}</span>}
        </span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`h-3 flex-1 rounded-sm ${i < value ? fill : "bg-stone-800"} ${
              marker !== undefined && i === marker - 1 ? "outline outline-1 outline-offset-1 outline-stone-400" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function ResourceBar({ battle }: { battle: BattleState }) {
  const phase = battlePhase(battle);
  const faithNote = battle.slingStoneUsed
    ? "Sling Stone used"
    : battle.party.david.hp <= 0
      ? "David has fallen"
      : battle.faith >= RULES.maxFaith
        ? "Sling Stone ready!"
        : undefined;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-stone-700 bg-stone-900/80 p-4">
      <div className="flex flex-wrap items-center gap-1 text-[11px]">
        {PHASES.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                phase === i + 1
                  ? "bg-amber-500 text-stone-950"
                  : phase > i + 1
                    ? "bg-stone-700 text-stone-300"
                    : "bg-stone-800 text-stone-500"
              }`}
            >
              {i + 1}. {p}
            </span>
            {i < PHASES.length - 1 && <span className="text-stone-600">→</span>}
          </span>
        ))}
        <span className="ml-auto text-stone-400">Turn {battle.turn}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
        <div className="sm:w-36">
          <div className="mb-1 text-xs font-semibold text-stone-200">Energy</div>
          <div className="flex gap-1">
            {Array.from({ length: Math.max(battle.energy, RULES.baseEnergy) }).map((_, i) => (
              <span
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                  i < battle.energy ? "bg-yellow-400 text-stone-900" : "bg-stone-800 text-stone-600"
                }`}
              >
                ⚡
              </span>
            ))}
          </div>
        </div>
        <Meter
          label="🔥 Courage"
          value={battle.courage}
          max={RULES.maxCourage}
          fill="bg-orange-500"
          marker={RULES.emboldenedAt}
          note={isEmboldened(battle) ? `Emboldened +${RULES.emboldenedBonus} ATK` : `≥${RULES.emboldenedAt}: +${RULES.emboldenedBonus} ATK`}
        />
        <Meter
          label="✨ Faith (David)"
          value={battle.faith}
          max={RULES.maxFaith}
          fill="bg-amber-300"
          note={faithNote}
        />
      </div>
    </section>
  );
}
