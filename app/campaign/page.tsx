import type { Metadata } from "next";
import { CampaignScreen } from "@/components/campaign/CampaignScreen";

export const metadata: Metadata = {
  title: "Campaign · Bible Quest",
};

export default function CampaignPage() {
  return <CampaignScreen />;
}
