import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CampaignBattle } from "@/components/campaign/CampaignBattle";
import { CAMPAIGN_IDS, isCampaignStageId } from "@/game/v3/campaign";

export const metadata: Metadata = {
  title: "Campaign stage · Bible Quest",
};

/** The stages are a fixed list, so every stage page is prerendered. */
export function generateStaticParams() {
  return CAMPAIGN_IDS.map((stage) => ({ stage }));
}

/** Reads the stage from the URL inside Suspense, so the page shell stays instant. */
async function Stage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params;
  if (!isCampaignStageId(stage)) notFound();
  return <CampaignBattle id={stage} />;
}

export default function CampaignStagePage({ params }: PageProps<"/campaign/[stage]">) {
  return (
    <Suspense fallback={null}>
      <Stage params={params} />
    </Suspense>
  );
}
