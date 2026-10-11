"use client";

// One campaign stage: the battle screen in campaign mode, once progress says the stage is open.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/game/locale";
import { campaignStage, isUnlocked, type CampaignStageId } from "@/game/v3/campaign";
import { useProgressStore } from "@/game/v3/progress";
import { BattleV3Screen } from "@/components/battle-v3/BattleV3Screen";

export function CampaignBattle({ id }: { id: CampaignStageId }) {
  const t = useT();
  const stage = campaignStage(id);
  const cleared = useProgressStore((s) => s.cleared);
  // Progress lives in localStorage; read it after mount so the prerendered page matches.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve(useProgressStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  if (!ready) return null;

  const notice = !stage.battle ? t("v3.campaign.soon") : !isUnlocked(id, cleared) ? t("v3.campaign.locked") : null;
  if (notice) {
    return (
      <main className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">{t(`v3.campaign.${id}.name`)}</h1>
        <p className="text-stone-400">{notice}</p>
        <Link href="/campaign" className="rounded-full border border-stone-500 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10">
          ← {t("v3.campaign.list")}
        </Link>
      </main>
    );
  }
  return <BattleV3Screen campaign={id} />;
}
