"use client";

// Printed enemy card, in the same style as the character cards: frame, ornaments, art, moves, weakness, verse.
import { ENEMY_ELEMENT, ENEMY_HP, RULES_V2 as R } from "@/game/v2/data";
import { elementMultiplier } from "@/game/v2/engine";
import type { EnemyId, GoliathActionId } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { CardFrame } from "./CardFrame";
import { ELEMENTS, THEME } from "./CharacterCardFace";
import { ElementIcon } from "./ElementIcon";
import { Foil } from "./HoloCard";
import { CARD_RARITY, lookOf } from "./rarity";
import { RarityMark } from "./RarityMark";

const PORTRAIT: Record<EnemyId, string> = {
  goliath: "🗿",
  bearer: "🛡️",
  archer: "🏹",
};
const CARD_NO: Record<EnemyId, string> = {
  goliath: "E01",
  bearer: "E02",
  archer: "E03",
};
/** scale: zoom into the illustration (1 = fit) around `origin` (defaults to the crop position); shiftX/shiftY: extra nudge in px (negative = left/up). */
const ART: Partial<
  Record<
    EnemyId,
    {
      src: string;
      position: string;
      scale?: number;
      origin?: string;
      shiftX?: number;
      shiftY?: number;
    }
  >
> = {
  goliath: {
    src: "/cards/goliath.jpg",
    position: "30% 50%",
    scale: 1.2,
    origin: "50% 38%",
  },
  archer: {
    src: "/cards/archer.jpg",
    position: "50% 89%",
    scale: 1.15,
    shiftY: 10,
  },
  bearer: {
    src: "/cards/bearer.jpg",
    position: "54% 94%",
    scale: 1.15,
    shiftY: 10,
  },
};

/** The moves printed on each enemy's card: [name key, amount]. */
const MOVES: Record<
  EnemyId,
  { action?: GoliathActionId; key: string; amount: string }[]
> = {
  goliath: [
    { action: "spear", key: "v2.action.spear.name", amount: String(R.spear) },
    { action: "crush", key: "v2.action.crush.name", amount: String(R.crush) },
    { action: "swing", key: "v2.action.swing.name", amount: String(R.swing) },
  ],
  archer: [{ key: "v3.action.arrow", amount: String(R.archerDamage) }],
  bearer: [{ key: "v3.ui.protects", amount: "🛡️" }],
};

function Header({ id, light }: { id: EnemyId; light?: boolean }) {
  const t = useT();
  return (
    <div
      className={`flex items-end justify-between px-[6%] ${light ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]" : ""}`}
    >
      <div className="min-w-0">
        <div
          className={`text-[0.6em] font-semibold uppercase tracking-wider ${light ? "opacity-90" : "opacity-60"}`}
        >
          {t(`v3.card.${id}.title`)}
        </div>
        <div className="truncate text-[1.35em] font-black leading-none">
          {t(`v2.enemy.${id}.name`)}
        </div>
      </div>
      {/* HP and element in the top-right corner, where the battle HP badge covers them. */}
      <div className="absolute right-[2%] top-[calc(2.2%+10px)] flex items-baseline gap-1">
        <span className="text-[0.6em] font-bold">HP</span>
        <span className="text-[1.6em] font-black leading-none">
          {ENEMY_HP[id]}
        </span>
        <span className="relative -top-[3px] text-[1.3em] leading-none">
          <ElementIcon element={ENEMY_ELEMENT[id]} />
        </span>
      </div>
    </div>
  );
}

