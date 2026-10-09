import type { Metadata } from "next";
import { CardDemo } from "@/components/cards/CardDemo";

export const metadata: Metadata = {
  title: "Card Demo · Bible Quest",
};

export default function CardDemoPage() {
  return <CardDemo />;
}
