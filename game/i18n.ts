import { enV2, zhV2 } from "./v2/i18n";
import { enV3, zhV3 } from "./v3/i18n";

export type Locale = "en" | "zh";

export type Params = Record<string, string | number | boolean | undefined>;

// Shared text (title screen, language switch, character names). Battle text lives in game/v2 and game/v3.
const en = {
  "char.david.name": "David",
  "char.samuel.name": "Samuel",
  "char.jonathan.name": "Jonathan",
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
