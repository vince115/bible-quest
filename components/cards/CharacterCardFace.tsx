"use client";

// Full-size character card face (TCG layout): name/HP, art, skills, passive, weakness/resistance, verse.
// With an illustration the card is full-art; without one it uses an art window with the character's emoji.
import { CHARACTER_ELEMENT, CHARACTER_SKILLS, MAX_HP, NEVER_FALLS, RULES_V2 as R, SKILLS, STORY } from "@/game/v2/data";
import { baseSupportAmount, elementMultiplier } from "@/game/v2/engine";
import type { CharacterId, Element, EnergyKind } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { CardFrame, type Ornament } from "./CardFrame";
import { figureOnFace, frameFigure, type Figure } from "./framing";
import { Foil } from "./HoloCard";
import { CARD_RARITY, RARITY, type Rarity } from "./rarity";
import { ElementIcon } from "./ElementIcon";
import { RarityMark } from "./RarityMark";

export const ELEMENTS: Element[] = ["metal", "wood", "water", "fire", "earth", "light", "dark"];
const ENERGY_ICON: Record<EnergyKind, string> = { faith: "✨", attack: "🗡️", guard: "🕊️" };
const PORTRAIT: Record<CharacterId, string> = { david: "🪨", samuel: "📜", jonathan: "🤝", adam: "🌳", eve: "🌸", cain: "🌾", abel: "🐑", noah: "🌈", abraham: "⭐", isaac: "🪵", jacob: "🪜", joseph: "🌾", moses: "🔥", aaron: "💎", miriam: "🪘", mosesSinai: "📜", joshua: "⚔️", rahab: "🧶", deborah: "🌴", gideon: "🔦", samson: "💪", ruth: "🌾", naomi: "🏠", boaz: "🌾", hannah: "🙏", saul: "👑", abigail: "🧺", solomon: "📜", elijah: "🐦‍⬛", elisha: "🧥", jonah: "🐋", isaiah: "🔥", esther: "👑", daniel: "🦁", nehemiah: "🧱", zechariah: "📝", mary: "🕊️", josephNaz: "🪚", johnBaptist: "🌊", jesus: "✝️", jesusUR: "✝️", peter: "🎣", andrew: "🐟", johnApostle: "⚡", matthew: "🪙", jamesZeb: "⛵", thomas: "✋", maryMagdalene: "🌿", martha: "🍞", zacchaeus: "🌳", maryBethany: "🏺", lazarus: "🪨", stephen: "😇", philip: "📜", paul: "✉️", barnabas: "🤝", silas: "🎶", timothy: "📖", lydia: "🟪", priscilla: "⛺", eli: "🪔", aquila: "🪢", dorcas: "🧵", cornelius: "🛡️", apollos: "📜", phoebe: "✉️", luke: "⚕️", johnMark: "🦁", titus: "🏛️", philemon: "🚪", onesimus: "🎒", nicodemus: "🌙", samaritan: "🏺", simeon: "👶", anna: "🕯️", loavesBoy: "🧺", judas: "💰", philipApostle: "👉", nathanael: "🌳", jamesAlph: "🤲", thaddaeus: "❓", simonZealot: "🔥", matthias: "🎲", elizabeth: "🤰", mordecai: "🚪", sarah: "😄", rebekah: "🏺", rachel: "🐑", barak: "⛰️", jael: "⛺", josephArimathea: "🪨", ananias: "👁️", threeFriends: "🔥", job: "🌾", enoch: "🚶", melchizedek: "🍞", caleb: "⛰️", jeremiah: "🌸", ezekiel: "🦴", ezra: "📜", nathan: "👉", hezekiah: "✉️", josiah: "📖", magi: "⭐", shepherds: "🐑", bartimaeus: "👁️", centurion: "🪖", jairus: "🙏", simonCyrene: "✝️", thief: "🕊️", jamesJust: "👂", mockingThief: "😠", jesusCross: "✝️", widow: "🪙", fisherman: "🎣", fourFriends: "🛏️", goodSamaritan: "🫒", zarephath: "🫓", shunammite: "🛏️", naaman: "🌊", maid: "🧺", bathsheba: "👑", mephibosheth: "🍞", sheba: "💎", leah: "🌾", esau: "🏹", hagar: "💧", lot: "🧂", jochebed: "🧺", pharaohDaughter: "👶", jethro: "⛺", zipporah: "🐑", loisEunice: "📜", balaam: "🫏", legionFreed: "🌊", prodigal: "🏠", ethiopian: "📜", johnPatmos: "🏝️", ehud: "🗡️", jephthah: "🛡️", joab: "⚔️", uriah: "🛡️", cyrus: "📜", zerubbabel: "🧱", vashti: "👑", michal: "🪢", jehu: "🏇", canaanite: "🍞", richRuler: "💎", cleopas: "🔥", malchus: "👂", jailer: "🔑", rhoda: "🚪", pharaoh: "𓂀", charioteer: "🐎", jezebel: "👑", baalProphet: "🗿", haman: "💍", delilah: "✂️", nebuchadnezzar: "🔥", ahab: "🍇", absalom: "💇", sapphira: "💰", pilate: "⚖️", caiaphas: "🕯️", herod: "🥻", barabbas: "⛓️", herodias: "🍷", romanSoldier: "🛡️", romanSpearman: "🔱", romanArcher: "🏹", romanCavalry: "🐎", romanCenturion: "⚜️", sennacherib: "🦁", belshazzar: "🍷", korah: "🔥", achan: "🪙", sisera: "🛞", herodGreat: "👑", simonMagus: "💰", herodAgrippa: "🎭", gehazi: "🧥", archerP: "🏹", bearerP: "🛡️", goliathP: "🗿", serpentP: "🐍" };
const CARD_NO: Record<CharacterId, string> = { david: "001", samuel: "002", jonathan: "003", adam: "004", eve: "005", cain: "006", abel: "007", noah: "008", abraham: "009", isaac: "010", jacob: "011", joseph: "012", moses: "013", aaron: "014", miriam: "015", mosesSinai: "016", joshua: "017", rahab: "018", deborah: "019", gideon: "020", samson: "021", ruth: "022", naomi: "023", boaz: "024", hannah: "025", saul: "026", abigail: "027", solomon: "028", elijah: "029", elisha: "030", jonah: "031", isaiah: "032", esther: "033", daniel: "034", nehemiah: "035", zechariah: "036", mary: "037", josephNaz: "038", johnBaptist: "039", jesus: "040", jesusUR: "041", peter: "042", andrew: "043", johnApostle: "044", matthew: "045", jamesZeb: "046", thomas: "047", maryMagdalene: "048", martha: "049", zacchaeus: "050", maryBethany: "051", lazarus: "052", stephen: "053", philip: "054", paul: "055", barnabas: "056", silas: "057", timothy: "058", lydia: "059", priscilla: "060", eli: "061", aquila: "062", dorcas: "063", cornelius: "064", apollos: "065", phoebe: "066", luke: "067", johnMark: "068", titus: "069", philemon: "070", onesimus: "071", nicodemus: "072", samaritan: "073", simeon: "074", anna: "075", loavesBoy: "076", judas: "077", philipApostle: "078", nathanael: "079", jamesAlph: "080", thaddaeus: "081", simonZealot: "082", matthias: "083", elizabeth: "084", mordecai: "085", sarah: "086", rebekah: "087", rachel: "088", barak: "089", jael: "090", josephArimathea: "091", ananias: "092", threeFriends: "093", job: "094", enoch: "095", melchizedek: "096", caleb: "097", jeremiah: "098", ezekiel: "099", ezra: "100", nathan: "101", hezekiah: "102", josiah: "103", magi: "104", shepherds: "105", bartimaeus: "106", centurion: "107", jairus: "108", simonCyrene: "109", thief: "110", jamesJust: "111", jesusCross: "112", widow: "113", fisherman: "114", fourFriends: "115", goodSamaritan: "116", zarephath: "117", shunammite: "118", naaman: "119", maid: "120", bathsheba: "121", mephibosheth: "122", sheba: "123", leah: "124", esau: "125", hagar: "126", lot: "127", jochebed: "128", pharaohDaughter: "129", jethro: "130", zipporah: "131", loisEunice: "132", balaam: "133", legionFreed: "134", prodigal: "135", ethiopian: "136", johnPatmos: "137", ehud: "138", jephthah: "139", joab: "140", uriah: "141", cyrus: "142", zerubbabel: "143", vashti: "144", michal: "145", jehu: "146", canaanite: "147", richRuler: "148", cleopas: "149", malchus: "150", jailer: "151", rhoda: "152", archerP: "E03", bearerP: "E02", goliathP: "E01", serpentP: "E04", mockingThief: "E05", pharaoh: "E06", charioteer: "E07", jezebel: "E08", baalProphet: "E09", haman: "E10", delilah: "E11", nebuchadnezzar: "E12", ahab: "E13", absalom: "E14", sapphira: "E15", pilate: "E16", caiaphas: "E17", herod: "E18", barabbas: "E19", herodias: "E20", romanSoldier: "E21", romanSpearman: "E22", romanArcher: "E23", romanCavalry: "E24", romanCenturion: "E25", sennacherib: "E26", belshazzar: "E27", korah: "E28", achan: "E29", sisera: "E30", herodGreat: "E31", simonMagus: "E32", herodAgrippa: "E33", gehazi: "E34" };
/** Card illustrations in /public/cards and where the figure stands in each (see framing.ts). */
const ART: Partial<Record<CharacterId, { src: string; figure: Figure }>> = {
  david: { src: "/cards/david.jpg", figure: { cx: 0.49, head: 0.19, feet: 0.952 } },
  samuel: { src: "/cards/samuel.jpg", figure: { cx: 0.435, head: 0.112, feet: 0.952 } },
  jonathan: { src: "/cards/jonathan.jpg", figure: { cx: 0.37, head: 0.161, feet: 0.947 } },
  adam: { src: "/cards/adam.jpg", figure: { cx: 0.43, head: 0.223, feet: 0.963 } },
  abel: { src: "/cards/abel.jpg", figure: { cx: 0.49, head: 0.112, feet: 0.952 } },
  abraham: { src: "/cards/abraham.jpg", figure: { cx: 0.49, head: 0.13, feet: 0.94 } },
  miriam: { src: "/cards/miriam.jpg", figure: { cx: 0.48, head: 0.112, feet: 0.952 } },
  matthias: { src: "/cards/matthias.jpg", figure: { cx: 0.51, head: 0.132, feet: 0.962 } },
  elizabeth: { src: "/cards/elizabeth.jpg", figure: { cx: 0.47, head: 0.13, feet: 0.975 } },
  mordecai: { src: "/cards/mordecai.jpg", figure: { cx: 0.45, head: 0.164, feet: 0.965 } },
  sarah: { src: "/cards/sarah.jpg", figure: { cx: 0.47, head: 0.128, feet: 0.97 } },
  rebekah: { src: "/cards/rebekah.jpg", figure: { cx: 0.48, head: 0.16, feet: 0.962 } },
  rachel: { src: "/cards/rachel.jpg", figure: { cx: 0.47, head: 0.175, feet: 0.965 } },
  barak: { src: "/cards/barak.jpg", figure: { cx: 0.46, head: 0.176, feet: 0.96 } },
  jael: { src: "/cards/jael.jpg", figure: { cx: 0.5, head: 0.14, feet: 0.955 } },
  josephArimathea: { src: "/cards/josephArimathea.jpg", figure: { cx: 0.49, head: 0.12, feet: 0.965 } },
  ananias: { src: "/cards/ananias.jpg", figure: { cx: 0.5, head: 0.15, feet: 0.965 } },
  charioteer: { src: "/cards/charioteer.jpg", figure: { cx: 0.44, head: 0.105, feet: 0.94 } },
  jezebel: { src: "/cards/jezebel.jpg", figure: { cx: 0.47, head: 0.09, feet: 0.955 } },
  baalProphet: { src: "/cards/baalProphet.jpg", figure: { cx: 0.42, head: 0.11, feet: 0.965 } },
  ahab: { src: "/cards/ahab.jpg", figure: { cx: 0.48, head: 0.08, feet: 0.95 } },
  nebuchadnezzar: { src: "/cards/nebuchadnezzar.jpg", figure: { cx: 0.45, head: 0.165, feet: 0.955 } },
  delilah: { src: "/cards/delilah.jpg", figure: { cx: 0.45, head: 0.11, feet: 0.965 } },
  haman: { src: "/cards/haman.jpg", figure: { cx: 0.5, head: 0.09, feet: 0.96 } },
  pharaoh: { src: "/cards/pharaoh.jpg", figure: { cx: 0.5, head: 0.175, feet: 0.965 } },
  naaman: { src: "/cards/naaman.jpg", figure: { cx: 0.49, head: 0.085, feet: 0.955 } },
  maid: { src: "/cards/maid.jpg", figure: { cx: 0.49, head: 0.14, feet: 0.95 } },
  balaam: { src: "/cards/balaam.jpg", figure: { cx: 0.5, head: 0.15, feet: 0.93, size: 0.82 } },
  loisEunice: { src: "/cards/loisEunice.jpg", figure: { cx: 0.48, head: 0.15, feet: 0.95, size: 0.85 } },
  zipporah: { src: "/cards/zipporah.jpg", figure: { cx: 0.45, head: 0.17, feet: 0.95 } },
  jethro: { src: "/cards/jethro.jpg", figure: { cx: 0.48, head: 0.165, feet: 0.955 } },
  pharaohDaughter: { src: "/cards/pharaohDaughter.jpg", figure: { cx: 0.46, head: 0.14, feet: 0.95 } },
  jochebed: { src: "/cards/jochebed.jpg", figure: { cx: 0.53, head: 0.13, feet: 0.95 } },
  lot: { src: "/cards/lot.jpg", figure: { cx: 0.44, head: 0.19, feet: 0.94, size: 0.88 } },
  hagar: { src: "/cards/hagar.jpg", figure: { cx: 0.47, head: 0.17, feet: 0.94, size: 0.85 } },
  esau: { src: "/cards/esau.jpg", figure: { cx: 0.48, head: 0.135, feet: 0.94 } },
  leah: { src: "/cards/leah.jpg", figure: { cx: 0.48, head: 0.15, feet: 0.94 } },
  sheba: { src: "/cards/sheba.jpg", figure: { cx: 0.48, head: 0.09, feet: 0.955 } },
  mephibosheth: { src: "/cards/mephibosheth.jpg", figure: { cx: 0.46, head: 0.14, feet: 0.95 } },
  uriah: { src: "/cards/uriah.jpg", figure: { cx: 0.45, head: 0.156, feet: 0.952 } },
  bathsheba: { src: "/cards/bathsheba.jpg", figure: { cx: 0.48, head: 0.09, feet: 0.96 } },
  korah: { src: "/cards/korah.jpg", figure: { cx: 0.5, head: 0.155, feet: 0.955 } },
  achan: { src: "/cards/achan.jpg", figure: { cx: 0.5, head: 0.12, feet: 0.955 } },
  sisera: { src: "/cards/sisera.jpg", figure: { cx: 0.47, head: 0.135, feet: 0.95 } },
  herodGreat: { src: "/cards/herodGreat.jpg", figure: { cx: 0.5, head: 0.145, feet: 0.955 } },
  simonMagus: { src: "/cards/simonMagus.jpg", figure: { cx: 0.47, head: 0.117, feet: 0.967 } },
  herodAgrippa: { src: "/cards/herodAgrippa.jpg", figure: { cx: 0.47, head: 0.103, feet: 0.967 } },
  belshazzar: { src: "/cards/belshazzar.jpg", figure: { cx: 0.47, head: 0.11, feet: 0.955 } },
  sennacherib: { src: "/cards/sennacherib.jpg", figure: { cx: 0.47, head: 0.14, feet: 0.955 } },
  romanCenturion: { src: "/cards/romanCenturion.jpg", figure: { cx: 0.47, head: 0.14, feet: 0.94 } },
  romanCavalry: { src: "/cards/romanCavalry.jpg", figure: { cx: 0.5, head: 0.13, feet: 0.94, size: 0.85 } },
  romanArcher: { src: "/cards/romanArcher.jpg", figure: { cx: 0.5, head: 0.17, feet: 0.965 } },
  romanSpearman: { src: "/cards/romanSpearman.jpg", figure: { cx: 0.48, head: 0.155, feet: 0.94 } },
  romanSoldier: { src: "/cards/romanSoldier.jpg", figure: { cx: 0.45, head: 0.18, feet: 0.95 } },
  herodias: { src: "/cards/herodias.jpg", figure: { cx: 0.5, head: 0.1, feet: 0.955 } },
  barabbas: { src: "/cards/barabbas.jpg", figure: { cx: 0.48, head: 0.14, feet: 0.965 } },
  herod: { src: "/cards/herod.jpg", figure: { cx: 0.48, head: 0.11, feet: 0.965 } },
  caiaphas: { src: "/cards/caiaphas.jpg", figure: { cx: 0.5, head: 0.14, feet: 0.94 } },
  pilate: { src: "/cards/pilate.jpg", figure: { cx: 0.5, head: 0.13, feet: 0.955 } },
  sapphira: { src: "/cards/sapphira.jpg", figure: { cx: 0.47, head: 0.17, feet: 0.95, size: 0.88 } },
  absalom: { src: "/cards/absalom.jpg", figure: { cx: 0.49, head: 0.095, feet: 0.955 } },
  shunammite: { src: "/cards/shunammite.jpg", figure: { cx: 0.47, head: 0.1, feet: 0.965 } },
  zarephath: { src: "/cards/zarephath.jpg", figure: { cx: 0.48, head: 0.1, feet: 0.965 } },
  canaanite: { src: "/cards/canaanite.jpg", figure: { cx: 0.48, head: 0.122, feet: 0.972 } },
  richRuler: { src: "/cards/richRuler.jpg", figure: { cx: 0.45, head: 0.156, feet: 0.972 } },
  cleopas: { src: "/cards/cleopas.jpg", figure: { cx: 0.42, head: 0.103, feet: 0.962 } },
  malchus: { src: "/cards/malchus.jpg", figure: { cx: 0.45, head: 0.088, feet: 0.962 } },
  jailer: { src: "/cards/jailer.jpg", figure: { cx: 0.47, head: 0.122, feet: 0.962 } },
  rhoda: { src: "/cards/rhoda.jpg", figure: { cx: 0.55, head: 0.161, feet: 0.952 } },
  legionFreed: { src: "/cards/legionFreed.jpg", figure: { cx: 0.52, head: 0.18, feet: 0.965 } },
  prodigal: { src: "/cards/prodigal.jpg", figure: { cx: 0.42, head: 0.145, feet: 0.94 } },
  ethiopian: { src: "/cards/ethiopian.jpg", figure: { cx: 0.42, head: 0.15, feet: 0.96 } },
  johnPatmos: { src: "/cards/johnPatmos.jpg", figure: { cx: 0.47, head: 0.14, feet: 0.955 } },
  goodSamaritan: { src: "/cards/goodSamaritan.jpg", figure: { cx: 0.52, head: 0.13, feet: 0.96 } },
  fourFriends: { src: "/cards/fourFriends.jpg", figure: { cx: 0.444, head: 0.11, feet: 0.95, size: 0.88 } },
  fisherman: { src: "/cards/fisherman.jpg", figure: { cx: 0.5, head: 0.13, feet: 0.965 } },
  widow: { src: "/cards/widow.jpg", figure: { cx: 0.47, head: 0.11, feet: 0.975 } },
  jesusCross: { src: "/cards/jesusCross.jpg", figure: { cx: 0.444, head: 0.145, feet: 0.88, size: 0.77 } },
  mockingThief: { src: "/cards/mockingThief.jpg", figure: { cx: 0.444, head: 0.15, feet: 0.9, size: 0.79 } },
  jamesJust: { src: "/cards/jamesJust.jpg", figure: { cx: 0.49, head: 0.105, feet: 0.965 } },
  thief: { src: "/cards/thief.jpg", figure: { cx: 0.444, head: 0.17, feet: 0.92, size: 0.79 } },
  simonCyrene: { src: "/cards/simonCyrene.jpg", figure: { cx: 0.49, head: 0.18, feet: 0.95 } },
  jairus: { src: "/cards/jairus.jpg", figure: { cx: 0.48, head: 0.14, feet: 0.975 } },
  centurion: { src: "/cards/centurion.jpg", figure: { cx: 0.5, head: 0.145, feet: 0.965 } },
  bartimaeus: { src: "/cards/bartimaeus.jpg", figure: { cx: 0.5, head: 0.135, feet: 0.95 } },
  shepherds: { src: "/cards/shepherds.jpg", figure: { cx: 0.4, head: 0.21, feet: 0.86, size: 0.69 } },
  magi: { src: "/cards/magi.jpg", figure: { cx: 0.444, head: 0.21, feet: 0.92, size: 0.75 } },
  josiah: { src: "/cards/josiah.jpg", figure: { cx: 0.45, head: 0.13, feet: 0.97 } },
  hezekiah: { src: "/cards/hezekiah.jpg", figure: { cx: 0.48, head: 0.175, feet: 0.965 } },
  nathan: { src: "/cards/nathan.jpg", figure: { cx: 0.47, head: 0.15, feet: 0.955 } },
  zerubbabel: { src: "/cards/zerubbabel.jpg", figure: { cx: 0.43, head: 0.161, feet: 0.943 } },
  vashti: { src: "/cards/vashti.jpg", figure: { cx: 0.48, head: 0.117, feet: 0.975 } },
  cyrus: { src: "/cards/cyrus.jpg", figure: { cx: 0.47, head: 0.127, feet: 0.962 } },
  ezra: { src: "/cards/ezra.jpg", figure: { cx: 0.46, head: 0.195, feet: 0.965 } },
  ezekiel: { src: "/cards/ezekiel.jpg", figure: { cx: 0.4, head: 0.19, feet: 0.955 } },
  jeremiah: { src: "/cards/jeremiah.jpg", figure: { cx: 0.47, head: 0.13, feet: 0.95 } },
  caleb: { src: "/cards/caleb.jpg", figure: { cx: 0.45, head: 0.19, feet: 0.96 } },
  melchizedek: { src: "/cards/melchizedek.jpg", figure: { cx: 0.5, head: 0.12, feet: 0.97 } },
  enoch: { src: "/cards/enoch.jpg", figure: { cx: 0.5, head: 0.18, feet: 0.95 } },
  job: { src: "/cards/job.jpg", figure: { cx: 0.43, head: 0.15, feet: 0.965 } },
  threeFriends: { src: "/cards/threeFriends.jpg", figure: { cx: 0.5, head: 0.19, feet: 0.89, size: 0.74 } },
  simonZealot: { src: "/cards/simon-zealot.jpg", figure: { cx: 0.47, head: 0.137, feet: 0.962 } },
  thaddaeus: { src: "/cards/thaddaeus.jpg", figure: { cx: 0.5, head: 0.122, feet: 0.957 } },
  jamesAlph: { src: "/cards/james-alphaeus.jpg", figure: { cx: 0.49, head: 0.183, feet: 0.962 } },
  nathanael: { src: "/cards/nathanael.jpg", figure: { cx: 0.5, head: 0.122, feet: 0.962, gaze: "right" } },
  philipApostle: { src: "/cards/philip-apostle.jpg", figure: { cx: 0.48, head: 0.137, feet: 0.967 } },
  judas: { src: "/cards/judas.jpg", figure: { cx: 0.49, head: 0.122, feet: 0.967 } },
  loavesBoy: { src: "/cards/loaves-boy.jpg", figure: { cx: 0.5, head: 0.2, feet: 0.962, size: 0.85 } },
  anna: { src: "/cards/anna.jpg", figure: { cx: 0.48, head: 0.156, feet: 0.967 } },
  simeon: { src: "/cards/simeon.jpg", figure: { cx: 0.48, head: 0.164, feet: 0.967 } },
  samaritan: { src: "/cards/samaritan.jpg", figure: { cx: 0.48, head: 0.164, feet: 0.967 } },
  nicodemus: { src: "/cards/nicodemus.jpg", figure: { cx: 0.47, head: 0.164, feet: 0.962 } },
  onesimus: { src: "/cards/onesimus.jpg", figure: { cx: 0.5, head: 0.212, feet: 0.967 } },
  philemon: { src: "/cards/philemon.jpg", figure: { cx: 0.52, head: 0.141, feet: 0.967 } },
  titus: { src: "/cards/titus.jpg", figure: { cx: 0.45, head: 0.156, feet: 0.962 } },
  johnMark: { src: "/cards/john-mark.jpg", figure: { cx: 0.46, head: 0.195, feet: 0.957 } },
  luke: { src: "/cards/luke.jpg", figure: { cx: 0.47, head: 0.146, feet: 0.957 } },
  phoebe: { src: "/cards/phoebe.jpg", figure: { cx: 0.45, head: 0.164, feet: 0.967 } },
  apollos: { src: "/cards/apollos.jpg", figure: { cx: 0.47, head: 0.156, feet: 0.967 } },
  cornelius: { src: "/cards/cornelius.jpg", figure: { cx: 0.47, head: 0.156, feet: 0.967 } },
  dorcas: { src: "/cards/dorcas.jpg", figure: { cx: 0.5, head: 0.168, feet: 0.977 } },
  aquila: { src: "/cards/aquila.jpg", figure: { cx: 0.5, head: 0.186, feet: 0.977 } },
  eli: { src: "/cards/eli.jpg", figure: { cx: 0.445, head: 0.28, feet: 0.978, size: 0.8 } },
  priscilla: { src: "/cards/priscilla.jpg", figure: { cx: 0.5, head: 0.151, feet: 0.972 } },
  lydia: { src: "/cards/lydia.jpg", figure: { cx: 0.49, head: 0.19, feet: 0.98 } },
  timothy: { src: "/cards/timothy.jpg", figure: { cx: 0.46, head: 0.151, feet: 0.972 } },
  silas: { src: "/cards/silas.jpg", figure: { cx: 0.47, head: 0.18, feet: 0.977 } },
  barnabas: { src: "/cards/barnabas.jpg", figure: { cx: 0.49, head: 0.132, feet: 0.967 } },
  paul: { src: "/cards/paul-v2.jpg", figure: { cx: 0.5, head: 0.15, feet: 0.965 } },
  philip: { src: "/cards/philip.jpg", figure: { cx: 0.49, head: 0.168, feet: 0.977 } },
  stephen: { src: "/cards/stephen.jpg", figure: { cx: 0.5, head: 0.142, feet: 0.962 } },
  lazarus: { src: "/cards/lazarus.jpg", figure: { cx: 0.5, head: 0.151, feet: 0.967 } },
  maryBethany: { src: "/cards/mary-bethany.jpg", figure: { cx: 0.48, head: 0.174, feet: 0.977 } },
  zacchaeus: { src: "/cards/zacchaeus.jpg", figure: { cx: 0.52, head: 0.22, feet: 0.957 } },
  martha: { src: "/cards/martha.jpg", figure: { cx: 0.46, head: 0.18, feet: 0.98 } },
  maryMagdalene: { src: "/cards/mary-magdalene.jpg", figure: { cx: 0.5, head: 0.2, feet: 0.967 } },
  thomas: { src: "/cards/thomas.jpg", figure: { cx: 0.48, head: 0.156, feet: 0.962 } },
  jamesZeb: { src: "/cards/james-zebedee.jpg", figure: { cx: 0.48, head: 0.161, feet: 0.972 } },
  matthew: { src: "/cards/matthew.jpg", figure: { cx: 0.5, head: 0.19, feet: 0.962 } },
  johnApostle: { src: "/cards/john-apostle.jpg", figure: { cx: 0.51, head: 0.171, feet: 0.972 } },
  andrew: { src: "/cards/andrew.jpg", figure: { cx: 0.5, head: 0.18, feet: 0.952 } },
  peter: { src: "/cards/peter.jpg", figure: { cx: 0.52, head: 0.164, feet: 0.977 } },
  jesus: { src: "/cards/jesus-risen.jpg", figure: { cx: 0.5, head: 0.11, feet: 0.965 } },
  jesusUR: { src: "/cards/jesus-ur.jpg", figure: { cx: 0.49, head: 0.145, feet: 0.972 } },
  johnBaptist: { src: "/cards/john-baptist.jpg", figure: { cx: 0.48, head: 0.164, feet: 0.962 } },
  josephNaz: { src: "/cards/joseph-nazareth.jpg", figure: { cx: 0.47, head: 0.193, feet: 0.972 } },
  mary: { src: "/cards/mary.jpg", figure: { cx: 0.46, head: 0.164, feet: 0.967 } },
  zechariah: { src: "/cards/zechariah.jpg", figure: { cx: 0.49, head: 0.164, feet: 0.977 } },
  nehemiah: { src: "/cards/nehemiah.jpg", figure: { cx: 0.4, head: 0.117, feet: 0.967 } },
  daniel: { src: "/cards/daniel.jpg", figure: { cx: 0.49, head: 0.174, feet: 0.952 } },
  esther: { src: "/cards/esther.jpg", figure: { cx: 0.48, head: 0.137, feet: 0.962 } },
  isaiah: { src: "/cards/isaiah.jpg", figure: { cx: 0.45, head: 0.18, feet: 0.962 } },
  jonah: { src: "/cards/jonah.jpg", figure: { cx: 0.44, head: 0.161, feet: 0.957 } },
  michal: { src: "/cards/michal.jpg", figure: { cx: 0.43, head: 0.147, feet: 0.967 } },
  gehazi: { src: "/cards/gehazi.jpg", figure: { cx: 0.48, head: 0.122, feet: 0.962 } },
  jehu: { src: "/cards/jehu.jpg", figure: { cx: 0.46, head: 0.112, feet: 0.952 } },
  elisha: { src: "/cards/elisha.jpg", figure: { cx: 0.49, head: 0.195, feet: 0.967 } },
  elijah: { src: "/cards/elijah.jpg", figure: { cx: 0.42, head: 0.174, feet: 0.962 } },
  solomon: { src: "/cards/solomon.jpg", figure: { cx: 0.49, head: 0.151, feet: 0.962 } },
  joab: { src: "/cards/joab.jpg", figure: { cx: 0.5, head: 0.137, feet: 0.97 } },
  abigail: { src: "/cards/abigail.jpg", figure: { cx: 0.47, head: 0.148, feet: 0.972 } },
  saul: { src: "/cards/saul.jpg", figure: { cx: 0.5, head: 0.137, feet: 0.957 } },
  hannah: { src: "/cards/hannah.jpg", figure: { cx: 0.45, head: 0.156, feet: 0.967 } },
  boaz: { src: "/cards/boaz.jpg", figure: { cx: 0.48, head: 0.137, feet: 0.962 } },
  naomi: { src: "/cards/naomi.jpg", figure: { cx: 0.49, head: 0.176, feet: 0.972 } },
  ruth: { src: "/cards/ruth.jpg", figure: { cx: 0.45, head: 0.137, feet: 0.962 } },
  samson: { src: "/cards/samson.jpg", figure: { cx: 0.47, head: 0.184, feet: 0.955 } },
  jephthah: { src: "/cards/jephthah.jpg", figure: { cx: 0.4, head: 0.137, feet: 0.952 } },
  gideon: { src: "/cards/gideon.jpg", figure: { cx: 0.46, head: 0.244, feet: 0.933 } },
  ehud: { src: "/cards/ehud.jpg", figure: { cx: 0.47, head: 0.127, feet: 0.952 } },
  deborah: { src: "/cards/deborah.jpg", figure: { cx: 0.49, head: 0.161, feet: 0.977 } },
  rahab: { src: "/cards/rahab.jpg", figure: { cx: 0.47, head: 0.145, feet: 0.947 } },
  joshua: { src: "/cards/joshua.jpg", figure: { cx: 0.47, head: 0.107, feet: 0.967 } },
  mosesSinai: { src: "/cards/moses-sinai.jpg", figure: { cx: 0.49, head: 0.132, feet: 0.957 } },
  aaron: { src: "/cards/aaron.jpg", figure: { cx: 0.49, head: 0.062, feet: 0.967 } },
  moses: { src: "/cards/moses.jpg", figure: { cx: 0.5, head: 0.117, feet: 0.962 } },
  joseph: { src: "/cards/joseph.jpg", figure: { cx: 0.5, head: 0.112, feet: 0.962 } },
  jacob: { src: "/cards/jacob.jpg", figure: { cx: 0.49, head: 0.142, feet: 0.947 } },
  isaac: { src: "/cards/isaac.jpg", figure: { cx: 0.5, head: 0.142, feet: 0.962 } },
  noah: { src: "/cards/noah.jpg", figure: { cx: 0.47, head: 0.098, feet: 0.952 } },
  cain: { src: "/cards/cain.jpg", figure: { cx: 0.62, head: 0.095, feet: 0.965, gaze: "left" } },
  eve: { src: "/cards/eve.jpg", figure: { cx: 0.44, head: 0.215, feet: 0.928 } },
  // Enemy cards drawn by the player: same art as their enemy versions, except the Serpent.
  goliathP: { src: "/cards/goliath.jpg", figure: { cx: 0.385, head: 0.22, feet: 0.943 } },
  serpentP: { src: "/cards/serpent-player.jpg", figure: { cx: 0.55, head: 0.2, feet: 0.931, gaze: "right" } },
  archerP: { src: "/cards/archer.jpg", figure: { cx: 0.48, head: 0.151, feet: 0.947 } },
  bearerP: { src: "/cards/bearer.jpg", figure: { cx: 0.46, head: 0.156, feet: 0.947 } },
};

