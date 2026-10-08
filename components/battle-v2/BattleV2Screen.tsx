"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CARDS_V2,
  CHARACTER_ELEMENT,
  CHARACTER_SKILLS,
  ENEMY_ELEMENT,
  ENEMY_HP,
  ENEMY_ORDER,
  MAX_HP,
  PARTY_ORDER,
  RULES_V2 as R,
  SKILLS,
} from "@/game/v2/data";
import {
  canAct,
  elementMultiplier,
  enemyAlive,
  isAlive,
  payment,
  skillBlockReason,
  skillDamage,
  skillTargets,
  type Target,
} from "@/game/v2/engine";
import { useBattleV2Store } from "@/game/v2/store";
import type { BattleState, CharacterId, Element, EnemyId, EnergyKind, Intent, SkillId } from "@/game/v2/types";
import { useT } from "@/game/locale";

type T = ReturnType<typeof useT>;

const ICON: Record<EnergyKind, string> = { faith: "✨", attack: "🗡️", guard: "🕊️" };
const ENERGY_TONE: Record<EnergyKind, string> = {
  faith: "border-amber-300 from-amber-900/70 text-amber-200",
  attack: "border-red-400 from-red-950/80 text-red-200",
  guard: "border-emerald-400 from-emerald-950/80 text-emerald-200",
};
/** Skill buttons take the colour of the energy they spend, matching the pool. */
const SKILL_TONE: Record<EnergyKind, string> = {
  faith: "border-amber-400/70 bg-amber-950/60 enabled:hover:border-amber-300",
  attack: "border-red-500/70 bg-red-950/60 enabled:hover:border-red-400",
  guard: "border-emerald-500/70 bg-emerald-950/60 enabled:hover:border-emerald-400",
};
const ENERGY_ORDER: EnergyKind[] = ["faith", "attack", "guard"];

const ELEMENT_ICON: Record<Element, string> = { water: "💧", fire: "🔥", wood: "🌿", light: "☀️", dark: "🌑" };
const ELEMENT_TONE: Record<Element, string> = {
  water: "bg-sky-800/70 text-sky-100",
  fire: "bg-orange-800/70 text-orange-100",
  wood: "bg-emerald-800/70 text-emerald-100",
  light: "bg-yellow-600/70 text-yellow-50",
  dark: "bg-violet-900/80 text-violet-100",
};

