"use client";

// /battle-v3: card-board layout experiment on the v2 rules, plus a line-up and a front line
// (game/v3/engine.ts): pick 1–3 characters, the front line takes the single-target hits, one free swap per turn.
// Each side is one row (bench · front line · bench); on phones the selected character's skills move
// into an action bar, so the whole board fits on one screen.
import { motion, useDragControls, useMotionValue } from "framer-motion";
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
  basicDamage,
  energyCap,
  mpCap,
  MULTI_TARGETS,
  RULES_V2 as R,
  SHAKES,
  SHOOTER_DAMAGE,
  SINGLE_TARGET,
  SKILLS,
  STAGE_GUARD,
  STAGE_ORDER,
  STAGE_SHOOTER,
} from "@/game/v2/data";
import { actionBase, attachedTotal, hasSkillOfColor, attackableEnemies, energyColor, paymentPreview, bossOf, canAct, canBasicAttack, elementAdjust, cardValue, cardsOf, energyRoom, mpCost, spCost, cardBlockReason, elementMultiplier, hitsEveryone, inStory, skillTargets, supportAmount, enemyAlive, enemyDamage, isAlive, skillDamage, type Target } from "@/game/v2/engine";
import { MAGIC_VERSION_ENABLED, NEVER_FALLS, PARTY_ORDER, personOf, tableKind } from "@/game/v2/data";
import type { BattleState, CardId, CharacterId, EnemyId, EnergyKind, Intent, PoolMode, SkillId, StageId } from "@/game/v2/types";
import { ACHIEVEMENTS, useAchievementStore, type AchievementId } from "@/game/v3/achievements";
import { boardBlockReason, boardSkillTargets, canDrawOnBoard, canSwap, isDuel, needsFront, type Board } from "@/game/v3/engine";
import { useBattleV3Store } from "@/game/v3/store";
import { CAMPAIGN, CAMPAIGN_IDS, STAGE_ART, campaignStage, isUnlocked, nextStage, stageBgm, type CampaignStage, type CampaignStageId } from "@/game/v3/campaign";
import { useProgressStore } from "@/game/v3/progress";
import { safeStorage, useT } from "@/game/locale";
import { CharacterCardFace, figureArea } from "@/components/cards/CharacterCardFace";
import { CARD_RARITY, lookOf } from "@/components/cards/rarity";
import { EnemyCardFace } from "@/components/cards/EnemyCardFace";
import { HoloCard } from "@/components/cards/HoloCard";
import { ENERGY_ELEMENT, ScriptureCardBack, ScriptureCardFace } from "@/components/cards/ScriptureCardFace";
import { BATTLE_STORY_KEY, StoryPanel, VIEWER_WIDTH, savedScale, savedShowStory, viewerStyle } from "@/components/cards/viewer";
import { ENERGY_DISC, EnergyDisc, EnergyIcon } from "@/components/cards/EnergyIcon";
import { PoolModeContext } from "@/components/cards/PoolModeContext";
import { playBattleBgm, stopBattleBgm } from "@/game/audio";

type T = ReturnType<typeof useT>;
/** A skill waiting for its target; `basic` is the tabletop rules' free basic attack (made by that character) instead of a skill. */
type Pending = { skill: SkillId; targets: Target[]; basic?: CharacterId };

const ENERGY_RING: Record<EnergyKind, string> = {
  faith: "border-amber-300 bg-amber-500/25 text-amber-100",
  attack: "border-red-400 bg-red-600/25 text-red-100",
  guard: "border-emerald-400 bg-emerald-600/25 text-emerald-100",
};

/** Card widths: phones get narrow cards so a whole side fits in one row. Every card uses the TCG ratio 63:88. */
/**
 * Desktop: responsive card sizing fitting 3 rows (enemies, 4 skill cards, 3 character cards) without board scrolling.
 */
const DESKTOP_CARD = "lg:w-[min(14.5rem,calc((100dvh-20rem)*0.26))]";
/** Phones: 3 character cards across screen width in bottom row. */
const PHONE_CARD = "w-[min(8.5rem,calc((100vw-2.5rem)/3),calc((100dvh-20rem)*0.26))]";
const CARD_WIDTH = { large: `${PHONE_CARD} sm:w-32 ${DESKTOP_CARD}`, small: `${PHONE_CARD} sm:w-32 ${DESKTOP_CARD}` };
const CHAR_WIDTH = CARD_WIDTH;
/** Upper row: 4 skill/energy card slots across screen width. */
const SKILL_SLOT_WIDTH = "w-[min(5.8rem,calc((100vw-3rem)/4))] sm:w-24 md:w-28 lg:w-[min(10.5rem,calc((100dvh-20rem)*0.19))]";
const CARD_RATIO = "aspect-[63/88]";


