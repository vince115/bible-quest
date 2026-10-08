"use client";

// /battle-v3: card-board layout experiment on the v2 rules, plus a line-up and a front line
// (game/v3/engine.ts): pick 1–3 characters, the front line takes the single-target hits, one free swap per turn.
// Each side is one row (bench · front line · bench); on phones the selected character's skills move
// into an action bar, so the whole board fits on one screen.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CARDS_V2,
  CHARACTER_ELEMENT,
  CHARACTER_SKILLS,
  ENEMY_ELEMENT,
  ENEMY_HP,
  MAX_HP,
  RULES_V2 as R,
  SKILLS,
} from "@/game/v2/data";
import { canAct, elementMultiplier, enemyAlive, enemyDamage, isAlive, payment, skillDamage, type Target } from "@/game/v2/engine";
import { PARTY_ORDER } from "@/game/v2/data";
import type { BattleState, CharacterId, Element, EnemyId, EnergyKind, Intent, SkillId } from "@/game/v2/types";
import { ACHIEVEMENTS, useAchievementStore, type AchievementId } from "@/game/v3/achievements";
import { boardBlockReason, boardSkillTargets, canSwap, isDuel, needsFront, type Board } from "@/game/v3/engine";
import { useBattleV3Store } from "@/game/v3/store";
import { useT } from "@/game/locale";

type T = ReturnType<typeof useT>;
type Pending = { skill: SkillId; targets: Target[] };

const ENERGY_ICON: Record<EnergyKind, string> = { faith: "✨", attack: "🗡️", guard: "🕊️" };
const ENERGY_RING: Record<EnergyKind, string> = {
  faith: "border-amber-300 bg-amber-500/25 text-amber-100",
  attack: "border-red-400 bg-red-600/25 text-red-100",
  guard: "border-emerald-400 bg-emerald-600/25 text-emerald-100",
};
const SKILL_TONE: Record<EnergyKind, string> = {
  faith: "border-amber-400/70 bg-amber-950/70 enabled:hover:border-amber-300",
  attack: "border-red-500/70 bg-red-950/70 enabled:hover:border-red-400",
  guard: "border-emerald-500/70 bg-emerald-950/70 enabled:hover:border-emerald-400",
};
const ELEMENT_ICON: Record<Element, string> = { water: "💧", fire: "🔥", wood: "🌿", light: "☀️", dark: "🌑" };
/** Card frame and art colours by element. */
const ELEMENT_FRAME: Record<Element, string> = {
  water: "border-sky-300 from-sky-900 via-sky-950 to-stone-950",
  fire: "border-orange-300 from-orange-900 via-red-950 to-stone-950",
  wood: "border-emerald-300 from-emerald-900 via-emerald-950 to-stone-950",
  light: "border-yellow-200 from-yellow-700 via-amber-900 to-stone-950",
  dark: "border-violet-300 from-violet-900 via-stone-950 to-black",
};
const PORTRAIT: Record<CharacterId | EnemyId, string> = {
  david: "🪨",
  samuel: "📜",
  jonathan: "🤝",
  goliath: "🗿",
  bearer: "🛡️",
  archer: "🏹",
};
const SUPPORT_AMOUNT: Partial<Record<SkillId, number>> = { heal: R.healAmount, arise: R.ariseHp, covshield: R.covShield };

/** Card widths: phones get narrow cards so a whole side fits in one row. */
const CARD_WIDTH = { large: "w-[9.5rem] sm:w-64", small: "w-[6.25rem] sm:w-56" };

