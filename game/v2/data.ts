import type { CardDef, CardId, CharacterId, Element, EnemyId, GoliathActionId, SkillDef, SkillId, StageId } from "./types";

// Prototype v2 (energy-card version) numbers. Change only with the designer's approval.
export const RULES_V2 = {
  openingHand: 5,
  drawPerTurn: 3,
  maxHand: 7,

  /** Faith and Guard carry over between turns up to these caps; Attack resets each turn. */
  maxFaith: 6,
  maxGuard: 6,
  /** David's passive "Against the Giant": while Faith ≥ this, David's attacks +giantBonus. */
  giantFaith: 3,
  giantBonus: 20,

  /** Victory when Goliath falls; the others flee (1 Sam 17:51). */
  archerDamage: 30,
  spear: 30,
  crush: 90,
  swing: 50,
  defyTargets: 2,

  healAmount: 50,
  ariseHp: 70,
  covShield: 30,
  /** The Serpent of Eden. Coil hits every ally. */
  fang: 60,
  fangShed: 80,
  coil: 40,
  temptFaith: 1,

  /** Story bonuses: a character fighting in their own Bible story. */
  /** Sling Stone away from Goliath: ordinary damage, no Stun. */
  slingStoneElsewhere: 80,
  /** Adam in Eden: Till the Ground +20, Keep the Garden Shield +30. */
  edenTillBonus: 20,
  edenKeepBonus: 30,
  /** Eve in Eden: Mother of All Living +20, and every ally's attacks on the Serpent +20 (Genesis 3:15). */
  edenMotherBonus: 20,
  edenSeedBonus: 20,

  /** Enemy cards played on the player's side. */
  shieldUpAmount: 50,

  /** Adam's Keep the Garden: Shield on himself. */
  keepShield: 50,
  /** Cain's Fruit of the Ground also gives Faith; his Mark strikes back at every enemy that hits him. */
  offeringFaith: 1,
  markRetaliate: 30,
  /** Abel's Firstlings of the Flock heals one ally; when he falls, Yet Speaketh shields every ally and gives Faith. */
  firstlingsHeal: 40,
  speakethShield: 30,
  speakethFaith: 1,
  /** Noah's Build the Ark shields every ally; his Rainbow Covenant (once per battle) heals every ally and lifts Shaken. */
  arkShield: 40,
  rainbowHeal: 50,
  /** Abraham's Look Toward Heaven gives Faith; The LORD Will Provide (once per battle) draws cards. */
  starsFaith: 2,
  provideDraw: 3,
  /** Isaac's Hundredfold Harvest hits harder with Abraham in the line-up; the Ram leaves a falling ally at this HP. */
  harvestBlessing: 20,
  ramHp: 10,
  /** Jacob's Wrestle Until Dawn costs him HP and wins the party Faith. */
  wrestleCost: 10,
  wrestleFaith: 1,
  /** Joseph's Storehouses heal and shield every ally; God Meant It for Good turns half the party's lost HP into damage. */
  granaryHeal: 30,
  granaryShield: 20,
  goodCap: 100,
  /** Moses' Hold Up His Hands: every ally's attacks this turn +20. */
  handsBonus: 20,
  /** Aaron's Blessing heals and shields one ally. */
  blessingHeal: 30,
  blessingShield: 30,
  /** Miriam's Song of the Sea gives Faith and lifts Shaken from everyone. */
  songFaith: 2,
  /** Moses at Sinai: The Ten Words shield every ally and give Faith. */
  tenWordsShield: 30,
  tenWordsFaith: 1,
  /** Rahab's Hide the Spies shields one ally. */
  hideShield: 40,
  /** Deborah's Up! This Is the Day gives Attack energy. */
  upTodayAttack: 2,
  /** Gideon's Sign of the Fleece gives Faith and draws a card. */
  fleeceFaith: 1,
  fleeceDraw: 1,
  /** Ruth's Gleaning draws cards. */
  gleanDraw: 2,
  /** Naomi's Counsel heals one ally (double for Ruth); Restorer of Life raises a fallen ally. */
  counselHeal: 30,
  restorerHp: 50,
  /** Boaz's Under His Wings shields one ally. */
  wingsShield: 60,
  /** Hannah's Silent Prayer gives Faith (more with Samuel beside her); her Song heals every ally. */
  prayerFaith: 1,
  prayerSamuelFaith: 2,
  hannahSongHeal: 40,
  /** Saul's Rash Offering gives Faith at once, but Saul is Shaken next turn. */
  rashFaith: 2,
  /** Abigail's Provision heals every ally; her Intercession softens every hit this turn. */
  provisionHeal: 20,
  intercedeBlock: 20,
  /** Solomon's Ask for Wisdom gives Faith and Attack; Fire from Heaven also heals every ally. */
  wisdomFaith: 1,
  wisdomAttack: 1,
  templeFireHeal: 30,
  /** Elijah's Fed by Ravens heals him and draws a card. */
  ravensHeal: 40,
  ravensDraw: 1,
  /** Elisha's Healing the Waters (double with Elijah beside him); Chariots of Fire shield every ally. */
  healWatersHeal: 20,
  chariotsShield: 50,
  /** Jonah comes back out of the fish with this HP, once per battle. */
  fishHp: 50,
  /** Esther's Fasting gives Faith at the cost of her HP. */
  fastingFaith: 2,
  fastingCost: 10,
  /** Nehemiah's wall: Shield to every ally, +10 per earlier course this battle, up to the cap. */
  wallShield: 20,
  wallStep: 10,
  wallCap: 50,
  /** Sword and Trowel also shields Nehemiah. */
  trowelShield: 20,
  /** Zechariah: Incense gives Faith and a small Shield to all; His Name Is John (from turn 3) heals all and gives Faith. */
  incenseFaith: 1,
  incenseShield: 10,
  johnTurn: 3,
  johnHeal: 40,
  johnFaith: 2,
  /** Mary's Handmaid gives Faith; the Magnificat takes a share of the leader's HP. */
  handmaidFaith: 1,
  magnificatShare: 0.25,
  /** Joseph of Nazareth's Carpenter's Hands shield and heal one ally (double for Mary). */
  carpenterShield: 30,
  carpenterHeal: 20,
  /** John the Baptist: the Axe hits wood enemies double; Baptism heals every ally (+1 Faith with Zechariah). */
  baptismHeal: 30,
  /** Jesus: Cleansing the Leper heals one ally; Gethsemane shields every ally and gives Faith; the Loaves feed everyone. */
  leperHeal: 50,
  gethsemaneShield: 40,
  gethsemaneFaith: 2,
  loavesHeal: 40,
  loavesDraw: 3,
  loavesFaith: 1,
  /** Jesus (UR) rises on the third day: two turns after the turn he falls, with full HP. */
  riseAfter: 2,
  /** Peter: the Great Catch draws cards and gives Attack; his attacks are stronger with Jesus beside him. */
  catchDraw: 2,
  catchAttack: 1,
  peterWithJesus: 20,
  /** Andrew's A Lad Here draws cards and gives Faith. */
  ladDraw: 2,
  ladFaith: 1,
  /** John the Apostle's Love One Another heals and shields every ally (double with Jesus beside him). */
  loveHeal: 20,
  loveShield: 20,
  /** Matthew: Leaving the Tax Booth turns Guard into Attack; the Feast heals every ally and draws a card. */
  taxBoothAttack: 2,
  feastHeal: 30,
  feastDraw: 1,
  /** James: Mending the Nets heals one ally; Boanerges hits harder with John; when he falls, every attack +10. */
  mendHeal: 30,
  boanergesWithJohn: 20,
  cupBonus: 10,
  /** Thomas: Reach Hither Thy Finger gives Faith and makes him believe. */
  fingerFaith: 1,
  /** Mary Magdalene: Spices heal one ally; I Have Seen the Lord raises a fallen ally (Jesus at once, in full). */
  spicesHeal: 30,
  seenHp: 60,
  /** Martha: Serving turns Attack into Guard; Thy Brother Shall Rise Again brings the next fallen ally back with this HP. */
  servingGuard: 2,
  riseAgainHp: 50,
  /** Zacchaeus: the Sycamore gives Faith; Restore Fourfold gives Attack and Faith. */
  sycamoreFaith: 1,
  fourfoldAttack: 2,
  fourfoldFaith: 2,

  /** Eve's Mother of All Living: heals every ally. */
  motherHeal: 40,

  /** Elements are reserved for multi-stage play: switched off, so damage is unaffected for now. */
  elements: {
    enabled: true,
    /** Attacker's element beats the defender's. */
    strong: 1.5,
    /** Defender's element beats the attacker's (water/fire/wood cycle). */
    weak: 0.75,
  },

  /** Delay between Goliath's action and the next turn in the UI (ms). */
  stepDelay: 800,
} as const;

