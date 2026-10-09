"use client";

// Full-size character card face (TCG layout): name/HP, art, skills, passive, weakness/resistance, verse.
// With an illustration the card is full-art; without one it uses an art window with the character's emoji.
import { CHARACTER_ELEMENT, CHARACTER_SKILLS, MAX_HP, RULES_V2 as R, SKILLS, STORY } from "@/game/v2/data";
import { baseSupportAmount, elementMultiplier } from "@/game/v2/engine";
import type { CharacterId, Element, EnergyKind } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { CardFrame, type Ornament } from "./CardFrame";
import { frameFigure, type Figure } from "./framing";
import { Foil } from "./HoloCard";
import { CARD_RARITY, RARITY, type Rarity } from "./rarity";
import { ElementIcon } from "./ElementIcon";
import { RarityMark } from "./RarityMark";

export const ELEMENTS: Element[] = ["metal", "wood", "water", "fire", "earth", "light", "dark"];
export const ELEMENT_ICON: Record<Element, string> = { metal: "🪙", wood: "🌿", water: "💧", fire: "🔥", earth: "⛰️", light: "☀️", dark: "🌙" };
const ENERGY_ICON: Record<EnergyKind, string> = { faith: "✨", attack: "🗡️", guard: "🕊️" };
const PORTRAIT: Record<CharacterId, string> = { david: "🪨", samuel: "📜", jonathan: "🤝", adam: "🌳", eve: "🌸", archerP: "🏹", bearerP: "🛡️", goliathP: "🗿", serpentP: "🐍" };
const CARD_NO: Record<CharacterId, string> = { david: "001", samuel: "002", jonathan: "003", adam: "004", eve: "005", archerP: "E03", bearerP: "E02", goliathP: "E01", serpentP: "E04" };
/** Card illustrations in /public/cards and where the figure stands in each (see framing.ts). */
const ART: Partial<Record<CharacterId, { src: string; figure: Figure }>> = {
  david: { src: "/cards/david.jpg", figure: { cx: 0.41, head: 0.176, feet: 0.947 } },
  samuel: { src: "/cards/samuel.jpg", figure: { cx: 0.435, head: 0.112, feet: 0.952 } },
  jonathan: { src: "/cards/jonathan.jpg", figure: { cx: 0.37, head: 0.161, feet: 0.947 } },
  adam: { src: "/cards/adam.jpg", figure: { cx: 0.43, head: 0.223, feet: 0.963 } },
  eve: { src: "/cards/eve.jpg", figure: { cx: 0.44, head: 0.215, feet: 0.928 } },
  // Enemy cards drawn by the player: same art as their enemy versions, except the Serpent.
  goliathP: { src: "/cards/goliath.jpg", figure: { cx: 0.385, head: 0.22, feet: 0.943 } },
  serpentP: { src: "/cards/serpent-player.jpg", figure: { cx: 0.55, head: 0.2, feet: 0.931, gaze: "right" } },
  archerP: { src: "/cards/archer.jpg", figure: { cx: 0.48, head: 0.151, feet: 0.947 } },
  bearerP: { src: "/cards/bearer.jpg", figure: { cx: 0.46, head: 0.156, feet: 0.947 } },
};

/** Card colours per element: outer frame (deep, so the gold ornaments stand out), inner panel, art backdrop. */
export const THEME: Record<Element, { frame: string; panel: string; art: string }> = {
  light: {
    frame: "from-amber-700 via-amber-900 to-stone-950",
    panel: "from-amber-50 to-yellow-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #fff7d1 0%, #fcd34d 30%, #b45309 75%, #451a03 100%)",
  },
  dark: {
    frame: "from-violet-800 via-indigo-950 to-black",
    panel: "from-violet-50 to-indigo-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #ddd6fe 0%, #7c3aed 35%, #1e1b4b 100%)",
  },
  water: {
    frame: "from-sky-800 via-blue-950 to-slate-950",
    panel: "from-sky-50 to-blue-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #e0f2fe 0%, #38bdf8 35%, #1e3a8a 100%)",
  },
  fire: {
    frame: "from-red-800 via-red-950 to-stone-950",
    panel: "from-orange-50 to-red-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #ffedd5 0%, #fb923c 35%, #7f1d1d 100%)",
  },
  wood: {
    frame: "from-emerald-800 via-emerald-950 to-stone-950",
    panel: "from-lime-50 to-emerald-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #ecfccb 0%, #4ade80 35%, #064e3b 100%)",
  },
  metal: {
    frame: "from-slate-500 via-slate-800 to-zinc-950",
    panel: "from-slate-50 to-zinc-200 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #f8fafc 0%, #cbd5e1 30%, #475569 70%, #0f172a 100%)",
  },
  earth: {
    frame: "from-yellow-800 via-stone-800 to-stone-950",
    panel: "from-amber-50 to-stone-200 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #fef3c7 0%, #d6a35c 35%, #78350f 75%, #292524 100%)",
  },
};

/** Name, title, HP and element. */
function Header({ id, light }: { id: CharacterId; light?: boolean }) {
  const t = useT();
  return (
    <div className={`flex items-end justify-between px-[6%] ${light ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]" : ""}`}>
      <div className="min-w-0">
        <div className={`text-[0.6em] font-semibold uppercase tracking-wider ${light ? "opacity-90" : "opacity-60"}`}>{t(`v3.card.${id}.title`)}</div>
        <div className="truncate text-[1.35em] font-black leading-none">{t(`char.${id}.name`)}</div>
      </div>
      {/* HP and element sit in the face's top-right corner, where the battle HP badge covers them. */}
      <div className="absolute right-[2%] top-[calc(2.2%+10px)] flex items-baseline gap-1">
        <span className="text-[0.6em] font-bold">HP</span>
        <span className="text-[1.6em] font-black leading-none">{MAX_HP[id]}</span>
        <span className="relative -top-[3px] text-[1.3em] leading-none"><ElementIcon element={CHARACTER_ELEMENT[id]} /></span>
      </div>
    </div>
  );
}

