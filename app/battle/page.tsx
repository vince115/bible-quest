import type { Metadata } from "next";
import { BattleScreen } from "@/components/battle/BattleScreen";

export const metadata: Metadata = {
  title: "David vs Goliath · Bible Quest",
};

export default function BattlePage() {
  return <BattleScreen />;
}