/** HP bar: green only at full HP, yellow above 50%, orange from 20% to 50%, red at 20% or less; Shield as a translucent layer. */
function HpBar({ value, max, shield = 0 }: { value: number; max: number; shield?: number }) {
  const pct = Math.max(0, (value / max) * 100);
  const shieldPct = Math.min(100, (shield / max) * 100);
  const color = pct >= 100 ? "bg-emerald-500" : pct > 50 ? "bg-yellow-400" : pct > 20 ? "bg-orange-500" : "bg-red-600";
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-black/50 sm:h-2">
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

/** What an enemy action does, as a short tag: damage against the current front line, or the effect. */
function actionTag(t: T, action: Intent["action"], front: CharacterId): string {
  if (action === "spear") return String(enemyDamage("goliath", front, R.spear));
  if (action === "crush") return String(enemyDamage("goliath", front, R.crush));
  if (action === "swing") return t("v3.tag.all", { n: R.swing });
  if (action === "defy") return t("v3.tag.shake", { n: R.defyTargets });
  return t("v3.tag.charge");
}

/** An enemy skill like a TCG attack row: name on the left, damage (or effect) on the right. */
function AttackRow({ label, name, tag, dim }: { label?: string; name: string; tag: string; dim?: boolean }) {
  return (
    <div className={`rounded-md bg-black/40 px-1.5 py-1 sm:px-2 ${dim ? "opacity-70" : ""}`}>
      {label && <div className="hidden text-[9px] uppercase tracking-widest text-red-300/70 sm:block">{label}</div>}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-red-100 sm:text-xs">{name}</span>
        <span className="shrink-0 text-xs font-black text-red-50 sm:text-sm">{tag}</span>
      </div>
    </div>
  );
}

function IntentRow({ label, intent, front, t, dim }: { label: string; intent: Intent; front: CharacterId; t: T; dim?: boolean }) {
  const single = intent.action === "spear" || intent.action === "crush";
  const name = `${t(`v2.action.${intent.action}.name`)}${single ? ` → ${t("v3.ui.front")}` : ""}`;
  return <AttackRow label={label} name={name} tag={actionTag(t, intent.action, front)} dim={dim} />;
}

function CardHeader({ name, element, hp, shield, size }: { name: string; element: Element; hp: number; shield?: number; size: "large" | "small" }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className={`truncate font-bold ${size === "large" ? "text-xs sm:text-base" : "text-[10px] sm:text-sm"}`}>
        {ELEMENT_ICON[element]} {name}
      </span>
      <span className={`shrink-0 font-black ${size === "large" ? "text-base sm:text-2xl" : "text-xs sm:text-lg"}`}>
        <span className="mr-0.5 text-[8px] font-bold sm:text-[10px]">HP</span>
        {hp}
        {!!shield && <span className="ml-0.5 text-[9px] font-bold text-sky-200 sm:text-xs">🛡️{shield}</span>}
      </span>
    </div>
  );
}