/**
 * Which elements each element beats: the five phases' overcoming cycle (wood → earth → water → fire → metal → wood),
 * plus light and dark countering each other. Every element beats one and is beaten by one; light and dark are
 * neutral to the five phases.
 */
export const ELEMENT_BEATS: Record<Element, Element[]> = {
  wood: ["earth"],
  earth: ["water"],
  water: ["fire"],
  fire: ["metal"],
  metal: ["wood"],
  light: ["dark"],
  dark: ["light"],
};

/** Adam is earth (formed from the dust, Genesis 2:7); Goliath is metal (bronze armour, 1 Samuel 17:5-7). */
export const CHARACTER_ELEMENT: Record<CharacterId, Element> = {
  david: "light",
  samuel: "water",
  jonathan: "fire",
  adam: "earth",
  cain: "earth",
  abel: "light",
  noah: "water",
  abraham: "metal",
  isaac: "wood",
  jacob: "earth",
  joseph: "metal",
  moses: "fire",
  aaron: "light",
  miriam: "water",
  mosesSinai: "light",
  joshua: "metal",
  rahab: "fire",
  deborah: "wood",
  gideon: "fire",
  samson: "earth",
  ruth: "wood",
  naomi: "water",
  boaz: "metal",
  hannah: "water",
  saul: "metal",
  abigail: "light",
  solomon: "fire",
  elijah: "fire",
  elisha: "water",
  jonah: "water",
  isaiah: "light",
  esther: "metal",
  daniel: "earth",
  nehemiah: "earth",
  zechariah: "light",
  mary: "wood",
  josephNaz: "wood",
  johnBaptist: "water",
  jesus: "light",
  jesusUR: "light",
  peter: "earth",
  andrew: "water",
  johnApostle: "fire",
  matthew: "metal",
  jamesZeb: "fire",
  thomas: "wood",
  maryMagdalene: "wood",
  martha: "earth",
  zacchaeus: "metal",
  eve: "wood",
  archerP: "fire",
  bearerP: "wood",
  goliathP: "metal",
  serpentP: "dark",
};
export const ENEMY_ELEMENT: Record<EnemyId, Element> = { bearer: "wood", goliath: "metal", archer: "fire", serpent: "dark" };

