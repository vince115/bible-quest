"use client";

// /collection: every character card in story order. The ones the player owns are shown (with how many copies);
// the rest are locked, showing only their rarity, so there is something to chase.
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { CHARACTER_ELEMENT } from "@/game/v2/data";
import type { CharacterId } from "@/game/v2/types";
import { safeStorage, useT } from "@/game/locale";
import { useProgressStore } from "@/game/v3/progress";
import { characterSearchText } from "@/components/cards/CardDemo";
import { CharacterCardFace, figureArea } from "@/components/cards/CharacterCardFace";
import { HoloCard } from "@/components/cards/HoloCard";
import { CARD_RARITY, type Rarity } from "@/components/cards/rarity";
import { TIMELINE } from "@/components/cards/timeline";
import { SCALE_DEFAULT, SCALE_KEY, SCALE_STEP, StoryPanel, VIEWER_WIDTH, savedScale, viewerStyle } from "@/components/cards/viewer";

const ALL_CARDS = TIMELINE.filter((id): id is CharacterId => id in CHARACTER_ELEMENT);
const RARITY_TABS = ["UR", "SSR", "SR", "R", "N"] as const;

export function CollectionScreen() {
  const t = useT();
  const collection = useProgressStore((s) => s.collection);
  // Read from this browser after mount, so the prerendered page matches.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve(useProgressStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [viewing, setViewing] = useState<CharacterId | null>(null);

  const count = (id: CharacterId) => collection[id] ?? 0;
  const kinds = ALL_CARDS.filter((id) => count(id) > 0).length;
  const copies = ALL_CARDS.reduce((n, id) => n + count(id), 0);

  const q = query.trim().toLowerCase();
  const matching = ALL_CARDS.filter((id) => (!q || characterSearchText(id).includes(q)) && (!ownedOnly || count(id) > 0));
  const shown = rarity === "all" ? matching : matching.filter((id) => CARD_RARITY[id] === rarity);
  const ownedIn = (list: CharacterId[]) => list.filter((id) => count(id) > 0).length;

  // The viewer steps through the owned cards on screen (the current search and rarity), wrapping at either end.
  const viewable = shown.filter((id) => count(id) > 0);
  const step = (d: number) =>
    setViewing((cur) => {
      const i = cur ? viewable.indexOf(cur) : -1;
      return i < 0 || viewable.length < 2 ? cur : viewable[(i + d + viewable.length) % viewable.length];
    });
  useEffect(() => {
    if (!viewing) return;
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewing(null);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  // The card size is the card demo's saved one (shared with it), adjustable here as there.
  const [scale, setScale] = useState(() => savedScale() || SCALE_DEFAULT);
  const adjust = (next: (current: number) => number) =>
    setScale((current) => {
      const clamped = Math.round(Math.min(4, Math.max(0.5, next(current))) * 100) / 100;
      safeStorage.setItem(SCALE_KEY, String(clamped));
      return clamped;
    });

  return (
    <main className="flex min-h-[calc(100dvh-3rem)] flex-1 flex-col items-center gap-5 bg-gradient-to-b from-stone-900 via-stone-950 to-black px-4 py-8">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("v3.collection.title")}</h1>
        <p className="mt-2 text-sm text-stone-400">{ready ? t("v3.collection.progress", { n: kinds, m: ALL_CARDS.length, c: copies }) : " "}</p>
        <div className="mx-auto mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-stone-800 ring-1 ring-black/50">
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${ready ? (kinds / ALL_CARDS.length) * 100 : 0}%` }} />
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("v3.demo.search")}
        aria-label={t("v3.demo.search")}
        className="w-full max-w-sm rounded-full border-2 border-stone-500 bg-stone-900/80 px-4 py-2 text-base text-stone-100 placeholder:text-stone-500 focus:border-amber-300 focus:outline-none sm:text-sm"
      />
      <div role="tablist" aria-label={t("v3.demo.filter")} className="flex flex-wrap justify-center gap-2">
        {(["all", ...RARITY_TABS] as const).map((f) => {
          const list = f === "all" ? matching : matching.filter((id) => CARD_RARITY[id] === f);
          return (
            <button
              key={f}
              role="tab"
              aria-selected={rarity === f}
              onClick={() => setRarity(f)}
              className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${rarity === f ? "border-amber-300 bg-amber-500 text-stone-950" : "border-stone-500 text-stone-200 hover:bg-white/10"}`}
            >
              {f === "all" ? t("v3.demo.all") : f} <span className="opacity-60">{ready ? ownedIn(list) : 0}/{list.length}</span>
            </button>
          );
        })}
        <button
          role="switch"
          aria-checked={ownedOnly}
          onClick={() => setOwnedOnly(!ownedOnly)}
          className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${ownedOnly ? "border-emerald-300 bg-emerald-600 text-white" : "border-stone-500 text-stone-200 hover:bg-white/10"}`}
        >
          {t("v3.collection.ownedOnly")}
        </button>
      </div>

      <div className="grid w-full max-w-7xl grid-cols-[repeat(auto-fill,minmax(120px,1fr))] justify-items-center gap-x-3 gap-y-5 px-1 py-2">
        {shown.length === 0 && <p className="col-span-full py-8 text-sm text-stone-400">{t("v3.demo.noMatch")}</p>}
        {shown.map((id) => {
          const n = ready ? count(id) : 0;
          return n > 0 ? (
            <div key={id} className="relative">
              <button type="button" onClick={() => setViewing(id)} aria-label={t("v3.demo.view")} className="block cursor-zoom-in text-left">
                <HoloCard element={CHARACTER_ELEMENT[id]} rarity={CARD_RARITY[id]} effects={false} touchTilt={false} figure={figureArea(id)} className="w-[120px] text-[5.6px]">
                  <CharacterCardFace id={id} />
                </HoloCard>
              </button>
              {n > 1 && <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-xs font-black text-stone-950 shadow">×{n}</span>}
            </div>
          ) : (
            <div key={id} aria-label={t("v3.collection.locked")} className="flex aspect-[63/88] w-[120px] flex-col items-center justify-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/80 text-stone-500">
              <Lock size={22} aria-hidden />
              <span className="text-sm font-black tracking-widest">{CARD_RARITY[id]}</span>
            </div>
          );
        })}
      </div>

      {viewing && count(viewing) > 0 && (
        <div role="dialog" aria-modal="true" onClick={() => setViewing(null)} className="fixed inset-0 z-[60] flex flex-col items-center gap-3 overflow-y-auto bg-black/80 p-4">
          {viewable.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label={t("v3.demo.prev")} className="fixed left-2 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-2 border-stone-400 bg-stone-900/70 text-2xl font-bold text-stone-100 hover:bg-white/15 sm:left-6">
                ‹
              </button>
              <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label={t("v3.demo.next")} className="fixed right-2 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-2 border-stone-400 bg-stone-900/70 text-2xl font-bold text-stone-100 hover:bg-white/15 sm:right-6">
                ›
              </button>
            </>
          )}
          <div className="mt-auto flex max-w-full flex-col items-center gap-4 lg:flex-row lg:items-stretch">
            <motion.div
              key={viewing}
              initial={{ scale: 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className={VIEWER_WIDTH}
              style={viewerStyle(scale)}
            >
              <HoloCard element={CHARACTER_ELEMENT[viewing]} rarity={CARD_RARITY[viewing]} figure={figureArea(viewing)}>
                <CharacterCardFace id={viewing} />
              </HoloCard>
            </motion.div>
            <StoryPanel id={viewing} />
          </div>
          <div onClick={(e) => e.stopPropagation()} className="mb-auto flex flex-wrap items-center justify-center gap-2 text-sm text-stone-200">
            <span className="tabular-nums text-stone-400">
              {viewable.indexOf(viewing) + 1} / {viewable.length}
            </span>
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
