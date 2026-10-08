import type { Metadata } from "next";
import { BattleV2Screen } from "@/components/battle-v2/BattleV2Screen";

export const metadata: Metadata = {
  title: "David vs Goliath (v2) · Bible Quest",
};

export default function BattleV2Page() {
  return <BattleV2Screen />;
}