/** Card colours per element: outer frame (deep, so the gold ornaments stand out), inner panel, art backdrop. */
export const THEME: Record<Element, { frame: string; panel: string; art: string }> = {
  light: {
    frame: "from-amber-700 via-amber-800 to-amber-900",
    panel: "from-amber-50 to-yellow-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #fff7d1 0%, #fcd34d 30%, #b45309 75%, #451a03 100%)",
  },
  dark: {
    frame: "from-violet-800 via-indigo-900 to-indigo-900",
    panel: "from-violet-50 to-indigo-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #ddd6fe 0%, #7c3aed 35%, #1e1b4b 100%)",
  },
  water: {
    frame: "from-sky-800 via-blue-900 to-blue-900",
    panel: "from-sky-50 to-blue-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #e0f2fe 0%, #38bdf8 35%, #1e3a8a 100%)",
  },
  fire: {
    frame: "from-red-800 via-red-900 to-red-900",
    panel: "from-orange-50 to-red-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #ffedd5 0%, #fb923c 35%, #7f1d1d 100%)",
  },
  wood: {
    frame: "from-emerald-800 via-emerald-900 to-emerald-900",
    panel: "from-lime-50 to-emerald-100 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #ecfccb 0%, #4ade80 35%, #064e3b 100%)",
  },
  metal: {
    frame: "from-slate-500 via-slate-600 to-slate-700",
    panel: "from-slate-50 to-zinc-200 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #f8fafc 0%, #cbd5e1 30%, #475569 70%, #0f172a 100%)",
  },
  earth: {
    frame: "from-yellow-800 via-stone-700 to-stone-700",
    panel: "from-amber-50 to-stone-200 text-stone-900",
    art: "radial-gradient(circle at 50% 35%, #fef3c7 0%, #d6a35c 35%, #78350f 75%, #292524 100%)",
  },
};