/** Enemy card: "large" for the front line (Goliath), "small" for the bench. */
function EnemyCard({
  b,
  front,
  id,
  t,
  size,
  className = "",
  pending,
  onTarget,
}: {
  b: BattleState;
  front: CharacterId;
  id: EnemyId;
  t: T;
  size: "large" | "small";
  className?: string;
  pending: Pending | null;
  onTarget: () => void;
}) {
  const hp = b.enemies[id].hp;
  const alive = hp > 0;
  const g = b.goliath;
  const isTarget = !!pending?.targets.includes(id);
  const owner = pending ? SKILLS[pending.skill].owner : null;
  const mult = owner ? elementMultiplier(CHARACTER_ELEMENT[owner], ENEMY_ELEMENT[id]) : 1;
  return (
    <div
      className={`relative flex shrink-0 flex-col gap-1 rounded-xl border-[3px] bg-gradient-to-b p-1.5 shadow-2xl transition sm:gap-1.5 sm:border-4 sm:p-2 ${
        ELEMENT_FRAME[ENEMY_ELEMENT[id]]
      } ${CARD_WIDTH[size]} ${!alive ? "opacity-40 grayscale" : ""} ${isTarget ? "ring-4 ring-amber-300" : ""} ${className}`}
    >
      <CardHeader name={t(`v2.enemy.${id}.name`)} element={ENEMY_ELEMENT[id]} hp={hp} size={size} />
      <HpBar value={hp} max={ENEMY_HP[id]} />
      <div className={`flex items-center justify-center rounded-lg bg-black/30 ${size === "large" ? "h-10 text-3xl sm:h-16 sm:text-5xl" : "h-8 text-2xl sm:h-10 sm:text-3xl"}`}>
        {PORTRAIT[id]}
      </div>
      <div className="flex flex-wrap gap-1 empty:hidden">
        {id === "goliath" && g.enraged && <span className="rounded bg-red-700 px-1 text-[9px] font-bold sm:text-[10px]">{t("v2.ui.enraged")}</span>}
        {id === "goliath" && g.stunned && <span className="rounded bg-sky-600 px-1 text-[9px] font-bold sm:text-[10px]">{t("v2.ui.stunned")}</span>}
        {id === "goliath" && g.charging && <span className="rounded bg-orange-600 px-1 text-[9px] font-bold sm:text-[10px]">{t("v2.ui.charging")}</span>}
        {id === "goliath" && enemyAlive(b, "bearer") && <span className="rounded bg-amber-700/80 px-1 text-[9px] font-bold sm:text-[10px]">{t("v2.ui.protected")}</span>}
        {!alive && <span className="rounded bg-stone-700 px-1 text-[9px] sm:text-[10px]">{t("v2.enemy.fallen")}</span>}
      </div>
      {alive && id === "goliath" && (
        <div className="grid gap-1">
          {g.stunned ? (
            <div className="rounded-md bg-black/40 px-2 py-1 text-[11px] font-semibold text-sky-200 sm:text-xs">{t("v2.ui.intentStunned")}</div>
          ) : (
            <IntentRow label={t("v3.ui.nextAction")} intent={b.intents[0]} front={front} t={t} />
          )}
          <div className="hidden sm:block">
            <IntentRow label={t("v3.ui.then")} intent={b.intents[1]} front={front} t={t} dim />
          </div>
        </div>
      )}
      {alive && id === "archer" && b.archerTarget && (
        <AttackRow name={`${t("v3.action.arrow")} → ${t("v3.ui.front")}`} tag={String(enemyDamage("archer", front, R.archerDamage))} />
      )}
      {alive && id === "bearer" && (
        <div className="rounded-md bg-black/40 px-1.5 py-1 text-[9px] leading-tight text-amber-100 sm:text-[11px]">{t("v3.ui.protects")}</div>
      )}
      {isTarget && pending && (
        <button
          onClick={onTarget}
          className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-amber-400 py-1 text-xs font-black text-stone-950 shadow-lg hover:bg-amber-300 sm:inset-x-2 sm:bottom-2 sm:py-1.5 sm:text-sm"
        >
          🎯 {skillDamage(b, pending.skill, id)}
          {mult !== 1 && ` ×${mult}`}
        </button>
      )}
    </div>
  );
}

/** A character's skills as attack rows (cost · name · amount), like a TCG card. */
function SkillList({ board, id, t, locked, pending, onSkill }: { board: Board; id: CharacterId; t: T; locked: boolean; pending: Pending | null; onSkill: (skill: SkillId) => void }) {
  const b = board.battle;
  return (
    <>
      {CHARACTER_SKILLS[id].map((skill) => {
        const def = SKILLS[skill];
        const reason = boardBlockReason(board, skill);
        const ready = !locked && !pending && !reason;
        const pay = payment(b, skill);
        const viaFaith = !!pay && pay.faith > 0 && def.kind !== "faith";
        const cost = pay ? ENERGY_ICON[def.kind].repeat(def.cost - pay.faith) + ENERGY_ICON.faith.repeat(pay.faith) : ENERGY_ICON[def.kind].repeat(def.cost);
        const amount = def.damage ? skillDamage(b, skill, skill === "slingStone" ? "goliath" : undefined) : SUPPORT_AMOUNT[skill];
        const special = skill === "slingStone" && !reason;
        return (
          <button
            key={skill}
            onClick={() => onSkill(skill)}
            disabled={!ready}
            title={reason ? t(reason) : t(`v2.skill.${skill}.desc`, { n: amount })}
            className={`flex items-center gap-2 rounded-md border px-2 py-1 text-left disabled:cursor-not-allowed ${
              special ? "border-amber-300 bg-amber-500/30 shadow-[0_0_12px] shadow-amber-400/60" : SKILL_TONE[viaFaith ? "faith" : def.kind]
            } ${ready ? "" : "opacity-50"}`}
          >
            <span className="w-11 shrink-0 text-xs">{cost}</span>
            <span className="flex-1 text-sm font-bold">{t(`v2.skill.${skill}.name`)}</span>
            <span className="text-sm font-black">{def.damage ? amount : `+${amount}`}</span>
            {reason && reason !== "v2.reason.over" && <span className="text-[9px] text-rose-200 sm:hidden">{t(reason)}</span>}
          </button>
        );
      })}
    </>
  );
}