function Body({ id }: { id: EnemyId }) {
  const t = useT();
  const element = ENEMY_ELEMENT[id];
  const weak = ELEMENTS.filter((e) => elementMultiplier(e, element, true) > 1);
  const resist = ELEMENTS.filter(
    (e) => elementMultiplier(e, element, true) < 1,
  );
  return (
    <>
      <div className="flex flex-col gap-[1.5%]">
        {MOVES[id].map((m) => (
          <div
            key={m.key}
            className="flex items-center gap-[3%] border-b border-stone-900/15 pb-[1%] last:border-0"
          >
            <span className="flex-1 text-[0.95em] font-black">{t(m.key)}</span>
            <span className="text-[1.15em] font-black">{m.amount}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t border-stone-900/20 pt-[1.5%] text-[0.58em]">
        <span>
          {t("v3.card.weakness")}{" "}
          {weak.length
            ? weak.map((e) => (
                <span key={e} className="mr-1">
                  <ElementIcon element={e} />×{R.elements.strong}
                </span>
              ))
            : "—"}
        </span>
        <span>
          {t("v3.card.resistance")}{" "}
          {resist.length
            ? resist.map((e) => (
                <span key={e} className="mr-1">
                  <ElementIcon element={e} />×{R.elements.weak}
                </span>
              ))
            : "—"}
        </span>
      </div>
      <div className="rounded-md bg-stone-900/5 px-[3%] py-[1.5%] text-[0.55em] leading-snug">
        <span className="italic">{t(`v3.card.${id}.verse`)}</span>
        <span className="ml-1 font-semibold">— {t(`v3.card.${id}.ref`)}</span>
      </div>
      <div className="flex justify-between px-[8%] text-[0.45em] opacity-60">
        <span>Bible Quest</span>
        <span>
          BQ-{CARD_NO[id]}{" "}
          <b className={`font-black ${lookOf(id).mark}`}>{CARD_RARITY[id]}</b>
        </span>
      </div>
    </>
  );
}

export function EnemyCardFace({ id }: { id: EnemyId }) {
  const t = useT();
  const art = ART[id];
  const element = ENEMY_ELEMENT[id];
  const theme = THEME[element];

  if (art) {
    return (
      <>
        <CardFrame frame={theme.frame} rarity={CARD_RARITY[id]}>
          <div className="relative h-full overflow-hidden rounded-[0.6%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static card art */}
            <img
              src={art.src}
              alt={t(`v2.enemy.${id}.name`)}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: art.position,
                transform: `translate(${art.shiftX ?? 0}px, ${art.shiftY ?? 0}px) scale(${art.scale ?? 1})`,
                transformOrigin: art.origin ?? art.position,
              }}
            />
            {lookOf(id).foil > 0 && <Foil element={element} strength={0.12} />}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 via-black/25 to-transparent px-[3%] pb-[8%] pt-[5%]">
              <Header id={id} light />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[1.5%] bg-gradient-to-b from-transparent via-amber-50/85 to-amber-50/95 px-[4%] pb-[3%] pt-[12%] text-stone-900">
              <Body id={id} />
            </div>
          </div>
        </CardFrame>
        <RarityMark
          rarity={CARD_RARITY[id]}
          element={ENEMY_ELEMENT[id]}
          className="left-[1.5%] top-[0.8%]"
        />
      </>
    );
  }

  return (
    <>
      <CardFrame frame={theme.frame} rarity={CARD_RARITY[id]}>
        <div
          className={`relative flex h-full flex-col gap-[2%] rounded-[0.6%] bg-gradient-to-b p-[3%] ${theme.panel}`}
        >
          <Header id={id} />
          <div
            className="relative flex-1 overflow-hidden rounded-[1%] border-[3px] border-yellow-100/80 shadow-inner"
            style={{ background: theme.art }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-[4.2em] drop-shadow-[0_6px_10px_rgb(0_0_0/0.5)]">
              {PORTRAIT[id]}
            </div>
            {lookOf(id).foil > 0 && <Foil element={element} strength={0.6} />}
          </div>
          <Body id={id} />
        </div>
      </CardFrame>
      <RarityMark
        rarity={CARD_RARITY[id]}
        element={ENEMY_ELEMENT[id]}
        className="left-[1.5%] top-[0.8%]"
      />
    </>
  );
}