/** What an enemy action does, as a short tag: damage against the current front line (or its prey), or the effect. */
function actionTag(t: T, b: BattleState, intent: Intent, front: CharacterId): string {
  const { action } = intent;
  if (SHAKES.includes(action)) return t("v3.tag.shake", { n: MULTI_TARGETS[action] ?? 1 });
  if (action === "tempt") return `😨 ✨-${R.temptFaith}`;
  if (action === "cry") return b.goliath.enraged ? `✨-${R.cryFaith}` : "—";
  if (action === "repair") return `+${R.repair}`;
  const n = actionBase(b, action);
  if (!n) return t("v3.tag.charge");
  if (hitsEveryone(b, action)) return t("v3.tag.all", { n });
  if (MULTI_TARGETS[action]) return `${n}×${MULTI_TARGETS[action]}`;
  return String(enemyDamage(bossOf(b), intent.targets[0] ?? front, n, b.pools));
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

function IntentRow({ label, intent, front, t, dim, b }: { label: string; intent: Intent; front: CharacterId; t: T; dim?: boolean; b: BattleState }) {
  // Aimed at the front line, or (the lions' Maul) at its prey by name.
  const single = SINGLE_TARGET.includes(intent.action);
  const prey = intent.action === "maul" && intent.targets[0] ? t(`char.${intent.targets[0]}.name`) : null;
  const name = `${t(`v2.action.${intent.action}.name`)}${single ? ` → ${t("v3.ui.front")}` : prey ? ` → ${prey}` : ""}`;
  return <AttackRow label={label} name={name} tag={actionTag(t, b, intent, front)} dim={dim} />;
}


/**
 * An enemy: its printed card (same style as ours) with the HP badge on the corner and status chips on the other;
 * what it will do next is shown under the card. While it is a valid target the whole card is the button.
 */
function EnemyCard({
  b,
  front,
  id,
  t,
  size,
  className = "",
  pending,
  onTarget,
  onView,
}: {
  b: BattleState;
  front: CharacterId;
  id: EnemyId;
  t: T;
  size: "large" | "small";
  className?: string;
  pending: Pending | null;
  onTarget: () => void;
  onView: () => void;
}) {
  const hp = b.enemies[id].hp;
  const alive = hp > 0;
  const g = b.goliath;
  const isTarget = !!pending?.targets.includes(id);
  const owner = pending ? (pending.basic ?? SKILLS[pending.skill].owner) : null;
  const mult = owner ? elementMultiplier(CHARACTER_ELEMENT[owner], ENEMY_ELEMENT[id]) : 1;
  const isBoss = id === bossOf(b);
  const chips = [
    isBoss && g.enraged && { text: t(`v3.ui.phase.${id}`), tone: "bg-red-700" },
    isBoss && g.stunned && { text: t("v2.ui.stunned"), tone: "bg-sky-600" },
    isBoss && g.charging && { text: t(`v3.ui.charging.${id}`) === `v3.ui.charging.${id}` ? t("v2.ui.charging") : t(`v3.ui.charging.${id}`), tone: "bg-orange-600" },
    isBoss && STAGE_GUARD[b.stage] && enemyAlive(b, STAGE_GUARD[b.stage]!) && { text: "🛡", title: t("v2.ui.protected", { enemy: STAGE_GUARD[b.stage] }), tone: "bg-amber-700" },
  ].filter(Boolean) as { text: string; title?: string; tone: string }[];
  return (
    <div className={`relative flex shrink-0 flex-col items-center gap-1.5 ${CARD_WIDTH[size]} ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isTarget) onTarget();
          else if (!pending) onView();
        }}
        aria-label={t(`v2.enemy.${id}.name`)}
        className={`relative z-10 w-full ${CARD_RATIO} rounded-xs text-left transition [container-type:inline-size] ${
          isTarget ? "animate-pulse cursor-pointer ring-4 ring-amber-300" : "cursor-zoom-in hover:-translate-y-1"
        }`}
      >
        <span className={`absolute inset-0 overflow-hidden rounded-xs shadow-2xl ${!alive ? "opacity-50 grayscale" : ""}`} style={{ fontSize: "4.67cqw" }}>
          <EnemyCardFace id={id} />
        </span>
        {!alive && <span className="absolute inset-0 z-10 flex items-center justify-center text-sm font-black text-stone-100 drop-shadow">{t("v2.enemy.fallen")}</span>}
        <span className="absolute -right-2 -top-4 z-20">
          <HpBadge hp={hp} max={ENEMY_HP[id]} />
        </span>
        {alive && chips.length > 0 && (
          <span className="absolute -left-2 -top-3 z-20 flex flex-wrap gap-0.5 text-[9px] font-bold text-white sm:text-[10px]">
            {chips.map((c) => (
              <span key={c.text} title={c.title} className={`rounded-full px-1.5 py-0.5 shadow ${c.tone}`}>
                {c.text}
              </span>
            ))}
          </span>
        )}
        {isTarget && pending && (
          <span className="absolute inset-x-1.5 bottom-1.5 z-20 rounded-md bg-amber-400 py-1 text-center text-xs font-black text-stone-950 shadow-lg sm:text-sm">
            🎯 {pending.basic ? elementAdjust(basicDamage(pending.basic), mult, b.pools) : skillDamage(b, pending.skill, id)}
            {mult !== 1 && ` ×${mult}`}
          </span>
        )}
      </button>

      {/* What this enemy will do */}
      {alive && (
        <div className="grid w-full gap-1">
          {isBoss &&
            (g.stunned ? (
              <div className="rounded-md bg-black/50 px-2 py-1 text-[11px] font-semibold text-sky-200 sm:text-xs">{t("v2.ui.intentStunned")}</div>
            ) : (
              <IntentRow label={t("v3.ui.nextAction")} intent={b.intents[0]} front={front} t={t} b={b} />
            ))}
          {isBoss && (
            <div className="hidden sm:block">
              <IntentRow label={t("v3.ui.then")} intent={b.intents[1]} front={front} t={t} dim b={b} />
            </div>
          )}
          {id === STAGE_SHOOTER[b.stage] && b.archerTarget && (
            <AttackRow name={`${t(id === "archer" ? "v3.action.arrow" : "v3.action.strike")} → ${t("v3.ui.front")}`} tag={String(enemyDamage(id, front, SHOOTER_DAMAGE[id] ?? 0, b.pools))} />
          )}
        </div>
      )}
    </div>
  );
}

/** HP badge hung on the card's top-right corner (outside the art), Pokémon TCG Pocket style. */
function HpBadge({ hp, max, shield = 0, big, endless, bonus }: { hp: number; max: number; shield?: number; big?: boolean; endless?: boolean; bonus?: boolean }) {
  const pct = endless ? 100 : Math.max(0, (hp / max) * 100);
  const color = pct >= 100 ? "bg-emerald-400" : pct > 50 ? "bg-yellow-400" : pct > 20 ? "bg-orange-500" : "bg-red-600";
  return (
    <div className="pointer-events-none flex items-start gap-1">
      {shield > 0 && (bonus ? <span className="mt-0.5 rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-white shadow sm:text-xs">+{shield}</span> : <span className="mt-0.5 rounded-full bg-sky-500 px-1.5 text-[10px] font-black text-white shadow sm:text-xs">🛡️{shield}</span>)}
      {/* The bar is exactly as wide as the number above it. */}
      <div className="inline-flex flex-col items-stretch gap-0.5">
        <span
          className={`text-center font-black leading-none text-slate-800 [-webkit-text-stroke:3px_white] [paint-order:stroke_fill] drop-shadow ${big ? "text-4xl" : "text-xl sm:text-2xl"}`}
        >
          {endless ? "∞" : hp}
        </span>
        <div className={`w-full overflow-hidden rounded-full bg-slate-900/70 ring-2 ring-black/50 ${big ? "h-2.5" : "h-1.5 sm:h-2"}`}>
          <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * One of our characters: the printed card (untouched), the front-line label under it, the HP badge on its corner and
 * status chips on the other. Clicking it opens the skill view, picks it as a target, or promotes it to the front line.
 */
/** What a scripture card does when it is played at the table, in the personal-pool battles: SP, MP, or a Shield. */
function cardEffect(kind: EnergyKind, amount: number, mode: PoolMode = "personal", card?: CardId): { icon: string; text: string; disc?: EnergyKind } {
  if (mode === "table") {
    const value = card ? cardValue(card) : amount;
    // Just the coloured circle and the value: the colour says which energy it is.
    return { icon: "", text: `${value}`, disc: kind };
  }
  if (kind === "attack") return { icon: "⚔️", text: `SP +${amount * R.pools.spUnit}` };
  if (kind === "faith") return { icon: "✨", text: `MP +${amount * R.pools.mpUnit}` };
  return { icon: "🛡️", text: `${R.pools.cardShield * amount}` };
}

/** A character's MP and SP as two small bars (personal-pool battles). */
function PoolBars({ b, id, t }: { b: BattleState; id: CharacterId; t: T }) {
  const c = b.party[id];
  // The tabletop rules: the energy cards stuck under the character, each as a chip with its value, and the total against the cap.
  if (b.pools === "table") {
    const cards = cardsOf(b, id);
    // Each attached card is a little card tucked under the character, fanned out so every one and its value can be seen.
    const tiles: { kind: EnergyKind; v: number }[] = [
      ...cards.red.map((v) => ({ kind: "attack" as const, v })),
      ...cards.green.map((v) => ({ kind: "guard" as const, v })),
      ...cards.blue.map((v) => ({ kind: "faith" as const, v })),
    ];
    return (
      <div className="pointer-events-none relative z-20 -mt-[26px] flex w-full items-end justify-between gap-1 px-0.5" title={t("v3.pool.table.desc")}>
        <div className="flex min-h-11 items-end pl-1">
          {tiles.map((c, i) => (
            <span
              key={i}
              className="-ml-1.5 flex h-11 w-8 shrink-0 items-center justify-center rounded-[3px] border border-white/80 shadow-[0_2px_4px_rgb(0_0_0/0.55)] first:ml-0"
              style={{ background: ENERGY_DISC[c.kind], zIndex: i, transform: `rotate(${(i - (tiles.length - 1) / 2) * 3}deg)` }}
            >
              <span className="self-center text-xl font-black leading-none text-white [-webkit-text-stroke:2.5px_rgb(0_0_0/0.5)] [paint-order:stroke_fill]">{c.v}</span>
            </span>
          ))}
        </div>
        <span className="shrink-0 text-[9px] font-black tabular-nums text-stone-200 sm:text-[10px]">{attachedTotal(b, id)}/{energyCap(id)}</span>
      </div>
    );
  }
  const rows = [
    { key: "mp", label: "MP", value: c.mp, max: mpCap(id), bar: "bg-[#3f80dc]", title: t("v3.pool.mp.desc") },
    { key: "sp", label: "SP", value: c.sp, max: R.pools.spCap, bar: "bg-[#c63e43]", title: t("v3.pool.sp.desc") },
  ];
  return (
    <div className="pointer-events-none grid w-full gap-0.5 px-0.5">
      {rows.map((r) => (
        <div key={r.key} title={r.title} className="flex items-center gap-1 text-[9px] font-black leading-none text-stone-200 sm:text-[10px]">
          <span className="w-4 shrink-0">{r.label}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60 ring-1 ring-black/60 sm:h-2">
            <span className={`block h-full ${r.bar} transition-all duration-300`} style={{ width: `${(r.value / r.max) * 100}%` }} />
          </span>
          <span className="w-9 shrink-0 text-right tabular-nums">{r.value}/{r.max}</span>
        </div>
      ))}
    </div>
  );
}

function CharacterSlot({
  board,
  id,
  t,
  size,
  className = "",
  highlight,
  onClick,
}: {
  board: Board;
  id: CharacterId;
  t: T;
  size: "large" | "small";
  className?: string;
  /** A valid target or a candidate for the empty front line. */
  highlight: boolean;
  onClick: () => void;
}) {
  const b = board.battle;
  const c = b.party[id];
  const alive = isAlive(b, id);
  return (
    <div className={`relative flex shrink-0 flex-col items-center gap-2 ${CHAR_WIDTH[size]} ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        aria-label={t(`char.${id}.name`)}
        className={`relative w-full ${CARD_RATIO} rounded-xs text-left transition [container-type:inline-size] ${
          highlight ? "animate-pulse ring-4 ring-emerald-300" : "hover:-translate-y-1"
        }`}
      >
        {c.shield > 0 && alive && (
          <span aria-hidden className="pointer-events-none absolute -inset-1.5 z-10 rounded-lg border-2 border-sky-300/70 bg-sky-400/10 shadow-[0_0_14px] shadow-sky-300/60" />
        )}
        <span
          className={`absolute inset-0 overflow-hidden rounded-xs shadow-2xl ${!alive ? "grayscale" : !canAct(b, id) ? "brightness-75" : ""}`}
          style={{ fontSize: "4.67cqw" }}
        >
          <CharacterCardFace id={id} />
        </span>
        {!alive && <span className="absolute inset-0 z-10 flex items-center justify-center text-4xl text-stone-100 drop-shadow">✝</span>}
        <span className="absolute -right-2 -top-4 z-20">
          <HpBadge hp={c.hp} max={MAX_HP[id]} shield={alive ? c.shield : 0} bonus={b.pools === "table"} endless={NEVER_FALLS.has(id)} />
        </span>
        {alive && (c.shaken || c.acted || b.coiled === id) && (
          <span className="absolute -left-2 -top-3 z-20 flex gap-0.5 text-xs">
            {b.coiled === id && <span title={t("v3.ui.coiled")} className="rounded-full bg-emerald-800 px-1.5 py-0.5 shadow">🐍</span>}
            {c.shaken && <span className="rounded-full bg-purple-700 px-1.5 py-0.5 shadow">😨</span>}
            {c.acted && <span className="rounded-full bg-stone-700 px-1.5 py-0.5 text-white shadow">✓</span>}
          </span>
        )}
      </button>
      {b.pools === "table" && alive && <PoolBars b={b} id={id} t={t} />}
      {/* Front-line tag under the card */}
      <div className="h-4 text-[9px] font-black uppercase tracking-wider sm:text-[10px]">
        {board.front === id && <span className="rounded-full bg-red-700 px-2 py-0.5 text-white shadow">{t("v3.ui.front")}</span>}
      </div>
      {b.pools !== "team" && b.pools !== "table" && alive && <PoolBars b={b} id={id} t={t} />}
    </div>
  );
}

/**
 * Upper row: 4 skill/energy card slots (上方技能四張卡, 參考地下城卡牌遊戲配置)
 * - 4 card slots in a horizontal row.
 * - Empty slots show stone/gold-bordered empty frames with "+ 抽卡" (if draws remain).
 * - Filled slots show the scripture energy card face-up with full art, title, energy value, and "打出" button!
 * - Clicking an empty slot draws a card; clicking a filled card plays it to gain energy!
 * - Extra cards (if hand > 4) stack on the 4th slot with a +N badge.
 */
function SkillSlotsRow({
  board,
  t,
  disabled,
  onDraw,
  onDrawAll,
  onPlay,
  onPlayAll,
  onInspect,
}: {
  board: Board;
  t: T;
  disabled: boolean;
  onDraw: () => void;
  onDrawAll: () => void;
  onPlay: (uid: number) => void;
  onPlayAll: () => void;
  onInspect?: (target: { uid: number; card: CardId }) => void;
}) {
  const b = board.battle;
  const ready = !disabled && canDrawOnBoard(board);
  const hand = b.hand;
  const handLen = hand.length;
  const slots = [0, 1, 2, 3];
  const canDrawSlots = ready && handLen < 4;

  return (
    <section className="flex flex-col items-center gap-1 px-2 py-1">
      {/* Header bar above the 4 slots */}
      <div className="flex w-full max-w-2xl items-center justify-between gap-2 px-1 text-[11px] sm:text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-bold text-amber-200">
            {t("v3.deck.slotTitle")}
          </span>
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-stone-300">
            {t("v3.ui.deck")} {b.deck.length} · {t("v3.ui.discard")} {b.discard.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Draws left pips */}
          <span className="flex items-center gap-1" title={board.draws > 0 ? t("v3.deck.left", { n: board.draws }) : t("v3.deck.done")}>
            <span className="text-[10px] text-stone-400">{board.draws > 0 ? t("v3.deck.left", { n: board.draws }) : t("v3.deck.done")}</span>
            <span className="flex gap-0.5">
              {Array.from({ length: Math.max(0, board.draws) }, (_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_4px] shadow-amber-300" />
              ))}
            </span>
          </span>

          {/* Quick Draw buttons */}
          {canDrawSlots && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDraw();
              }}
              className="rounded-full border border-amber-300/80 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30 active:scale-95 sm:text-xs"
            >
              + {t("v3.deck.draw")}
            </button>
          )}

          {canDrawSlots && board.draws > 1 && handLen < 3 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDrawAll();
              }}
              className="rounded-full border border-amber-300/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-100 hover:bg-amber-500/25 sm:text-xs"
            >
              {t("v3.deck.drawFill")}
            </button>
          )}

          {/* Play All button */}
          {handLen > 1 && !disabled && b.pools === "team" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayAll();
              }}
              className="rounded-full border border-red-400/80 bg-red-600/20 px-2 py-0.5 text-[10px] font-bold text-red-200 hover:bg-red-600/30 sm:text-xs"
            >
              {t("v3.deck.playAll", { n: handLen })}
            </button>
          )}
        </div>
      </div>

      {/* 4 Card Slots */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 lg:gap-4">
        {slots.map((idx) => {
          const inst = hand[idx];
          if (inst) {
            const cardId = inst.card;
            const { energy: kind, amount } = CARDS_V2[cardId];
            const blocked = cardBlockReason(b, cardId);
            const playable = !disabled && !blocked;
            const extra = idx === 3 && handLen > 4 ? handLen - 4 : 0;

            return (
              <div key={inst.uid} className={`relative flex shrink-0 flex-col items-center ${SKILL_SLOT_WIDTH}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect?.({ uid: inst.uid, card: cardId });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onInspect?.({ uid: inst.uid, card: cardId });
                    }
                  }}
                  title={t("v3.ui.viewCard")}
                  className={`group relative w-full ${CARD_RATIO} cursor-pointer rounded-xs text-left transition hover:-translate-y-1 [container-type:inline-size]`}
                >
                  {/* Extra cards stack indicator behind slot 3 if hand > 4 */}
                  {extra > 0 && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xs shadow-lg brightness-75"
                      style={{ transform: "translate(3px, 3px)" }}
                    >
                      <ScriptureCardBack />
                    </span>
                  )}

                  {/* Active Card Face (比照 CharacterSlot 等比例微縮文字，絕對不跑版) */}
                  <span
                    className="absolute inset-0 overflow-hidden rounded-xs shadow-2xl"
                    style={{ fontSize: "4.67cqw" }}
                  >
                    <ScriptureCardFace id={cardId} />
                  </span>

                  {/* Top-Right: Energy Amount Badge */}
                  <span className={`absolute -right-1 -top-2 z-20 flex items-center gap-0.5 sm:-right-1.5 sm:-top-2.5 ${b.pools === "team" ? "rounded-full border border-white bg-slate-900/90 px-1 py-0.2 shadow sm:px-1.5" : "[filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.9))]"}`}>
                    {b.pools !== "team" ? (
                      cardEffect(kind, amount, b.pools, cardId).disc ? (
                        <EnergyDisc kind={cardEffect(kind, amount, b.pools, cardId).disc!} className="h-6 w-6 text-sm sm:h-7 sm:w-7 sm:text-base">
                          {cardEffect(kind, amount, b.pools, cardId).text}
                        </EnergyDisc>
                      ) : (
                        <span className="text-[10px] font-black text-amber-200 sm:text-[11px]">{cardEffect(kind, amount, b.pools, cardId).icon} {cardEffect(kind, amount, b.pools, cardId).text}</span>
                      )
                    ) : (
                      <>
                        <EnergyIcon kind={kind} className="h-3 w-3 sm:h-3.5 sm:w-3.5 object-contain" />
                        <span className="text-[9px] font-black text-amber-200 sm:text-[11px]">+{amount}</span>
                      </>
                    )}
                  </span>

                  {/* Top-Left: Extra cards count if > 4 */}
                  {extra > 0 && (
                    <span className="absolute -left-1 -top-2 z-20 rounded-full bg-black/85 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 shadow">
                      +{extra}
                    </span>
                  )}

                  {/* Playable glowing border */}
                  {playable && (
                    <span aria-hidden className="pointer-events-none absolute -inset-0.5 z-10 animate-pulse rounded-md ring-2 sm:ring-3 ring-amber-300/80 shadow-[0_0_12px] shadow-amber-300/50" />
                  )}
                </div>
              </div>
            );
          }

          // Empty Slot: Stone / antique gold dashed frame
          return (
            <div key={`empty-${idx}`} className={`relative flex shrink-0 flex-col items-center ${SKILL_SLOT_WIDTH}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (canDrawSlots) onDraw();
                }}
                disabled={!canDrawSlots}
                title={canDrawSlots ? t("v3.deck.tapToDraw") : t("v3.deck.emptySlot")}
                className={`group relative flex w-full ${CARD_RATIO} flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed transition ${
                  canDrawSlots
                    ? "cursor-pointer border-amber-400/50 bg-amber-500/10 hover:border-amber-300 hover:bg-amber-500/20 ring-1 ring-amber-300/30"
                    : "cursor-default border-stone-600/40 bg-black/25 opacity-60"
                }`}
              >
                {canDrawSlots ? (
                  <>
                    <span className="text-sm sm:text-base leading-none text-amber-300 group-hover:scale-110 transition-transform">
                      +
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-amber-200/90 leading-tight">
                      {t("v3.deck.draw")}
                    </span>
                  </>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-medium text-stone-500">
                    {idx + 1}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** How long a skill's effect plays on the close-up card before it resolves (ms). */
const CAST_FX_MS = 550;
/** Skills with their own illustration: it fills the card while the skill is cast, so the effect plays longer. */
const SKILL_ART: Partial<Record<SkillId, string>> = { ark: "/cards/ark.jpg", sea: "/cards/red-sea.jpg" };
const ART_FX_MS = 1500;
const BURST: Record<EnergyKind, string> = {
  faith: "rgb(253 224 71 / 0.95)",
  attack: "rgb(248 113 113 / 0.95)",
  guard: "rgb(110 231 183 / 0.95)",
};

/** A band of light that sweeps once across the card as it comes up close. */
function CardShine() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xs">
      <motion.div
        initial={{ x: "-120%" }}
        animate={{ x: "120%" }}
        transition={{ duration: 0.9, delay: 0.25, ease: "easeInOut" }}
        className="absolute inset-y-0 w-2/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent mix-blend-overlay"
      />
    </div>
  );
}

/** The cast effect: a burst of the skill's energy colour from the card, with the skill name. */
function CastBurst({ kind, label, art }: { kind: EnergyKind; label: string; art?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      {art && (
        // The skill's illustration fades in over the card and drifts slowly closer.
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0.85] }}
          transition={{ duration: ART_FX_MS / 1000, times: [0, 0.25, 0.8, 1] }}
          className="absolute inset-0 overflow-hidden rounded-xs"
        >
          <motion.img
            src={art}
            alt=""
            initial={{ scale: 1.15 }}
            animate={{ scale: 1.3 }}
            transition={{ duration: ART_FX_MS / 1000, ease: "easeOut" }}
            className="h-full w-full object-cover"
          />
        </motion.div>
      )}
      <motion.div
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: CAST_FX_MS / 1000, ease: "easeOut" }}
        className="absolute aspect-square w-full rounded-full"
        style={{ background: `radial-gradient(circle, ${BURST[kind]} 0%, transparent 65%)` }}
      />
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.25, 1], opacity: [0, 1, 1] }}
        transition={{ duration: 0.35 }}
        className="relative text-[2em] font-black text-white [-webkit-text-stroke:2px_rgb(0_0_0/0.7)] [paint-order:stroke_fill] drop-shadow-lg"
      >
        {label}
      </motion.span>
    </div>
  );
}