/** Cards that show the same person: a line-up holds only one of them. */
export const PERSON: Partial<Record<CharacterId, CharacterId>> = { mosesSinai: "moses", jesusUR: "jesus" };

/** Cards that never fall: never targeted, never hurt, and not counted when deciding defeat. */
export const NEVER_FALLS: ReadonlySet<CharacterId> = new Set(["jesus"]);
export const personOf = (id: CharacterId): CharacterId => PERSON[id] ?? id;

/** Every playable character, in display order. */
export const PARTY_ORDER: CharacterId[] = ["david", "samuel", "jonathan", "adam", "eve", "cain", "abel", "noah", "abraham", "isaac", "jacob", "joseph", "moses", "aaron", "miriam", "mosesSinai", "joshua", "rahab", "deborah", "gideon", "samson", "ruth", "naomi", "boaz", "hannah", "saul", "abigail", "solomon", "elijah", "elisha", "jonah", "isaiah", "esther", "daniel", "nehemiah", "zechariah", "mary", "josephNaz", "johnBaptist", "jesus", "jesusUR", "peter", "andrew", "johnApostle", "matthew", "jamesZeb", "thomas", "maryMagdalene", "martha", "zacchaeus", "goliathP", "serpentP", "bearerP", "archerP"];
/** Who fights when no line-up is chosen (the v2 battle). */
export const DEFAULT_LINEUP: CharacterId[] = ["david", "samuel", "jonathan"];

