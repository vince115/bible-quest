// Bible Quest v2 battle model (energy-card version). Independent of the v1 engine in game/engine.ts.
// Scripture cards are energy; characters act through skills paid with that energy.

/** Playable characters. The *P ids are the enemy cards' playable versions (a card can be drawn and fielded by the player). */
export type CharacterId = "david" | "samuel" | "jonathan" | "adam" | "eve" | "cain" | "abel" | "seth" | "noah" | "abraham" | "isaac" | "jacob" | "joseph" | "moses" | "aaron" | "miriam" | "mosesSinai" | "joshua" | "rahab" | "deborah" | "gideon" | "samson" | "ruth" | "naomi" | "boaz" | "hannah" | "saul" | "abigail" | "solomon" | "elijah" | "elisha" | "jonah" | "isaiah" | "esther" | "daniel" | "nehemiah" | "zechariah" | "mary" | "josephNaz" | "johnBaptist" | "jesus" | "jesusUR" | "peter" | "andrew" | "johnApostle" | "matthew" | "jamesZeb" | "thomas" | "maryMagdalene" | "martha" | "zacchaeus" | "maryBethany" | "lazarus" | "stephen" | "philip" | "paul" | "barnabas" | "silas" | "timothy" | "lydia" | "priscilla" | "eli" | "aquila" | "dorcas" | "cornelius" | "apollos" | "phoebe" | "luke" | "johnMark" | "titus" | "philemon" | "onesimus" | "nicodemus" | "samaritan" | "simeon" | "anna" | "loavesBoy" | "judas" | "philipApostle" | "nathanael" | "jamesAlph" | "thaddaeus" | "simonZealot" | "matthias" | "elizabeth" | "mordecai" | "sarah" | "rebekah" | "rachel" | "barak" | "jael" | "josephArimathea" | "ananias" | "threeFriends" | "job" | "enoch" | "melchizedek" | "caleb" | "jeremiah" | "ezekiel" | "ezra" | "nathan" | "hezekiah" | "josiah" | "magi" | "shepherds" | "bartimaeus" | "centurion" | "jairus" | "simonCyrene" | "thief" | "jamesJust" | "mockingThief" | "jesusCross" | "widow" | "fisherman" | "fourFriends" | "goodSamaritan" | "zarephath" | "shunammite" | "naaman" | "maid" | "bathsheba" | "mephibosheth" | "sheba" | "leah" | "esau" | "hagar" | "lot" | "jochebed" | "pharaohDaughter" | "jethro" | "zipporah" | "loisEunice" | "balaam" | "pharaoh" | "charioteer" | "jezebel" | "baalProphet" | "haman" | "delilah" | "nebuchadnezzar" | "ahab" | "absalom" | "sapphira" | "pilate" | "caiaphas" | "herod" | "barabbas" | "herodias" | "romanSoldier" | "romanSpearman" | "romanArcher" | "romanCavalry" | "romanCenturion" | "sennacherib" | "belshazzar" | "korah" | "achan" | "sisera" | "herodGreat" | "legionFreed" | "prodigal" | "ethiopian" | "johnPatmos" | "ehud" | "jephthah" | "joab" | "uriah" | "cyrus" | "zerubbabel" | "vashti" | "michal" | "gehazi" | "jehu" | "canaanite" | "richRuler" | "cleopas" | "malchus" | "jailer" | "rhoda" | "simonMagus" | "herodAgrippa" | "archerP" | "bearerP" | "goliathP" | "serpentP"
  | "father" | "holySpirit" | "gabriel" | "michael" | "satanDisguised" | "satan";

/** ✨ Faith can stand in for Attack or Guard; Faith and 🕊️ Guard carry over, 🗡️ Attack resets each turn. */
export type EnergyKind = "faith" | "attack" | "guard";