/** Charge segments beside a skill name: Attack red, Faith yellow, Guard green. */
const SEGMENT_COLOR: Record<EnergyKind, string> = { attack: "bg-red-500", faith: "bg-yellow-400", guard: "bg-emerald-400" };

/** Where the skills were dragged to, kept while the page is open so every character's skill view opens there. */
let skillsOffset = { x: 0, y: 0 };

/**
 * Skill view: the card at the same size as the /card-demo viewer, with the character story and the skills in the side
 * panel (the skills below the story; above it on phones, where the panel drops under the card), the swap-to-front bar
 * like "Retreat", and advantage tags against the enemies above the card.
 */
function SkillFocus({
  board,
  id,
  t,
  locked,
  onSkill,
  onBasic,
  onSwap,
  onClose,
}: {
  board: Board;
  id: CharacterId;
  t: T;
  locked: boolean;
  onSkill: (skill: SkillId) => void;
  onBasic: () => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const b = board.battle;
  const c = b.party[id];
  const alive = isAlive(b, id);
  /** The skill being cast: its effect plays on the card before the skill resolves. */
  const [casting, setCasting] = useState<SkillId | null>(null);
  const cast = (skill: SkillId) => {
    setCasting(skill);
    setTimeout(() => onSkill(skill), SKILL_ART[skill] ? ART_FX_MS : CAST_FX_MS);
  };
  const tags = ENEMY_ORDER.filter((e) => enemyAlive(b, e)).map((e) => ({ e, mult: elementMultiplier(CHARACTER_ELEMENT[id], ENEMY_ELEMENT[e]) })).filter((x) => x.mult !== 1);
  // The card size chosen in /card-demo; the story beside it is off until switched on here (remembered for later battles).
  const [scale] = useState(savedScale);
  const [showStory, setShowStory] = useState(() => savedShowStory(BATTLE_STORY_KEY, false));
  const toggleStory = () =>
    setShowStory((on) => {
      safeStorage.setItem(BATTLE_STORY_KEY, on ? "off" : "on");
      return !on;
    });
  // The skills can be dragged by their title bar to anywhere around the card.
  const area = useRef<HTMLDivElement>(null);
  const dragSkills = useDragControls();
  const skillsX = useMotionValue(skillsOffset.x);
  const skillsY = useMotionValue(skillsOffset.y);
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-black/85 p-4 pt-12"
    >
      <div ref={area} className="my-auto flex max-w-full flex-col items-center gap-4 lg:flex-row lg:items-stretch">
      {/* The card rises from the table to a close-up */}
      <motion.div
        initial={{ scale: 0.55, y: 60, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative shrink-0 ${VIEWER_WIDTH}`}
        style={viewerStyle(scale)}
      >
        {/* Advantage against the enemies on the field */}
        <div className="absolute bottom-full left-0 mb-[0.5em] flex flex-wrap gap-[0.3em] text-[0.5em] font-black">
          {inStory(b, id) && <span className="rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-3 py-1 text-stone-950 shadow-lg">📖 {t("v3.story.on")}</span>}
          {tags.map(({ e, mult }) => (
            <span key={e} className={`rounded-full px-3 py-1 shadow-lg ${mult > 1 ? "bg-gradient-to-r from-orange-400 to-red-500 text-white" : "bg-slate-500 text-slate-100"}`}>
              {mult > 1 ? t("v3.focus.advantage") : t("v3.focus.disadvantage")} · {t(`v2.enemy.${e}.name`)} ×{mult}
            </span>
          ))}
        </div>
        <div className="absolute -right-4 -top-6 z-30">
          <HpBadge hp={c.hp} max={MAX_HP[id]} shield={alive ? c.shield : 0} bonus={b.pools === "table"} big endless={NEVER_FALLS.has(id)} />
        </div>

        <div className="relative">
          <HoloCard element={CHARACTER_ELEMENT[id]} rarity={CARD_RARITY[id]} figure={figureArea(id)}>
            <CharacterCardFace id={id} />
          </HoloCard>
          {lookOf(id).shine && <CardShine />}
          {casting && <CastBurst kind={SKILLS[casting].kind} label={t(`v2.skill.${casting}.name`)} art={SKILL_ART[casting]} />}
        </div>

        <button
          onClick={onClose}
          aria-label={t("v3.ui.close")}
          className="absolute -left-[0.5em] -top-[0.5em] z-30 flex h-[1.4em] w-[1.4em] items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[0.8em] text-white shadow-lg hover:bg-slate-600"
        >
          ✕
        </button>
      </motion.div>

      {/* Side panel: the story, then the skills (skills first on phones, so they stay near the card) */}
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col items-stretch gap-3 lg:w-80 lg:justify-center">
        <div className="order-last lg:order-none">{showStory && <StoryPanel id={id} />}</div>
        <motion.div
          drag
          dragControls={dragSkills}
          dragListener={false}
          dragConstraints={area}
          dragMomentum={false}
          dragElastic={0.05}
          style={{ x: skillsX, y: skillsY }}
          onDragEnd={() => (skillsOffset = { x: skillsX.get(), y: skillsY.get() })}
          className="relative z-10"
        >
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-2 p-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p
              onPointerDown={(e) => dragSkills.start(e)}
              title={t("v3.focus.drag")}
              className="flex flex-1 cursor-grab touch-none select-none items-center gap-1.5 text-xs font-bold tracking-widest text-amber-300/80 active:cursor-grabbing"
            >
              <span aria-hidden className="text-sm leading-none text-stone-400">⠿</span>
              {t("v3.focus.skills")}
            </p>
            <button
              onClick={toggleStory}
              aria-pressed={showStory}
              className={`rounded-full border px-3 py-0.5 text-[11px] ${showStory ? "border-amber-300 bg-amber-500/90 font-bold text-stone-950" : "border-stone-500 text-stone-300 hover:bg-white/10"}`}
            >
              {t("v3.demo.story")}：{showStory ? t("v3.demo.on") : t("v3.demo.off")}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {/* The tabletop rules' free basic attack: no energy, but it takes the character's action. */}
            {b.pools === "table" && (
              <button
                onClick={onBasic}
                disabled={locked || !!casting || !canBasicAttack(b, id)}
                title={t("v3.basic.desc")}
                className="group flex items-center gap-2 rounded-lg border-2 border-white bg-gradient-to-b from-amber-50 to-amber-200 px-2.5 py-1.5 text-left text-slate-900 shadow-[0_6px_16px_rgb(0_0_0/0.5)] transition enabled:hover:-translate-y-0.5 disabled:opacity-45"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black">{t("v3.basic.name")} <span className="ml-1 rounded-full bg-slate-900/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{t("v3.basic.free")}</span></span>
                  <span className="block text-[11px] leading-snug text-slate-600">{t("v3.basic.desc")}</span>
                </span>
                <span className="text-xl font-black leading-none">{basicDamage(id)}</span>
              </button>
            )}
            {CHARACTER_SKILLS[id].map((skill) => {
              const def = SKILLS[skill];
              const reason = boardBlockReason(board, skill);
              const ready = !locked && !reason;
              const amount = def.damage ? skillDamage(b, skill, skill === "slingStone" ? bossOf(b) : skillTargets(b, skill).length === 1 ? (skillTargets(b, skill)[0] as EnemyId) : undefined) : supportAmount(b, skill);
              const boosted = !!def.damage && amount > def.damage;
              // Not enough energy just fades the button; other reasons (Shaken, already acted…) are spelled out.
              const short = reason === "v2.reason.energy" || reason === "v2.reason.needFaith";
              // Charge toward the cost, one segment per point: Faith pays for itself; Attack or Guard can be topped up with Faith.
              // Personal pools: strikes are paid with the character's SP, everything else with their MP (nothing is topped up).
              const mine = b.pools === "personal";
              // The tabletop rules re-sort some skills into blue magic; the other versions keep each skill's own kind.
              const kind = b.pools === "table" ? tableKind(skill) : def.kind;
              const tab = b.pools === "table";
              const pool = tab ? cardsOf(b, id)[energyColor(kind)].reduce((n, v) => n + v, 0) : Math.floor((kind === "attack" ? b.party[id].sp / R.pools.spUnit : b.party[id].mp / R.pools.mpUnit)); // in points
              const charged = mine || tab ? Math.min(def.cost, pool) : Math.min(def.cost, kind === "faith" ? b.energy.faith : b.energy[kind] + b.energy.faith);
              // Segments paid by the skill's own energy come first, in its colour; any topped up with Faith show yellow.
              const own = mine || tab ? charged : kind === "faith" ? charged : Math.min(def.cost, b.energy[kind]);
              const segmentKind: EnergyKind = mine || tab ? (kind === "attack" ? "attack" : "faith") : kind;
              return (
                <button
                  key={skill}
                  onClick={() => cast(skill)}
                  disabled={!ready || !!casting}
                  title={reason ? t(reason) : t(`v2.skill.${skill}.desc`, { n: amount })}
                  className={`group flex items-center gap-2 rounded-lg border-2 border-white bg-gradient-to-b from-slate-50 to-slate-300 px-2.5 py-1.5 text-left text-slate-900 shadow-[0_6px_16px_rgb(0_0_0/0.5)] transition enabled:hover:-translate-y-0.5 enabled:hover:from-white disabled:cursor-not-allowed ${short ? "disabled:opacity-60" : "disabled:opacity-80"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {/* The energy that pays for it, at a glance: red for strikes, green for heals and defence, blue for magic. */}
                      <EnergyIcon kind={kind} circle className="h-[1.1em] w-[1.1em] text-sm" />
                      <span className="text-sm font-black">{t(`v2.skill.${skill}.name`)}</span>
                      {def.cost > 0 && (
                        <span className="flex items-center gap-0.5" aria-label={`${charged}/${def.cost}`}>
                          {mine ? (
                            <>
                              <span className="mr-0.5 text-[9px] font-black text-slate-600">{kind === "attack" ? `SP ${spCost(skill)}` : `MP ${mpCost(skill)}`}</span>
                              {/* Costs differ from skill to skill, so show how much of this one is charged. */}
                              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-900/25">
                                <span className={`block h-full ${kind === "attack" ? "bg-[#c63e43]" : "bg-[#3f80dc]"}`} style={{ width: `${Math.min(100, ((kind === "attack" ? b.party[id].sp : b.party[id].mp) / (kind === "attack" ? spCost(skill) : mpCost(skill))) * 100)}%` }} />
                              </span>
                            </>
                          ) : (
                            Array.from({ length: def.cost }, (_, i) => (
                              <span
                                key={i}
                                className={`h-2.5 w-2.5 rounded-full border-2 ${
                                  i < own
                                    ? tab ? (kind === "attack" ? "border-[#9b1e23] bg-[#c63e43]" : kind === "guard" ? "border-[#15733f] bg-[#249e5a]" : "border-[#205ec0] bg-[#3f80dc]") : `${kind === "attack" ? "border-[#9b1e23]" : "border-amber-500"} ${kind === "attack" ? "bg-[#c63e43]" : SEGMENT_COLOR[segmentKind]}`
                                    : i < charged ? "border-amber-500 bg-yellow-400"
                                    // Not paid yet: an empty ring in the colour of the energy that pays for it.
                                    : tab || kind === "attack" ? (kind === "attack" ? "border-[#9b1e23]/80 bg-[#c63e43]/15" : kind === "guard" ? "border-[#15733f]/80 bg-[#249e5a]/15" : "border-[#205ec0]/80 bg-[#3f80dc]/15") : kind === "guard" ? "border-emerald-500/80 bg-emerald-100" : "border-amber-500/80 bg-amber-100"
                                }`}
                              />
                            ))
                          )}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] leading-snug text-slate-600">{t(`v2.skill.${skill}.desc`, { n: amount })}</span>
                    {/* The tabletop rules give no change: say which cards would be spent and how much of them is wasted. */}
                    {tab && (() => {
                      const pay = paymentPreview(b, skill);
                      return pay && pay.waste > 0 ? (
                        <span className="block text-[10px] font-bold leading-snug text-amber-700">
                          {t("v3.pool.waste", { spent: pay.spent.join("+"), n: pay.waste })}
                        </span>
                      ) : null;
                    })()}
                    {reason && reason !== "v2.reason.over" && !short && <span className="block text-[11px] font-semibold text-red-700">{t(reason)}</span>}
                  </span>
                  <span className="text-xl font-black leading-none">
                    {def.damage ? amount : amount > 0 && `${skill === "mark" ? "↩" : "+"}${amount}`}
                    {boosted && <span className="ml-0.5 text-[0.6em] text-amber-500">▲</span>}
                  </span>
                </button>
              );
            })}
            {board.front !== id && alive && (
              <button
                onClick={onSwap}
                disabled={locked || !canSwap(board, id)}
                className="flex items-center justify-between gap-2 rounded-lg border-2 border-white bg-gradient-to-b from-slate-50 to-slate-300 px-2.5 py-1.5 text-slate-900 shadow-[0_6px_16px_rgb(0_0_0/0.5)] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:grayscale"
              >
                <span className="text-[11px] font-bold text-slate-600">{needsFront(board) ? t("v3.focus.free") : b.coiled === board.front ? t("v3.ui.coiled") : board.swapped ? t("v3.ui.swapUsed") : t("v3.focus.free")}</span>
                <span className="text-sm font-black tracking-widest">{needsFront(board) ? t("v3.ui.promote") : t("v3.ui.swap")}</span>
              </button>
            )}
          </div>
        </motion.div>
        </motion.div>
      </div>
      </div>
    </div>
  );
}