/** Rough display width of a name: CJK characters count double. */
const nameWidth = (name: string) => [...name].reduce((w, c) => w + (c.charCodeAt(0) > 0xff ? 2 : 1), 0);

/** Name, title, HP and element. */
function Header({ id, light }: { id: CharacterId; light?: boolean }) {
  const t = useT();
  return (
    <div className={`flex items-end justify-between px-[6%] ${light ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]" : ""}`}>
      <div className="min-w-0">
        <div className={`text-[0.6em] font-semibold uppercase tracking-wider ${light ? "opacity-90" : "opacity-60"}`}>{t(`v3.card.${id}.title`)}</div>
        {/* Long names (Shadrach, Meshach and Abednego) shrink so they stay clear of the HP corner. */}
        <div className={`truncate font-black leading-none ${nameWidth(t(`char.${id}.name`)) > 14 ? "text-[0.85em]" : "text-[1.35em]"}`}>{t(`char.${id}.name`)}</div>
      </div>
      {/* HP and element sit in the face's top-right corner, where the battle HP badge covers them. */}
      <div className="absolute right-[2%] top-[calc(2.2%+10px)] flex items-baseline gap-1">
        <span className="text-[0.6em] font-bold">HP</span>
        <span className="text-[1.6em] font-black leading-none">{NEVER_FALLS.has(id) ? "∞" : MAX_HP[id]}</span>
        <span className="relative -top-[3px] text-[1.3em] leading-none"><ElementIcon element={CHARACTER_ELEMENT[id]} /></span>
      </div>
    </div>
  );
}

