"use client";

// /campaign: the main stages in Bible order, which are open, and the cards collected so far.
import Link from "next/link";
import { useEffect, useState } from "react";
import { CHARACTER_ELEMENT, ENEMY_ELEMENT } from "@/game/v2/data";
import { useT } from "@/game/locale";
import { CAMPAIGN, campaignBoss, isPlayable, isUnlocked } from "@/game/v3/campaign";
import { ownedCards, useProgressStore } from "@/game/v3/progress";
import { CharacterCardFace, figureArea } from "@/components/cards/CharacterCardFace";
import { EnemyCardFace } from "@/components/cards/EnemyCardFace";
import { HoloCard } from "@/components/cards/HoloCard";
import { CARD_RARITY } from "@/components/cards/rarity";
import { TIMELINE } from "@/components/cards/timeline";
import type { CharacterId } from "@/game/v2/types";

export function CampaignScreen() {
  const t = useT();
  const cleared = useProgressStore((s) => s.cleared);
  const collection = useProgressStore((s) => s.collection);
  // Progress lives in localStorage; read it after mount so the prerendered page matches.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve(useProgressStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  const owned = ownedCards(collection, TIMELINE.filter((id): id is CharacterId => id in CHARACTER_ELEMENT));
  const copies = owned.reduce((n, c) => n + c.count, 0);

  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center gap-6 bg-gradient-to-b from-stone-900 via-stone-950 to-black px-4 py-8">
      <div className="max-w-xl text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("v3.campaign.title")}</h1>
        <p className="mt-2 text-sm text-stone-400">{t("v3.campaign.hint")}</p>
      </div>

      <ol className="flex w-full max-w-2xl flex-col gap-3">
        {CAMPAIGN.map((stage, i) => {
          const boss = campaignBoss(stage);
          const times = cleared[stage.id] ?? 0;
          const playable = ready && isPlayable(stage.id, cleared);
          const status = !stage.battle ? t("v3.campaign.soon") : times > 0 ? t("v3.campaign.cleared", { n: times }) : ready && !isUnlocked(stage.id, cleared) ? t("v3.campaign.locked") : null;
          const body = (
            <>
              {/* Stage art, or the boss card, or a placeholder while the boss is still being built */}
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-800 sm:h-28 sm:w-24">
                {stage.art ? (
                  // eslint-disable-next-line @next/next/no-img-element -- stage art is a plain file in /public
                  <img src={stage.art} alt="" className="h-full w-full object-cover" />
                ) : boss ? (
                  <div className="origin-top-left scale-[0.364] sm:scale-[0.436]">
                    <HoloCard element={ENEMY_ELEMENT[boss]} rarity={CARD_RARITY[boss]} effects={false} touchTilt={false} className="w-[220px] text-[10.3px]">
                      <EnemyCardFace id={boss} />
                    </HoloCard>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl text-stone-600">✦</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300/80">
                  {i + 1} · {t(`v3.campaign.${stage.id}.ref`)}
                </div>
                <h2 className="truncate text-lg font-black sm:text-xl">{t(`v3.campaign.${stage.id}.name`)}</h2>
                <p className="text-sm text-stone-300">
                  {t("v3.campaign.boss")}：{t(`v3.campaign.${stage.id}.boss`)}
                </p>
                {status && <p className={`mt-1 text-xs ${times > 0 ? "text-emerald-300" : "text-stone-500"}`}>{status}</p>}
              </div>
              {playable && <span className="shrink-0 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-bold text-stone-950">{t("v3.campaign.play")}</span>}
            </>
          );
          const frame = `flex items-center gap-4 rounded-2xl border-2 p-3 ${playable ? "border-amber-400/70 bg-stone-900 hover:bg-stone-800" : "border-stone-700 bg-stone-900/60 opacity-70"}`;
          return (
            <li key={stage.id}>
              {playable ? (
                <Link href={`/campaign/${stage.id}`} className={frame}>
                  {body}
                </Link>
              ) : (
                <div className={frame}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>

      {/* The collection: every card dropped so far, with how many copies */}
      <section className="w-full max-w-2xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{t("v3.campaign.collection")}</h2>
          <span className="text-xs text-stone-400">{t("v3.campaign.collectionCount", { n: copies, m: owned.length })}</span>
        </div>
        {owned.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{t("v3.campaign.empty")}</p>
        ) : (
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] justify-items-center gap-3">
            {owned.map(({ id, count }) => (
              <div key={id} className="relative">
                <HoloCard element={CHARACTER_ELEMENT[id]} rarity={CARD_RARITY[id]} effects={false} touchTilt={false} figure={figureArea(id)} className="w-[120px] text-[5.6px]">
                  <CharacterCardFace id={id} />
                </HoloCard>
                {count > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-xs font-black text-stone-950 shadow">×{count}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-center gap-4 text-xs text-stone-400">
        <Link href="/battle-v3" className="underline">
          {t("v3.campaign.free")}
        </Link>
        <Link href="/" className="underline">
          {t("v2.ui.backHome")}
        </Link>
      </div>
    </main>
  );
}
