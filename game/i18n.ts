import { enV2, zhV2 } from "./v2/i18n";
import { enV3, zhV3 } from "./v3/i18n";

export type Locale = "en" | "zh";

export type Params = Record<string, string | number | boolean | undefined>;

// Shared text (title screen, language switch, character names). Battle text lives in game/v2 and game/v3.
const en = {
  "char.david.name": "David",
  "char.samuel.name": "Samuel",
  "char.jonathan.name": "Jonathan",
  "char.adam.name": "Adam",
  "char.cain.name": "Cain",
  "char.abel.name": "Abel",
  "char.noah.name": "Noah",
  "char.abraham.name": "Abraham",
  "char.isaac.name": "Isaac",
  "char.jacob.name": "Jacob",
  "char.joseph.name": "Joseph",
  "char.moses.name": "Moses",
  "char.aaron.name": "Aaron",
  "char.miriam.name": "Miriam",
  "char.mosesSinai.name": "Moses",
  "char.joshua.name": "Joshua",
  "char.rahab.name": "Rahab",
  "char.deborah.name": "Deborah",
  "char.gideon.name": "Gideon",
  "char.samson.name": "Samson",
  "char.ruth.name": "Ruth",
  "char.naomi.name": "Naomi",
  "char.boaz.name": "Boaz",
  "char.hannah.name": "Hannah",
  "char.saul.name": "King Saul",
  "char.abigail.name": "Abigail",
  "char.solomon.name": "King Solomon",
  "char.elijah.name": "Elijah",
  "char.elisha.name": "Elisha",
  "char.jonah.name": "Jonah",
  "char.isaiah.name": "Isaiah",
  "char.esther.name": "Esther",
  "char.daniel.name": "Daniel",
  "char.nehemiah.name": "Nehemiah",
  "char.zechariah.name": "Zechariah",
  "char.mary.name": "Mary",
  "char.josephNaz.name": "Joseph",
  "char.johnBaptist.name": "John the Baptist",
  "char.eve.name": "Eve",
  "char.archerP.name": "Philistine Archer",
  "char.bearerP.name": "Shield Bearer",
  "char.goliathP.name": "Goliath of Gath",
  "char.serpentP.name": "Serpent of Eden",
  "ui.tagline": "Scripture Card Adventure",
  "ui.subtitle": "Gameplay prototype · Stage 1: David vs Goliath",
  "ui.start": "Start Battle",
  "ui.switchLanguage": "Switch language",
};

type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  "char.david.name": "大衛",
  "char.samuel.name": "撒母耳",
  "char.jonathan.name": "約拿單",
  "char.adam.name": "亞當",
  "char.cain.name": "該隱",
  "char.abel.name": "亞伯",
  "char.noah.name": "挪亞",
  "char.abraham.name": "亞伯拉罕",
  "char.isaac.name": "以撒",
  "char.jacob.name": "雅各",
  "char.joseph.name": "約瑟",
  "char.moses.name": "摩西",
  "char.aaron.name": "亞倫",
  "char.miriam.name": "米利暗",
  "char.mosesSinai.name": "摩西",
  "char.joshua.name": "約書亞",
  "char.rahab.name": "喇合",
  "char.deborah.name": "底波拉",
  "char.gideon.name": "基甸",
  "char.samson.name": "參孫",
  "char.ruth.name": "路得",
  "char.naomi.name": "拿俄米",
  "char.boaz.name": "波阿斯",
  "char.hannah.name": "哈拿",
  "char.saul.name": "掃羅王",
  "char.abigail.name": "亞比該",
  "char.solomon.name": "所羅門王",
  "char.elijah.name": "以利亞",
  "char.elisha.name": "以利沙",
  "char.jonah.name": "約拿",
  "char.isaiah.name": "以賽亞",
  "char.esther.name": "以斯帖",
  "char.daniel.name": "但以理",
  "char.nehemiah.name": "尼希米",
  "char.zechariah.name": "撒迦利亞",
  "char.mary.name": "馬利亞",
  "char.josephNaz.name": "約瑟",
  "char.johnBaptist.name": "施洗約翰",
  "char.eve.name": "夏娃",
  "char.archerP.name": "非利士弓箭手",
  "char.bearerP.name": "拿盾牌的",
  "char.goliathP.name": "迦特人歌利亞",
  "char.serpentP.name": "伊甸古蛇",
  "ui.tagline": "經文卡牌冒險",
  "ui.subtitle": "玩法原型 · 第一關：大衛與歌利亞",
  "ui.start": "開始戰鬥",
  "ui.switchLanguage": "切換語言",
};

const DICTS: Record<Locale, Record<string, string>> = {
  en: { ...en, ...enV2, ...enV3 },
  zh: { ...zh, ...zhV2, ...zhV3 },
};

/** Params that hold ids and are rendered as their localized names. */
const NAMED: Record<string, (id: string) => string> = {
  char: (id) => `char.${id}.name`,
  action: (id) => `v2.action.${id}.name`,
  card: (id) => `v2.card.${id}.name`,
  skill: (id) => `v2.skill.${id}.name`,
  energy: (id) => `v2.energy.${id}.name`,
  enemy: (id) => `v2.enemy.${id}.name`,
};

/** Looks up a message and fills {placeholders}; id params (see NAMED) become localized names. */
export function translate(locale: Locale, key: string, params: Params = {}): string {
  const raw = DICTS[locale][key] ?? DICTS.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = params[name];
    if (v === undefined) return match;
    return NAMED[name] ? translate(locale, NAMED[name](String(v))) : String(v);
  });
}