/** Character card. On phones the skills are hidden here and shown in the action bar instead. */
function CharacterCard({
  board,
  id,
  t,
  size,
  className = "",
  selected,
  locked,
  pending,
  onSkill,
  onTarget,
  onSelect,
  onSwap,
}: {
  board: Board;
  id: CharacterId;
  t: T;
  size: "large" | "small";
  className?: string;
  selected: boolean;
  locked: boolean;
  pending: Pending | null;
  onSkill: (skill: SkillId) => void;
  onTarget: () => void;
  onSelect: () => void;
  onSwap: () => void;
}) {
  const b = board.battle;
  const c = b.party[id];
  const isFront = board.front === id;
  const promote = needsFront(board);
  const swappable = !locked && !pending && canSwap(board, id);
  const alive = isAlive(b, id);
  const isTarget = !!pending?.targets.includes(id);
  return (
    <div
      onClick={onSelect}
      className={`relative flex shrink-0 cursor-pointer flex-col gap-1 rounded-xl border-[3px] bg-gradient-to-b p-1.5 shadow-2xl sm:cursor-default sm:gap-1.5 sm:border-4 sm:p-2 ${
        ELEMENT_FRAME[CHARACTER_ELEMENT[id]]
      } ${CARD_WIDTH[size]} ${!alive ? "opacity-50 grayscale" : canAct(b, id) ? "" : "opacity-80"} ${
        isTarget ? "ring-4 ring-emerald-300" : selected ? "ring-2 ring-white/80 sm:ring-0" : ""
      } ${className}`}
    >
      {c.shield > 0 && alive && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 animate-pulse rounded-2xl border-2 border-sky-300/70 bg-sky-400/10 shadow-[inset_0_0_24px] shadow-sky-300/40 sm:-inset-1.5"
        />
      )}
      {isFront && (
        <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow sm:text-[10px]">
          {t("v3.ui.front")}
        </span>
      )}
      <CardHeader name={t(`char.${id}.name`)} element={CHARACTER_ELEMENT[id]} hp={c.hp} shield={alive ? c.shield : 0} size={size} />
      <HpBar value={c.hp} max={MAX_HP[id]} shield={alive ? c.shield : 0} />
      <div className={`relative flex items-center justify-center rounded-lg bg-black/30 ${size === "large" ? "h-10 text-3xl sm:h-14 sm:text-4xl" : "h-8 text-2xl sm:h-10 sm:text-3xl"}`}>
        {alive ? PORTRAIT[id] : "✝"}
        {c.shaken && alive && <span className="absolute left-0.5 top-0.5 rounded bg-purple-800/90 px-1 text-[8px] font-semibold sm:text-[10px]">😨</span>}
        {c.acted && alive && <span className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[8px] sm:text-[10px]">✓</span>}
        {!isFront && alive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwap();
            }}
            disabled={!swappable}
            className={`absolute inset-x-1 bottom-0.5 rounded-md border px-1 py-0.5 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs ${
              promote ? "animate-pulse border-red-300 bg-red-600 text-white" : "border-sky-300/70 bg-stone-950/80 text-sky-100 enabled:hover:bg-sky-900"
            }`}
          >
            {promote ? t("v3.ui.promote") : board.swapped ? t("v3.ui.swapUsed") : t("v3.ui.swap")}
          </button>
        )}
      </div>

      <div className="hidden gap-1 sm:grid">
        <SkillList board={board} id={id} t={t} locked={locked} pending={pending} onSkill={onSkill} />
      </div>
      {size === "large" && id === "david" && (
        <div className="hidden text-[10px] leading-tight text-amber-100/80 sm:block">
          {t("v2.passive.david")}
          {b.energy.faith >= R.giantFaith && alive && <span className="ml-1 font-bold text-amber-300">· {t("v2.ui.giantOn")}</span>}
        </div>
      )}
      {isTarget && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTarget();
          }}
          className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-emerald-400 py-1 text-xs font-black text-stone-950 shadow-lg sm:inset-x-2 sm:bottom-2 sm:py-1.5 sm:text-sm"
        >
          ✓ {t(`char.${id}.name`)}
        </button>
      )}
    </div>
  );
}

