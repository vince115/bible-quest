// The main campaign: the Bible's best-known stories in order, Genesis onward. Each stage lends the player a few cards
// from its own time (the player's collection is not needed), fights a boss fixed by the story, and drops one card from
// its drop list into the collection when cleared. Side stages come later; a stage without a battle (none right now)
// is shown as "coming soon" and is skipped when working out what is unlocked.
import { STAGE_BOSS } from "../v2/data";
import type { Rng } from "../v2/engine";
import type { CardId, CharacterId, EnemyId, StageId } from "../v2/types";

export type CampaignStageId = "eden" | "ark" | "redSea" | "jericho" | "goliath" | "carmel" | "lions" | "temptation" | "gerasa";

export type Testament = "old" | "new";

export interface CampaignStage {
  id: CampaignStageId;
  /** Old or New Testament: the stage list is shown in two parts. */
  testament: Testament;
  /** The period in the card timeline (see components/cards/timeline.ts); every card in the pool comes from it. */
  era: string;
  /** The battle this stage plays, or null until its boss is built. */
  battle: StageId | null;
  /** A first round fought before `battle` (the same party carries its HP into the second round). */
  before?: StageId;
  /**
   * An optional round after the stage is cleared, the hell level: the same party, with the HP it has left, may take it on
   * (or not). Winning earns an achievement and a card; losing takes nothing away.
   */
  hell?: StageId;
  /** The card the hell level gives. */
  hellDrop?: CharacterId;
  /** Cards the stage lends the player to choose from. */
  pool: CharacterId[];
  /** How many of the pool may go to battle (at most). */
  pick: number;
  /** Cards that can drop when the stage is cleared; the pool when left out. */
  drops?: CharacterId[];
  /** Stage art in public/stages, when there is some. */
  art?: string;
  /** Which part of the art the stage list's wide strip shows (CSS object-position); the middle when left out. */
  artFocus?: string;
  /** The scripture (energy) deck the stage lends, once decks are built per stage; the standard deck until then. */
  deck?: CardId[];
  /** Custom background music for this stage. */
  bgm?: string;
}

export const CAMPAIGN: CampaignStage[] = [
  { id: "eden", testament: "old", era: "creation", battle: "eden", before: "tempter", pool: ["adam", "eve", "cain", "abel", "seth", "enoch"], pick: 6, art: "/stages/eden.jpg", bgm: "/audio/bgm/eden.mp3" },
  { id: "ark", testament: "old", era: "creation", battle: "ark", pool: ["noah", "enoch", "seth", "adam", "cain", "abel"], pick: 6, art: "/stages/ark.jpg", bgm: "/audio/bgm/ark.mp3" },
  { id: "redSea", testament: "old", era: "exodus", battle: "redSea", pool: ["moses", "aaron", "miriam", "joshua", "jochebed", "zipporah"], pick: 6, art: "/stages/red-sea.jpg", bgm: "/audio/bgm/red-sea.m4a" },
  { id: "jericho", testament: "old", era: "exodus", battle: "jericho", pool: ["joshua", "rahab", "caleb", "achan", "aaron", "miriam"], pick: 6, art: "/stages/jericho.jpg", bgm: "/audio/bgm/jericho.mp3" },
  { id: "goliath", testament: "old", era: "kingdom", battle: "goliath", pool: ["david", "jonathan", "samuel", "saul", "abigail", "michal"], pick: 6, art: "/stages/goliath.jpg", bgm: "/audio/bgm/goliath.mp3" },
  { id: "carmel", testament: "old", era: "prophets", battle: "carmel", pool: ["elijah", "elisha", "naaman", "jehu", "zarephath", "shunammite"], pick: 6, art: "/stages/carmel.jpg", bgm: "/audio/bgm/carmel.mp3" },
  { id: "lions", testament: "old", era: "exile", battle: "lions", before: "plot", pool: ["daniel", "threeFriends", "nebuchadnezzar", "esther", "haman", "nehemiah"], pick: 6, art: "/stages/lions.jpg", bgm: "/audio/bgm/lions.mp3" },
  { id: "temptation", testament: "new", era: "ministry", battle: "temptation", before: "disguise", hell: "revealed", hellDrop: "satan", pool: ["jesusUR", "holySpirit", "peter", "johnApostle", "satanDisguised", "satan"], drops: ["satanDisguised", "satan"], pick: 6, art: "/stages/temptation.jpg", artFocus: "center 12%", bgm: "/audio/bgm/battle.mp3" },
  { id: "gerasa", testament: "new", era: "ministry", battle: "gerasa", pool: ["jesusUR", "peter", "jamesZeb", "johnApostle", "simonZealot", "legionFreed"], pick: 6, art: "/stages/legion.jpg", bgm: "/audio/bgm/gerasa.mp3" },
];

export const CAMPAIGN_IDS = CAMPAIGN.map((s) => s.id);

/** The stages of each testament, in order. */
export const TESTAMENTS: { testament: Testament; stages: CampaignStage[] }[] = (["old", "new"] as Testament[]).map((testament) => ({ testament, stages: CAMPAIGN.filter((s) => s.testament === testament) }));

export const isCampaignStageId = (id: string): id is CampaignStageId => (CAMPAIGN_IDS as string[]).includes(id);

export const campaignStage = (id: CampaignStageId): CampaignStage => CAMPAIGN.find((s) => s.id === id)!;

/** The campaign stage that plays a battle (every battle belongs to one stage). */
export const stageOfBattle = (battle: StageId): CampaignStage => CAMPAIGN.find((s) => s.battle === battle || s.before === battle || s.hell === battle)!;

/** Stage art for each battle, for free mode. */
export const STAGE_ART: Partial<Record<StageId, string>> = Object.fromEntries(CAMPAIGN.filter((s) => s.battle && s.art).flatMap((s) => [[s.battle, s.art], ...(s.before ? [[s.before, s.art]] : []), ...(s.hell ? [[s.hell, s.art]] : [])]));

/** The background music of a campaign stage or a battle (Eden's when there is none). */
export function stageBgm(id?: string | null): string {
  const stage = id ? (isCampaignStageId(id) ? campaignStage(id) : CAMPAIGN.find((s) => s.battle === id || s.before === id || s.hell === id)) : undefined;
  return stage?.bgm ?? "/audio/bgm/eden.mp3";
}

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