export type SkillId =
  | "anotherSeed" | "callOnLord"
  | "greatFlood" | "comeOut" | "sling" | "slingStone" | "rebuke" | "heal" | "arise" | "sword" | "covshield" | "till" | "keep" | "mother" | "helper" | "offering" | "mark" | "firstlings" | "faithOffering" | "ark" | "rainbow" | "stars" | "provide" | "harvest" | "ram" | "wrestle" | "ladder" | "granary" | "meantForGood" | "sea" | "handsUp" | "blessing" | "breastplate" | "timbrel" | "song" | "tenWords" | "faceShone" | "courage" | "jericho" | "hideSpies" | "scarletCord" | "upToday" | "starsFought" | "fleece" | "torches" | "jawbone" | "pillars" | "glean" | "whither" | "counsel" | "restorer" | "wings" | "redeemer" | "prayer" | "hannahSong" | "javelin" | "rashOffering" | "provision" | "intercede" | "wisdom" | "templeFire" | "ravens" | "carmel" | "healWaters" | "chariots" | "castIntoSea" | "nineveh" | "sendMe" | "greatLight" | "fasting" | "contrary" | "stoneCut" | "lionsDen" | "buildWall" | "swordAndTrowel" | "incense" | "nameIsJohn" | "handmaid" | "magnificat" | "carpenter" | "dreamWarning" | "axe" | "baptism" | "peaceBeUnto" | "withYouAlway" | "loaves" | "walkOnWater" | "greatCatch" | "drawSword" | "comeAndSee" | "aLadHere" | "thunder" | "loveOneAnother" | "taxBooth" | "feast" | "mendNets" | "boanerges" | "reachFinger" | "myLord" | "spices" | "seenTheLord" | "serving" | "riseAgain" | "sycamore" | "fourfold" | "atHisFeet" | "spikenard" | "looseHim" | "manyBelieved" | "gracePower" | "heavensOpened" | "hereIsWater" | "samaria" | "armourOfGod" | "swordOfSpirit" | "encourage" | "soldField" | "midnightHymns" | "prisonOpened" | "example" | "stirUpGift" | "purpleCloth" | "abideHouse" | "tentmaking" | "expound" | "goInPeace" | "speakLord" | "tentRope" | "layDownNeck" | "garments" | "almsdeeds" | "centurionCommand" | "prayersAlms" | "mightyScriptures" | "watered" | "succourer" | "bearLetter" | "physician" | "inOrder" | "departed" | "profitable" | "setInOrder" | "earnestCare" | "refreshed" | "receiveHim" | "nowProfitable" | "belovedBrother" | "byNight" | "bornAgain" | "livingWater" | "comeSee" | "waiting" | "nuncDimittis" | "nightAndDay" | "gaveThanks" | "giveBasket" | "pebble" | "thirtySilver" | "moneyBag" | "philipComeSee" | "twoHundredPence" | "figTree" | "noGuile" | "quietFaith" | "oneOfTwelve" | "aQuestion" | "contendFaith" | "zeal" | "swordDown" | "lotFell" | "withEleven" | "leaped" | "blessedAmong" | "wouldNotBow" | "suchATime" | "laughter" | "tooHard" | "drinkMyLord" | "waterCamels" | "keepSheep" | "fewDays" | "ifThouGo" | "downTabor" | "blessedAbove" | "tentPeg" | "wentInBoldly" | "fineLinen" | "brotherSaul" | "scalesFell" | "butIfNot" | "fourthMan" | "lordGave" | "turnedCaptivity" | "walkedWithGod" | "saintsCome" | "breadAndWine" | "tenthOfAll" | "goUpAtOnce" | "thisMountain" | "almondRod" | "fireInBones" | "watchman" | "dryBones" | "preparedHeart" | "readTheLaw" | "thouArtTheMan" | "houseForever" | "spreadLetter" | "fifteenYears" | "heardTheBook" | "purgeIdols" | "hisStar" | "threeGifts" | "goodTidings" | "gloryHighest" | "sonOfDavid" | "castGarment" | "speakTheWord" | "underAuthority" | "onlyBelieve" | "talithaCumi" | "bearHisCross" | "comingFromCountry" | "rememberMe" | "paradise" | "swiftToHear" | "faithWorks" | "saveThyself" | "railedOn" | "forgiveThem" | "commitSpirit" | "twoMites" | "allHerLiving" | "toiledAllNight" | "atThyWord" | "throughTheRoof" | "theirFaith" | "oilAndWine" | "twoPence" | "hardenedHeart" | "makeBricks" | "pursued" | "chosenChariots" | "royalCommand" | "sealedLetters" | "callOnBaal" | "cutThemselves" | "kingsRing" | "hamansDecree" | "pieceOfSilver" | "whereinStrength" | "sevenTimesHotter" | "praiseKingOfHeaven" | "covetVineyard" | "humbledHimself" | "mealNotSpent" | "littleCake" | "littleChamber" | "itIsWell" | "sevenTimesJordan" | "captainOfHost" | "wouldGod" | "littleMaid" | "rememberOath" | "kingsMother" | "stoleHearts" | "fiftyMen" | "kingsTable" | "deadDog" | "hardQuestions" | "spicesAndGold" | "lookedUpon" | "nowPraise" | "cunningHunter" | "ranToMeet" | "godHeard" | "wellOpened" | "escapeForLife" | "lookedBack" | "arkOfBulrushes" | "nurseHim" | "hadCompassion" | "drewHimOut" | "shareBurden" | "greaterThanAll" | "wateredFlock" | "strangerLand" | "unfeignedFaith" | "fromAChild" | "soldPossession" | "keptBackPart" | "noFault" | "washedHands" | "oneManDie" | "rentClothes" | "hopedSign" | "gorgeousRobe" | "insurrection" | "releasedUnto" | "convenientDay" | "heldGrudge" | "shieldWall" | "gladius" | "braceSpears" | "pilum" | "aimedShot" | "arrowVolley" | "rideOut" | "cavalryCharge" | "commandCohort" | "trulySonOfGod" | "whomTrust" | "fencedCities" | "goldenVessels" | "writingOnWall" | "donkeySaw" | "blessNotCurse" | "takeTooMuch" | "strangeCensers" | "hiddenSpoil" | "troubleOfAchor" | "ironChariots" | "fledToTent" | "privilyCalled" | "exceedingWroth" | "rightMind" | "tellHowGreat" | "cameToHimself" | "bestRobe" | "readingIsaiah" | "wentRejoicing" | "inTheSpirit" | "newHeaven" | "leftHanded" | "blewTrumpet" | "judgeThisDay" | "rashVow" | "playTheMen" | "threeDarts" | "wouldNotGoHome" | "hottestBattle" | "sorceries" | "offeredMoney" | "pleasedJews" | "voiceOfGod" | "cyrusDecree" | "returnVessels" | "laidFoundation" | "notByMight" | "refusedToCome" | "royalFeast" | "letDownWindow" | "imageInBed" | "ranAfterNaaman" | "twoTalents" | "drivethFuriously" | "zealForLord" | "lordHelpMe" | "crumbs" | "keptAllThese" | "greatPossessions" | "heartsBurn" | "breakingBread" | "lanternsTorches" | "earHealed" | "whatMustIDo" | "washedStripes" | "forGladness" | "ranInTold"
  | "volley" | "shieldUp" | "bash" | "spearThrust" | "taunt" | "venom" | "beguile"
  | "letThereBeLight" | "lordMyShield" | "likeADove" | "comforter" | "heraldNews" | "fearNot" | "whoIsLikeGod" | "heavenlyHost" | "ifThouBeSon" | "angelOfLight" | "fieryDarts" | "roaringLion";

