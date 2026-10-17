"use client";

// Turning the five cards of an opened pack over, one at a time: a tap on a turned card views it close up, and Next sends it
// flying down into its place in the row of five below (the first to the left end), until the row is full. Turning all over
// lays the five out at once. From the row, the five are put away into the collection together.
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/game/sfx";
import { CHARACTER_ELEMENT } from "@/game/v2/data";
import type { CharacterId } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { CharacterCardFace, figureArea } from "@/components/cards/CharacterCardFace";
import { HoloCard } from "@/components/cards/HoloCard";
import { CARD_RARITY, type Rarity } from "@/components/cards/rarity";
import { CARD_BACK } from "@/components/cards/ScriptureCardFace";
import { asset } from "@/game/assets";
import { VIEWER_WIDTH, savedScale, viewerStyle } from "@/components/cards/viewer";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttons";
import type { PackKind } from "@/game/v3/gacha";
import { PackArt } from "./PackArt";
import { STRIP } from "./PackTear";

/** The torn pack the cards are drawn from, one at a time: how much of it shows (its open top), and how far a card sits in it. */
const POUCH_SHOWN = 120;
const TUCKED = 40;
const CARD_H = (220 * 88) / 63;

export interface Pulled {
  card: CharacterId;
  isNew: boolean;
  /** Blessing points given instead of the card: the collection already held as many copies as it may. */
  overflow: number;
}

/** The glow around a card as it turns over: more for the rarer ones. */
const GLOW: Record<Rarity, string> = {
  N: "",
  R: "shadow-[0_0_28px_6px_rgb(56_189_248/0.55)]",
  SR: "shadow-[0_0_34px_8px_rgb(167_139_250/0.7)]",
  SSR: "shadow-[0_0_40px_10px_rgb(251_191_36/0.8)]",
  UR: "shadow-[0_0_46px_12px_rgb(244_114_182/0.85)]",
  GR: "shadow-[0_0_56px_16px_rgb(255_226_122/0.95)]",
};

/** New, a copy, or (when the collection is full of it) the blessing points given instead. */
function Badge({ pulled }: { pulled: Pulled }) {
  const t = useT();
  const { isNew, overflow } = pulled;
  return (
    <span className={`absolute -right-1 -top-1 z-10 whitespace-nowrap rounded-full px-1.5 text-xs font-black shadow ${isNew ? "bg-red-600 text-white" : overflow ? "bg-amber-400 text-stone-950" : "bg-stone-700 text-stone-100"}`}>
      {isNew ? t("v3.gacha.new") : overflow ? t("v3.gacha.full", { n: overflow }) : t("v3.gacha.copy")}
    </span>
  );
}

