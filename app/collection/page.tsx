import type { Metadata } from "next";
import { CollectionScreen } from "@/components/collection/CollectionScreen";

export const metadata: Metadata = {
  title: "My Collection · Bible Quest",
};

export default function CollectionPage() {
  return <CollectionScreen />;
}