function ElementBadge({ element, t }: { element: Element; t: T }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ELEMENT_TONE[element]}`}>
      {ELEMENT_ICON[element]} {t(`v2.element.${element}`)}
    </span>
  );
}

/** Numbers shown in the support skills' text (attack skills show their damage instead). */
const SUPPORT_AMOUNT: Partial<Record<SkillId, number>> = { heal: R.healAmount, arise: R.ariseHp, covshield: R.covShield };

/** "×1.5" / "×0.75" label for an attacker hitting a defender, or "" when neutral. */
function multiplierLabel(attacker: Element, defender: Element): string {
  const m = elementMultiplier(attacker, defender);
  return m === 1 ? "" : `×${m}`;
}

/** Base damage of Goliath's actions, for the intent text. */
const ACTION_DAMAGE: Partial<Record<Intent["action"], number>> = { spear: R.spear, crush: R.crush, swing: R.swing };

const names = (t: T, ids: CharacterId[]) => ids.map((id) => t(`char.${id}.name`)).join(t("ui.listSep"));

/**
 * HP bar: green only at full HP, yellow above 50%, orange from 20% to 50%, red at 20% or less.
 * A Shield is drawn as a translucent layer laid over the end of the HP it protects.
 */
function Bar({ value, max, shield = 0 }: { value: number; max: number; shield?: number }) {
  const pct = Math.max(0, (value / max) * 100);
  const shieldPct = Math.min(100, (shield / max) * 100);
  const color = pct >= 100 ? "bg-emerald-500" : pct > 50 ? "bg-yellow-400" : pct > 20 ? "bg-orange-500" : "bg-red-600";
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-stone-800">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      {shield > 0 && (
        <div
          className="absolute inset-y-0 rounded-full border border-sky-200/80 bg-sky-300/45 shadow-[0_0_8px] shadow-sky-300/70 transition-all duration-500"
          style={{ left: `${Math.max(0, pct - shieldPct)}%`, width: `${shieldPct}%` }}
        />
      )}
    </div>
  );
}

function IntentLine({ intent, t }: { intent: Intent; t: T }) {
  return (
    <div>
      <div className="font-semibold text-red-200">{t(`v2.action.${intent.action}.name`)}</div>
      <div className="text-xs text-red-200/80">{t(`v2.action.${intent.action}.desc`, { targets: names(t, intent.targets), n: ACTION_DAMAGE[intent.action] })}</div>
    </div>
  );
}

function EnemyRow({
  b,
  t,
  targets,
  skill,
  onTarget,
}: {
  b: BattleState;
  t: T;
  /** Enemies that can be picked as the pending attack's target. */
  targets: Target[] | null;
  /** The pending attack, for the damage preview on each target. */
  skill: SkillId | null;
  onTarget: (id: EnemyId) => void;
}) {
  const g = b.goliath;
  const lastHit = [...b.log].reverse().find((l) => l.key === "v2.log.attack" || l.key === "v2.log.slingStone");
  return (
    <section className="rounded-2xl border border-stone-700 bg-stone-900/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-stone-400">{t("v2.ui.goal")}</span>
        {lastHit && <span className="font-semibold text-amber-100">{t(lastHit.key, lastHit.params)}</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1.6fr_1fr]">
        {ENEMY_ORDER.map((id) => {
          const hp = b.enemies[id].hp;
          const alive = hp > 0;
          const isTarget = targets?.includes(id);
          const protectedNow = id === "goliath" && enemyAlive(b, "bearer");
          return (
            <div
              key={id}
              className={`flex flex-col gap-2 rounded-xl border p-3 ${
                isTarget
                  ? "border-amber-300 bg-amber-950/30 ring-2 ring-amber-300"
                  : !alive
                    ? "border-stone-800 bg-stone-950 opacity-50"
                    : id === "goliath"
                      ? "border-red-800/80 bg-red-950/30"
                      : "border-stone-700 bg-stone-950/40"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-bold ${id === "goliath" ? "text-lg" : ""}`}>
                  {id === "goliath" ? "🗿" : id === "bearer" ? "🛡️" : "🏹"} {t(`v2.enemy.${id}.name`)}
                </span>
                <ElementBadge element={ENEMY_ELEMENT[id]} t={t} />
                {!alive && <span className="text-xs text-stone-500">{t("v2.enemy.fallen")}</span>}
                {id === "goliath" && g.enraged && <span className="rounded bg-red-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-red-200">{t("v2.ui.enraged")}</span>}
                {id === "goliath" && g.stunned && <span className="rounded bg-sky-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-sky-100">{t("v2.ui.stunned")}</span>}
                {id === "goliath" && g.charging && <span className="rounded bg-orange-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-orange-100">{t("v2.ui.charging")}</span>}
              </div>
              <Bar value={hp} max={ENEMY_HP[id]} />
              <div className="text-xs text-stone-300">HP {hp}/{ENEMY_HP[id]}</div>
              {protectedNow && <div className="text-[11px] font-semibold text-amber-300">{t("v2.ui.protected")}</div>}

              {alive && id === "bearer" && <div className="text-[11px] text-stone-400">{t("v2.enemy.bearer.desc")}</div>}
              {alive && id === "archer" && b.archerTarget && (
                <div className="rounded-lg border border-red-800/70 bg-red-950/40 p-2 text-xs text-red-200">
                  {t("v2.enemy.archer.intent", { char: b.archerTarget, n: R.archerDamage })}
                </div>
              )}
              {id === "goliath" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-red-800/70 bg-red-950/40 p-2">
                    <div className="text-[10px] uppercase tracking-widest text-red-300/70">{t("v2.ui.intentNow")}</div>
                    {g.stunned ? <div className="text-sm font-semibold text-sky-200">{t("v2.ui.intentStunned")}</div> : <IntentLine intent={b.intents[0]} t={t} />}
                  </div>
                  <div className="rounded-lg border border-stone-700 bg-stone-950/40 p-2 opacity-80">
                    <div className="text-[10px] uppercase tracking-widest text-stone-400">{t("v2.ui.intentNext")}</div>
                    <IntentLine intent={b.intents[1]} t={t} />
                  </div>
                </div>
              )}
              {isTarget && (
                <button onClick={() => onTarget(id)} className="mt-auto rounded-lg bg-amber-400 px-2 py-1.5 text-sm font-bold text-stone-950 hover:bg-amber-300">
                  🎯 {t(`v2.enemy.${id}.name`)}
                  {skill && (
                    <span className="ml-1">
                      · {skillDamage(b, skill, id)}
                      {multiplierLabel(CHARACTER_ELEMENT[SKILLS[skill].owner], ENEMY_ELEMENT[id]) &&
                        ` (${multiplierLabel(CHARACTER_ELEMENT[SKILLS[skill].owner], ENEMY_ELEMENT[id])})`}
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CharacterPanel({
  b,
  id,
  t,
  locked,
  targets,
  onSkill,
  onTarget,
}: {
  b: BattleState;
  id: CharacterId;
  t: T;
  locked: boolean;
  /** Targets of the pending skill (characters here; enemies are picked in the enemy row). */
  targets: Target[] | null;
  onSkill: (skill: SkillId) => void;
  onTarget: () => void;
}) {
  const c = b.party[id];
  const alive = isAlive(b, id);
  const isTarget = targets?.includes(id);
  return (
    <div
      className={`relative flex flex-col gap-2 rounded-2xl border p-3 ${
        isTarget
          ? "border-emerald-400 bg-emerald-950/30 ring-2 ring-emerald-400"
          : !alive
            ? "border-stone-800 bg-stone-950 opacity-60"
            : canAct(b, id)
              ? "border-stone-600 bg-stone-900/80"
              : "border-stone-800 bg-stone-900/50"
      }`}
    >
      {c.shield > 0 && alive && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 animate-pulse rounded-3xl border-2 border-sky-300/60 bg-sky-400/10 shadow-[inset_0_0_24px] shadow-sky-300/40"
        />
      )}
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-base font-bold">
          {t(`char.${id}.name`)} <ElementBadge element={CHARACTER_ELEMENT[id]} t={t} />
        </span>
        <span className="text-[11px] text-stone-400">{!alive ? t("v2.ui.fallen") : c.acted ? t("v2.ui.acted") : ""}</span>
      </div>
      <div className="text-[11px] text-stone-400">{t(`v2.char.${id}.role`)}</div>
      <Bar value={c.hp} max={MAX_HP[id]} shield={alive ? c.shield : 0} />
      <div className="flex justify-between text-xs text-stone-400">
        <span>HP {c.hp}/{MAX_HP[id]}</span>
        {c.shield > 0 && <span className="font-semibold text-sky-300">🛡️ {c.shield}</span>}
      </div>
      {c.shaken && alive && <div className="text-xs font-semibold text-purple-300">{t("v2.ui.shaken")}</div>}
      {id === "david" && (
        <div className="text-[11px] text-stone-500">
          {t("v2.passive.david")}
          {b.energy.faith >= R.giantFaith && alive && <span className="ml-1 font-semibold text-amber-300">· {t("v2.ui.giantOn")}</span>}
        </div>
      )}

      <div className="mt-1 grid gap-1.5">
        {CHARACTER_SKILLS[id].map((skill) => {
          const def = SKILLS[skill];
          const reason = skillBlockReason(b, skill);
          const ready = !locked && !targets && !reason;
          const pay = payment(b, skill);
          // When Faith stands in for 🗡️/🕊️, show the button as a Faith action so the spend is obvious.
          const viaFaith = !!pay && pay.faith > 0 && def.kind !== "faith";
          const special = skill === "slingStone";
          return (
            <button
              key={skill}
              onClick={() => onSkill(skill)}
              disabled={!ready}
              className={`rounded-lg border px-2.5 py-1.5 text-left disabled:cursor-not-allowed ${
                special && !reason
                  ? "border-amber-300 bg-amber-500/25 shadow-[0_0_14px] shadow-amber-400/50"
                  : SKILL_TONE[viaFaith ? "faith" : def.kind]
              }`}
            >
              <div className={`flex items-center justify-between ${ready ? "" : "opacity-50"}`}>
                <span className={`text-sm font-bold ${special ? "text-amber-200" : "text-stone-100"}`}>{t(`v2.skill.${skill}.name`)}</span>
                <span className="text-xs font-bold">
                  {pay ? ICON[def.kind].repeat(def.cost - pay.faith) + ICON.faith.repeat(pay.faith) : ICON[def.kind].repeat(def.cost)}
                </span>
              </div>
              <div className={`text-[11px] text-stone-400 ${ready ? "" : "opacity-50"}`}>
                {skill === "slingStone"
                  ? t("v2.skill.slingStone.desc", { n: skillDamage(b, skill, "goliath") })
                  : t(`v2.skill.${skill}.desc`, { n: SUPPORT_AMOUNT[skill] ?? skillDamage(b, skill) })}
              </div>
              {def.damage && skill !== "slingStone" && (
                <div className={`text-[10px] text-stone-500 ${ready ? "" : "opacity-50"}`}>{t("v2.ui.elementHint")}</div>
              )}
              {ready && viaFaith && pay && (
                <div className="text-[10px] font-semibold text-amber-300">{t("v2.ui.usesFaith", { n: pay.faith, kind: t(`v2.energy.${def.kind}.name`) })}</div>
              )}
              {reason && reason !== "v2.reason.over" && <div className="text-[10px] text-rose-300">⛔ {t(reason)}</div>}
            </button>
          );
        })}
      </div>

      {isTarget && (
        <button onClick={onTarget} className="mt-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-sm font-bold text-stone-950 hover:bg-emerald-400">
          ✓ {t(`char.${id}.name`)}
        </button>
      )}
    </div>
  );
}

function LogPanel({ b, t }: { b: BattleState; t: T }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [b.log.length]);
  const tone = { player: "text-amber-100", enemy: "text-red-300", system: "text-stone-400 italic", detail: "text-stone-500" };
  return (
    <section className="flex min-h-48 flex-col rounded-2xl border border-stone-700 bg-stone-900/80 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400">{t("v2.ui.log")}</h3>
      <div ref={ref} className="flex-1 space-y-0.5 overflow-y-auto text-xs lg:max-h-[calc(100vh-8rem)]">
        {b.log.map((l) => (
          <div key={l.id} className={tone[l.kind]}>
            {t(l.key, l.params)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function BattleV2Screen() {
  const t = useT();
  const { battle: b, resolving, auto, setAuto, start, play, playAll, cast, endTurn } = useBattleV2Store();
  const [pending, setPending] = useState<{ skill: SkillId; targets: Target[] } | null>(null);
  const [showResult, setShowResult] = useState(true);

  // The deck is shuffled on the client so prerendering stays deterministic.
  useEffect(() => {
    start();
  }, [start]);

  if (!b) return <div className="flex flex-1 items-center justify-center text-stone-400">…</div>;

  // While auto-battle runs, the AI owns the controls.
  const locked = resolving || auto || b.result !== "ongoing";
  const onSkill = (skill: SkillId) => {
    const targets = skillTargets(b, skill);
    if (targets.length) setPending({ skill, targets });
    else cast(skill);
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 pb-16 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="text-[11px] uppercase tracking-widest text-stone-500">{t("v2.ui.prototype")}</div>
        <EnemyRow
          b={b}
          t={t}
          targets={pending?.targets ?? null}
          skill={pending?.skill ?? null}
          onTarget={(id) => {
            if (pending) cast(pending.skill, id);
            setPending(null);
          }}
        />

        {/* Scripture hand: every card is one energy */}
        <section className="rounded-2xl border border-stone-700 bg-stone-900/80 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-400">
            <span className="font-semibold text-stone-200">{t("v2.ui.hand", { n: b.hand.length, max: R.maxHand })}</span>
            <span>{t("v2.ui.deck", { n: b.deck.length })}</span>
            <span>{t("v2.ui.discard", { n: b.discard.length })}</span>
            <button
              onClick={playAll}
              disabled={locked || !b.hand.length}
              className="ml-auto rounded-lg border border-stone-500 px-3 py-1 text-xs text-stone-200 enabled:hover:bg-stone-800 disabled:opacity-40"
            >
              {t("v2.ui.playAll")}
            </button>
          </div>
          <div className="rounded-lg bg-stone-950/60 px-3 py-2 text-sm">
            {pending ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-emerald-200">
                  {t(`v2.skill.${pending.skill}.name`)} ·{" "}
                  {pending.targets.some((x) => (ENEMY_ORDER as string[]).includes(x)) ? t("v2.ui.chooseEnemy") : t("v2.ui.chooseTarget")}
                </span>
                <button onClick={() => setPending(null)} className="text-xs text-stone-400 underline hover:text-white">
                  {t("v2.ui.cancel")}
                </button>
              </div>
            ) : (
              <span className="text-stone-400">{t("v2.ui.turnHint", { turn: b.turn })}</span>
            )}
          </div>
          <div className="flex items-end gap-3 overflow-x-auto pb-2 pt-3">
            {[...b.hand]
              .sort((x, y) => ENERGY_ORDER.indexOf(CARDS_V2[x.card].energy) - ENERGY_ORDER.indexOf(CARDS_V2[y.card].energy))
              .map((inst) => {
                const kind = CARDS_V2[inst.card].energy;
                return (
                  <button
                    key={inst.uid}
                    onClick={() => play(inst.uid)}
                    disabled={locked || !!pending}
                    className={`flex w-36 shrink-0 flex-col items-center rounded-xl border-2 bg-gradient-to-b to-stone-900 p-2.5 text-center shadow-lg transition enabled:hover:-translate-y-1 disabled:opacity-45 ${ENERGY_TONE[kind]}`}
                  >
                    <span className="text-3xl">{ICON[kind]}</span>
                    <span className="text-xs font-bold">{t(`v2.energy.${kind}.name`)} +1</span>
                    <span className="mt-1.5 text-[11px] leading-tight text-stone-200">{t(`v2.card.${inst.card}.name`)}</span>
                    <span className="text-[10px] text-stone-500">{t(`v2.card.${inst.card}.ref`)}</span>
                  </button>
                );
              })}
          </div>
        </section>

        {/* Energy pool (above the characters who spend it) */}
        <section className="flex flex-wrap items-stretch gap-3 rounded-2xl border border-stone-700 bg-stone-900/80 p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-stone-400 [writing-mode:horizontal-tb] self-center">{t("v2.ui.pool")}</div>
          {ENERGY_ORDER.map((kind) => (
            <div key={kind} className={`min-w-36 flex-1 rounded-xl border-2 bg-gradient-to-b to-stone-900 px-3 py-2 ${ENERGY_TONE[kind]}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">
                  {ICON[kind]} {t(`v2.energy.${kind}.name`)}
                </span>
                <span className="text-2xl font-black">
                  {b.energy[kind]}
                  {kind === "faith" && <span className="text-xs font-normal text-stone-400">/{R.maxFaith}</span>}
                </span>
              </div>
              <div className="text-[10px] text-stone-400">{t(`v2.energy.${kind}.desc`)}</div>
            </div>
          ))}
          {b.energy.faith >= SKILLS.slingStone.cost && isAlive(b, "david") && (
            <div className="w-full text-sm font-semibold text-amber-300">{t("v2.ui.slingReady")}</div>
          )}
        </section>
        <div className="grid gap-3 md:grid-cols-3">
          {PARTY_ORDER.map((id) => (
            <CharacterPanel
              key={id}
              b={b}
              id={id}
              t={t}
              locked={locked}
              targets={pending?.targets ?? null}
              onSkill={onSkill}
              onTarget={() => {
                if (pending) cast(pending.skill, id);
                setPending(null);
              }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {auto && b.result === "ongoing" && <span className="text-sm text-sky-300">{t("v2.ui.autoRunning")}</span>}
          <button
            onClick={() => {
              setPending(null);
              setAuto(!auto);
            }}
            disabled={b.result !== "ongoing"}
            className={`rounded-2xl border-2 px-5 py-3 font-bold disabled:opacity-40 ${
              auto ? "border-sky-300 bg-sky-500 text-stone-950 hover:bg-sky-400" : "border-sky-400 text-sky-200 hover:bg-sky-950"
            }`}
          >
            {auto ? t("v2.ui.autoOn") : t("v2.ui.autoOff")}
          </button>
          <button
            onClick={() => {
              setPending(null);
              endTurn();
            }}
            disabled={locked}
            className="rounded-2xl bg-red-700 px-8 py-3 text-lg font-bold text-white enabled:hover:bg-red-600 disabled:opacity-40"
          >
            {resolving ? t("v2.ui.resolving") : t("v2.ui.endTurn")}
          </button>
        </div>
      </div>

      <LogPanel b={b} t={t} />

      {b.result !== "ongoing" && showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`w-full max-w-sm rounded-2xl border-2 bg-stone-900 p-6 text-center ${b.result === "victory" ? "border-amber-400" : "border-red-700"}`}>
            <div className="text-5xl">{b.result === "victory" ? "👑" : "💀"}</div>
            <h2 className="mt-2 text-3xl font-bold">{b.result === "victory" ? t("v2.ui.victory") : t("v2.ui.defeat")}</h2>
            <p className="mt-2 text-stone-300">{t("v2.ui.resultTurns", { n: b.turn })}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setPending(null);
                  start();
                }}
                className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-stone-950 hover:bg-amber-400"
              >
                {t("v2.ui.playAgain")}
              </button>
              <button onClick={() => setShowResult(false)} className="rounded-xl border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-800">
                {t("v2.ui.viewBattlefield")}
              </button>
              <Link href="/" className="rounded-xl border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-800">
                {t("v2.ui.backHome")}
              </Link>
            </div>
          </div>
        </div>
      )}
      {b.result !== "ongoing" && !showResult && (
        <button onClick={() => setShowResult(true)} className="fixed bottom-14 right-3 z-40 rounded-xl bg-amber-500 px-4 py-2 font-semibold text-stone-950">
          {b.result === "victory" ? t("v2.ui.victory") : t("v2.ui.defeat")} · {t("v2.ui.playAgain")}
        </button>
      )}
    </div>
  );
}
