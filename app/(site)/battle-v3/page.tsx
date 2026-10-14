import type { Metadata } from "next";
import { BattleV3Screen } from "@/components/battle-v3/BattleV3Screen";

export const metadata: Metadata = {
  title: "David vs Goliath (v3 board) · Bible Quest",
};

export default function BattleV3Page() {
  return <BattleV3Screen />;
}