export function PackReveal({ results, pack, onAgain }: { results: Pulled[]; pack?: PackKind; onAgain: () => void }) {
  const t = useT();
  const [at, setAt] = useState(0); // the card on show
  const [flipped, setFlipped] = useState(false);
  const [all, setAll] = useState(false);
  /** The pulled card viewed close up. */
  const [viewing, setViewing] = useState<number | null>(null);
  /** Putting the cards away: how far each card flies to reach the collection in the menu, then whether they are in. */
  const [fly, setFly] = useState<{ x: number; y: number }[] | null>(null);
  const [stored, setStored] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** One at a time: how the card on show flies down into its place in the row, while it does; and how many are in the row. */
  const [leaving, setLeaving] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [placed, setPlaced] = useState(0);
  const oneRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** The row was filled one card at a time, so the laid-out five need not land again. */
  const [landed, setLanded] = useState(false);

  const current = results[at];
  const rare = (i: number) => ["SR", "SSR", "UR", "GR"].includes(CARD_RARITY[results[i].card]);
  // The cards land on the table one after another: a soft thud for each, as it arrives.
  useEffect(() => {
    if (!all || landed) return;
    const timers = results.map((_, i) => window.setTimeout(() => playSfx(rare(i) ? "rare" : "land"), 220 * i + 380));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- results never change while the pack is shown
  }, [all]);
  // A tap turns the card over; once it is turned, a tap views it close up.
  const tap = () => {
    if (!flipped) {
      setFlipped(true);
      playSfx(rare(at) ? "rare" : "flip");
    } else setViewing(at);
  };
  // Cards fly into the collection: its link in the side menu, or the menu button on a phone. How far an element must go.
  const toCollection = (el: Element | null | undefined) => {
    const visible = (e: Element | null) => !!e && e.getBoundingClientRect().width > 0;
    const target = [...document.querySelectorAll('a[href="/collection"], header button')].find(visible);
    const to = target?.getBoundingClientRect() ?? new DOMRect(16, 16, 0, 0);
    const r = el?.getBoundingClientRect();
    return r ? { x: to.left + to.width / 2 - (r.left + r.width / 2), y: to.top + to.height / 2 - (r.top + r.height / 2) } : { x: 0, y: 0 };
  };
  // The collection answers each arrival with a little bounce.
  const bounce = () => {
    playSfx("land");
    const link = [...document.querySelectorAll('a[href="/collection"]')].find((el) => el.getBoundingClientRect().width > 0);
    link?.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
  };
  // One at a time: Next sends the card on show down into its place in the row, then the next card comes; the last one fills
  // the row, and the five lie laid out.
  const next = () => {
    const from = oneRef.current?.getBoundingClientRect();
    const to = slotRefs.current[at]?.getBoundingClientRect();
    setViewing(null);
    setLeaving(from && to ? { x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2), scale: to.width / from.width } : { x: 0, y: 0, scale: 1 });
  };
  const placedOne = () => {
    playSfx(rare(at) ? "rare" : "land");
    setLeaving(null);
    setPlaced(at + 1);
    if (at < results.length - 1) {
      setAt(at + 1);
      setFlipped(false);
    } else {
      setLanded(true);
      setAll(true);
    }
  };
  // All five on the table fly in one after another.
  const store = () => {
    setViewing(null);
    setFly(results.map((_, i) => toCollection(cardRefs.current[i])));
    playSfx("flip");
  };
  const arrived = () => {
    setStored(true);
    bounce();
  };
  const after = (
    <div className="flex flex-wrap justify-center gap-3">
      <button onClick={onAgain} className={PRIMARY_BUTTON}>
        {t("v3.gacha.again")}
      </button>
      <Link href="/collection" className={SECONDARY_BUTTON}>
        {t("nav.collection")} →
      </Link>
    </div>
  );
  const viewer = viewing !== null && <PulledViewer results={all ? results : [results[viewing]]} start={all ? viewing : 0} onClose={() => setViewing(null)} />;

  if (all) {
    return (
      <div className="flex w-full flex-col items-center gap-5">
        <section aria-label={t("v3.gacha.result")} className="grid w-full max-w-4xl grid-cols-[repeat(auto-fill,minmax(130px,1fr))] justify-items-center gap-x-3 gap-y-5">
          {results.map((pulled, i) => {
            const { card } = pulled;
            return (
            // The cards come in one after another: each flies up from below the screen's middle, turning as it lands.
            <motion.div
              key={`${card}-${i}`}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              initial={landed ? false : { opacity: 0, y: 260, scale: 0.4, rotate: i % 2 ? 14 : -14 }}
              animate={fly ? { opacity: 0, x: fly[i].x, y: fly[i].y, scale: 0.12, rotate: i % 2 ? 20 : -20 } : { opacity: 1, y: 0, scale: 1, rotate: 0 }}
              transition={fly ? { delay: i * 0.12, duration: 0.65, ease: [0.5, 0, 0.75, 0] } : { delay: i * 0.22, type: "spring", stiffness: 170, damping: 17 }}
              onAnimationComplete={() => fly && i === results.length - 1 && arrived()}
              className={`relative z-40 rounded-md ${GLOW[CARD_RARITY[card]]}`}
            >
              <button type="button" onClick={() => !fly && setViewing(i)} aria-label={t("v3.demo.view")} className="block cursor-zoom-in">
                <HoloCard element={CHARACTER_ELEMENT[card]} rarity={CARD_RARITY[card]} effects touchTilt={false} figure={figureArea(card)} className="w-[130px] text-[6.1px]">
                  <CharacterCardFace id={card} />
                </HoloCard>
              </button>
              <Badge pulled={pulled} />
            </motion.div>
            );
          })}
        </section>
        {/* First the cards are put away into the collection; then another pack, or a look at the collection. */}
        {!stored ? (
          <button onClick={store} disabled={!!fly} className={`${PRIMARY_BUTTON} disabled:opacity-60`}>
            {t("v3.gacha.store")}
          </button>
        ) : (
          after
        )}
        {viewer}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="text-sm font-bold tabular-nums text-stone-400">
        {at + 1} / {results.length}
      </div>
      {/* The card is drawn up out of the torn pack, which stays in front of its lower edge; while a card flies to the row,
          nothing clips it. */}
      <div className={`relative flex w-[260px] justify-center ${leaving ? "" : "overflow-hidden"}`} style={{ height: pack ? CARD_H + POUCH_SHOWN - TUCKED : undefined }}>
      <motion.div
        key={at}
        ref={oneRef}
        className="relative z-40 self-start"
        initial={pack ? { y: CARD_H } : { opacity: 0, y: -30, scale: 0.92 }}
        animate={leaving ? { x: leaving.x, y: leaving.y, scale: leaving.scale } : { opacity: 1, x: 0, y: 0, scale: 1 }}
        transition={leaving ? { duration: 0.5, ease: [0.4, 0, 0.2, 1] } : { type: "spring", stiffness: 160, damping: 22, delay: 0.1 }}
        onAnimationComplete={() => leaving && placedOne()}
      >
      <button
        type="button"
        onClick={() => !leaving && tap()}
        aria-label={flipped ? t("v3.demo.view") : t("v3.gacha.tap")}
        className="relative block w-[220px] text-[10.3px] [perspective:1000px]"
        style={{ aspectRatio: "63/88" }}
      >
        <div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : "none" }}>
          {/* The back: the card face down */}
          <div className="absolute inset-0 overflow-hidden rounded-md shadow-xl [backface-visibility:hidden]">
            {/* eslint-disable-next-line @next/next/no-img-element -- card art is a plain file */}
            <img src={asset(CARD_BACK)} alt="" draggable={false} className="h-full w-full select-none object-cover" />
          </div>
          {/* The front */}
          <div className={`absolute inset-0 rounded-md [backface-visibility:hidden] [transform:rotateY(180deg)] ${flipped ? GLOW[CARD_RARITY[current.card]] : ""}`}>
            <HoloCard element={CHARACTER_ELEMENT[current.card]} rarity={CARD_RARITY[current.card]} effects touchTilt={false} figure={figureArea(current.card)} className="w-full text-[10.3px]">
              <CharacterCardFace id={current.card} />
            </HoloCard>
            <Badge pulled={current} />
          </div>
        </div>
      </button>
      </motion.div>
      {pack && (
        <div aria-hidden className={`pointer-events-none absolute bottom-0 left-0 w-[260px] overflow-hidden text-[16.5px] ${leaving ? "z-30" : "z-50"}`} style={{ height: POUCH_SHOWN }}>
          <div style={{ clipPath: `inset(${STRIP}% 0 0 0)`, transform: `translateY(-${STRIP}%)` }}>
            <PackArt pack={pack} />
          </div>
        </div>
      )}
      </div>
      <p className="h-5 text-sm text-stone-300">{flipped ? t("v3.gacha.tapToView") : t("v3.gacha.tap")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {flipped && (
          <button onClick={next} disabled={!!leaving} className={`${PRIMARY_BUTTON} disabled:opacity-60`}>
            {at < results.length - 1 ? `${t("v3.demo.next")} →` : t("v3.gacha.showAll")}
          </button>
        )}
        <button onClick={() => setAll(true)} disabled={!!leaving} className="rounded-full border border-stone-500 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10 disabled:opacity-60">
          {t("v3.gacha.skip")}
        </button>
      </div>
      {/* The row of five the turned cards go into, the first at the left end; a placed card can be viewed close up. */}
      <section aria-label={t("v3.gacha.result")} className="grid w-full max-w-4xl grid-cols-[repeat(auto-fill,minmax(130px,1fr))] justify-items-center gap-x-3 gap-y-5">
        {results.map((pulled, i) => (
          <div
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            className={`relative w-[130px] rounded-md ${i < placed ? GLOW[CARD_RARITY[pulled.card]] : "bg-black/20"}`}
            style={{ aspectRatio: "63/88" }}
          >
            {i < placed && (
              <>
                <button type="button" onClick={() => setViewing(i)} aria-label={t("v3.demo.view")} className="block cursor-zoom-in">
                  <HoloCard element={CHARACTER_ELEMENT[pulled.card]} rarity={CARD_RARITY[pulled.card]} effects touchTilt={false} figure={figureArea(pulled.card)} className="w-[130px] text-[6.1px]">
                    <CharacterCardFace id={pulled.card} />
                  </HoloCard>
                </button>
                <Badge pulled={pulled} />
              </>
            )}
          </div>
        ))}
      </section>
      {viewer}
    </div>
  );
}