export type CardId =
  // ✨ Faith
  | "delivered"
  | "fightForYou"
  | "allThings"
  | "assurance"
  // 🗡️ Attack
  | "spiritSword"
  | "trains"
  | "stones"
  // 🕊️ Guard
  | "wings"
  | "shepherd"
  | "renewed"
  | "bestrong"
  | "threefoldCord";

/**
 * Elements (reserved, switched off by RULES_V2.elements.enabled):
 * 💧 water → 🔥 fire → 🌿 wood → 💧 water, and ✨ light ⇄ 🌑 dark (they counter each other).
 * Any side may use any element (PvP opponents can field dark cards); enemies simply tend to be dark.
 */
export type Element = "metal" | "wood" | "water" | "fire" | "earth" | "light" | "dark";

/**
 * The enemies: Goliath with his shield bearer (1 Sam 17:7) and a Philistine archer, and the other campaign bosses,
 * each fighting alone: the Serpent, the Flood, Pharaoh's chariots, the walls of Jericho, the prophets of Baal,
 * the lions of the den and Legion.
 */
export type EnemyId =
  | "bearer" | "goliath" | "archer" | "serpent"
  | "flood" | "fountains" | "windows"
  | "chariots" | "pharaohHost" | "chariotCaptain"
  | "walls" | "jerichoKing" | "wallGuard"
  | "baalProphets" | "ahabKing" | "jezebelQueen"
  | "lionRest" | "lion" | "lioness" | "presidents" | "princes"
  | "serpentTempter" | "satanMan" | "satanFoe"
  | "legion" | "uncleanSpirits" | "swine";

