"use client";

// Drawing the five cards of an opened pack, one at a time: a tap on the card in the pack draws it out, and it turns over in
// the air as it flies into its place in the row of five; then the next card comes up. A card in the row views close up.
// Turning all over lays the five out at once. From the row, the five are put away into the collection together.
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

/**
 * Drawing the cards one at a time out of the torn pack: the pack as wide as on the tearing screen, whole but for its torn
 * strip; the card a little narrower, its lower part tucked inside the pack until it is drawn.
 */
const PACK_W = 220;
const PACK_BODY_H = ((PACK_W * 14) / 9) * (1 - STRIP / 100);
const CARD_W = 200;
const CARD_H = (CARD_W * 88) / 63;
const TUCKED = 70;
const STAGE_H = CARD_H + PACK_BODY_H - TUCKED;

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
  // One at a time: a tap draws the card out of the pack; it turns over in the air and flies into its place in the row, then
  // the next card comes up. The last one fills the row, and the five lie laid out.
  const draw = () => {
    if (leaving) return;
    const from = oneRef.current?.getBoundingClientRect();
    const to = slotRefs.current[at]?.getBoundingClientRect();
    setViewing(null);
    setFlipped(true);
    playSfx(rare(at) ? "rare" : "flip");
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
    // On a wide screen the row of five stands to the left of the pack (a turned card flies left into it); on a phone, below.
    <div className="flex w-full flex-col-reverse items-center gap-6 lg:flex-row lg:items-center lg:justify-center lg:gap-12">
      {/* The row of five the turned cards go into, the first at the start; a placed card can be viewed close up. */}
      <section aria-label={t("v3.gacha.result")} className="grid grid-cols-5 gap-2 lg:grid-cols-3 lg:gap-3">
        {results.map((pulled, i) => (
          <div
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            className={`relative w-[60px] rounded-md sm:w-[100px] ${i < placed ? GLOW[CARD_RARITY[pulled.card]] : "bg-black/20"}`}
            style={{ aspectRatio: "63/88" }}
          >
            {i < placed && (
              <>
                <button type="button" onClick={() => setViewing(i)} aria-label={t("v3.demo.view")} className="block w-full cursor-zoom-in">
                  <HoloCard element={CHARACTER_ELEMENT[pulled.card]} rarity={CARD_RARITY[pulled.card]} effects touchTilt={false} figure={figureArea(pulled.card)} className="w-full text-[2.8px] sm:text-[4.7px]">
                    <CharacterCardFace id={pulled.card} />
                  </HoloCard>
                </button>
                <Badge pulled={pulled} />
              </>
            )}
          </div>
        ))}
      </section>

      <div className="flex flex-col items-center gap-3">
        <div className="text-sm font-bold tabular-nums text-stone-400">
          {at + 1} / {results.length}
        </div>
        {/* The torn pack moves down from where it was torn and stays whole on the table; each card is drawn up out of it, the
            pack in front of the card's lower edge. While a card flies to the row nothing clips it. */}
        <div className={`relative ${leaving ? "" : "overflow-hidden"}`} style={{ width: PACK_W, height: STAGE_H }}>
          <motion.div
            key={at}
            ref={oneRef}
            className="absolute top-0 z-40"
            style={{ left: (PACK_W - CARD_W) / 2 }}
            initial={pack ? { y: CARD_H } : { opacity: 0, y: -30, scale: 0.92 }}
            // Drawn out: up out of the pack first, turning over, then across into its place in the row.
            animate={leaving ? { x: [0, 0, leaving.x], y: [0, -CARD_H * 0.55, leaving.y], scale: [1, 1.04, leaving.scale] } : { opacity: 1, x: 0, y: 0, scale: 1 }}
            transition={leaving ? { duration: 0.95, times: [0, 0.4, 1], ease: "easeInOut" } : { type: "spring", stiffness: 160, damping: 22, delay: at === 0 ? 0.75 : 0.1 }}
            onAnimationComplete={() => leaving && placedOne()}
          >
            <button
              type="button"
              onClick={draw}
              aria-label={t("v3.gacha.draw")}
              className="relative block [perspective:1000px]"
              style={{ width: CARD_W, aspectRatio: "63/88", fontSize: `${(10.3 * CARD_W) / 220}px` }}
            >
              <div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : "none" }}>
                {/* The back: the card face down */}
                <div className="absolute inset-0 overflow-hidden rounded-md shadow-xl [backface-visibility:hidden]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- card art is a plain file */}
                  <img src={asset(CARD_BACK)} alt="" draggable={false} className="h-full w-full select-none object-cover" />
                </div>
                {/* The front */}
                <div className={`absolute inset-0 rounded-md [backface-visibility:hidden] [transform:rotateY(180deg)] ${flipped ? GLOW[CARD_RARITY[current.card]] : ""}`}>
                  <HoloCard element={CHARACTER_ELEMENT[current.card]} rarity={CARD_RARITY[current.card]} effects touchTilt={false} figure={figureArea(current.card)} className="w-full">
                    <CharacterCardFace id={current.card} />
                  </HoloCard>
                  <Badge pulled={current} />
                </div>
              </div>
            </button>
          </motion.div>
          {pack && (
            // The same pack as on the tearing screen (layoutId): it glides down here from where it was torn.
            <motion.div layoutId="torn-pack" aria-hidden className={`pointer-events-none absolute bottom-0 left-0 text-[14px] ${leaving ? "z-30" : "z-50"}`} style={{ width: PACK_W }}>
              <div style={{ clipPath: `inset(${STRIP}% 0 0 0)` }}>
                <PackArt pack={pack} />
              </div>
            </motion.div>
          )}
        </div>
        <p className="h-5 text-center text-sm text-stone-300">{placed > 0 ? t("v3.gacha.drawMore") : t("v3.gacha.draw")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => setAll(true)} disabled={!!leaving} className="rounded-full border border-stone-500 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10 disabled:opacity-60">
            {t("v3.gacha.skip")}
          </button>
        </div>
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