/** Passive, skills, weakness/resistance, verse and card number. */
function Body({ id, compact, rarity }: { id: CharacterId; compact?: boolean; rarity: Rarity }) {
  const t = useT();
  const element = CHARACTER_ELEMENT[id];
  // A card that never falls takes no damage, so it has no weakness or resistance to show.
  const weak = NEVER_FALLS.has(id) ? [] : ELEMENTS.filter((e) => elementMultiplier(e, element, true) > 1);
  const resist = NEVER_FALLS.has(id) ? [] : ELEMENTS.filter((e) => elementMultiplier(e, element, true) < 1);
  return (
    <>
      {(id === "david" || id === "abel" || id === "jonah" || id === "jesus" || id === "jesusUR" || id === "jamesZeb" || id === "lazarus" || id === "paul" || id === "dorcas" || id === "luke" || id === "josephArimathea" || id === "enoch") && (
        <div className="rounded-md border border-red-700/30 bg-red-50/70 px-[3%] py-[1.5%] text-[0.62em] leading-snug">
          <span className="mr-1 rounded bg-red-700 px-1 font-bold text-white">{t("v3.card.passive")}</span>
          {t(`v2.passive.${id}`)}
        </div>
      )}
      {/* Story bonus: what this character gains in their own Bible story */}
      {STORY[id] && (
        <div className="rounded-md border border-amber-600/40 bg-amber-50/70 px-[3%] py-[1.2%] text-[0.58em] leading-snug">
          <span className="mr-1 rounded bg-amber-600 px-1 font-bold text-white">{t("v3.story.label")}</span>
          {t(`v3.story.${id}`)}
        </div>
      )}

      <div className={`flex flex-col justify-center ${compact ? "gap-[1.5%]" : "flex-1 gap-[3%]"}`}>
        {CHARACTER_SKILLS[id].map((skill) => {
          const def = SKILLS[skill];
          const amount = def.damage ?? baseSupportAmount(skill);
          return (
            <div key={skill} className={`border-b border-stone-900/15 last:border-0 ${compact ? "pb-[1%]" : "pb-[2%]"}`}>
              <div className="flex items-center gap-[3%]">
                <span className="w-[22%] shrink-0 text-[0.8em] tracking-tighter">{ENERGY_ICON[def.kind].repeat(def.cost)}</span>
                <span className="flex-1 text-[0.95em] font-black">{t(`v2.skill.${skill}.name`)}</span>
                <span className="text-[1.15em] font-black">{def.damage ? amount : amount > 0 && `${skill === "mark" ? "↩" : "+"}${amount}`}</span>
              </div>
              <div className="pl-[25%] text-[0.58em] leading-snug opacity-75">{t(`v2.skill.${skill}.desc`, { n: amount })}</div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between border-t border-stone-900/20 pt-[1.5%] text-[0.58em]">
        <span>
          {t("v3.card.weakness")}{" "}
          {weak.length
            ? weak.map((e) => (
                <span key={e} className="mr-1">
                  <ElementIcon element={e} />×{R.elements.strong}
                </span>
              ))
            : "—"}
        </span>
        <span>
          {t("v3.card.resistance")}{" "}
          {resist.length
            ? resist.map((e) => (
                <span key={e} className="mr-1">
                  <ElementIcon element={e} />×{R.elements.weak}
                </span>
              ))
            : "—"}
        </span>
      </div>

      <div className="rounded-md bg-stone-900/5 px-[3%] py-[1.5%] text-[0.55em] leading-snug">
        <span className="italic">{t(`v3.card.${id}.verse`)}</span>
        <span className="ml-1 font-semibold">— {t(`v3.card.${id}.ref`)}</span>
      </div>

      <div className="flex justify-between px-[8%] text-[0.45em] opacity-60">
        <span>Bible Quest</span>
        <span>
          BQ-{CARD_NO[id]} <b className={`font-black ${RARITY[rarity].mark}`}>{rarity}</b>
        </span>
      </div>
    </>
  );
}

/** rarity: print the card at another rarity than its own (the card demo previews every rarity). */
/**
 * 2.5D: the picture is drawn twice. The scene behind shifts with the card's tilt (HoloCard's --px/--py); a copy cut
 * down to the figure (a soft oval where it stands) barely moves, so the figure seems to stand in front of the scene.
 * Both copies are zoomed a little so the shifting scene never shows an edge.
 */
const PARALLAX_ZOOM = 1.08;
const shift = (k: number) => `translate(calc((50% - var(--px, 50%)) * ${k}), calc((50% - var(--py, 50%)) * ${k * 0.75})) scale(${PARALLAX_ZOOM})`;

function ParallaxArt({ src, alt, figure }: { src: string; alt: string; figure: Figure }) {
  const f = figureOnFace(figure);
  const cut = `radial-gradient(ellipse 21% ${((f.bottom - f.top) / 2) * 115}% at ${f.x * 100}% ${((f.top + f.bottom) / 2) * 100}%, #000 0 68%, transparent 100%)`;
  return (
    <>
      <div className="absolute inset-0" style={{ transform: shift(0.08) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static card art; no resizing needed for a demo */}
        <img src={src} alt={alt} draggable={false} className="absolute inset-0 h-full w-full object-cover" style={frameFigure(figure)} />
      </div>
      <div aria-hidden className="absolute inset-0" style={{ transform: shift(0.004), maskImage: cut, WebkitMaskImage: cut }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the same art, cut down to the figure */}
        <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={frameFigure(figure)} />
      </div>
    </>
  );
}

/** Where a character's figure stands on its card face, so a foil texture can leave it uncovered (none without art). */
export function figureArea(id: CharacterId) {
  const art = ART[id];
  return art ? figureOnFace(art.figure) : undefined;
}

export function CharacterCardFace({ id, ornament, rarity: printed }: { id: CharacterId; ornament?: Ornament; rarity?: Rarity }) {
  const rarity = printed ?? CARD_RARITY[id];
  const t = useT();
  const art = ART[id];
  const element = CHARACTER_ELEMENT[id];
  const theme = THEME[element];

  // Full-art card: the illustration fills the whole card; text sits on a fade at the top and bottom.
  if (art) {
    return (
      <>
        <CardFrame frame={theme.frame} rarity={rarity} ornament={ornament}>
        <div className="relative h-full overflow-hidden rounded-[0.6%]">
          {/* Only UR gets the 2.5D parallax; the rest show the picture flat. */}
          {rarity === "UR" ? (
            <ParallaxArt src={art.src} alt={t(`char.${id}.name`)} figure={art.figure} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- static card art; no resizing needed for a demo
            <img src={art.src} alt={t(`char.${id}.name`)} draggable={false} className="absolute inset-0 h-full w-full object-cover" style={frameFigure(art.figure)} />
          )}
          {/* Real art gets a light foil so the illustration stays readable. */}
          {RARITY[rarity].foil > 0 && <Foil element={element} strength={0.12} />}
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 via-black/25 to-transparent px-[3%] pb-[8%] pt-[5%]">
            <Header id={id} light />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[1.5%] bg-gradient-to-b from-transparent via-amber-50/85 to-amber-50/95 px-[4%] pb-[3%] pt-[12%] text-stone-900">
            <Body id={id} compact rarity={rarity} />
          </div>
        </div>
        </CardFrame>
        <RarityMark rarity={rarity} element={element} className="left-[1.5%] top-[0.8%]" />
      </>
    );
  }

  return (
    <>
      <CardFrame frame={theme.frame} rarity={rarity} ornament={ornament}>
      <div className={`relative flex h-full flex-col gap-[2%] rounded-[0.6%] bg-gradient-to-b p-[3%] ${theme.panel}`}>
        <Header id={id} />

        {/* Art window (holo) */}
        <div className="relative aspect-[5/3.4] overflow-hidden rounded-[1%] border-[3px] border-yellow-100/80 shadow-inner" style={{ background: theme.art }}>
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{ background: "repeating-conic-gradient(from 0deg at 50% 38%, rgb(255 255 255 / 0.35) 0deg 6deg, transparent 6deg 18deg)" }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[4.2em] drop-shadow-[0_6px_10px_rgb(0_0_0/0.5)]">{PORTRAIT[id]}</div>
          {RARITY[rarity].foil > 0 && <Foil element={element} strength={0.8} />}
        </div>
        <div className="-mt-[1%] text-center text-[0.55em] italic opacity-70">{t(`v3.card.${id}.flavor`)}</div>

        <Body id={id} rarity={rarity} />
      </div>
      </CardFrame>
      <RarityMark rarity={rarity} element={element} className="left-[1.5%] top-[0.8%]" />
    </>
  );
}