/** Which battle is being fought: the campaign's eight stages (Goliath brings his shield bearer and archer). */
/**
 * "plot" is the first round of the lions' stage (the presidents and princes plot against Daniel) and "tempter" the first
 * round of Eden (the cunning serpent tempts Eve); "disguise" is the first round of the temptation in the wilderness (Satan
 * looks like a man) and "temptation" its second (he shows what he is). None of them is a stage of its own.
 */
export type StageId = "goliath" | "eden" | "ark" | "redSea" | "jericho" | "carmel" | "lions" | "gerasa" | "plot" | "tempter" | "temptation" | "disguise";

/** Who an effect must be aimed at, chosen by the player before it resolves. */
/** actedAlly: an ally who has already acted this turn (Eve's Helper lets them act again). */
/** anyEnemy: any standing enemy, ignoring the shield bearer's protection (the archer's Volley). */
export type TargetKind = "none" | "ally" | "otherAlly" | "fallenAlly" | "actedAlly" | "enemy" | "anyEnemy";

export interface SkillDef {
  id: SkillId;
  owner: CharacterId;
  /** Paid with this energy kind (Faith can stand in for Attack/Guard; Sling Stone needs real Faith). */
  kind: EnergyKind;
  cost: number;
  damage?: number;
}

/** When a scripture card may be played: from turn 3, or only with some Faith in hand. */
export type CardCondition = "turn3" | "needFaith";

export interface CardDef {
  id: CardId;
  energy: EnergyKind;
  /** Energy given when played (1–3). */
  amount: number;
  /** When the card may be played; none means any time. */
  condition?: CardCondition;
}

export interface CardInstance {
  uid: number;
  card: CardId;
}

export type EnergyPool = Record<EnergyKind, number>;

export interface CharacterState {
  hp: number;
  shield: number;
  shaken: boolean;
  /** Used a skill this turn (one per turn). */
  acted: boolean;
  /** Personal pools (BattleState.pools === "personal"; always 0 in the team-energy mode): MP pays spells, SP pays strikes. */
  mp: number;
  sp: number;
  /**
   * Tabletop mode only: the energy cards stuck under this character, by colour, each with its value: red pays strikes,
   * green pays heals and defence, blue pays magic. `mp` and `sp` then hold the totals of the blue and red cards.
   */
  cards?: { red: number[]; green: number[]; blue: number[] };
}

/**
 * How energy works in a battle. "team": one shared pool of Faith, Attack and Guard that scripture cards fill and any
 * ally's skills spend. "personal" (the free digital mode): every character has their own MP (spells: healing, shields,
 * utility, ultimates) and SP (strikes) as large numbers; scripture cards are given to a chosen ally (see playCard).
 * "table" (the tabletop rules): scripture cards of three colours (red attack, green heal, blue magic) are stuck under a
 * character (at most attachPerTurn a turn, up to an energy cap by rarity) and skills cost 1 to 3 of their own colour;
 * elements add or take away a flat 10.
 */