export const ENEMY_ORDER: EnemyId[] = ["bearer", "goliath", "archer", "serpent"];

/** Each character's own Bible story: fighting in that stage turns on their story bonus. */
export const STORY: Partial<Record<CharacterId, StageId>> = { david: "goliath", adam: "eden", eve: "eden" };

/** Who fights in each stage, and the boss. */
export const STAGE_ENEMIES: Record<StageId, EnemyId[]> = { goliath: ["bearer", "goliath", "archer"], eden: ["serpent"] };
export const STAGE_BOSS: Record<StageId, EnemyId> = { goliath: "goliath", eden: "serpent" };

/** HP and damage use Pokémon-TCG-style numbers (steps of 10). */
export const ENEMY_HP: Record<EnemyId, number> = { bearer: 60, goliath: 220, archer: 40, serpent: 250 };

export const MAX_HP: Record<CharacterId, number> = { david: 120, samuel: 100, jonathan: 140, adam: 130, eve: 120, cain: 120, abel: 120, noah: 140, abraham: 130, isaac: 100, jacob: 130, joseph: 120, moses: 130, aaron: 130, miriam: 100, mosesSinai: 130, joshua: 140, rahab: 100, deborah: 110, gideon: 120, samson: 150, ruth: 120, naomi: 90, boaz: 130, hannah: 100, saul: 150, abigail: 100, solomon: 130, elijah: 120, elisha: 120, jonah: 110, isaiah: 110, esther: 110, daniel: 130, nehemiah: 130, zechariah: 100, mary: 110, josephNaz: 130, johnBaptist: 120, jesus: 100, jesusUR: 150, peter: 140, andrew: 110, johnApostle: 110, matthew: 110, jamesZeb: 120, thomas: 110, maryMagdalene: 110, martha: 120, zacchaeus: 90, archerP: 70, bearerP: 110, goliathP: 150, serpentP: 100 };

