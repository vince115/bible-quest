"use client";

// Turning the five cards of an opened pack over, one at a time, then all five together. A tap on a turned card views it
// close up; the next card comes with the Next button.
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

export function PackReveal({ results, onAgain }: { results: Pulled[]; onAgain: () => void }) {
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

  const current = results[at];
  const rare = (i: number) => ["SR", "SSR", "UR", "GR"].includes(CARD_RARITY[results[i].card]);
  // The cards land on the table one after another: a soft thud for each, as it arrives.
  useEffect(() => {
    if (!all) return;
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
  const next = () => {
    if (at < results.length - 1) {
      setAt(at + 1);
      setFlipped(false);
    } else setAll(true);
  };
  // The cards fly one after another into the collection: its link in the side menu, or the menu button on a phone.
  const store = () => {
    const visible = (el: Element | null) => !!el && el.getBoundingClientRect().width > 0;
    const target = [...document.querySelectorAll('a[href="/collection"], header button')].find(visible);
    const to = target?.getBoundingClientRect() ?? new DOMRect(16, 16, 0, 0);
    const toX = to.left + to.width / 2;
    const toY = to.top + to.height / 2;
    setViewing(null);
    setFly(
      results.map((_, i) => {
        const r = cardRefs.current[i]?.getBoundingClientRect();
        return r ? { x: toX - (r.left + r.width / 2), y: toY - (r.top + r.height / 2) } : { x: 0, y: 0 };
      }),
    );
    playSfx("flip");
  };
  const arrived = () => {
    setStored(true);
    playSfx("land");
    // The collection answers with a little bounce.
    const link = [...document.querySelectorAll('a[href="/collection"]')].find((el) => el.getBoundingClientRect().width > 0);
    link?.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
  };
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
              initial={{ opacity: 0, y: 260, scale: 0.4, rotate: i % 2 ? 14 : -14 }}
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
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={onAgain} className={PRIMARY_BUTTON}>
              {t("v3.gacha.again")}
            </button>
            <Link href="/collection" className={SECONDARY_BUTTON}>
              {t("nav.collection")} →
            </Link>
          </div>
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
      <button
        type="button"
        onClick={tap}
        aria-label={flipped ? t("v3.demo.view") : t("v3.gacha.tap")}
        className="relative w-[220px] text-[10.3px] [perspective:1000px]"
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
      <p className="h-5 text-sm text-stone-300">{flipped ? t("v3.gacha.tapToView") : t("v3.gacha.tap")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {flipped && (
          <button onClick={next} className={PRIMARY_BUTTON}>
            {at < results.length - 1 ? `${t("v3.demo.next")} →` : t("v3.gacha.showAll")}
          </button>
        )}
        <button onClick={() => setAll(true)} className="rounded-full border border-stone-500 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10">
          {t("v3.gacha.skip")}
        </button>
      </div>
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