export type PoolMode = "team" | "personal" | "table";

/**
 * The boss's actions: Goliath's; the Serpent's (tempt, fang, coil); the Flood's (rain, surge, rise, deluge);
 * the chariots' (pursue, charge, arrows); the walls' (stones, arrows, repair, boulder); the prophets of Baal's
 * (cry, leap, cut); the lions' (roar, pounce, maul); the presidents' (accuse, decree); the tempter's (lure, darts, devour); Legion's (many, chains, torment).
 */
export type GoliathActionId =
  | "defy" | "spear" | "raise" | "crush" | "swing"
  | "tempt" | "fang" | "coil"
  | "rain" | "surge" | "rise" | "deluge"
  | "pursue" | "charge" | "arrows"
  | "stones" | "repair" | "boulder"
  | "cry" | "leap" | "cut"
  | "roar" | "pounce" | "maul"
  | "accuse" | "decree"
  | "lure" | "darts" | "devour"
  | "many" | "chains" | "torment";

export interface Intent {
  action: GoliathActionId;
  /** Single target (Spear Thrust, Crushing Blow) or the allies Defy the Armies will shake. */
  targets: CharacterId[];
}

export interface EnemyState {
  hp: number;
}

/** Goliath's own status; his HP lives in `enemies.goliath`. */
export interface GoliathState {
  /**
   * The boss's second phase: Goliath Enraged after the first Sling Stone; the Serpent shed at half HP; the Flood
   * prevailing from turn 4; the chariots' wheels off, the walls cracked, the prophets in a frenzy and Legion
   * unleashed at half HP (the lions have no second phase).
   */
  enraged: boolean;
  charging: boolean;
  stunned: boolean;
  /** Index of the current intent within the phase cycle. */
  cycle: number;
}

export interface LogEntry {
  id: number;
  turn: number;
  key: string;
  params?: Record<string, string | number | boolean | undefined>;
  kind: "player" | "enemy" | "system" | "detail";
}

export type BattleResult = "ongoing" | "victory" | "defeat";