export const SKILLS: Record<SkillId, SkillDef> = {
  sling: { id: "sling", owner: "david", kind: "attack", cost: 1, damage: 30 },
  slingStone: { id: "slingStone", owner: "david", kind: "faith", cost: 3, damage: 140 },
  rebuke: { id: "rebuke", owner: "samuel", kind: "attack", cost: 1, damage: 20 },
  heal: { id: "heal", owner: "samuel", kind: "guard", cost: 1 },
  arise: { id: "arise", owner: "samuel", kind: "guard", cost: 2 },
  sword: { id: "sword", owner: "jonathan", kind: "attack", cost: 1, damage: 30 },
  covshield: { id: "covshield", owner: "jonathan", kind: "guard", cost: 1 },
  till: { id: "till", owner: "adam", kind: "attack", cost: 1, damage: 30 },
  keep: { id: "keep", owner: "adam", kind: "guard", cost: 1 },
  mother: { id: "mother", owner: "eve", kind: "guard", cost: 1 },
  helper: { id: "helper", owner: "eve", kind: "guard", cost: 1 },
  offering: { id: "offering", owner: "cain", kind: "attack", cost: 1, damage: 20 },
  mark: { id: "mark", owner: "cain", kind: "guard", cost: 2 },
  firstlings: { id: "firstlings", owner: "abel", kind: "guard", cost: 1 },
  faithOffering: { id: "faithOffering", owner: "abel", kind: "attack", cost: 1, damage: 20 },
  ark: { id: "ark", owner: "noah", kind: "guard", cost: 2 },
  rainbow: { id: "rainbow", owner: "noah", kind: "guard", cost: 3 },
  stars: { id: "stars", owner: "abraham", kind: "guard", cost: 1 },
  provide: { id: "provide", owner: "abraham", kind: "faith", cost: 2 },
  harvest: { id: "harvest", owner: "isaac", kind: "attack", cost: 1, damage: 20 },
  ram: { id: "ram", owner: "isaac", kind: "guard", cost: 2 },
  wrestle: { id: "wrestle", owner: "jacob", kind: "attack", cost: 2, damage: 40 },
  ladder: { id: "ladder", owner: "jacob", kind: "faith", cost: 3 },
  granary: { id: "granary", owner: "joseph", kind: "guard", cost: 2 },
  meantForGood: { id: "meantForGood", owner: "joseph", kind: "faith", cost: 2 },
  sea: { id: "sea", owner: "moses", kind: "faith", cost: 3, damage: 60 },
  handsUp: { id: "handsUp", owner: "moses", kind: "guard", cost: 2 },
  blessing: { id: "blessing", owner: "aaron", kind: "guard", cost: 1 },
  breastplate: { id: "breastplate", owner: "aaron", kind: "guard", cost: 2 },
  timbrel: { id: "timbrel", owner: "miriam", kind: "attack", cost: 1, damage: 10 },
  song: { id: "song", owner: "miriam", kind: "guard", cost: 2 },
  tenWords: { id: "tenWords", owner: "mosesSinai", kind: "guard", cost: 2 },
  faceShone: { id: "faceShone", owner: "mosesSinai", kind: "faith", cost: 3 },
  courage: { id: "courage", owner: "joshua", kind: "attack", cost: 1, damage: 30 },
  jericho: { id: "jericho", owner: "joshua", kind: "faith", cost: 3, damage: 40 },
  hideSpies: { id: "hideSpies", owner: "rahab", kind: "guard", cost: 1 },
  scarletCord: { id: "scarletCord", owner: "rahab", kind: "guard", cost: 3 },
  upToday: { id: "upToday", owner: "deborah", kind: "attack", cost: 1 },
  starsFought: { id: "starsFought", owner: "deborah", kind: "faith", cost: 3, damage: 60 },
  fleece: { id: "fleece", owner: "gideon", kind: "guard", cost: 1 },
  torches: { id: "torches", owner: "gideon", kind: "faith", cost: 3, damage: 30 },
  jawbone: { id: "jawbone", owner: "samson", kind: "attack", cost: 2, damage: 30 },
  pillars: { id: "pillars", owner: "samson", kind: "faith", cost: 3, damage: 100 },
  glean: { id: "glean", owner: "ruth", kind: "guard", cost: 1 },
  whither: { id: "whither", owner: "ruth", kind: "guard", cost: 1 },
  counsel: { id: "counsel", owner: "naomi", kind: "guard", cost: 1 },
  restorer: { id: "restorer", owner: "naomi", kind: "guard", cost: 2 },
  wings: { id: "wings", owner: "boaz", kind: "guard", cost: 2 },
  redeemer: { id: "redeemer", owner: "boaz", kind: "guard", cost: 2 },
  prayer: { id: "prayer", owner: "hannah", kind: "guard", cost: 1 },
  hannahSong: { id: "hannahSong", owner: "hannah", kind: "faith", cost: 3, damage: 40 },
  javelin: { id: "javelin", owner: "saul", kind: "attack", cost: 1, damage: 30 },
  rashOffering: { id: "rashOffering", owner: "saul", kind: "guard", cost: 1 },
  provision: { id: "provision", owner: "abigail", kind: "guard", cost: 1 },
  intercede: { id: "intercede", owner: "abigail", kind: "guard", cost: 2 },
  wisdom: { id: "wisdom", owner: "solomon", kind: "guard", cost: 1 },
  templeFire: { id: "templeFire", owner: "solomon", kind: "faith", cost: 3, damage: 50 },
  ravens: { id: "ravens", owner: "elijah", kind: "guard", cost: 1 },
  carmel: { id: "carmel", owner: "elijah", kind: "faith", cost: 3, damage: 80 },
  healWaters: { id: "healWaters", owner: "elisha", kind: "guard", cost: 1 },
  chariots: { id: "chariots", owner: "elisha", kind: "faith", cost: 2 },
  castIntoSea: { id: "castIntoSea", owner: "jonah", kind: "guard", cost: 1 },
  nineveh: { id: "nineveh", owner: "jonah", kind: "attack", cost: 2, damage: 20 },
  sendMe: { id: "sendMe", owner: "isaiah", kind: "attack", cost: 1, damage: 30 },
  greatLight: { id: "greatLight", owner: "isaiah", kind: "faith", cost: 3, damage: 60 },
  fasting: { id: "fasting", owner: "esther", kind: "guard", cost: 1 },
  contrary: { id: "contrary", owner: "esther", kind: "faith", cost: 3 },
  stoneCut: { id: "stoneCut", owner: "daniel", kind: "attack", cost: 2, damage: 50 },
  lionsDen: { id: "lionsDen", owner: "daniel", kind: "faith", cost: 2 },
  buildWall: { id: "buildWall", owner: "nehemiah", kind: "guard", cost: 1 },
  swordAndTrowel: { id: "swordAndTrowel", owner: "nehemiah", kind: "attack", cost: 1, damage: 20 },
  incense: { id: "incense", owner: "zechariah", kind: "guard", cost: 1 },
  nameIsJohn: { id: "nameIsJohn", owner: "zechariah", kind: "guard", cost: 2 },
  handmaid: { id: "handmaid", owner: "mary", kind: "guard", cost: 1 },
  magnificat: { id: "magnificat", owner: "mary", kind: "faith", cost: 3 },
  carpenter: { id: "carpenter", owner: "josephNaz", kind: "guard", cost: 1 },
  dreamWarning: { id: "dreamWarning", owner: "josephNaz", kind: "faith", cost: 2 },
  axe: { id: "axe", owner: "johnBaptist", kind: "attack", cost: 2, damage: 40 },
  baptism: { id: "baptism", owner: "johnBaptist", kind: "guard", cost: 2 },
  leper: { id: "leper", owner: "jesus", kind: "guard", cost: 1 },
  gethsemane: { id: "gethsemane", owner: "jesus", kind: "guard", cost: 2 },
  walkOnWater: { id: "walkOnWater", owner: "jesusUR", kind: "faith", cost: 2 },
  loaves: { id: "loaves", owner: "jesusUR", kind: "faith", cost: 3 },
  greatCatch: { id: "greatCatch", owner: "peter", kind: "guard", cost: 1 },
  drawSword: { id: "drawSword", owner: "peter", kind: "attack", cost: 2, damage: 50 },
  comeAndSee: { id: "comeAndSee", owner: "andrew", kind: "guard", cost: 2 },
  aLadHere: { id: "aLadHere", owner: "andrew", kind: "guard", cost: 1 },
  thunder: { id: "thunder", owner: "johnApostle", kind: "attack", cost: 1, damage: 30 },
  loveOneAnother: { id: "loveOneAnother", owner: "johnApostle", kind: "guard", cost: 2 },
  taxBooth: { id: "taxBooth", owner: "matthew", kind: "guard", cost: 1 },
  feast: { id: "feast", owner: "matthew", kind: "guard", cost: 2 },
  mendNets: { id: "mendNets", owner: "jamesZeb", kind: "guard", cost: 1 },
  boanerges: { id: "boanerges", owner: "jamesZeb", kind: "attack", cost: 1, damage: 30 },
  reachFinger: { id: "reachFinger", owner: "thomas", kind: "guard", cost: 1 },
  myLord: { id: "myLord", owner: "thomas", kind: "faith", cost: 2, damage: 50 },
  spices: { id: "spices", owner: "maryMagdalene", kind: "guard", cost: 1 },
  seenTheLord: { id: "seenTheLord", owner: "maryMagdalene", kind: "faith", cost: 2 },
  serving: { id: "serving", owner: "martha", kind: "attack", cost: 1 },
  riseAgain: { id: "riseAgain", owner: "martha", kind: "faith", cost: 2 },
  sycamore: { id: "sycamore", owner: "zacchaeus", kind: "guard", cost: 1 },
  fourfold: { id: "fourfold", owner: "zacchaeus", kind: "guard", cost: 1 },
  volley: { id: "volley", owner: "archerP", kind: "attack", cost: 1, damage: 40 },
  shieldUp: { id: "shieldUp", owner: "bearerP", kind: "guard", cost: 1 },
  bash: { id: "bash", owner: "bearerP", kind: "attack", cost: 1, damage: 20 },
  spearThrust: { id: "spearThrust", owner: "goliathP", kind: "attack", cost: 1, damage: 30 },
  taunt: { id: "taunt", owner: "goliathP", kind: "attack", cost: 2, damage: 10 },
  venom: { id: "venom", owner: "serpentP", kind: "attack", cost: 1, damage: 30 },
  beguile: { id: "beguile", owner: "serpentP", kind: "guard", cost: 3 },
};

