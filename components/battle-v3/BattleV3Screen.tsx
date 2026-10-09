"use client";

// /battle-v3: card-board layout experiment on the v2 rules, plus a line-up and a front line
// (game/v3/engine.ts): pick 1–3 characters, the front line takes the single-target hits, one free swap per turn.
// Each side is one row (bench · front line · bench); on phones the selected character's skills move
// into an action bar, so the whole board fits on one screen.
import { motion } from "framer-motion";
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
  RULES_V2 as R,
  SKILLS,
} from "@/game/v2/data";
import { bossOf, canAct, elementMultiplier, inStory, skillTargets, supportAmount, enemyAlive, enemyDamage, isAlive, payment, skillDamage, type Target } from "@/game/v2/engine";
import { PARTY_ORDER, personOf } from "@/game/v2/data";
import type { BattleState, CharacterId, EnemyId, EnergyKind, Intent, SkillId, StageId } from "@/game/v2/types";
import { ACHIEVEMENTS, useAchievementStore, type AchievementId } from "@/game/v3/achievements";
import { boardBlockReason, boardSkillTargets, canSwap, isDuel, needsFront, type Board } from "@/game/v3/engine";
import { useBattleV3Store } from "@/game/v3/store";
import { useT } from "@/game/locale";
import { CharacterCardFace } from "@/components/cards/CharacterCardFace";
import { CARD_RARITY, lookOf } from "@/components/cards/rarity";
import { EnemyCardFace } from "@/components/cards/EnemyCardFace";
import { HoloCard } from "@/components/cards/HoloCard";

type T = ReturnType<typeof useT>;
type Pending = { skill: SkillId; targets: Target[] };

const ENERGY_ICON: Record<EnergyKind, string> = { faith: "✨", attack: "🗡️", guard: "🕊️" };
const ENERGY_RING: Record<EnergyKind, string> = {
  faith: "border-amber-300 bg-amber-500/25 text-amber-100",
  attack: "border-red-400 bg-red-600/25 text-red-100",
  guard: "border-emerald-400 bg-emerald-600/25 text-emerald-100",
};

/** Card widths: phones get narrow cards so a whole side fits in one row. Every card uses the TCG ratio 63:88. */
/**
 * Desktop: up to 200% (16rem), but never so tall that the board scrolls — two rows of cards share the height left
 * after the hand, intents and labels (about 19.5rem); 0.358 = card ratio 63/88 shared by two rows.
 */
const DESKTOP_CARD = "lg:w-[min(16rem,calc((100dvh-19.5rem)*0.358))]";
/**
 * Phones: up to 150% (8.25rem), limited by three cards across the screen width and by two rows of cards in the height.
 */
const PHONE_CARD = "w-[min(8.25rem,calc((100vw-2.5rem)/3),calc((100dvh-18rem)*0.358))]";
const CARD_WIDTH = { large: `${PHONE_CARD} sm:w-32 ${DESKTOP_CARD}`, small: `${PHONE_CARD} sm:w-32 ${DESKTOP_CARD}` };
/** Every card on the table is the same size; only the selected card is shown enlarged. */
const CHAR_WIDTH = CARD_WIDTH;
const CARD_RATIO = "aspect-[63/88]";