/** A pulled card close up, over the page; with all five on the table, the arrows (or ← →) go through them. */
function PulledViewer({ results, start, onClose }: { results: Pulled[]; start: number; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(start);
  const [scale] = useState(savedScale);
  const step = (d: number) => setI((n) => (n + d + results.length) % results.length);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && results.length > 1) setI((n) => (n - 1 + results.length) % results.length);
      else if (e.key === "ArrowRight" && results.length > 1) setI((n) => (n + 1) % results.length);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [onClose, results.length]);
  const pulled = results[i];
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 overflow-y-auto bg-black/80 p-4">
      {results.length > 1 &&
        ([-1, 1] as const).map((d) => (
          <button
            key={d}
            onClick={(e) => {
              e.stopPropagation();
              step(d);
            }}
            aria-label={t(d < 0 ? "v3.demo.prev" : "v3.demo.next")}
            className={`fixed top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-2 border-stone-400 bg-stone-900/70 text-2xl font-bold text-stone-100 hover:bg-white/15 ${d < 0 ? "left-2 sm:left-6" : "right-2 sm:right-6"}`}
          >
            {d < 0 ? "‹" : "›"}
          </button>
        ))}
      <motion.div key={i} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} onClick={(e) => e.stopPropagation()} className={`relative ${VIEWER_WIDTH}`} style={viewerStyle(scale)}>
        <HoloCard element={CHARACTER_ELEMENT[pulled.card]} rarity={CARD_RARITY[pulled.card]} effects figure={figureArea(pulled.card)}>
          <CharacterCardFace id={pulled.card} />
        </HoloCard>
        <Badge pulled={pulled} />
      </motion.div>
      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-3 text-sm text-stone-200">
        {results.length > 1 && <span className="tabular-nums text-stone-400">{i + 1} / {results.length}</span>}
        <button onClick={onClose} className="rounded-full border border-stone-400 px-4 py-1.5 hover:bg-white/10">
          ✕ {t("v3.ui.close")}
        </button>
      </div>
    </div>
  );
}