export const CHARACTER_SKILLS: Record<CharacterId, SkillId[]> = {
  david: ["sling", "slingStone"],
  samuel: ["rebuke", "heal", "arise"],
  jonathan: ["sword", "covshield"],
  adam: ["till", "keep"],
  cain: ["offering", "mark"],
  abel: ["firstlings", "faithOffering"],
  noah: ["ark", "rainbow"],
  abraham: ["stars", "provide"],
  isaac: ["harvest", "ram"],
  jacob: ["wrestle", "ladder"],
  joseph: ["granary", "meantForGood"],
  moses: ["sea", "handsUp"],
  aaron: ["blessing", "breastplate"],
  miriam: ["timbrel", "song"],
  mosesSinai: ["tenWords", "faceShone"],
  joshua: ["courage", "jericho"],
  rahab: ["hideSpies", "scarletCord"],
  deborah: ["upToday", "starsFought"],
  gideon: ["fleece", "torches"],
  samson: ["jawbone", "pillars"],
  ruth: ["glean", "whither"],
  naomi: ["counsel", "restorer"],
  boaz: ["wings", "redeemer"],
  hannah: ["prayer", "hannahSong"],
  saul: ["javelin", "rashOffering"],
  abigail: ["provision", "intercede"],
  solomon: ["wisdom", "templeFire"],
  elijah: ["ravens", "carmel"],
  elisha: ["healWaters", "chariots"],
  jonah: ["castIntoSea", "nineveh"],
  isaiah: ["sendMe", "greatLight"],
  esther: ["fasting", "contrary"],
  daniel: ["stoneCut", "lionsDen"],
  nehemiah: ["buildWall", "swordAndTrowel"],
  zechariah: ["incense", "nameIsJohn"],
  mary: ["handmaid", "magnificat"],
  josephNaz: ["carpenter", "dreamWarning"],
  johnBaptist: ["axe", "baptism"],
  jesus: ["leper", "gethsemane"],
  jesusUR: ["walkOnWater", "loaves"],
  peter: ["greatCatch", "drawSword"],
  andrew: ["comeAndSee", "aLadHere"],
  johnApostle: ["thunder", "loveOneAnother"],
  matthew: ["taxBooth", "feast"],
  jamesZeb: ["mendNets", "boanerges"],
  thomas: ["reachFinger", "myLord"],
  maryMagdalene: ["spices", "seenTheLord"],
  martha: ["serving", "riseAgain"],
  zacchaeus: ["sycamore", "fourfold"],
  eve: ["mother", "helper"],
  archerP: ["volley"],
  bearerP: ["shieldUp", "bash"],
  goliathP: ["spearThrust", "taunt"],
  serpentP: ["venom", "beguile"],
};

