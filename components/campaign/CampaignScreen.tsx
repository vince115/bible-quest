"use client";

// /campaign: the main stages in Bible order, which are open, and the cards collected so far.
import Link from "next/link";
import { useEffect, useState } from "react";
import { CHARACTER_ELEMENT, ENEMY_ELEMENT } from "@/game/v2/data";
import { useT } from "@/game/locale";
import { CAMPAIGN, TESTAMENTS, campaignBoss } from "@/game/v3/campaign";
import { ownedCards, useProgressStore } from "@/game/v3/progress";
import { EnemyCardFace } from "@/components/cards/EnemyCardFace";
import { HoloCard } from "@/components/cards/HoloCard";
import { CARD_RARITY } from "@/components/cards/rarity";
import { TIMELINE } from "@/components/cards/timeline";
import { OrnateFrame } from "@/components/cards/viewer";
import type { CharacterId } from "@/game/v2/types";
import { asset } from "@/game/assets";

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
    <main className="flex min-h-[calc(100dvh-3rem)] flex-1 flex-col items-center gap-6 px-4 py-8">
      <div className="max-w-xl text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("v3.campaign.title")}</h1>
        <p className="mt-2 text-sm text-stone-400">{t("v3.campaign.hint")}</p>
      </div>

      {/* Old Testament, then New Testament; stages numbered straight through */}
      {TESTAMENTS.map(({ testament, stages }) => (
      <section key={testament} className="w-full max-w-2xl">
      <h2 className="mb-3 text-lg font-bold">{t(`v3.campaign.${testament}`)}</h2>
      <ol className="flex w-full flex-col gap-3">
        {stages.map((stage) => {
          const i = CAMPAIGN.indexOf(stage);
          const boss = campaignBoss(stage);
          const times = cleared[stage.id] ?? 0;
          // 測試中：先不鎖關卡，全部開放測試遊玩
          const playable = true;
          const status = times > 0 ? t("v3.campaign.cleared", { n: times }) : null;
          const body = (
            <>
              {/* Stage art (1:1 square), or the boss card, or a placeholder while the boss is still being built */}
              <div className="aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-800 sm:h-28 sm:w-28 shadow-md">
                {stage.art ? (
                  // eslint-disable-next-line @next/next/no-img-element -- stage art is a plain file in /public
                  <img src={asset(stage.art)} alt="" className="aspect-square h-full w-full object-cover" />
                ) : boss ? (
                  <div className="origin-top-left scale-[0.364] sm:scale-[0.436]">
                    <HoloCard element={ENEMY_ELEMENT[boss]} rarity={CARD_RARITY[boss]} effects={false} touchTilt={false} className="w-[220px] text-[10.3px]">
                      <EnemyCardFace id={boss} />
                    </HoloCard>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl text-amber-500/70">✦</div>
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
                {status && <p className="mt-1 text-xs text-emerald-300">{status}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-bold text-stone-950 transition group-hover:bg-amber-400">{t("v3.campaign.play")}</span>
            </>
          );
          const frame = "group relative isolate flex items-center gap-4 p-[26px] transition";
          return (
            <li key={stage.id}>
              <Link href={`/campaign/${stage.id}`} className={frame}>
                {/* The black ground stays inside the frame's line (so it never shows past the scrolled corners) and is half see-through. */}
                <span aria-hidden className="absolute inset-[3px] -z-10 bg-black/50 transition group-hover:bg-black/60" />
                <OrnateFrame size={22} />
                {body}
              </Link>
            </li>
          );
        })}
      </ol>
      </section>
      ))}

      {/* The collection has its own page */}
      <section className="w-full max-w-2xl">
        <Link href="/collection" className="flex items-center justify-between rounded-2xl border-2 border-stone-600 bg-stone-900 p-4 transition hover:bg-stone-800/90">
          <span className="text-lg font-bold">{t("v3.campaign.collection")}</span>
          <span className="text-sm text-stone-300">{ready ? t("v3.campaign.collectionCount", { n: copies, m: owned.length }) : ""} →</span>
        </Link>
      </section>
    </main>
  );
}
