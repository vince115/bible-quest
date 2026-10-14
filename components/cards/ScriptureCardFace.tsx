"use client";

// Printed scripture (energy) card: a Bible cover of grained leather (public/cards/scripture-leather.webp, cut from the
// reference artwork), coloured by its energy: Faith deep blue, Attack burgundy, Guard green. No frame: with a picture,
// the art sits on the leather with an even margin and is laid out like a full-art character card; without one the
// verse is set in the middle of the cover.
import { CARDS_V2 } from "@/game/v2/data";
import type { CardId, Element, EnergyKind } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { EnergyIcon } from "./EnergyIcon";
import { asset } from "@/game/assets";

export const ENERGY_ELEMENT: Record<EnergyKind, Element> = { faith: "water", attack: "fire", guard: "wood" };
export { ENERGY_ICON_SRC } from "./EnergyIcon";
/** The cover's ground, lit from the middle. */
const GROUND: Record<EnergyKind, string> = {
  faith: "radial-gradient(ellipse at 50% 45%, #3f80dc 0%, #205ec0 55%, #15459e 100%)",
  attack: "radial-gradient(ellipse at 50% 45%, #c63e43 0%, #9b1e23 55%, #6f161c 100%)",
  guard: "radial-gradient(ellipse at 50% 45%, #249e5a 0%, #15733f 55%, #0f5930 100%)",
};

/** The gilt frame's tint: the energy's colour, at half strength. */
const FRAME_TINT: Record<EnergyKind, string> = { faith: "#3f80dc", attack: "#c63e43", guard: "#249e5a" };