export const CARDS_V2: Record<CardId, CardDef> = {
  delivered: { id: "delivered", energy: "faith" },
  battle: { id: "battle", energy: "faith" },
  trust: { id: "trust", energy: "faith" },
  assurance: { id: "assurance", energy: "faith" },
  inname: { id: "inname", energy: "attack" },
  trains: { id: "trains", energy: "attack" },
  stones: { id: "stones", energy: "attack" },
  wings: { id: "wings", energy: "guard" },
  shepherd: { id: "shepherd", energy: "guard" },
  renewed: { id: "renewed", energy: "guard" },
  bestrong: { id: "bestrong", energy: "guard" },
  covenant: { id: "covenant", energy: "guard" },
};

/** 15 energy cards: ✨ Faith 4, 🗡️ Attack 6, 🕊️ Guard 5. */
export const DECK_V2: CardId[] = [
  "delivered", "battle", "trust", "assurance",
  "inname", "inname", "trains", "trains", "stones", "stones",
  "wings", "shepherd", "renewed", "bestrong", "covenant",
];

export const PHASE1_CYCLE: GoliathActionId[] = ["defy", "spear", "raise", "crush"];
export const PHASE2_CYCLE: GoliathActionId[] = ["swing", "raise", "crush"];
/** The Serpent keeps one cycle; after shedding its skin (half HP) its fang hits harder. */
export const SERPENT_CYCLE: GoliathActionId[] = ["tempt", "fang", "coil", "fang"];