/** What an enemy action does, as a short tag: damage against the current front line, or the effect. */
function actionTag(t: T, action: Intent["action"], front: CharacterId, enraged = false): string {
  if (action === "spear") return String(enemyDamage("goliath", front, R.spear));
  if (action === "crush") return String(enemyDamage("goliath", front, R.crush));
  if (action === "swing") return t("v3.tag.all", { n: R.swing });
  if (action === "defy") return t("v3.tag.shake", { n: R.defyTargets });
  if (action === "fang") return String(enemyDamage("serpent", front, enraged ? R.fangShed : R.fang));
  if (action === "coil") return String(enemyDamage("serpent", front, R.coil));
  if (action === "tempt") return `😨 ✨-${R.temptFaith}`;
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

function IntentRow({ label, intent, front, t, dim, enraged }: { label: string; intent: Intent; front: CharacterId; t: T; dim?: boolean; enraged?: boolean }) {
  const single = ["spear", "crush", "fang", "coil"].includes(intent.action);
  const name = `${t(`v2.action.${intent.action}.name`)}${single ? ` → ${t("v3.ui.front")}` : ""}`;
  return <AttackRow label={label} name={name} tag={actionTag(t, intent.action, front, enraged)} dim={dim} />;
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
  const owner = pending ? SKILLS[pending.skill].owner : null;
  const mult = owner ? elementMultiplier(CHARACTER_ELEMENT[owner], ENEMY_ELEMENT[id]) : 1;
  const isBoss = id === bossOf(b);
  const chips = [
    isBoss && g.enraged && { text: id === "serpent" ? t("v3.ui.shed") : t("v2.ui.enraged"), tone: "bg-red-700" },
    isBoss && g.stunned && { text: t("v2.ui.stunned"), tone: "bg-sky-600" },
    id === "goliath" && g.charging && { text: t("v2.ui.charging"), tone: "bg-orange-600" },
    id === "goliath" && enemyAlive(b, "bearer") && { text: "🛡", title: t("v2.ui.protected"), tone: "bg-amber-700" },
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
        className={`relative w-full ${CARD_RATIO} rounded-xs text-left transition [container-type:inline-size] ${
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
            🎯 {skillDamage(b, pending.skill, id)}
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
              <IntentRow label={t("v3.ui.nextAction")} intent={b.intents[0]} front={front} t={t} enraged={g.enraged} />
            ))}
          {isBoss && (
            <div className="hidden sm:block">
              <IntentRow label={t("v3.ui.then")} intent={b.intents[1]} front={front} t={t} dim enraged={g.enraged} />
            </div>
          )}
          {id === "archer" && b.archerTarget && (
            <AttackRow name={`${t("v3.action.arrow")} → ${t("v3.ui.front")}`} tag={String(enemyDamage("archer", front, R.archerDamage))} />
          )}
        </div>
      )}
    </div>
  );
}

/** HP badge hung on the card's top-right corner (outside the art), Pokémon TCG Pocket style. */
function HpBadge({ hp, max, shield = 0, big }: { hp: number; max: number; shield?: number; big?: boolean }) {
  const pct = Math.max(0, (hp / max) * 100);
  const color = pct >= 100 ? "bg-emerald-400" : pct > 50 ? "bg-yellow-400" : pct > 20 ? "bg-orange-500" : "bg-red-600";
  return (
    <div className="pointer-events-none flex items-start gap-1">
      {shield > 0 && <span className="mt-0.5 rounded-full bg-sky-500 px-1.5 text-[10px] font-black text-white shadow sm:text-xs">🛡️{shield}</span>}
      {/* The bar is exactly as wide as the number above it. */}
      <div className="inline-flex flex-col items-stretch gap-0.5">
        <span
          className={`text-center font-black leading-none text-slate-800 [-webkit-text-stroke:3px_white] [paint-order:stroke_fill] drop-shadow ${big ? "text-4xl" : "text-xl sm:text-2xl"}`}
        >
          {hp}
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
          <HpBadge hp={c.hp} max={MAX_HP[id]} shield={alive ? c.shield : 0} />
        </span>
        {alive && (c.shaken || c.acted || b.coiled === id) && (
          <span className="absolute -left-2 -top-3 z-20 flex gap-0.5 text-xs">
            {b.coiled === id && <span title={t("v3.ui.coiled")} className="rounded-full bg-emerald-800 px-1.5 py-0.5 shadow">🐍</span>}
            {c.shaken && <span className="rounded-full bg-purple-700 px-1.5 py-0.5 shadow">😨</span>}
            {c.acted && <span className="rounded-full bg-stone-700 px-1.5 py-0.5 text-white shadow">✓</span>}
          </span>
        )}
      </button>
      {/* Front-line tag under the card */}
      <div className="h-4 text-[9px] font-black uppercase tracking-wider sm:text-[10px]">
        {board.front === id && <span className="rounded-full bg-red-700 px-2 py-0.5 text-white shadow">{t("v3.ui.front")}</span>}
      </div>
    </div>
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

/**
 * Skill view (Pokémon TCG Pocket style): the card enlarged in the middle of the screen, its skills as bars laid over
 * the printed rows, the swap-to-front bar like "Retreat", and advantage tags against the enemies above the card.
 */
function SkillFocus({
  board,
  id,
  t,
  locked,
  onSkill,
  onSwap,
  onClose,
}: {
  board: Board;
  id: CharacterId;
  t: T;
  locked: boolean;
  onSkill: (skill: SkillId) => void;
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
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      {/* The card rises from the table to a close-up */}
      <motion.div
        initial={{ scale: 0.55, y: 60, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="relative [--w:min(630px,74vw,calc((100dvh-6rem)*63/88))]"
        style={{ width: "var(--w)", fontSize: "calc(var(--w) * 0.0467)" }}
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
          <HpBadge hp={c.hp} max={MAX_HP[id]} shield={alive ? c.shield : 0} big />
        </div>

        <div className="relative">
          <HoloCard element={CHARACTER_ELEMENT[id]} rarity={CARD_RARITY[id]}>
            <CharacterCardFace id={id} />
          </HoloCard>
          {lookOf(id).shine && <CardShine />}
          {casting && <CastBurst kind={SKILLS[casting].kind} label={t(`v2.skill.${casting}.name`)} art={SKILL_ART[casting]} />}
        </div>

        {/* Skill bars: compact and off to the right. Anchored to the bottom, where every card prints its skills just above
            the weakness/verse lines (cards with an ability or story line push their skills lower). */}
        <div className="absolute -right-[12%] bottom-[16%] z-20 flex w-[70%] flex-col gap-[0.25em] text-[0.62em]">
          {CHARACTER_SKILLS[id].map((skill) => {
            const def = SKILLS[skill];
            const reason = boardBlockReason(board, skill);
            const ready = !locked && !reason;
            const pay = payment(b, skill);
            const cost = pay ? ENERGY_ICON[def.kind].repeat(def.cost - pay.faith) + ENERGY_ICON.faith.repeat(pay.faith) : ENERGY_ICON[def.kind].repeat(def.cost);
            const amount = def.damage ? skillDamage(b, skill, skill === "slingStone" ? bossOf(b) : skillTargets(b, skill).length === 1 ? (skillTargets(b, skill)[0] as EnemyId) : undefined) : supportAmount(b, skill);
            const boosted = !!def.damage && amount > def.damage;
            return (
              <button
                key={skill}
                onClick={() => cast(skill)}
                disabled={!ready || !!casting}
                title={reason ? t(reason) : t(`v2.skill.${skill}.desc`, { n: amount })}
                className="group flex items-center gap-[0.5em] rounded-[0.5em] border-2 border-white bg-gradient-to-b from-slate-50 to-slate-300 px-[0.6em] py-[0.3em] text-left text-slate-900 shadow-[0_6px_16px_rgb(0_0_0/0.5)] transition enabled:hover:-translate-x-1 enabled:hover:from-white disabled:cursor-not-allowed disabled:opacity-70 disabled:grayscale"
              >
                <span className="w-[3.2em] shrink-0 text-[0.8em] tracking-tighter">{cost}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1em] font-black">{t(`v2.skill.${skill}.name`)}</span>
                  {reason && reason !== "v2.reason.over" && <span className="block truncate text-[0.62em] font-semibold text-red-700">{t(reason)}</span>}
                </span>
                <span className="text-[1.4em] font-black leading-none">
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
              className="flex items-center justify-between gap-[0.5em] rounded-[0.5em] border-2 border-white bg-gradient-to-b from-slate-50 to-slate-300 px-[0.6em] py-[0.3em] text-slate-900 shadow-[0_6px_16px_rgb(0_0_0/0.5)] transition enabled:hover:-translate-x-1 disabled:cursor-not-allowed disabled:opacity-70 disabled:grayscale"
            >
              <span className="text-[0.62em] font-bold text-slate-600">{needsFront(board) ? t("v3.focus.free") : b.coiled === board.front ? t("v3.ui.coiled") : board.swapped ? t("v3.ui.swapUsed") : t("v3.focus.free")}</span>
              <span className="text-[0.95em] font-black tracking-widest">{needsFront(board) ? t("v3.ui.promote") : t("v3.ui.swap")}</span>
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          aria-label={t("v3.ui.close")}
          className="absolute -left-[0.5em] -top-[0.5em] z-30 flex h-[1.4em] w-[1.4em] items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[0.8em] text-white shadow-lg hover:bg-slate-600"
        >
          ✕
        </button>
      </motion.div>
    </div>
  );
}

/** Before battle: bring 1–3 characters and choose who starts on the front line. */
/** How many characters can go to battle. */
const MAX_LINEUP = 3;

function LineupPicker({ t, onStart }: { t: T; onStart: (lineup: CharacterId[], front: CharacterId, stage: StageId) => void }) {
  const last = useBattleV3Store((st) => st.lastLineup);
  const [stage, setStage] = useState<StageId>(last.stage);
  const unlocked = useAchievementStore((st) => st.unlocked);
  const [lineup, setLineup] = useState<CharacterId[]>(last.lineup);
  const [front, setFront] = useState<CharacterId>(last.front);
  const chosen = PARTY_ORDER.filter((id) => lineup.includes(id));
  const lead = chosen.includes(front) ? front : chosen[0];
  // At most three characters go to battle, and one card per person: picking another card of the same person swaps it in.
  const full = chosen.length >= MAX_LINEUP;
  const twin = (id: CharacterId) => chosen.find((x) => x !== id && personOf(x) === personOf(id));
  const toggle = (id: CharacterId) => {
    if (lineup.includes(id)) setLineup(lineup.filter((x) => x !== id));
    else if (twin(id)) setLineup([...lineup.filter((x) => x !== twin(id)), id]);
    else if (!full) setLineup([...lineup, id]);
  };

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-3 bg-gradient-to-b from-rose-950 via-stone-900 to-indigo-950 py-4 sm:gap-4 sm:py-6">
      <div className="px-4 text-center">
        <div className="text-[10px] uppercase tracking-widest text-stone-300/70 sm:text-[11px]">{t("v3.ui.title")}</div>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("v3.lineup.title")}</h1>
        <p className="mt-1 max-w-md text-sm text-stone-300">{t("v3.lineup.hint")}</p>
      </div>

      {/* Stage */}
      <div role="radiogroup" aria-label={t("v3.stage.title")} className="flex flex-wrap justify-center gap-2 px-4">
        {(["goliath", "eden"] as StageId[]).map((st) => (
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

      {/* Full character cards; on phones the row scrolls sideways. */}
      <div className="flex max-w-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 pt-3 sm:gap-4">
        {PARTY_ORDER.map((id) => {
          const on = chosen.includes(id);
          return (
            <div key={id} className="flex shrink-0 snap-center flex-col items-center gap-2">
              <button
                onClick={() => toggle(id)}
                aria-pressed={on}
                className={`relative w-[220px] text-left text-[10.3px] transition sm:w-[200px] sm:text-[9.35px] lg:w-[220px] lg:text-[10.3px] ${on ? "" : "opacity-45 grayscale"}`}
              >
                <HoloCard element={CHARACTER_ELEMENT[id]} rarity={CARD_RARITY[id]} touchTilt={false}>
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

      <button
        onClick={() => onStart(chosen, lead, stage)}
        disabled={!chosen.length}
        className="rounded-full bg-red-700 px-8 py-2.5 text-lg font-bold text-white shadow-lg enabled:hover:bg-red-600 disabled:opacity-40"
      >
        {chosen.length === 1 ? t("v3.lineup.startSolo") : chosen.length ? t("v3.lineup.start") : t("v3.lineup.need")}
      </button>

      {/* Achievements, one compact line each (details on hover) */}
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
  /** The character whose skill view is open. */
  const [acting, setActing] = useState<CharacterId | null>(null);
  /** The hand card being previewed. */
  const [preview, setPreview] = useState<number | null>(null);
  /** Character whose full card is shown enlarged. */
  const [viewing, setViewing] = useState<CharacterId | null>(null);
  /** Enemy whose card is shown enlarged. */
  const [viewingEnemy, setViewingEnemy] = useState<EnemyId | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const b = board?.battle;

  // Achievements live in localStorage; read them after mount so the prerendered page matches.
  useEffect(() => {
    void useAchievementStore.persist.rehydrate();
  }, []);
  // Esc closes whatever is open: the enlarged card, the action panel, or targeting.
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setViewing(null);
      setViewingEnemy(null);
      setActing(null);
      setPending(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [b?.log.length, showLog]);

  if (!board || !b) return <LineupPicker t={t} onStart={start} />;

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
    if (pending) cast(pending.skill, target);
    setPending(null);
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
  // Hand: a mouse previews on hover and plays on click; a finger previews on the first tap and plays from the preview.
  const canHover = typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
  const previewed = b.hand.find((c) => c.uid === preview);
  const bench = board.lineup.filter((id) => id !== board.front);
  const lastHit = [...b.log].reverse().find((l) => l.key === "v2.log.attack" || l.key === "v2.log.slingStone");
  const order: EnergyKind[] = ["faith", "attack", "guard"];
  const hand = [...b.hand].sort((x, y) => order.indexOf(CARDS_V2[x.card].energy) - order.indexOf(CARDS_V2[y.card].energy));

  return (
    <div
      onClick={() => {
        setActing(null);
        setPreview(null);
      }}
      className="relative flex min-h-[100dvh] flex-1 flex-col overflow-x-hidden bg-gradient-to-b from-rose-950 via-stone-900 to-indigo-950 sm:flex-row"
    >
      {/* ---------- Board: enemies, message, our characters, hand ---------- */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="px-3 pt-2 text-[10px] uppercase tracking-widest text-stone-300/70 sm:px-4 sm:text-[11px]">{t("v3.ui.title")}</div>

        <section className="flex flex-1 items-center justify-center px-2 pt-5 sm:px-4">
          <div className="flex items-start justify-center gap-2 sm:gap-5">
            {/* In a duel the shield bearer and the archer stand aside; Eden has only the Serpent. */}
            <div className={isDuel(board) || b.stage === "eden" ? "hidden" : "contents"}>
              <EnemyCard b={b} front={board.front} id="archer" t={t} size="small" className="order-1" pending={pending} onTarget={() => onTarget("archer")} onView={() => setViewingEnemy("archer")} />
              <EnemyCard b={b} front={board.front} id="bearer" t={t} size="small" className="order-3" pending={pending} onTarget={() => onTarget("bearer")} onView={() => setViewingEnemy("bearer")} />
            </div>
            <EnemyCard b={b} front={board.front} id={bossOf(b)} t={t} size="large" className="order-2" pending={pending} onTarget={() => onTarget(bossOf(b))} onView={() => setViewingEnemy(bossOf(b))} />
          </div>
        </section>

        {/* What is happening / what to do next */}
        <div className="mx-auto my-1 min-h-6 max-w-xl px-3 text-center text-[11px] font-semibold leading-tight text-amber-100 sm:text-sm">
          {promote ? (
            <span className="text-red-200">{t("v3.ui.chooseFront")}</span>
          ) : pending ? (
            <span className="text-emerald-200">
              {t(`v2.skill.${pending.skill}.name`)} · {t("v2.ui.chooseTarget")}
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
          ) : (
            <span className="text-stone-300">{t("v3.ui.tapCharacter")}</span>
          )}
        </div>

        {/* Hand: Scripture cards fanned above our characters */}
        <section className="flex justify-center px-2 pb-2 pt-1 sm:pb-3">
          {hand.map((inst, i) => {
            const kind = CARDS_V2[inst.card].energy;
            const tilt = (i - (hand.length - 1) / 2) * 5;
            return (
              <button
                key={inst.uid}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canHover || preview === inst.uid) {
                    play(inst.uid);
                    setPreview(null);
                  } else setPreview(inst.uid);
                }}
                onMouseEnter={() => setPreview(inst.uid)}
                onMouseLeave={() => canHover && setPreview(null)}
                disabled={locked || !!pending}
                style={{ transform: `rotate(${tilt}deg) translateY(${(preview === inst.uid ? -14 : 0) + Math.abs(tilt) * 0.6}px)` }}
                className={`-ml-3 flex h-[4.5rem] ${CARD_RATIO} shrink-0 ${preview === inst.uid ? "z-10 ring-2 ring-white" : ""} flex-col items-center justify-between rounded-md border-2 bg-stone-900 p-1 text-center shadow-xl transition first:ml-0 enabled:hover:z-10 enabled:hover:-translate-y-3 disabled:opacity-50 sm:h-24 sm:p-1.5 ${ENERGY_RING[kind]}`}
              >
                <span className="text-xl sm:text-3xl">{ENERGY_ICON[kind]}</span>
                <span className="text-[9px] font-bold sm:text-[10px]">{t(`v2.energy.${kind}.name`)} +1</span>
                <span className="hidden text-[9px] leading-tight text-stone-300 sm:block">{t(`v2.card.${inst.card}.ref`)}</span>
              </button>
            );
          })}
        </section>
        <section className="flex flex-1 items-center justify-center px-2 sm:px-4">
          <div className="flex items-start justify-center gap-2 sm:gap-5">
            {/* The front line stands forward; the bench stands back. */}
            {slot(board.front, "large", "order-2 z-10 -translate-y-4")}
            {bench.map((id, i) => slot(id, "small", `${i === 0 ? "order-1" : "order-3"} brightness-90`))}
          </div>
        </section>

      </main>

      {/* ---------- Controls: side rail on desktop, bottom bar on phones ---------- */}
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 border-t border-white/10 bg-black/40 px-2 py-2 sm:w-44 sm:flex-col sm:items-stretch sm:justify-center sm:gap-3 sm:border-l sm:border-t-0 sm:px-3"
      >
        <div className="flex gap-1.5 sm:justify-between">
          {order.map((k) => (
            <div key={k} title={t(`v2.energy.${k}.desc`)} className={`flex h-9 w-9 flex-col items-center justify-center rounded-full border-2 sm:h-11 sm:w-11 ${ENERGY_RING[k]}`}>
              <span className="text-[11px] leading-none sm:text-sm">{ENERGY_ICON[k]}</span>
              <span className="text-sm font-black leading-none">{b.energy[k]}</span>
            </div>
          ))}
        </div>
        <button
          onClick={playAll}
          disabled={locked || !b.hand.length}
          className="hidden rounded-full border border-stone-400 px-3 py-1 text-xs text-stone-200 enabled:hover:bg-white/10 disabled:opacity-40 sm:block"
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
          className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold disabled:opacity-40 sm:text-sm ${
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
          className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-bold text-white shadow-lg enabled:hover:bg-red-600 disabled:opacity-40 sm:py-2.5 sm:text-base"
        >
          {resolving ? t("v2.ui.resolving") : t("v2.ui.endTurn")}
        </button>
        <button onClick={() => setShowLog(!showLog)} className="rounded-full border border-stone-500 px-2.5 py-1.5 text-xs text-stone-200 hover:bg-white/10">
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
          onSwap={() => {
            setActing(null);
            swap(open);
          }}
          onClose={() => setActing(null)}
        />
      )}

      {/* Hand card preview, over the enemy row (the hand sits mid-screen) */}
      {previewed && !locked && !pending && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed left-1/2 top-[4%] z-40 w-36 -translate-x-1/2 sm:top-[8%] sm:w-48 ${canHover ? "pointer-events-none" : ""}`}
        >
          <div className={`flex ${CARD_RATIO} flex-col items-center justify-between rounded-xl border-4 bg-stone-900 p-3 text-center shadow-2xl ${ENERGY_RING[CARDS_V2[previewed.card].energy]}`}>
            <span className="text-[11px] font-semibold text-stone-300">{t(`v2.card.${previewed.card}.ref`)}</span>
            <span className="text-5xl">{ENERGY_ICON[CARDS_V2[previewed.card].energy]}</span>
            <span className="text-sm font-black leading-snug text-white">「{t(`v2.card.${previewed.card}.name`)}」</span>
            <span className="text-xs font-bold">→ {t(`v2.energy.${CARDS_V2[previewed.card].energy}.name`)} +1</span>
            <span className="text-[10px] leading-tight text-stone-300">{t(`v2.energy.${CARDS_V2[previewed.card].energy}.desc`)}</span>
          </div>
          {!canHover && (
            <button
              onClick={() => {
                play(previewed.uid);
                setPreview(null);
              }}
              className="mt-2 w-full rounded-full bg-amber-500 py-1.5 text-sm font-black text-stone-950 shadow-lg"
            >
              {t("v3.focus.play")}
            </button>
          )}
        </div>
      )}

      {/* Enlarged full card */}
      {viewing && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setViewing(null);
          }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/80 p-4"
        >
          {/* Sized to fit both the width and the height of the screen; the text scales with the card. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="[--w:min(720px,88vw,calc((100dvh-7rem)*63/88))]"
            style={{ width: "var(--w)", fontSize: "calc(var(--w) * 0.0467)" }}
          >
            <HoloCard element={CHARACTER_ELEMENT[viewing]} rarity={CARD_RARITY[viewing]}>
              <CharacterCardFace id={viewing} />
            </HoloCard>
          </div>
          <button onClick={() => setViewing(null)} className="rounded-full border border-stone-400 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10">
            ✕ {t("v3.ui.close")}
          </button>
        </div>
      )}

      {/* Enlarged enemy card */}
      {viewingEnemy && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setViewingEnemy(null);
          }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/80 p-4"
        >
          <motion.div
            initial={{ scale: 0.55, y: -60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative [--w:min(720px,88vw,calc((100dvh-7rem)*63/88))]"
            style={{ width: "var(--w)", fontSize: "calc(var(--w) * 0.0467)" }}
          >
            <HoloCard element={ENEMY_ELEMENT[viewingEnemy]} rarity={CARD_RARITY[viewingEnemy]}>
              <EnemyCardFace id={viewingEnemy} />
            </HoloCard>
            {lookOf(viewingEnemy).shine && <CardShine />}
            <div className="absolute -right-4 -top-6 z-30">
              <HpBadge hp={b.enemies[viewingEnemy].hp} max={ENEMY_HP[viewingEnemy]} big />
            </div>
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
