// The main campaign: the Bible's best-known stories in order, Genesis onward. Each stage lends the player a few cards
// from its own time (the player's collection is not needed), fights a boss fixed by the story, and drops one card from
// its drop list into the collection when cleared. Side stages come later; a stage without a battle yet is shown as
// "coming soon" and is skipped when working out what is unlocked.
import { STAGE_BOSS } from "../v2/data";
import type { Rng } from "../v2/engine";
import type { CardId, CharacterId, EnemyId, StageId } from "../v2/types";

export type CampaignStageId = "eden" | "ark" | "redSea" | "jericho" | "goliath" | "carmel" | "lions" | "gerasa";

export interface CampaignStage {
  id: CampaignStageId;
  /** The period in the card timeline (see components/cards/timeline.ts); every card in the pool comes from it. */
  era: string;
  /** The battle this stage plays, or null until its boss is built. */
  battle: StageId | null;
  /** Cards the stage lends the player to choose from. */
  pool: CharacterId[];
  /** How many of the pool may go to battle (at most). */
  pick: number;
  /** Cards that can drop when the stage is cleared; the pool when left out. */
  drops?: CharacterId[];
  /** Stage art in public/stages, when there is some. */
  art?: string;
  /** The scripture (energy) deck the stage lends, once decks are built per stage; the standard deck until then. */
  deck?: CardId[];
}

export const CAMPAIGN: CampaignStage[] = [
  { id: "eden", era: "creation", battle: "eden", pool: ["adam", "eve", "cain", "abel", "enoch", "noah"], pick: 3 },
  { id: "ark", era: "creation", battle: null, pool: ["noah", "enoch", "adam", "eve", "abel", "cain"], pick: 3 },
  { id: "redSea", era: "exodus", battle: null, pool: ["moses", "aaron", "miriam", "jochebed", "zipporah", "jethro"], pick: 3, art: "/stages/red-sea.jpg" },
  { id: "jericho", era: "exodus", battle: null, pool: ["joshua", "rahab", "caleb", "achan", "aaron", "miriam"], pick: 3, art: "/stages/jericho.jpg" },
  { id: "goliath", era: "kingdom", battle: "goliath", pool: ["david", "jonathan", "samuel", "saul", "abigail", "michal"], pick: 3 },
  { id: "carmel", era: "prophets", battle: null, pool: ["elijah", "elisha", "zarephath", "naaman", "maid", "shunammite"], pick: 3 },
  { id: "lions", era: "exile", battle: null, pool: ["daniel", "threeFriends", "ezekiel", "esther", "mordecai", "nehemiah"], pick: 3 },
  { id: "gerasa", era: "ministry", battle: null, pool: ["jesusUR", "peter", "andrew", "jamesZeb", "johnApostle", "legionFreed"], pick: 3, art: "/stages/legion.jpg" },
];

export const CAMPAIGN_IDS = CAMPAIGN.map((s) => s.id);

export const isCampaignStageId = (id: string): id is CampaignStageId => (CAMPAIGN_IDS as string[]).includes(id);

export const campaignStage = (id: CampaignStageId): CampaignStage => CAMPAIGN.find((s) => s.id === id)!;

/** The boss of a built stage. */
export const campaignBoss = (stage: CampaignStage): EnemyId | null => (stage.battle ? STAGE_BOSS[stage.battle] : null);

/** How many times each stage has been cleared. */
export type Cleared = Partial<Record<CampaignStageId, number>>;

/** A stage opens once every built stage before it has been cleared (stages still being built don't hold the line up). */
export function isUnlocked(id: CampaignStageId, cleared: Cleared): boolean {
  const i = CAMPAIGN_IDS.indexOf(id);
  return CAMPAIGN.slice(0, i).every((s) => !s.battle || (cleared[s.id] ?? 0) > 0);
}

/** Playable right now: built and unlocked. */
export const isPlayable = (id: CampaignStageId, cleared: Cleared): boolean => !!campaignStage(id).battle && isUnlocked(id, cleared);

/** The next built stage after this one, if any. */
export function nextStage(id: CampaignStageId): CampaignStageId | null {
  const i = CAMPAIGN_IDS.indexOf(id);
  return CAMPAIGN.slice(i + 1).find((s) => s.battle)?.id ?? null;
}

/** The card a cleared stage drops: one of its drop list, each as likely as the next (rarity weighting is still open). */
export function dropFor(id: CampaignStageId, rng: Rng = Math.random): CharacterId {
  const stage = campaignStage(id);
  const drops = stage.drops ?? stage.pool;
  return drops[Math.min(drops.length - 1, Math.floor(rng() * drops.length))];
}
