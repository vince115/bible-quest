"use client";

// One campaign stage: the battle screen in campaign mode, once progress says the stage is open.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/game/locale";
import { campaignStage, isUnlocked, type CampaignStageId } from "@/game/v3/campaign";
import { useProgressStore } from "@/game/v3/progress";
import { BattleV3Screen } from "@/components/battle-v3/BattleV3Screen";

export function CampaignBattle({ id }: { id: CampaignStageId }) {
  // Progress lives in localStorage; read it after mount so the prerendered page matches.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve(useProgressStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  if (!ready) return null;

  return <BattleV3Screen campaign={id} />;
}