/** How many characters can go to battle in free mode. */
const MAX_LINEUP = 3;

/**
 * Before battle: bring 1–3 characters and choose who starts on the front line. In the campaign the stage lends its own
 * pool of cards and fixes the battle; free mode offers every card and a choice of stage.
 */
function LineupPicker({ t, onStart, campaign }: { t: T; onStart: (lineup: CharacterId[], front: CharacterId, stage: StageId, mode: PoolMode) => void; campaign?: CampaignStage }) {
  const last = useBattleV3Store((st) => st.lastLineup);
  const [mode, setMode] = useState<PoolMode>(!MAGIC_VERSION_ENABLED ? "table" : last.mode === "team" ? "personal" : last.mode);
  const [stage, setStage] = useState<StageId>(campaign?.battle ?? "goliath");
  const unlocked = useAchievementStore((st) => st.unlocked);
  const pool = campaign?.pool ?? PARTY_ORDER;
  const max = campaign?.pick ?? MAX_LINEUP;
  // The last line-up, as far as this stage lends it; otherwise the first cards of the pool.
  const [lineup, setLineup] = useState<CharacterId[]>(() => {
    const kept = last.lineup.filter((id) => pool.includes(id));
    return kept.length ? kept : campaign ? pool.slice(0, max) : last.lineup;
  });
  const [front, setFront] = useState<CharacterId>(last.front);
  const chosen = PARTY_ORDER.filter((id) => lineup.includes(id));
  const lead = chosen.includes(front) ? front : chosen[0];
  // At most three characters go to battle, and one card per person: picking another card of the same person swaps it in.
  const full = chosen.length >= max;
  const twin = (id: CharacterId) => chosen.find((x) => x !== id && personOf(x) === personOf(id));
  const toggle = (id: CharacterId) => {
    if (lineup.includes(id)) setLineup(lineup.filter((x) => x !== id));
    else if (twin(id)) setLineup([...lineup.filter((x) => x !== twin(id)), id]);
    else if (!full) setLineup([...lineup, id]);
  };
  const stageArt = campaign?.art ?? STAGE_ART[stage];
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      onPointerMove={onPointerMove}
      className="relative flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-3 bg-stone-950 py-4 sm:gap-4 sm:py-6 overflow-hidden"
    >
      {/* ===== 背景 4 層架構 ===== */}
      {/* [底層 1] 放大關卡專屬場景照片（每關不同背景照片） */}
      {stageArt && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stageArt}
            alt=""
            className="h-full w-full object-cover scale-110 filter transition-all duration-700"
          />
        </div>
      )}

      {/* [中層 2] 黑色半透明遮罩（壓暗場景，強化氛圍與卡牌數字辨識度） */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/45" />

      {/* [中層 3] 暗紅至暗藍色半透明遮罩（暗紅暗藍半透明約70% 中間區域50%） */}
      <div className="pointer-events-none absolute inset-0 z-0 bq-red-blue-mask" />

      {/* 支援滑鼠滑過：中心區域半透明，讓使用者稍微看清背景照片 */}
      {stageArt && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bq-reveal-spotlight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stageArt}
            alt=""
            className="h-full w-full object-cover scale-110 filter brightness-105"
          />
        </div>
      )}

      {/* [頂層 4] 黑色半透明點（70%透明、空隙100%透光、空隙縮小至約3px更密集） */}
      <div className="pointer-events-none absolute inset-0 z-0 bq-black-dots-dense" />

      {/* 支援滑鼠滑過：區域周邊色點發光效果 */}
      <div className="pointer-events-none absolute inset-0 z-0 bq-glowing-dots-dense" />

      <div className="relative z-10 flex flex-col items-center justify-center gap-3 sm:gap-4 w-full">
        <div className="px-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-stone-300/70 sm:text-[11px]">{t("v3.ui.title")}</div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{campaign ? t(`v3.campaign.${campaign.id}.name`) : t("v3.lineup.title")}</h1>
          <p className="mt-1 max-w-md text-sm text-stone-300">{campaign ? t("v3.campaign.pick", { n: max, m: pool.length }) : t("v3.lineup.hint")}</p>
        </div>

      {/* Stage (free mode only; a campaign stage fixes it) */}
      {!campaign && (
      <div role="radiogroup" aria-label={t("v3.stage.title")} className="flex flex-wrap justify-center gap-2 px-4">
        {STAGE_ORDER.map((st) => (
          <button
            key={st}
            role="radio"
            aria-checked={stage === st}
            onClick={() => setStage(st)}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${stage === st ? "border-amber-300 bg-amber-500 text-stone-950" : "border-stone-500 text-stone-200 hover:bg-white/10"}`}
          >
            {t(`v3.stage.${st}`)}
          </button>
        ))}
      </div>
      )}

      {/* Full character cards; 2 rows of 3 in campaign mode (top 3, bottom 3). */}
      {campaign || pool.length <= 6 ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 justify-items-center max-w-4xl mx-auto px-2 sm:px-4 py-2">
          {pool.map((id) => {
            const on = chosen.includes(id);
            return (
              <div key={id} className="flex flex-col items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => toggle(id)}
                  aria-pressed={on}
                  className={`relative w-[110px] text-left text-[5.15px] transition sm:w-[170px] sm:text-[8px] md:w-[195px] md:text-[9.15px] lg:w-[215px] lg:text-[10.1px] ${on ? "" : "opacity-45 grayscale"}`}
                >
                  <HoloCard element={CHARACTER_ELEMENT[id]} rarity={CARD_RARITY[id]} touchTilt={false} figure={figureArea(id)}>
                    <CharacterCardFace id={id} />
                  </HoloCard>
                  {on && lead === id && (
                    <span className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow sm:text-xs sm:px-2.5">
                      {t("v3.ui.front")}
                    </span>
                  )}
                </button>
                <div className="flex w-full flex-col items-center justify-center gap-1 sm:flex-row sm:gap-1.5">
                  <button
                    onClick={() => toggle(id)}
                    disabled={!on && full && !twin(id)}
                    className={`w-full max-w-[90px] rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:max-w-none sm:w-auto sm:px-3 sm:py-1 sm:text-xs disabled:opacity-40 ${on ? "bg-amber-500 text-stone-950" : "border border-stone-400 text-stone-200"}`}
                  >
                    {on ? t("v3.lineup.in") : t("v3.lineup.out")}
                  </button>
                  <button
                    onClick={() => setFront(id)}
                    disabled={!on || lead === id}
                    className="w-full max-w-[90px] rounded-full border border-red-400/70 px-1.5 py-0.5 text-[10px] font-bold text-red-100 sm:max-w-none sm:w-auto sm:px-3 sm:py-1 sm:text-xs enabled:hover:bg-red-900/50 disabled:opacity-30"
                  >
                    {t("v3.lineup.setFront")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex max-w-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 pt-3 sm:gap-4">
          {pool.map((id) => {
            const on = chosen.includes(id);
            return (
              <div key={id} className="flex shrink-0 snap-center flex-col items-center gap-2">
                <button
                  onClick={() => toggle(id)}
                  aria-pressed={on}
                  className={`relative w-[220px] text-left text-[10.3px] transition sm:w-[200px] sm:text-[9.35px] lg:w-[220px] lg:text-[10.3px] ${on ? "" : "opacity-45 grayscale"}`}
                >
                  <HoloCard element={CHARACTER_ELEMENT[id]} rarity={CARD_RARITY[id]} touchTilt={false} figure={figureArea(id)}>
                    <CharacterCardFace id={id} />
                  </HoloCard>
                  {on && lead === id && (
                    <span className="absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-700 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow sm:text-xs">
                      {t("v3.ui.front")}
                    </span>
                  )}
                </button>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggle(id)}
                    disabled={!on && full && !twin(id)}
                    className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-40 ${on ? "bg-amber-500 text-stone-950" : "border border-stone-400 text-stone-200"}`}
                  >
                    {on ? t("v3.lineup.in") : t("v3.lineup.out")}
                  </button>
                  <button
                    onClick={() => setFront(id)}
                    disabled={!on || lead === id}
                    className="rounded-full border border-red-400/70 px-3 py-1 text-xs font-bold text-red-100 enabled:hover:bg-red-900/50 disabled:opacity-30"
                  >
                    {t("v3.lineup.setFront")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Which energy rules: the free digital version (MP and SP) or the tabletop version (energy cards under characters). */}
      {MAGIC_VERSION_ENABLED && (
      <div role="radiogroup" aria-label={t("v3.mode.title")} className="flex flex-wrap justify-center gap-2 px-4">
        {(["personal", "table"] as PoolMode[]).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            title={t(`v3.mode.${m}.desc`)}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${mode === m ? "border-sky-300 bg-sky-500 text-stone-950" : "border-stone-500 text-stone-200 hover:bg-white/10"}`}
          >
            {t(`v3.mode.${m}`)}
          </button>
        ))}
      </div>
      )}
      <p className="max-w-md px-4 text-center text-xs text-stone-300">{t(`v3.mode.${mode}.desc`)}</p>

      <button
        onClick={() => onStart(chosen, lead, stage, mode)}
        disabled={!chosen.length}
        className="rounded-full bg-red-700 px-8 py-2.5 text-lg font-bold text-white shadow-lg enabled:hover:bg-red-600 disabled:opacity-40"
      >
        {chosen.length === 1 ? t("v3.lineup.startSolo") : chosen.length ? t("v3.lineup.start") : t("v3.lineup.need")}
      </button>

      {/* Achievements, one compact line each (details on hover) */}
      {!campaign && (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 text-xs">
        <span className="font-bold uppercase tracking-widest text-stone-400">{t("v3.ach.title")}</span>
        {ACHIEVEMENTS.map((id: AchievementId) => {
          const got = unlocked.includes(id);
          return (
            <span key={id} title={t(`v3.ach.${id}.desc`)} className={got ? "text-amber-100" : "text-stone-500"}>
              {got ? "🏆" : "🔒"} {t(`v3.ach.${id}.name`)} <span className="text-stone-500">· {t(`v3.ach.${id}.desc`)}</span>
            </span>
          );
        })}
      </div>
      )}

      <Link href={campaign ? "/campaign" : "/"} className="text-xs text-stone-400 underline">
        {campaign ? `← ${t("v3.campaign.list")}` : t("v2.ui.backHome")}
      </Link>
      </div>
    </div>
  );
}

export function BattleV3Screen({ campaign }: { campaign?: CampaignStageId }) {
  const t = useT();
  const { board, resolving, auto, setAuto, start, restart, pickLineup, play, playAll, draw, drawAll, cast, basic, swap, endTurn, newAchievements, drop, enter } = useBattleV3Store();
  const inCampaign = useBattleV3Store((st) => st.campaign);
  const cleared = useProgressStore((st) => st.cleared);
  const stage = campaign ? campaignStage(campaign) : undefined;
  const b = board?.battle;
  const stageArt = stage?.art ?? (b ? STAGE_ART[b.stage] : undefined);
  const next = campaign ? (CAMPAIGN[CAMPAIGN_IDS.indexOf(campaign) + 1]?.id ?? null) : null;
  const [pending, setPending] = useState<Pending | null>(null);
  /** The character whose skill view is open. */
  const [acting, setActing] = useState<CharacterId | null>(null);
  /** Character whose full card is shown enlarged. */
  const [viewing, setViewing] = useState<CharacterId | null>(null);
  /** Enemy whose card is shown enlarged. */
  const [viewingEnemy, setViewingEnemy] = useState<EnemyId | null>(null);
  /** Scripture card shown enlarged. */
  const [viewingScripture, setViewingScripture] = useState<{ uid?: number; card: CardId } | null>(null);
  const [scale] = useState(savedScale);
  const [showLog, setShowLog] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // Achievements live in localStorage; read them after mount so the prerendered page matches.
  useEffect(() => {
    void useAchievementStore.persist.rehydrate();
  }, []);
  // Play background music during battle, smooth fade out when exiting
  const bgmTrack = stageBgm(campaign ?? b?.stage);
  useEffect(() => {
    playBattleBgm(bgmTrack);
    return () => {
      stopBattleBgm();
    };
  }, [bgmTrack]);
  // Entering a campaign stage (or free mode) starts from its line-up; coming back to the same one keeps the battle.
  useEffect(() => {
    enter(campaign ?? null);
  }, [campaign, enter]);
  // Esc closes whatever is open: the enlarged card, the action panel, or targeting.
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setViewing(null);
      setViewingEnemy(null);
      setViewingScripture(null);
      setActing(null);
      setPending(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [b?.log.length, showLog]);

  if (inCampaign !== (campaign ?? null)) return null; // until enter() has switched
  if (!board || !b) return <LineupPicker t={t} onStart={start} campaign={stage} />;

  const locked = resolving || auto || b.result !== "ongoing";
  const promote = needsFront(board);
  const open = acting && board.lineup.includes(acting) && !pending ? acting : null;
  const onSkill = (skill: SkillId) => {
    setActing(null);
    const targets = boardSkillTargets(board, skill);
    if (targets.length) setPending({ skill, targets });
    else cast(skill);
  };
  const onTarget = (target: Target) => {
    if (pending?.basic) basic(pending.basic, target as EnemyId);
    else if (pending) cast(pending.skill, target);
    setPending(null);
  };
  /** The free basic attack: pick the target when there is more than one, otherwise attack at once. */
  const onBasic = (who: CharacterId) => {
    setActing(null);
    const targets = attackableEnemies(b);
    if (targets.length > 1) setPending({ skill: Object.keys(SKILLS)[0] as SkillId, targets, basic: who });
    else if (targets.length === 1) basic(who, targets[0]);
  };
  const onCharacter = (id: CharacterId) => {
    if (pending?.targets.includes(id)) return onTarget(id);
    if (pending) return;
    if (promote && canSwap(board, id)) return swap(id);
    setActing(open === id ? null : id);
  };
  const slot = (id: CharacterId, size: "large" | "small", order: string) => (
    <CharacterSlot
      key={id}
      board={board}
      id={id}
      t={t}
      size={size}
      className={order}
      highlight={!!pending?.targets.includes(id) || (promote && canSwap(board, id))}
      onClick={() => onCharacter(id)}
    />
  );
  const bench = board.lineup.filter((id) => id !== board.front);
  const lastHit = [...b.log].reverse().find((l) => l.key === "v2.log.attack" || l.key === "v2.log.slingStone");
  const order: EnergyKind[] = ["faith", "attack", "guard"];
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <PoolModeContext.Provider value={b.pools}>
    <div
      onPointerMove={onPointerMove}
      onClick={() => {
        setActing(null);
      }}
      className="relative flex min-h-[100dvh] flex-1 flex-col overflow-x-hidden bg-stone-950 sm:flex-row"
    >
      {/* ===== 背景 4 層架構 ===== */}
      {/* [底層 1] 放大關卡專屬場景照片（每關不同背景照片） */}
      {stageArt && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stageArt}
            alt=""
            className="h-full w-full object-cover scale-110 filter transition-all duration-700"
          />
        </div>
      )}

      {/* [中層 2] 黑色半透明遮罩（壓暗場景，強化氛圍與卡牌數字辨識度） */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/45" />

      {/* [中層 3] 暗紅至暗藍色半透明遮罩（暗紅暗藍半透明約70% 中間區域50%） */}
      <div className="pointer-events-none absolute inset-0 z-0 bq-red-blue-mask" />

      {/* 支援滑鼠滑過：中心區域半透明，讓使用者稍微看清背景照片 */}
      {stageArt && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bq-reveal-spotlight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stageArt}
            alt=""
            className="h-full w-full object-cover scale-110 filter brightness-105"
          />
        </div>
      )}

      {/* [頂層 4] 黑色半透明點（70%透明、空隙100%透光、空隙縮小至約3px更密集） */}
      <div className="pointer-events-none absolute inset-0 z-0 bq-black-dots-dense" />

      {/* 支援滑鼠滑過：區域周邊色點發光效果 */}
      <div className="pointer-events-none absolute inset-0 z-0 bq-glowing-dots-dense" />

      {/* ---------- Board: enemies, message, our characters, hand ---------- */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="px-3 pt-2 pr-36 text-[10px] uppercase tracking-widest text-stone-300/70 sm:px-4 sm:pr-4 sm:text-[11px]">{t("v3.ui.title")}</div>

        <section className="flex flex-1 items-center justify-center px-2 pt-5 sm:px-4">
          <div className="flex items-start justify-center gap-2 sm:gap-5">
            {/* The stage's shooter and guard flank the boss; in a duel they stand aside (Eden has only the Serpent). */}
            {!isDuel(board) && STAGE_SHOOTER[b.stage] && STAGE_GUARD[b.stage] && (
              <>
                <EnemyCard b={b} front={board.front} id={STAGE_SHOOTER[b.stage]!} t={t} size="small" className="order-1" pending={pending} onTarget={() => onTarget(STAGE_SHOOTER[b.stage]!)} onView={() => setViewingEnemy(STAGE_SHOOTER[b.stage]!)} />
                <EnemyCard b={b} front={board.front} id={STAGE_GUARD[b.stage]!} t={t} size="small" className="order-3" pending={pending} onTarget={() => onTarget(STAGE_GUARD[b.stage]!)} onView={() => setViewingEnemy(STAGE_GUARD[b.stage]!)} />
              </>
            )}
            <EnemyCard b={b} front={board.front} id={bossOf(b)} t={t} size="large" className="order-2" pending={pending} onTarget={() => onTarget(bossOf(b))} onView={() => setViewingEnemy(bossOf(b))} />
          </div>
        </section>

        {/* What is happening / what to do next */}
        <div className="mx-auto my-1 min-h-6 max-w-xl px-3 text-center text-[11px] font-semibold leading-tight text-amber-100 sm:text-sm">
          {promote ? (
            <span className="text-red-200">{t("v3.ui.chooseFront")}</span>
          ) : pending ? (
            <span className="text-emerald-200">
              {pending.basic ? t("v3.basic.name") : t(`v2.skill.${pending.skill}.name`)} · {t("v2.ui.chooseTarget")}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPending(null);
                }}
                className="ml-2 text-xs text-stone-300 underline"
              >
                {t("v2.ui.cancel")}
              </button>
            </span>
          ) : lastHit ? (
            t(lastHit.key, lastHit.params)
          ) : !b.hand.length && canDrawOnBoard(board) ? (
            <span className="text-amber-200">{t("v3.deck.hint")}</span>
          ) : (
            <span className="text-stone-300">{t("v3.ui.tapCharacter")}</span>
          )}
        </div>

        {/* Upper row: 4 skill/energy card slots (上方技能四張卡) */}
        <SkillSlotsRow
          board={board}
          t={t}
          disabled={locked || !!pending || promote}
          onDraw={draw}
          onDrawAll={drawAll}
          onPlay={play}
          onPlayAll={playAll}
          onInspect={(target) => setViewingScripture(target)}
        />

        {/* Lower row: 3 character cards (下方三張角色卡) */}
        <section className="flex flex-1 items-center justify-center px-2 pb-2 sm:px-4">
          <div className="flex items-start justify-center gap-2 sm:gap-5">
            {/* The front line stands forward; the bench stands back. */}
            {slot(board.front, "large", "order-2 z-10 -translate-y-3")}
            {bench.map((id, i) => slot(id, "small", `${i === 0 ? "order-1" : "order-3"} brightness-90`))}
          </div>
        </section>

      </main>

      {/* ---------- Controls: side rail on desktop, bottom bar on phones ---------- */}
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex items-center gap-2 border-t border-white/10 bg-black/40 px-2 py-2 sm:w-44 sm:flex-col sm:items-stretch sm:justify-center sm:gap-3 sm:border-l sm:border-t-0 sm:px-3"
      >
        {b.pools !== "team" ? (
          <div className="hidden text-center text-[10px] leading-snug text-stone-400 sm:block">
            {t(b.pools === "table" ? "v3.pool.hintTable" : "v3.pool.hint")}
            {b.pools === "table" && <div className="mt-1 font-bold text-amber-200">{t("v3.pool.attached", { n: b.attached, m: R.table.attachPerTurn })}</div>}
          </div>
        ) : (
        <div className="flex gap-1.5 sm:justify-between">
          {order.map((k) => (
            <div key={k} title={t(`v2.energy.${k}.desc`)} className={`flex h-9 w-9 flex-col items-center justify-center rounded-full border-2 sm:h-11 sm:w-11 ${ENERGY_RING[k]}`}>
              <EnergyIcon kind={k} className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 object-contain" />
              <span className="text-sm font-black leading-none">{b.energy[k]}</span>
            </div>
          ))}
        </div>
        )}
        <button
          onClick={playAll}
          disabled={locked || !b.hand.length || b.pools !== "team"}
          className={`hidden rounded-full border border-stone-400 px-3 py-1 text-xs text-stone-200 enabled:hover:bg-white/10 disabled:opacity-40 ${b.pools !== "team" ? "" : "sm:block"}`}
        >
          {t("v2.ui.playAll")}
        </button>
        <div className="hidden justify-between text-[11px] text-stone-400 sm:flex">
          <span>
            {t("v3.ui.deck")} {b.deck.length}
          </span>
          <span>
            {t("v3.ui.discard")} {b.discard.length}
          </span>
        </div>
        <div className="flex-1 sm:hidden" />
        <button
          onClick={() => {
            setPending(null);
            setAuto(!auto);
          }}
          disabled={b.result !== "ongoing"}
          className={`shrink-0 whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-xs font-bold disabled:opacity-40 sm:text-sm ${
            auto ? "border-sky-300 bg-sky-500 text-stone-950" : "border-sky-300 text-sky-100 hover:bg-sky-900/60"
          }`}
        >
          {auto ? t("v2.ui.autoOn") : t("v2.ui.autoOff")}
        </button>
        <button
          onClick={() => {
            setPending(null);
            setActing(null);
            endTurn();
          }}
          disabled={locked || promote}
          className="shrink-0 whitespace-nowrap rounded-full bg-red-700 px-4 py-1.5 text-sm font-bold text-white shadow-lg enabled:hover:bg-red-600 disabled:opacity-40 sm:py-2.5 sm:text-base"
        >
          {resolving ? t("v2.ui.resolving") : t("v2.ui.endTurn")}
        </button>
        <button onClick={() => setShowLog(!showLog)} className="shrink-0 whitespace-nowrap rounded-full border border-stone-500 px-2.5 py-1.5 text-xs text-stone-200 hover:bg-white/10">
          {showLog ? t("v3.ui.hideLog") : t("v3.ui.showLog")}
        </button>
      </aside>

      {/* Skill view for the selected character */}
      {open && (
        <SkillFocus
          board={board}
          id={open}
          t={t}
          locked={locked}
          onSkill={onSkill}
          onBasic={() => onBasic(open)}
          onSwap={() => {
            setActing(null);
            swap(open);
          }}
          onClose={() => setActing(null)}
        />
      )}

      {/* Enlarged scripture card (比照角色卡比例與技能按鈕) */}
      {viewingScripture && (() => {
        const cardId = viewingScripture.card;
        const cardDef = CARDS_V2[cardId];
        const { energy: kind, amount } = cardDef;
        const blocked = b ? cardBlockReason(b, cardId) : null;
        const inHand = viewingScripture.uid !== undefined && b?.hand.some((c) => c.uid === viewingScripture.uid);
        const playable = inHand && !locked && !blocked;

        return (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setViewingScripture(null);
            }}
            className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-black/85 p-4 pt-12 backdrop-blur-sm"
          >
            <div className="my-auto flex max-w-full flex-col items-center gap-4 lg:flex-row lg:items-center">
              {/* Enlarged card container with spring pop-in matching character card */}
              <motion.div
                initial={{ scale: 0.55, y: 60, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                onClick={(e) => e.stopPropagation()}
                className={`relative shrink-0 ${VIEWER_WIDTH}`}
                style={viewerStyle(scale)}
              >
                <HoloCard element={ENERGY_ELEMENT[kind]} rarity="N">
                  <ScriptureCardFace id={cardId} />
                </HoloCard>
                <CardShine />

                {/* Energy Amount Badge */}
                <div className={`absolute -right-3 -top-3 z-30 flex items-center gap-1.5 ${b && b.pools !== "team" ? "[filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.9))]" : "rounded-full border-2 border-white bg-slate-900/95 px-3 py-1 shadow-xl"}`}>
                  {b && b.pools !== "team" ? (
                    cardEffect(kind, amount, b.pools, cardId).disc ? (
                      <EnergyDisc kind={cardEffect(kind, amount, b.pools, cardId).disc!} className="h-12 w-12 text-3xl">
                        {cardEffect(kind, amount, b.pools, cardId).text}
                      </EnergyDisc>
                    ) : (
                      <span className="text-xs font-black text-amber-200">{cardEffect(kind, amount, b.pools, cardId).icon} {cardEffect(kind, amount, b.pools, cardId).text}</span>
                    )
                  ) : (
                    <>
                      <EnergyIcon kind={kind} className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5 object-contain" />
                      <span className="text-xs font-black text-amber-200">+{amount} {t(`v2.energy.${kind}.name`)}</span>
                    </>
                  )}
                </div>

                {/* Close button on card corner matching character card */}
                <button
                  onClick={() => setViewingScripture(null)}
                  aria-label={t("v3.ui.close")}
                  className="absolute -left-[0.5em] -top-[0.5em] z-30 flex h-[1.4em] w-[1.4em] items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[0.8em] text-white shadow-lg hover:bg-slate-600"
                >
                  ✕
                </button>
              </motion.div>

              {/* Side action panel (比照角色卡技能面板) */}
              <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col items-stretch gap-2.5 lg:w-80 lg:justify-center">
                {inHand && b && b.pools !== "team" && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-center text-xs font-bold text-amber-200">{t("v3.pool.giveTo")} · {cardEffect(kind, amount, b.pools, cardId).disc ? <EnergyDisc kind={cardEffect(kind, amount, b.pools, cardId).disc!} className="mx-0.5 h-3.5 w-3.5 align-[-0.15em]" /> : cardEffect(kind, amount, b.pools, cardId).icon} {cardEffect(kind, amount, b.pools, cardId).text}{b.pools === "table" ? ` · ${t("v3.pool.attached", { n: b.attached, m: R.table.attachPerTurn })}` : ""}</p>
                    {b.lineup.filter((cid) => isAlive(b, cid)).map((cid) => {
                      const ch = b.party[cid];
                      const room = b.pools === "table" ? energyRoom(b, cid) - cardValue(cardId) + 1 : kind === "attack" ? R.pools.spCap - ch.sp : kind === "faith" ? mpCap(cid) - ch.mp : Infinity;
                      // The tabletop rules: a colour only goes to someone with a skill of that colour.
                      const useless = b.pools === "table" && !hasSkillOfColor(cid, kind);
                      return (
                        <button
                          key={cid}
                          disabled={!playable || (b.pools === "table" && (room <= 0 || useless))}
                          onClick={() => {
                            if (viewingScripture.uid !== undefined && playable) {
                              play(viewingScripture.uid, cid);
                              setViewingScripture(null);
                            }
                          }}
                          className="flex items-center justify-between gap-2 rounded-lg border-2 border-white bg-gradient-to-b from-slate-50 to-slate-300 px-3 py-1.5 text-left text-slate-900 shadow-[0_6px_16px_rgb(0_0_0/0.5)] transition enabled:hover:-translate-y-0.5 disabled:opacity-50"
                        >
                          <span className="text-sm font-black">{t(`char.${cid}.name`)}</span>
                          <span className="flex items-center gap-1 text-[11px] font-bold tabular-nums text-slate-600">
                            {/* What is missing comes first, in the colour of the energy that cannot be used. */}
                            {useless ? <span className={kind === "attack" ? "text-[#9b1e23]" : kind === "guard" ? "text-[#15733f]" : "text-[#205ec0]"}>{t("v3.pool.noSkill")}</span> : room <= 0 && <span className="text-red-700">{t("v3.pool.full")}</span>}
                            {b.pools === "table" ? `🔴${ch.sp} 🟢${cardsOf(b, cid).green.reduce((n, v) => n + v, 0)} 🔵${ch.mp} · ${attachedTotal(b, cid)}/${energyCap(cid)}` : `MP ${ch.mp}/${mpCap(cid)} · SP ${ch.sp}/${R.pools.spCap}`}
                          </span>
                        </button>
                      );
                    })}
                    {blocked && <span className="block text-center text-[11px] font-semibold text-red-300">{t(blocked)}</span>}
                  </div>
                )}
                {inHand && b?.pools === "team" && (
                  <button
                    onClick={() => {
                      if (viewingScripture.uid !== undefined && playable) {
                        play(viewingScripture.uid);
                        setViewingScripture(null);
                      }
                    }}
                    disabled={!playable}
                    title={blocked ? t(blocked) : t(`v2.card.${cardId}.name`)}
                    className="group flex items-center gap-2.5 rounded-lg border-2 border-white bg-gradient-to-b from-slate-50 to-slate-300 px-3 py-2 text-left text-slate-900 shadow-[0_6px_16px_rgb(0_0_0/0.5)] transition enabled:hover:-translate-y-0.5 enabled:hover:from-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-black">{t("v3.deck.play")} · {t(`v2.card.${cardId}.name`)}</span>
                        <span className="flex items-center gap-1 rounded-full bg-slate-900/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
                          <EnergyIcon kind={kind} className="h-3 w-3 object-contain" />
                          <span>{t(`v2.energy.${kind}.name`)}</span>
                        </span>
                      </span>
                      <span className="block text-[11px] leading-snug text-slate-600">
                        {t("v3.deck.play")} {t(`v2.card.${cardId}.name`)} (+{amount} {t(`v2.energy.${kind}.name`)})
                      </span>
                      {blocked && <span className="block text-[11px] font-semibold text-red-700">{t(blocked)}</span>}
                    </span>
                    <span className="text-xl font-black leading-none text-slate-900">
                      +{amount}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setViewingScripture(null)}
                  className="self-center rounded-full border border-stone-400 bg-black/40 px-5 py-1.5 text-xs font-semibold text-stone-200 transition hover:bg-white/10"
                >
                  ✕ {t("v3.ui.close")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Enlarged full card (比照角色卡比例) */}
      {viewing && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setViewing(null);
          }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative shrink-0 ${VIEWER_WIDTH}`}
            style={viewerStyle(scale)}
          >
            <HoloCard element={CHARACTER_ELEMENT[viewing]} rarity={CARD_RARITY[viewing]} figure={figureArea(viewing)}>
              <CharacterCardFace id={viewing} />
            </HoloCard>
            <button
              onClick={() => setViewing(null)}
              aria-label={t("v3.ui.close")}
              className="absolute -left-[0.5em] -top-[0.5em] z-30 flex h-[1.4em] w-[1.4em] items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[0.8em] text-white shadow-lg hover:bg-slate-600"
            >
              ✕
            </button>
          </div>
          <button onClick={() => setViewing(null)} className="rounded-full border border-stone-400 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10">
            ✕ {t("v3.ui.close")}
          </button>
        </div>
      )}

      {/* Enlarged enemy card (比照角色卡比例) */}
      {viewingEnemy && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setViewingEnemy(null);
          }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
        >
          <motion.div
            initial={{ scale: 0.55, y: -60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative shrink-0 ${VIEWER_WIDTH}`}
            style={viewerStyle(scale)}
          >
            <HoloCard element={ENEMY_ELEMENT[viewingEnemy]} rarity={CARD_RARITY[viewingEnemy]}>
              <EnemyCardFace id={viewingEnemy} />
            </HoloCard>
            {lookOf(viewingEnemy).shine && <CardShine />}
            <div className="absolute -right-4 -top-6 z-30">
              <HpBadge hp={b.enemies[viewingEnemy].hp} max={ENEMY_HP[viewingEnemy]} big />
            </div>
            <button
              onClick={() => setViewingEnemy(null)}
              aria-label={t("v3.ui.close")}
              className="absolute -left-[0.5em] -top-[0.5em] z-30 flex h-[1.4em] w-[1.4em] items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[0.8em] text-white shadow-lg hover:bg-slate-600"
            >
              ✕
            </button>
          </motion.div>
          <button onClick={() => setViewingEnemy(null)} className="rounded-full border border-stone-400 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10">
            ✕ {t("v3.ui.close")}
          </button>
        </div>
      )}

      {/* Battle log */}
      {showLog && (
        <div
          ref={logRef}
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-16 left-3 right-3 z-40 max-h-[50vh] overflow-y-auto rounded-xl border border-stone-600 bg-stone-950/95 p-3 text-xs sm:bottom-4 sm:left-auto sm:right-48 sm:w-80"
        >
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
            {drop && (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-amber-300 bg-amber-500/15 p-3">
                <div className="text-xs font-bold text-amber-300">{t("v3.campaign.drop")}</div>
                <HoloCard element={CHARACTER_ELEMENT[drop]} rarity={CARD_RARITY[drop]} touchTilt={false} figure={figureArea(drop)} className="w-[160px] text-[7.5px]">
                  <CharacterCardFace id={drop} />
                </HoloCard>
                <div className="text-lg font-bold">{t(`char.${drop}.name`)}</div>
              </div>
            )}
            {newAchievements.map((id) => (
              <div key={id} className="mt-3 rounded-xl border border-amber-300 bg-amber-500/15 p-3">
                <div className="text-xs font-bold text-amber-300">{t("v3.ach.unlocked")}</div>
                <div className="text-lg font-bold">🏆 {t(`v3.ach.${id}.name`)}</div>
                <div className="text-xs text-stone-300">{t(`v3.ach.${id}.desc`)}</div>
              </div>
            ))}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {campaign && b.result === "victory" && next && (
                <Link href={`/campaign/${next}`} className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-stone-950 hover:bg-amber-400">
                  {t("v3.campaign.next")} →
                </Link>
              )}
              <button
                onClick={() => {
                  setPending(null);
                  restart();
                }}
                className={`rounded-xl px-4 py-2 font-semibold ${campaign && b.result === "victory" ? "border border-amber-500 text-amber-100 hover:bg-stone-800" : "bg-amber-500 text-stone-950 hover:bg-amber-400"}`}
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
              <Link href={campaign ? "/campaign" : "/"} className="rounded-xl border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-800">
                {campaign ? t("v3.campaign.list") : t("v2.ui.backHome")}
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
    </PoolModeContext.Provider>
  );
}
