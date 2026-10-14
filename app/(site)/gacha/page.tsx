import type { Metadata } from "next";
import { GachaScreen } from "@/components/gacha/GachaScreen";

export const metadata: Metadata = {
  title: "Draw · Bible Quest",
};

export default function GachaPage() {
  return <GachaScreen />;
}
