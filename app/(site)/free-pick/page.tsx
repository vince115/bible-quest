import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BattleV3Screen } from "@/components/battle-v3/BattleV3Screen";
import { FREE_PICK_ENABLED } from "@/game/v3/vip";

export const metadata: Metadata = {
  title: "Free pick · Bible Quest",
};

/** Free pick: every card in the game, one of each — for VIPs and developers only. */
export default function FreePickPage() {
  if (!FREE_PICK_ENABLED) notFound();
  return <BattleV3Screen freePick />;
}
