"use client";

// /collection: every character card in story order. The ones the player owns are shown (with how many copies);
// the rest are locked, showing only their rarity, so there is something to chase.
import Link from "next/link";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { CHARACTER_ELEMENT } from "@/game/v2/data";
import type { CharacterId } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { useProgressStore } from "@/game/v3/progress";
import { characterSearchText } from "@/components/cards/CardDemo";
import { CharacterCardFace, figureArea } from "@/components/cards/CharacterCardFace";
import { HoloCard } from "@/components/cards/HoloCard";
import { CARD_RARITY, type Rarity } from "@/components/cards/rarity";
import { TIMELINE } from "@/components/cards/timeline";

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

  const count = (id: CharacterId) => collection[id] ?? 0;
  const kinds = ALL_CARDS.filter((id) => count(id) > 0).length;
  const copies = ALL_CARDS.reduce((n, id) => n + count(id), 0);

  const q = query.trim().toLowerCase();
  const matching = ALL_CARDS.filter((id) => (!q || characterSearchText(id).includes(q)) && (!ownedOnly || count(id) > 0));
  const shown = rarity === "all" ? matching : matching.filter((id) => CARD_RARITY[id] === rarity);
  const ownedIn = (list: CharacterId[]) => list.filter((id) => count(id) > 0).length;

  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center gap-5 bg-gradient-to-b from-stone-900 via-stone-950 to-black px-4 py-8">
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
              <HoloCard element={CHARACTER_ELEMENT[id]} rarity={CARD_RARITY[id]} effects={false} touchTilt={false} figure={figureArea(id)} className="w-[120px] text-[5.6px]">
                <CharacterCardFace id={id} />
              </HoloCard>
              {n > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-xs font-black text-stone-950 shadow">×{n}</span>}
            </div>
          ) : (
            <div key={id} aria-label={t("v3.collection.locked")} className="flex aspect-[63/88] w-[120px] flex-col items-center justify-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/80 text-stone-500">
              <Lock size={22} aria-hidden />
              <span className="text-sm font-black tracking-widest">{CARD_RARITY[id]}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-4 text-xs text-stone-400">
        <Link href="/gacha" className="underline">
          {t("v3.gacha.title")}
        </Link>
        <Link href="/campaign" className="underline">
          {t("v3.campaign.title")}
        </Link>
        <Link href="/" className="underline">
          {t("v2.ui.backHome")}
        </Link>
      </div>
    </main>
  );
}