function Pile({ label, count, faceDown }: { label: string; count: number; faceDown?: boolean }) {
  return (
    <div className="hidden flex-col items-center gap-1 sm:flex">
      <div
        className={`relative flex h-20 w-14 items-center justify-center rounded-lg border-2 text-2xl font-black shadow-[4px_4px_0_rgba(0,0,0,0.4)] ${
          faceDown ? "border-amber-300/70 bg-gradient-to-br from-indigo-900 to-stone-950 text-amber-200" : "border-stone-500 bg-stone-800/80 text-stone-300"
        }`}
      >
        {faceDown ? "✝" : ""}
        <span className="absolute bottom-1 right-1.5 text-sm">{count}</span>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-stone-300">{label}</span>
    </div>
  );
}

/** Before battle: bring 1–3 characters and choose who starts on the front line. */
function LineupPicker({ t, onStart }: { t: T; onStart: (lineup: CharacterId[], front: CharacterId) => void }) {
  const last = useBattleV3Store((st) => st.lastLineup);
  const unlocked = useAchievementStore((st) => st.unlocked);
  const [lineup, setLineup] = useState<CharacterId[]>(last.lineup);
  const [front, setFront] = useState<CharacterId>(last.front);
  const chosen = PARTY_ORDER.filter((id) => lineup.includes(id));
  const lead = chosen.includes(front) ? front : chosen[0];
  const toggle = (id: CharacterId) => setLineup(lineup.includes(id) ? lineup.filter((x) => x !== id) : [...lineup, id]);

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-b from-rose-950 via-stone-900 to-indigo-950 px-4 py-6">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest text-stone-300/70 sm:text-[11px]">{t("v3.ui.title")}</div>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("v3.lineup.title")}</h1>
        <p className="mt-1 max-w-md text-sm text-stone-300">{t("v3.lineup.hint")}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
        {PARTY_ORDER.map((id) => {
          const on = chosen.includes(id);
          return (
            <div
              key={id}
              className={`relative flex w-[6.5rem] flex-col gap-1.5 rounded-xl border-[3px] bg-gradient-to-b p-2 transition sm:w-44 sm:border-4 ${ELEMENT_FRAME[CHARACTER_ELEMENT[id]]} ${
                on ? "" : "opacity-40 grayscale"
              }`}
            >
              {on && lead === id && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white sm:text-[10px]">
                  {t("v3.ui.front")}
                </span>
              )}
              <button onClick={() => toggle(id)} className="flex flex-col gap-1.5 text-left">
                <CardHeader name={t(`char.${id}.name`)} element={CHARACTER_ELEMENT[id]} hp={MAX_HP[id]} size="small" />
                <div className="flex h-10 items-center justify-center rounded-lg bg-black/30 text-3xl sm:h-14 sm:text-4xl">{PORTRAIT[id]}</div>
                <div className="grid gap-0.5 text-[10px] text-stone-200 sm:text-xs">
                  {CHARACTER_SKILLS[id].map((skill) => (
                    <span key={skill} className="truncate">
                      {ENERGY_ICON[SKILLS[skill].kind]} {t(`v2.skill.${skill}.name`)}
                    </span>
                  ))}
                </div>
                <span className={`rounded-md py-0.5 text-center text-xs font-bold ${on ? "bg-amber-500 text-stone-950" : "border border-stone-400 text-stone-200"}`}>
                  {on ? t("v3.lineup.in") : t("v3.lineup.out")}
                </span>
              </button>
              <button
                onClick={() => setFront(id)}
                disabled={!on || lead === id}
                className="rounded-md border border-red-400/70 py-0.5 text-[10px] font-bold text-red-100 enabled:hover:bg-red-900/50 disabled:opacity-30 sm:text-xs"
              >
                {t("v3.lineup.setFront")}
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onStart(chosen, lead)}
        disabled={!chosen.length}
        className="rounded-full bg-red-700 px-8 py-2.5 text-lg font-bold text-white shadow-lg enabled:hover:bg-red-600 disabled:opacity-40"
      >
        {chosen.length === 1 ? t("v3.lineup.startSolo") : chosen.length ? t("v3.lineup.start") : t("v3.lineup.need")}
      </button>

      <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">{t("v3.ach.title")}</div>
        <div className="grid gap-1.5">
          {ACHIEVEMENTS.map((id: AchievementId) => {
            const got = unlocked.includes(id);
            return (
              <div key={id} className={`flex items-center gap-2 text-sm ${got ? "text-amber-100" : "text-stone-500"}`}>
                <span className="text-lg">{got ? "🏆" : "🔒"}</span>
                <div className="min-w-0">
                  <div className="font-semibold">{t(`v3.ach.${id}.name`)}</div>
                  <div className="text-[11px] text-stone-400">{t(`v3.ach.${id}.desc`)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Link href="/" className="text-xs text-stone-400 underline">
        {t("v2.ui.backHome")}
      </Link>
    </div>
  );
}

export function BattleV3Screen() {
  const t = useT();
  const { board, resolving, auto, setAuto, start, restart, pickLineup, play, playAll, cast, swap, endTurn, newAchievements } = useBattleV3Store();
  const [pending, setPending] = useState<Pending | null>(null);
  const [picked, setPicked] = useState<CharacterId | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const b = board?.battle;

  // Achievements live in localStorage; read them after mount so the prerendered page matches.
  useEffect(() => {
    void useAchievementStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [b?.log.length, showLog]);

  if (!board || !b) return <LineupPicker t={t} onStart={start} />;

  const selected = picked && board.lineup.includes(picked) ? picked : board.front;
  const locked = resolving || auto || b.result !== "ongoing";
  const promote = needsFront(board);
  const onSkill = (skill: SkillId) => {
    const targets = boardSkillTargets(board, skill);
    if (targets.length) setPending({ skill, targets });
    else cast(skill);
  };
  const onTarget = (target: Target) => {
    if (pending) cast(pending.skill, target);
    setPending(null);
  };
  const charProps = (id: CharacterId) => ({
    board,
    id,
    t,
    locked,
    pending,
    onSkill,
    selected: selected === id,
    onTarget: () => onTarget(id),
    onSelect: () => setPicked(id),
    onSwap: () => {
      setPending(null);
      swap(id);
    },
  });
  const bench = board.lineup.filter((id) => id !== board.front);
  const lastHit = [...b.log].reverse().find((l) => l.key === "v2.log.attack" || l.key === "v2.log.slingStone");
  const order: EnergyKind[] = ["faith", "attack", "guard"];
  const hand = [...b.hand].sort((x, y) => order.indexOf(CARDS_V2[x.card].energy) - order.indexOf(CARDS_V2[y.card].energy));

  return (
    <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-x-hidden bg-gradient-to-b from-rose-950 via-stone-900 to-indigo-950 pb-12 sm:pb-6">
      <div className="px-3 pt-2 text-[10px] uppercase tracking-widest text-stone-300/70 sm:px-4 sm:pt-3 sm:text-[11px]">{t("v3.ui.title")}</div>

      {/* Enemy side — phone: archer · Goliath · shield bearer in one row; desktop: bench above the front line.
          Each half takes an equal share of any extra height and centres its cards, so the board sits in the middle. */}
      <section className="flex flex-1 flex-col items-center justify-center gap-1 px-2 pt-1 sm:px-4">
        <div className="flex items-start justify-center gap-1.5 sm:gap-4">
          {/* In a duel the shield bearer and the archer stand aside. */}
          <div className={isDuel(board) ? "hidden" : "contents"}>
            <EnemyCard b={b} front={board.front} id="archer" t={t} size="small" className="order-1" pending={pending} onTarget={() => onTarget("archer")} />
            <EnemyCard b={b} front={board.front} id="bearer" t={t} size="small" className="order-3" pending={pending} onTarget={() => onTarget("bearer")} />
          </div>
          <EnemyCard b={b} front={board.front} id="goliath" t={t} size="large" className="order-2" pending={pending} onTarget={() => onTarget("goliath")} />
        </div>
      </section>

      {/* Middle band: energy zone, last hit, auto, end turn */}
      <section className="my-2 flex flex-wrap items-center justify-center gap-2 border-y border-white/10 bg-black/30 px-2 py-2 sm:gap-4 sm:px-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden text-[10px] uppercase tracking-widest text-stone-400 sm:inline">{t("v3.ui.energyZone")}</span>
          {order.map((k) => (
            <div key={k} title={t(`v2.energy.${k}.desc`)} className={`flex h-9 w-9 flex-col items-center justify-center rounded-full border-2 sm:h-12 sm:w-12 ${ENERGY_RING[k]}`}>
              <span className="text-[11px] leading-none sm:text-sm">{ENERGY_ICON[k]}</span>
              <span className="text-sm font-black leading-none sm:text-base">{b.energy[k]}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            setPending(null);
            setAuto(!auto);
          }}
          disabled={b.result !== "ongoing"}
          className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold disabled:opacity-40 sm:order-3 sm:px-4 sm:py-2 sm:text-sm ${
            auto ? "border-sky-300 bg-sky-500 text-stone-950" : "border-sky-300 text-sky-100 hover:bg-sky-900/60"
          }`}
        >
          {auto ? t("v2.ui.autoOn") : t("v2.ui.autoOff")}
        </button>
        <button
          onClick={() => {
            setPending(null);
            endTurn();
          }}
          disabled={locked || promote}
          className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-bold text-white shadow-lg enabled:hover:bg-red-600 disabled:opacity-40 sm:order-4 sm:px-6 sm:py-2.5 sm:text-base"
        >
          {resolving ? t("v2.ui.resolving") : t("v2.ui.endTurn")}
        </button>
        <div className="w-full text-center text-[11px] font-semibold leading-tight text-amber-100 sm:order-2 sm:w-auto sm:min-w-48 sm:flex-1 sm:text-sm">
          {promote ? (
            <span className="text-red-200">{t("v3.ui.chooseFront")}</span>
          ) : pending ? (
            <span className="text-emerald-200">
              {t(`v2.skill.${pending.skill}.name`)} · {t("v2.ui.chooseTarget")}{" "}
              <button onClick={() => setPending(null)} className="ml-2 text-xs text-stone-300 underline">
                {t("v2.ui.cancel")}
              </button>
            </span>
          ) : lastHit ? (
            t(lastHit.key, lastHit.params)
          ) : (
            <span className="text-stone-300">{t("v2.ui.goal")}</span>
          )}
        </div>
      </section>

      {/* Hand (above our characters): deck pile · fanned energy cards · discard pile */}
      <section className="flex items-end justify-center gap-4 px-2 pb-1 sm:px-4 sm:pb-3">
        <Pile label={t("v3.ui.deck")} count={b.deck.length} faceDown />
        <div className="flex min-w-0 flex-col items-center gap-1.5 sm:gap-2">
          <div className="flex justify-center pt-2">
            {hand.map((inst, i) => {
              const kind = CARDS_V2[inst.card].energy;
              const tilt = (i - (hand.length - 1) / 2) * 5;
              return (
                <button
                  key={inst.uid}
                  onClick={() => play(inst.uid)}
                  disabled={locked || !!pending}
                  style={{ transform: `rotate(${tilt}deg) translateY(${Math.abs(tilt) * 0.6}px)` }}
                  className={`-ml-4 flex h-20 w-14 shrink-0 flex-col items-center justify-between rounded-lg border-2 bg-stone-900 p-1 text-center shadow-xl transition first:ml-0 enabled:hover:z-10 enabled:hover:-translate-y-3 disabled:opacity-50 sm:-ml-3 sm:h-24 sm:w-[4.5rem] sm:p-1.5 ${ENERGY_RING[kind]}`}
                >
                  <span className="text-xl sm:text-3xl">{ENERGY_ICON[kind]}</span>
                  <span className="text-[9px] font-bold sm:text-[10px]">{t(`v2.energy.${kind}.name`)} +1</span>
                  <span className="hidden text-[9px] leading-tight text-stone-300 sm:block">{t(`v2.card.${inst.card}.ref`)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-stone-400 sm:hidden">
              {t("v3.ui.deck")} {b.deck.length} · {t("v3.ui.discard")} {b.discard.length}
            </span>
            <button
              onClick={playAll}
              disabled={locked || !b.hand.length}
              className="rounded-full border border-stone-400 px-3 py-1 text-xs text-stone-200 enabled:hover:bg-white/10 disabled:opacity-40"
            >
              {t("v2.ui.playAll")}
            </button>
          </div>
        </div>
        <Pile label={t("v3.ui.discard")} count={b.discard.length} />
      </section>

      {/* Our side — phone: Samuel · David · Jonathan in one row; desktop: front line above the bench */}
      <section className="flex flex-1 flex-col items-center justify-center gap-1 px-2 sm:px-4">
        <div className="flex items-start justify-center gap-1.5 pt-1 sm:gap-4">
          <CharacterCard {...charProps(board.front)} size="large" className="order-2" />
          {bench.map((id, i) => (
            <CharacterCard key={id} {...charProps(id)} size="small" className={i === 0 ? "order-1" : "order-3"} />
          ))}
        </div>

        {/* Phone action bar: the selected character's skills */}
        <div className="w-full max-w-sm rounded-xl border border-white/15 bg-black/40 p-2 sm:hidden">
          <div className="mb-1 text-[11px] font-semibold text-stone-200">
            {ELEMENT_ICON[CHARACTER_ELEMENT[selected]]} {t(`char.${selected}.name`)}
            {selected === "david" && b.energy.faith >= R.giantFaith && isAlive(b, "david") && <span className="ml-1 text-amber-300">· {t("v2.ui.giantOn")}</span>}
          </div>
          <div className="grid gap-1">
            <SkillList board={board} id={selected} t={t} locked={locked} pending={pending} onSkill={onSkill} />
          </div>
        </div>
      </section>

      {/* Battle log drawer */}
      <button
        onClick={() => setShowLog(!showLog)}
        className="fixed bottom-3 left-3 z-40 rounded-full border border-stone-500 bg-stone-900/90 px-3 py-1.5 text-xs text-stone-200"
      >
        {showLog ? t("v3.ui.hideLog") : t("v3.ui.showLog")}
      </button>
      {showLog && (
        <div ref={logRef} className="fixed bottom-12 left-3 right-3 z-40 max-h-[50vh] overflow-y-auto rounded-xl border border-stone-600 bg-stone-950/95 p-3 text-xs sm:right-auto sm:w-80">
          {b.log.map((l) => (
            <div key={l.id} className={l.kind === "enemy" ? "text-red-300" : l.kind === "player" ? "text-amber-100" : "text-stone-400"}>
              {t(l.key, l.params)}
            </div>
          ))}
        </div>
      )}

      {b.result !== "ongoing" && showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`w-full max-w-sm rounded-2xl border-2 bg-stone-900 p-6 text-center ${b.result === "victory" ? "border-amber-400" : "border-red-700"}`}>
            <div className="text-5xl">{b.result === "victory" ? "👑" : "💀"}</div>
            <h2 className="mt-2 text-3xl font-bold">{b.result === "victory" ? t("v2.ui.victory") : t("v2.ui.defeat")}</h2>
            <p className="mt-2 text-stone-300">{t("v2.ui.resultTurns", { n: b.turn })}</p>
            {board.lineup.length === 1 && <p className="mt-1 text-sm text-amber-200">{t("v3.lineup.solo")}</p>}
            {newAchievements.map((id) => (
              <div key={id} className="mt-3 rounded-xl border border-amber-300 bg-amber-500/15 p-3">
                <div className="text-xs font-bold text-amber-300">{t("v3.ach.unlocked")}</div>
                <div className="text-lg font-bold">🏆 {t(`v3.ach.${id}.name`)}</div>
                <div className="text-xs text-stone-300">{t(`v3.ach.${id}.desc`)}</div>
              </div>
            ))}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setPending(null);
                  restart();
                }}
                className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-stone-950 hover:bg-amber-400"
              >
                {t("v2.ui.playAgain")}
              </button>
              <button
                onClick={() => {
                  setPending(null);
                  setShowResult(true);
                  pickLineup();
                }}
                className="rounded-xl border border-amber-500 px-4 py-2 text-amber-100 hover:bg-stone-800"
              >
                {t("v3.lineup.change")}
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
