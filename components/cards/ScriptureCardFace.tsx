"use client";

// Printed scripture (energy) card: a Bible cover of grained leather (public/cards/scripture-leather.webp, cut from the
// reference artwork), coloured by its energy: Faith deep blue, Attack burgundy, Guard green. No frame: with a picture,
// the art sits on the leather with an even margin and is laid out like a full-art character card; without one the
// verse is set in the middle of the cover.
import { CARDS_V2 } from "@/game/v2/data";
import type { CardId, Element, EnergyKind } from "@/game/v2/types";
import { useT } from "@/game/locale";

export const ENERGY_ELEMENT: Record<EnergyKind, Element> = { faith: "water", attack: "fire", guard: "wood" };
const ENERGY_ICON: Record<EnergyKind, string> = { faith: "✨", attack: "🗡️", guard: "🕊️" };
/** The pale band between the white border and the leather: sky blue, rose, mint. */
const BAND: Record<EnergyKind, string> = { faith: "#8ec5ea", attack: "#e8a2a6", guard: "#9fd8b6" };
/** The cover's ground, lit from the middle. */
const GROUND: Record<EnergyKind, string> = {
  faith: "radial-gradient(ellipse at 50% 45%, #1b3a6b 0%, #0f2347 55%, #050c1c 100%)",
  attack: "radial-gradient(ellipse at 50% 45%, #5c1418 0%, #33090c 55%, #120304 100%)",
  guard: "radial-gradient(ellipse at 50% 45%, #15503a 0%, #0b2e21 55%, #03110b 100%)",
};

/** Card illustrations in /public/cards/scripture (the energy's mark stands in until a card has one). */
const ART: Partial<Record<CardId, string>> = {
  delivered: "/cards/scripture/delivered.jpg",
};

/** Every scripture card once, in print order (the deck repeats some). */
export const SCRIPTURE_CARDS = Object.keys(CARDS_V2) as CardId[];
const CARD_NO = Object.fromEntries(SCRIPTURE_CARDS.map((id, i) => [id, `S${String(i + 1).padStart(2, "0")}`])) as Record<CardId, string>;

export function ScriptureCardFace({ id }: { id: CardId }) {
  const t = useT();
  const { energy: kind, amount, condition } = CARDS_V2[id];
  const art = ART[id];
  const cond = condition ? t(`v2.card.cond.${condition}`) : null;
  const label = (
    <div className="text-[0.55em] font-semibold uppercase tracking-[0.25em] text-[#e2c069] [text-shadow:0_0.04em_0.12em_rgb(0_0_0/0.9)]">
      {t("v3.scripture.card")} · {t(`v2.energy.${kind}.name`)}
    </div>
  );
  const name = <div className="text-[1.15em] font-black leading-tight text-[#e9c96f] [text-shadow:0_0.04em_0.12em_rgb(0_0_0/0.9)]">{t(`v2.card.${id}.name`)}</div>;
  const pill = (
    <div className="rounded-full border border-[#e2c069]/70 bg-black/40 px-[0.8em] py-[0.15em] text-[0.7em] font-black text-[#e9c96f]">
      {ENERGY_ICON[kind]} {t(`v2.energy.${kind}.name`)} +{amount}
    </div>
  );
  const number = <div className="text-[0.45em] tracking-wider text-[#e2c069]/70">Bible Quest · BQ-{CARD_NO[id]}</div>;

  return (
    // A thick white border, a pale band in the energy's colour, then a strip of the leather, then the face (the
    // picture with small rounded corners).
    <div className="absolute inset-0 overflow-hidden rounded-[2.5%] bg-white [container-type:inline-size]">
    <div aria-hidden className="absolute rounded-[2cqw]" style={{ inset: "3cqw", background: BAND[kind] }} />
    <div className="absolute overflow-hidden rounded-[1.5cqw]" style={{ inset: "5cqw", background: GROUND[kind] }}>
      {/* Leather grain, laid over the colour */}
      <div aria-hidden className="absolute inset-0 opacity-55 mix-blend-overlay" style={{ backgroundImage: "url(/cards/scripture-leather.webp)", backgroundSize: "55cqw" }} />

      {art ? (
        // Full-art, laid out like the character cards: the picture fills the face inside an even leather margin, the
        // name sits on a dark fade at the top and the verse on a light fade at the bottom.
        <div className="absolute overflow-hidden rounded-[2.5cqw]" style={{ inset: "2.5cqw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static card art */}
          <img src={art} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-[0.2em] bg-gradient-to-b from-black/70 via-black/35 to-transparent px-[12%] pb-[12%] pt-[6%] text-center">
            {label}
            {name}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-[0.4em] bg-gradient-to-b from-transparent via-amber-50/85 to-amber-50/95 px-[12%] pb-[4%] pt-[14%] text-center text-stone-900">
            <p className="text-[0.64em] leading-snug">{t(`v2.card.${id}.verse`)}</p>
            <p className="text-[0.5em] font-semibold text-amber-800">— {t(`v2.card.${id}.ref`)}</p>
            <div className="rounded-full border border-amber-700/60 bg-white/60 px-[0.8em] py-[0.15em] text-[0.7em] font-black text-amber-900">
              {ENERGY_ICON[kind]} {t(`v2.energy.${kind}.name`)} +{amount}
            </div>
            {cond && <p className="text-[0.5em] text-stone-600">{cond}</p>}
            <div className="text-[0.45em] tracking-wider text-stone-500">Bible Quest · BQ-{CARD_NO[id]}</div>
          </div>
        </div>
      ) : (
        // No picture yet: the energy's mark and the verse, set in the middle of the cover.
        <div className="absolute inset-0 flex flex-col items-center text-center text-[#f3e9d2]">
          <div className="mt-[9%]">{label}</div>
          <div className="flex flex-1 flex-col items-center justify-center gap-[0.6em] px-[13%]">
            <div className="text-[2.6em] leading-none drop-shadow-[0_0.08em_0.2em_rgb(0_0_0/0.8)]">{ENERGY_ICON[kind]}</div>
            {name}
            <div className="h-px w-[40%] bg-gradient-to-r from-transparent via-[#e2c069]/80 to-transparent" />
            <p className="text-[0.64em] leading-snug">{t(`v2.card.${id}.verse`)}</p>
            <p className="text-[0.5em] font-semibold text-[#e2c069]">— {t(`v2.card.${id}.ref`)}</p>
          </div>
          <div className="mb-[2.5%] flex flex-col items-center gap-[0.35em]">
            {pill}
            {cond && <p className="text-[0.5em] text-[#f3e9d2]/80">{cond}</p>}
            {number}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
