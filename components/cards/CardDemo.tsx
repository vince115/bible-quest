"use client";

// /card-demo: every card, highest rarity first, to compare frames and effects. Click a card to view it full size.
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CHARACTER_ELEMENT, ENEMY_ELEMENT } from "@/game/v2/data";
import type { CharacterId, EnemyId } from "@/game/v2/types";
import { safeStorage, useT } from "@/game/locale";
import { CharacterCardFace } from "./CharacterCardFace";
import { EnemyCardFace } from "./EnemyCardFace";
import { HoloCard } from "./HoloCard";
import { CARD_RARITY, type Rarity } from "./rarity";

const RARITY_ORDER: Rarity[] = ["N", "R", "SR", "SSR", "UR"];

const CARDS: { id: CharacterId | EnemyId; enemy?: boolean }[] = [
  { id: "david" },
  { id: "goliath", enemy: true },
  { id: "samuel" },
  { id: "jonathan" },
  { id: "adam" },
  { id: "eve" },
  { id: "bearer", enemy: true },
  { id: "archer", enemy: true },
  { id: "serpent", enemy: true },
  { id: "serpentP" },
];

type Viewed = { id: CharacterId | EnemyId; enemy?: boolean; rarity?: Rarity };

function CardFace({ id, enemy, rarity }: Viewed) {
  return enemy ? <EnemyCardFace id={id as EnemyId} /> : <CharacterCardFace id={id as CharacterId} rarity={rarity} />;
}

/**
 * Viewer size as a share of a real Pokémon card (63 × 88 mm). CSS millimetres run small on the designer's 24-inch
 * screen: a real card measured 115% of 63mm, so that is 100% here. Adjustable and remembered.
 */
const REAL_SIZE = "calc(63mm * 1.15)";
const SCALE_KEY = "bq-card-demo-real";
const SCALE_DEFAULT = 1.75;
const SCALE_STEP = 0.1;

const elementOf = ({ id, enemy }: Viewed) => (enemy ? ENEMY_ELEMENT[id as EnemyId] : CHARACTER_ELEMENT[id as CharacterId]);

export function CardDemo() {
  const t = useT();
  const [effects, setEffects] = useState(true);
  const [viewing, setViewing] = useState<Viewed | null>(null);
  // Read once on the client; the scale only shows in the viewer, which never renders on the server.
  const [scale, setScale] = useState(() => (typeof window === "undefined" ? 1 : Number(safeStorage.getItem(SCALE_KEY)) || SCALE_DEFAULT));

  const adjust = (next: (current: number) => number) =>
    setScale((current) => {
      const clamped = Math.round(Math.min(4, Math.max(0.5, next(current))) * 100) / 100;
      safeStorage.setItem(SCALE_KEY, String(clamped));
      return clamped;
    });

  useEffect(() => {
    if (!viewing) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setViewing(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [viewing]);

  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_30%,#3b2f1a_0%,#1c1917_55%,#0c0a09_100%)] px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-bold">{t("v3.demo.title")}</h1>
        <p className="mt-1 text-sm text-stone-400">{t("v3.demo.hint")}</p>
      </div>
      <div className="flex max-w-full snap-x snap-mandatory gap-6 overflow-x-auto px-2 py-4">
        {CARDS.map((card) => (
          <div key={card.id} className="flex shrink-0 snap-center flex-col items-center gap-2">
            <button type="button" onClick={() => setViewing(card)} aria-label={t("v3.demo.view")} className="cursor-zoom-in">
              <HoloCard element={elementOf(card)} effects={effects} rarity={CARD_RARITY[card.id]} className="w-[280px] text-[13px] sm:w-[300px] sm:text-[14px]">
                <CardFace {...card} />
              </HoloCard>
            </button>
            <span className="text-sm font-black tracking-widest text-amber-200">{CARD_RARITY[card.id]}</span>
          </div>
        ))}
      </div>
      {/* Every rarity on one card, including R and UR which no card uses yet */}
      <div className="text-center">
        <h2 className="text-lg font-bold">{t("v3.demo.rarities")}</h2>
      </div>
      <div className="flex max-w-full snap-x snap-mandatory gap-6 overflow-x-auto px-2 py-4">
        {RARITY_ORDER.map((r) => (
          <div key={r} className="flex shrink-0 snap-center flex-col items-center gap-2">
            <button type="button" onClick={() => setViewing({ id: "david", rarity: r })} aria-label={t("v3.demo.view")} className="cursor-zoom-in">
              <HoloCard element={CHARACTER_ELEMENT.david} effects={effects} rarity={r} className="w-[220px] text-[10.3px] sm:w-[240px] sm:text-[11.2px]">
                <CharacterCardFace id="david" rarity={r} />
              </HoloCard>
            </button>
            <span className="text-sm font-black tracking-widest text-amber-200">{r}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setEffects(!effects)}
          className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${effects ? "border-amber-300 bg-amber-500 text-stone-950" : "border-stone-500 text-stone-300"}`}
        >
          {effects ? t("v3.demo.effectsOn") : t("v3.demo.effectsOff")}
        </button>
      </div>

      {/* Sized from a real card (100% = actual size), 175% by default; capped to the screen so the card always fits. */}
      {viewing && (
        <div onClick={() => setViewing(null)} className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
          <motion.div
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="[--w:min(calc(var(--real)*var(--cal)),92vw,calc((100dvh-7rem)*63/88))]"
            style={{ "--real": REAL_SIZE, "--cal": scale, width: "var(--w)", fontSize: "calc(var(--w) * 0.0467)" } as React.CSSProperties}
          >
            <HoloCard element={elementOf(viewing)} effects={effects} rarity={viewing.rarity ?? CARD_RARITY[viewing.id]}>
              <CardFace {...viewing} />
            </HoloCard>
          </motion.div>
          <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center justify-center gap-2 text-sm text-stone-200">
            <span className="text-stone-400">{t("v3.demo.calibrate")}</span>
            <button onClick={() => adjust((v) => v - SCALE_STEP)} aria-label="−" className="h-8 w-8 rounded-full border border-stone-400 font-bold hover:bg-white/10">
              −
            </button>
            <span className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <button onClick={() => adjust((v) => v + SCALE_STEP)} aria-label="+" className="h-8 w-8 rounded-full border border-stone-400 font-bold hover:bg-white/10">
              +
            </button>
            <button onClick={() => adjust(() => 1)} className="rounded-full border border-stone-500 px-3 py-1 text-xs text-stone-300 hover:bg-white/10">
              1:1
            </button>
            <button onClick={() => adjust(() => SCALE_DEFAULT)} className="rounded-full border border-stone-500 px-3 py-1 text-xs text-stone-300 hover:bg-white/10">
              {t("v3.demo.reset")}
            </button>
            <button onClick={() => setViewing(null)} className="rounded-full border border-stone-400 px-4 py-1.5 hover:bg-white/10">
              ✕ {t("v3.ui.close")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