/** Passive, skills, weakness/resistance, verse and card number. */
function Body({ id, compact, rarity }: { id: CharacterId; compact?: boolean; rarity: Rarity }) {
  const t = useT();
  const element = CHARACTER_ELEMENT[id];
  const weak = ELEMENTS.filter((e) => elementMultiplier(e, element, true) > 1);
  const resist = ELEMENTS.filter((e) => elementMultiplier(e, element, true) < 1);
  return (
    <>
      {id === "david" && (
        <div className="rounded-md border border-red-700/30 bg-red-50/70 px-[3%] py-[1.5%] text-[0.62em] leading-snug">
          <span className="mr-1 rounded bg-red-700 px-1 font-bold text-white">{t("v3.card.passive")}</span>
          {t("v2.passive.david")}
        </div>
      )}
      {/* Story bonus: what this character gains in their own Bible story */}
      {STORY[id] && (
        <div className="rounded-md border border-amber-600/40 bg-amber-50/70 px-[3%] py-[1.2%] text-[0.58em] leading-snug">
          <span className="mr-1 rounded bg-amber-600 px-1 font-bold text-white">{t("v3.story.label")}</span>
          {t(`v3.story.${id}`)}
        </div>
      )}

      <div className={`flex flex-col justify-center ${compact ? "gap-[1.5%]" : "flex-1 gap-[3%]"}`}>
        {CHARACTER_SKILLS[id].map((skill) => {
          const def = SKILLS[skill];
          const amount = def.damage ?? baseSupportAmount(skill);
          return (
            <div key={skill} className={`border-b border-stone-900/15 last:border-0 ${compact ? "pb-[1%]" : "pb-[2%]"}`}>
              <div className="flex items-center gap-[3%]">
                <span className="w-[22%] shrink-0 text-[0.8em] tracking-tighter">{ENERGY_ICON[def.kind].repeat(def.cost)}</span>
                <span className="flex-1 text-[0.95em] font-black">{t(`v2.skill.${skill}.name`)}</span>
                <span className="text-[1.15em] font-black">{def.damage ? amount : amount > 0 && `+${amount}`}</span>
              </div>
              <div className="pl-[25%] text-[0.58em] leading-snug opacity-75">{t(`v2.skill.${skill}.desc`, { n: amount })}</div>
            </div>
          );
        })}
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
          BQ-{CARD_NO[id]} <b className={`font-black ${RARITY[rarity].mark}`}>{rarity}</b>
        </span>
      </div>
    </>
  );
}

/** rarity: print the card at another rarity than its own (the card demo previews every rarity). */
export function CharacterCardFace({ id, ornament, rarity: printed }: { id: CharacterId; ornament?: Ornament; rarity?: Rarity }) {
  const rarity = printed ?? CARD_RARITY[id];
  const t = useT();
  const art = ART[id];
  const element = CHARACTER_ELEMENT[id];
  const theme = THEME[element];

  // Full-art card: the illustration fills the whole card; text sits on a fade at the top and bottom.
  if (art) {
    return (
      <>
        <CardFrame frame={theme.frame} rarity={rarity} ornament={ornament}>
        <div className="relative h-full overflow-hidden rounded-[0.6%]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static card art; no resizing needed for a demo */}
          <img
            src={art.src}
            alt={t(`char.${id}.name`)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={frameFigure(art.figure)}
          />
          {/* Real art gets a light foil so the illustration stays readable. */}
          {RARITY[rarity].foil > 0 && <Foil element={element} strength={0.12} />}
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 via-black/25 to-transparent px-[3%] pb-[8%] pt-[5%]">
            <Header id={id} light />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[1.5%] bg-gradient-to-b from-transparent via-amber-50/85 to-amber-50/95 px-[4%] pb-[3%] pt-[12%] text-stone-900">
            <Body id={id} compact rarity={rarity} />
          </div>
        </div>
        </CardFrame>
        <RarityMark rarity={rarity} element={element} className="left-[1.5%] top-[0.8%]" />
      </>
    );
  }

  return (
    <>
      <CardFrame frame={theme.frame} rarity={rarity} ornament={ornament}>
      <div className={`relative flex h-full flex-col gap-[2%] rounded-[0.6%] bg-gradient-to-b p-[3%] ${theme.panel}`}>
        <Header id={id} />

        {/* Art window (holo) */}
        <div className="relative aspect-[5/3.4] overflow-hidden rounded-[1%] border-[3px] border-yellow-100/80 shadow-inner" style={{ background: theme.art }}>
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{ background: "repeating-conic-gradient(from 0deg at 50% 38%, rgb(255 255 255 / 0.35) 0deg 6deg, transparent 6deg 18deg)" }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[4.2em] drop-shadow-[0_6px_10px_rgb(0_0_0/0.5)]">{PORTRAIT[id]}</div>
          {RARITY[rarity].foil > 0 && <Foil element={element} strength={0.8} />}
        </div>
        <div className="-mt-[1%] text-center text-[0.55em] italic opacity-70">{t(`v3.card.${id}.flavor`)}</div>

        <Body id={id} rarity={rarity} />
      </div>
      </CardFrame>
      <RarityMark rarity={rarity} element={element} className="left-[1.5%] top-[0.8%]" />
    </>
  );
}