export interface BattleState {
  turn: number;
  energy: EnergyPool;
  /** Team energy (the default), each character's own MP and SP, or the tabletop rules. */
  pools: PoolMode;
  /** Tabletop mode: energy cards attached so far this turn (at most R.table.attachPerTurn). */
  attached: number;
  party: Record<CharacterId, CharacterState>;
  enemies: Record<EnemyId, EnemyState>;
  /** The boss's status (Goliath, or the Serpent in Eden); the name is kept from stage 1. */
  goliath: GoliathState;
  stage: StageId;
  /** The ally the Serpent coiled around: they can't be swapped out of the front line this turn. */
  coiled: CharacterId | null;
  /** Goliath's [current intent, next intent]; both are always shown. */
  intents: [Intent, Intent];
  /** Who the stage's shooter (the archer, the captain of the chariots, ...) will hit this turn. */
  archerTarget: CharacterId | null;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  /** Arise can be used once per battle. */
  ariseUsed: boolean;
  /** Eve's Helper can be used once per battle. */
  helperUsed: boolean;
  /** The Serpent card's Beguile can be used once per battle. */
  beguileUsed: boolean;
  /** Cain's Mark can be used once per battle; marked: it holds through this turn's enemy phase. */
  markUsed: boolean;
  marked: boolean;
  /** Noah's Rainbow Covenant can be used once per battle. */
  rainbowUsed: boolean;
  /** Abraham's The LORD Will Provide can be used once per battle. */
  provideUsed: boolean;
  /** Isaac's Ram in the Thicket can be used once per battle; ramReady: it spares the next ally who would fall this turn. */
  ramUsed: boolean;
  ramReady: boolean;
  /** Jacob's Ladder can be used once per battle. */
  ladderUsed: boolean;
  /** Joseph's God Meant It for Good can be used once per battle. */
  goodUsed: boolean;
  /** Moses: Part the Red Sea once per battle; handsUp: his raised hands strengthen every attack this turn. */
  seaUsed: boolean;
  handsUp: boolean;
  /** Aaron's Breastplate: the enemy leader's damage is halved this turn. */
  breastplate: boolean;
  /** Moses at Sinai: His Face Shone can be used once per battle. */
  shoneUsed: boolean;
  /** Joshua's Jericho Falls can be used once per battle. */
  jerichoUsed: boolean;
  /** Rahab's Scarlet Cord can be used once per battle; cordReady: no ally can fall this turn. */
  cordUsed: boolean;
  cordReady: boolean;
  /** Deborah's Stars Fought from Heaven can be used once per battle. */
  starsFoughtUsed: boolean;
  /** Gideon's Torches and Pitchers can be used once per battle. */
  torchesUsed: boolean;
  /** Ruth's Whither Thou Goest: the ally whose blows she takes this turn. */
  covered: CharacterId | null;
  /** Naomi's Restorer of Life can be used once per battle. */
  restorerUsed: boolean;
  /** Boaz's Kinsman Redeemer can be used once per battle. */
  redeemerUsed: boolean;
  /** Hannah's Song can be used once per battle. */
  hannahSongUsed: boolean;
  /** Saul offered in haste: he is Shaken next turn. */
  saulRash: boolean;
  /** Mark left the work midway: he is Shaken next turn. */
  markLeft: boolean;
  /** Philemon's Receive Him as Myself can be used once per battle. */
  receiveUsed: boolean;
  /** Nicodemus' Born Again can be used once per battle. */
  bornAgainUsed: boolean;
  /** Simeon is waiting for the consolation of Israel: +1 Faith every other turn. */
  simeonWaiting: boolean;
  /** The boy's basket can be given once per battle. */
  basketGiven: boolean;
  /** Matthias' The Lot Fell can be used once per battle. */
  lotUsed: boolean;
  /** Sarah's Is Any Thing Too Hard can be used once per battle. */
  tooHardUsed: boolean;
  /** Abigail's Wise Intercession: every hit on an ally is softened this turn. */
  intercede: boolean;
  /** Solomon's Fire from Heaven can be used once per battle. */
  templeFireUsed: boolean;
  /** Elijah's Fire on Carmel can be used once per battle. */
  carmelUsed: boolean;
  /** Elisha's Chariots of Fire can be used once per battle. */
  chariotsUsed: boolean;
  /** Jonah: castIntoSea draws every blow to him this turn; fish: "ready" until he falls, "inside" until he returns, then "used". */
  castIntoSea: boolean;
  fish: "ready" | "inside" | "used";
  /** Isaiah's A Great Light can be used once per battle. */
  greatLightUsed: boolean;
  /** Esther's Turned to the Contrary: once per battle; while on, the leader's blows fall back on it this turn. */
  contraryUsed: boolean;
  contrary: boolean;
  /** Daniel's Shut the Lions' Mouths: once per battle; while on, the leader's blows go to Daniel and do no harm. */
  lionsDenUsed: boolean;
  lionsDen: boolean;
  /** Shadrach, Meshach and Abednego: the Fourth in the Fire keeps every ally unhurt this turn, once per battle. */
  fourthManUsed: boolean;
  fiery: boolean;
  /** Job: the LORD Turned His Captivity can be used once per battle. */
  captivityUsed: boolean;
  /** Enoch: God took him — the first time he falls, every ally is blessed. */
  enochTaken: boolean;
  /** Ezekiel: the Dry Bones Live can be used once per battle. */
  dryBonesUsed: boolean;
  /** Hezekiah: Spread the Letter before the LORD can be used once per battle. */
  letterUsed: boolean;
  /** The Magi: Gold, Frankincense and Myrrh can be given once per battle. */
  giftsGiven: boolean;
  /** Jairus: Talitha Cumi can be used once per battle. */
  talithaUsed: boolean;
  /** Jesus on the cross: Into Thy Hands can be spoken once per battle. */
  spiritUsed: boolean;
  /** Nebuchadnezzar praises the King of heaven once per battle. */
  praisedHeaven: boolean;
  /** Ahab humbles himself once per battle. */
  ahabHumbled: boolean;
  /** The Shunammite woman's It Is Well can be used once per battle. */
  itIsWellUsed: boolean;
  /** Naaman dips seven times in Jordan once per battle. */
  jordanUsed: boolean;
  /** Hagar sees the well once per battle. */
  wellUsed: boolean;
  /** Barabbas is released once per battle. */
  releasedUsed: boolean;
  /** The good Samaritan's Two Pence: the innkeeper looks after this ally for a few more turns. */
  inn: { ally: CharacterId; turns: number } | null;
  /** How many times Nehemiah has built the wall this battle: each course makes it stronger. */
  wallCourses: number;
  /** Zechariah's His Name Is John can be used once per battle. */
  johnUsed: boolean;
  /** Mary's Magnificat can be used once per battle. */
  magnificatUsed: boolean;
  /** Joseph of Nazareth's Warned in a Dream can be used once per battle. */
  dreamUsed: boolean;
  /** Jesus: Five Loaves and Two Fish, and Walking on Water, can each be used once per battle. */
  loavesUsed: boolean;
  walkUsed: boolean;
  withYouUsed: boolean;
  /** Andrew's Come and See can be used once per battle. */
  comeAndSeeUsed: boolean;
  /** James has drunk the cup: every ally's attacks are stronger for the rest of the battle. */
  cupDrunk: boolean;
  /** Thomas has seen and believed: My Lord and My God is unlocked. */
  thomasBelieves: boolean;
  /** Mary Magdalene's I Have Seen the Lord can be used once per battle. */
  seenUsed: boolean;
  /** Martha's Thy Brother Shall Rise Again: "ready" waits for the next ally to fall, then holds who comes back next turn. */
  riseAgain: "unused" | "ready" | CharacterId | "used";
  /** Zacchaeus is up the sycamore this turn (out of reach); Restore Fourfold can be used once per battle. */
  inTree: boolean;
  fourfoldUsed: boolean;
  /** Mary of Bethany's Spikenard can be used once per battle. */
  spikenardUsed: boolean;
  /** Lazarus, come forth: "ready" until he falls beside Jesus, "tomb" until next turn, then "raised". */
  lazarus: "ready" | "tomb" | "raised";
  /** Stephen's Heavens Opened can be used once per battle. */
  heavensUsed: boolean;
  /** Barnabas' Sold His Field can be used once per battle. */
  fieldSold: boolean;
  /** Silas' Prison Doors Opened can be used once per battle. */
  prisonOpened: boolean;
  /** Timothy is an example to the believers this turn: every attack is a little stronger. */
  example: boolean;
  /** The ally Priscilla has taught this turn: their attacks are stronger. */
  taught: CharacterId | null;
  /** Eli's Speak, Lord can be used once per battle. */
  speakUsed: boolean;
  /** The ally Aquila takes the blows for this turn. */
  aquilaCovers: CharacterId | null;
  /** Simon of Cyrene bears the blows meant for this ally this turn. */
  simonCovers: CharacterId | null;
  /** The Roman spearman holds the line in front of this ally this turn. */
  spearCovers: CharacterId | null;
  /** Tabitha, arise: "ready" until she falls beside Peter, "asleep" until next turn, then "raised". */
  dorcas: "ready" | "asleep" | "raised";
  /** Jesus (UR) rises once: the turn he rises on while in the tomb, else null; risenUsed after that. */
  tomb: number | null;
  risenUsed: boolean;
  /** The characters in this battle; everyone else sits it out (HP 0, never targeted). */
  lineup: CharacterId[];
  log: LogEntry[];
  seq: number;
  result: BattleResult;
}
