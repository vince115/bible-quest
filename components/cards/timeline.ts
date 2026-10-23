// The order cards are shown in: through the Bible's story, from creation to the early church.
// Card numbers (BQ-001…) stay as they are — this only decides where a card sits in a list.
// A new card goes into its period here; timeline.test.ts fails if any card is missing or listed twice.
import type { CharacterId, EnemyId } from "@/game/v2/types";

type Card = CharacterId | EnemyId;

/** Each period in story order; within a period, roughly in the order the people appear. */
export const TIMELINE_ERAS: { era: string; cards: Card[] }[] = [
  { era: "creation", cards: ["father", "adam", "eve", "serpent", "serpentTempter", "serpentP", "cain", "abel", "seth", "enoch", "noah", "noahFamily", "fountains", "flood", "windows"] },
  {
    era: "patriarchs",
    // Job is usually placed in the patriarchs' time.
    cards: ["terah", "melchizedek", "abraham", "sarah", "hagar", "lot", "isaac", "rebekah", "esau", "jacob", "leah", "rachel", "joseph", "job"],
  },
  {
    era: "exodus",
    cards: ["jochebed", "pharaohDaughter", "moses", "zipporah", "pharaoh", "charioteer", "pharaohHost", "chariots", "chariotCaptain", "aaron", "miriam", "jethro", "mosesSinai", "korah", "caleb", "balaam", "joshua", "rahab", "jerichoKing", "walls", "wallGuard", "achan"],
  },
  { era: "judges", cards: ["ehud", "deborah", "barak", "sisera", "jael", "gideon", "jephthah", "delilah", "samson", "ruth", "naomi", "boaz"] },
  {
    era: "kingdom",
    cards: ["eli", "hannah", "samuel", "saul", "jonathan", "david", "goliath", "bearer", "archer", "michal", "abigail", "joab", "nathan", "bathsheba", "uriah", "mephibosheth", "absalom", "hiramKing", "solomon", "hiramSmith", "sheba"],
  },
  {
    era: "prophets",
    cards: ["elijah", "ahab", "jezebel", "baalProphet", "ahabKing", "baalProphets", "jezebelQueen", "zarephath", "elisha", "shunammite", "naaman", "maid", "gehazi", "jehu", "jonah", "sennacherib", "hezekiah", "isaiah", "josiah", "jeremiah"],
  },
  { era: "exile", cards: ["ezekiel", "daniel", "presidents", "princes", "lionRest", "lion", "lioness", "nebuchadnezzar", "threeFriends", "belshazzar", "cyrus", "zerubbabel", "vashti", "esther", "mordecai", "haman", "ezra", "artaxerxes", "nehemiah", "sanballat"] },
  { era: "nativity", cards: ["gabriel", "zechariah", "elizabeth", "mary", "josephNaz", "jesusInfant", "shepherds", "magi", "herodGreat", "simeon", "anna", "johnBaptist", "romanSoldier", "herodias"] },
  {
    era: "ministry",
    cards: [
      "jesusUR", "holySpirit", "satanDisguised", "satan", "satanMan", "satanVeiled", "satanFoe", "roaringLion", "fieryDarts", "peter", "andrew", "jamesZeb", "johnApostle", "philipApostle", "nathanael", "matthew", "thomas", "jamesAlph", "thaddaeus", "simonZealot", "judas",
      "fisherman", "nicodemus", "samaritan", "centurion", "fourFriends", "uncleanSpirits", "legion", "swine", "legionFreed", "jairus", "loavesBoy", "canaanite", "goodSamaritan", "prodigal", "maryMagdalene", "martha", "maryBethany",
      "lazarus", "richRuler", "bartimaeus", "zacchaeus", "widow",
    ],
  },
  { era: "passion", cards: ["malchus", "caiaphas", "pilate", "herod", "barabbas", "simonCyrene", "thief", "mockingThief", "jesusCross", "romanCenturion", "josephArimathea", "jesus", "cleopas"] },
  {
    era: "church",
    cards: [
      "matthias", "jamesJust", "sapphira", "stephen", "philip", "simonMagus", "ethiopian", "ananias", "paul", "romanSpearman", "romanArcher", "romanCavalry", "barnabas", "cornelius", "herodAgrippa", "rhoda", "dorcas", "johnMark", "silas", "lydia", "jailer",
      "loisEunice", "timothy", "priscilla", "aquila", "apollos", "luke", "titus", "phoebe", "philemon", "onesimus",
    ],
  },
  { era: "revelation", cards: ["johnPatmos", "michael"] },
];

/** Every card in story order. */
export const TIMELINE: Card[] = TIMELINE_ERAS.flatMap((e) => e.cards);