/** Card illustrations in /public/cards/scripture (all 12 scripture cards have their full art). */
const ART: Record<CardId, string> = {
  delivered: "/cards/scripture/delivered.jpg",
  fightForYou: "/cards/scripture/fightForYou.jpg",
  spiritSword: "/cards/scripture/spiritSword.jpg",
  bestrong: "/cards/scripture/bestrong.jpg",
  assurance: "/cards/scripture/assurance.jpg",
  trains: "/cards/scripture/trains.jpg",
  wings: "/cards/scripture/wings.jpg",
  stones: "/cards/scripture/stones.jpg",
  threefoldCord: "/cards/scripture/threefoldCord.jpg",
  renewed: "/cards/scripture/renewed.jpg",
  shepherd: "/cards/scripture/shepherd.jpg",
  allThings: "/cards/scripture/allThings.jpg",
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
    <div className="text-[0.55em] font-semibold uppercase tracking-[0.25em] text-[#f5eedc] [text-shadow:0_0.04em_0.14em_rgb(0_0_0/0.95)]">
      {t("v3.scripture.card")} · {t(`v2.energy.${kind}.name`)}
    </div>
  );
  const name = <div className="text-[1.15em] font-black leading-tight text-[#fefcf5] [text-shadow:0_0.05em_0.16em_rgb(0_0_0/0.95)]">{t(`v2.card.${id}.name`)}</div>;
  const pill = (
    <div className="flex items-center gap-[0.25em] rounded-full border border-[#f5eedc]/70 bg-black/40 px-[0.8em] py-[0.15em] text-[0.7em] font-black text-[#fefcf5]">
      <EnergyIcon kind={kind} className="h-[1.1em] w-[1.1em] object-contain drop-shadow" />
      <span>{t(`v2.energy.${kind}.name`)} +{amount}</span>
    </div>
  );
  const number = <div className="text-[0.45em] tracking-wider text-[#f5eedc]/75">Bible Quest · BQ-{CARD_NO[id]}</div>;

  return (
    // A white border with the gilt rule running round it, then a strip of the leather, then the face (the picture
    // with small rounded corners).
    <div className="absolute inset-0 overflow-hidden rounded-[2.5%] bg-white [container-type:inline-size]">
    {/* The floral frame (細金線花框) is drawn in the card's own colour at 50% see-through, cut out with the frame
        image itself; laid over the gold it muddied the blue, so it stands alone on the white border. */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 opacity-50 drop-shadow-[0_1px_1px_rgb(0_0_0/0.18)]"
      style={{ backgroundColor: FRAME_TINT[kind], WebkitMaskImage: "url(/cards/scripture-gilt-frame.png)", maskImage: "url(/cards/scripture-gilt-frame.png)", WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}
    />
    {/* 色彩帶（皮革底層）：外圈到內圈具備 50% 半透明黑色漸層，模擬外圍白框落下的相框陰影 (Photo Frame Inner Drop Shadow) */}
    <div
      className="absolute overflow-hidden rounded-[3.5cqw]"
      style={{
        inset: "6.3cqw",
        background: GROUND[kind],
        boxShadow: "inset 0 0 1.35cqw 0.2cqw rgb(0 0 0 / 0.5), inset 0 0.25cqw 0.6cqw rgb(0 0 0 / 0.35)",
      }}
    >
      {/* Leather grain, laid over the colour */}
      <div aria-hidden className="absolute inset-0 opacity-55 mix-blend-overlay" style={{ backgroundImage: "url(/cards/scripture-leather.webp)", backgroundSize: "55cqw" }} />

      {art ? (
        <div className="absolute overflow-hidden rounded-[2.2cqw]" style={{ inset: "1.35cqw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static card art */}
          <img src={asset(art)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-[0.4em] bg-gradient-to-b from-black/75 via-black/35 to-transparent px-[5%] pb-[12%] pt-[5%]">
            <div className="min-w-0 flex flex-col items-start text-left">
              {label}
              {name}
            </div>
            <div className="shrink-0 flex items-center pt-[0.1em]">
              <div className="flex items-center gap-[0.25em] rounded-full border border-[#f5eedc]/70 bg-black/45 px-[0.6em] py-[0.12em] text-[0.68em] font-black text-[#fefcf5] shadow-[0_2px_4px_rgb(0_0_0/0.45)] backdrop-blur-[2px]">
                <EnergyIcon kind={kind} className="h-[1.15em] w-[1.15em] object-contain drop-shadow" />
                <span>{t(`v2.energy.${kind}.name`)}</span>
                <span className="text-[#ffe28a]">+{amount}</span>
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-[0.35em] bg-gradient-to-b from-transparent via-amber-50/85 to-amber-50/95 px-[10%] pb-[4%] pt-[14%] text-center text-stone-900">
            <p className="text-[0.66em] leading-snug">{t(`v2.card.${id}.verse`)}</p>
            <p className="text-[0.52em] font-semibold text-amber-800">— {t(`v2.card.${id}.ref`)}</p>
            {cond && <p className="rounded-full bg-amber-900/10 px-[0.7em] py-[0.1em] text-[0.5em] font-bold text-amber-900">{cond}</p>}
            <div className="text-[0.45em] tracking-wider text-stone-500">Bible Quest · BQ-{CARD_NO[id]}</div>
          </div>
        </div>
      ) : (
        // No picture yet: the energy's mark and the verse, set in the middle of the cover.
        <div className="absolute inset-0 flex flex-col items-center text-center text-[#f3e9d2]">
          <div className="mt-[9%]">{label}</div>
          <div className="flex flex-1 flex-col items-center justify-center gap-[0.6em] px-[13%]">
            <div className="flex items-center justify-center">
              <EnergyIcon kind={kind} className="h-[2.8em] w-[2.8em] object-contain drop-shadow-[0_0.08em_0.2em_rgb(0_0_0/0.8)]" />
            </div>
            {name}
            <div className="h-px w-[40%] bg-gradient-to-r from-transparent via-[#f5eedc]/80 to-transparent" />
            <p className="text-[0.64em] leading-snug">{t(`v2.card.${id}.verse`)}</p>
            <p className="text-[0.5em] font-semibold text-[#f5eedc]">— {t(`v2.card.${id}.ref`)}</p>
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

/** The picture on the back of every card: the cover of a dark leather Bible with gilt ornament and the Nativity at its centre. */
export const CARD_BACK = "/backs/bible.jpg";

/**
 * The back of a card, as seen on the deck pile: the picture of a leather Bible cover (public/backs), filling the card
 * with its corners rounded like the faces.
 */
export function ScriptureCardBack() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[2.5%] bg-[#12162a]">
      {/* eslint-disable-next-line @next/next/no-img-element -- card art is a plain file */}
      <img src={asset(CARD_BACK)} alt="" draggable={false} className="h-full w-full select-none object-cover" />
    </div>
  );
}
