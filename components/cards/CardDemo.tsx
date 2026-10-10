"use client";

// /card-demo: every card in a grid, to compare frames and effects. Click a card to view it full size.
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CHARACTER_ELEMENT, CHARACTER_SKILLS, ENEMY_ELEMENT } from "@/game/v2/data";
import { translate } from "@/game/i18n";
import type { CharacterId, EnemyId } from "@/game/v2/types";
import { safeStorage, useT } from "@/game/locale";
import { CharacterCardFace } from "./CharacterCardFace";
import { EnemyCardFace } from "./EnemyCardFace";
import { HoloCard } from "./HoloCard";
import { CARD_RARITY, type Rarity } from "./rarity";

/** Rarity filter tabs, highest first; the choice is remembered in this browser. */
const RARITY_TABS: Rarity[] = ["UR", "SSR", "SR", "R", "N"];
const FILTER_KEY = "bq-card-demo-rarity";

const CARDS: { id: CharacterId | EnemyId; enemy?: boolean }[] = [
  { id: "david" },
  { id: "goliath", enemy: true },
  { id: "samuel" },
  { id: "jonathan" },
  { id: "adam" },
  { id: "eve" },
  { id: "cain" },
  { id: "abel" },
  { id: "noah" },
  { id: "abraham" },
  { id: "isaac" },
  { id: "jacob" },
  { id: "joseph" },
  { id: "moses" },
  { id: "mosesSinai" },
  { id: "aaron" },
  { id: "miriam" },
  { id: "joshua" },
  { id: "rahab" },
  { id: "deborah" },
  { id: "gideon" },
  { id: "samson" },
  { id: "ruth" },
  { id: "naomi" },
  { id: "boaz" },
  { id: "hannah" },
  { id: "saul" },
  { id: "abigail" },
  { id: "solomon" },
  { id: "elijah" },
  { id: "elisha" },
  { id: "jonah" },
  { id: "isaiah" },
  { id: "esther" },
  { id: "daniel" },
  { id: "nehemiah" },
  { id: "zechariah" },
  { id: "mary" },
  { id: "josephNaz" },
  { id: "johnBaptist" },
  { id: "jesus" },
  { id: "jesusUR" },
  { id: "peter" },
  { id: "andrew" },
  { id: "johnApostle" },
  { id: "matthew" },
  { id: "jamesZeb" },
  { id: "thomas" },
  { id: "maryMagdalene" },
  { id: "martha" },
  { id: "zacchaeus" },
  { id: "maryBethany" },
  { id: "lazarus" },
  { id: "stephen" },
  { id: "philip" },
  { id: "paul" },
  { id: "barnabas" },
  { id: "silas" },
  { id: "timothy" },
  { id: "lydia" },
  { id: "priscilla" },
  { id: "eli" },
  { id: "aquila" },
  { id: "dorcas" },
  { id: "cornelius" },
  { id: "apollos" },
  { id: "phoebe" },
  { id: "luke" },
  { id: "johnMark" },
  { id: "titus" },
  { id: "philemon" },
  { id: "onesimus" },
  { id: "nicodemus" },
  { id: "samaritan" },
  { id: "simeon" },
  { id: "anna" },
  { id: "loavesBoy" },
  { id: "judas" },
  { id: "philipApostle" },
  { id: "nathanael" },
  { id: "jamesAlph" },
  { id: "thaddaeus" },
  { id: "simonZealot" },
  { id: "matthias" },
  { id: "elizabeth" },
  { id: "mordecai" },
  { id: "sarah" },
  { id: "rebekah" },
  { id: "rachel" },
  { id: "barak" },
  { id: "jael" },
  { id: "josephArimathea" },
  { id: "ananias" },
  { id: "threeFriends" },
  { id: "job" },
  { id: "enoch" },
  { id: "melchizedek" },
  { id: "caleb" },
  { id: "jeremiah" },
  { id: "ezekiel" },
  { id: "ezra" },
  { id: "nathan" },
  { id: "hezekiah" },
  { id: "josiah" },
  { id: "magi" },
  { id: "shepherds" },
  { id: "bartimaeus" },
  { id: "centurion" },
  { id: "jairus" },
  { id: "simonCyrene" },
  { id: "thief" },
  { id: "jamesJust" },
  { id: "jesusCross" },
  { id: "widow" },
  { id: "fisherman" },
  { id: "fourFriends" },
  { id: "goodSamaritan" },
  { id: "bearer", enemy: true },
  { id: "archer", enemy: true },
  { id: "serpent", enemy: true },
  { id: "serpentP" },
  { id: "mockingThief" },
  { id: "pharaoh" },
  { id: "charioteer" },
  { id: "jezebel" },
  { id: "baalProphet" },
  { id: "haman" },
  { id: "delilah" },
  { id: "nebuchadnezzar" },
];

type Viewed = { id: CharacterId | EnemyId; enemy?: boolean; rarity?: Rarity };

function CardFace({ id, enemy, rarity }: Viewed) {
  return enemy ? <EnemyCardFace id={id as EnemyId} /> : <CharacterCardFace id={id as CharacterId} rarity={rarity} />;
}

/**
 * Viewer size as a share of a real Pokémon card (63 × 88 mm). CSS millimetres run small on the designer's 24-inch
 * screen: a real card measured 115% of 63mm, so that is 100% here. Adjustable and remembered.
 */
const REAL_SIZE = "calc(63mm * 1.15)";
const SCALE_KEY = "bq-card-demo-real";
const SCALE_DEFAULT = 1.75;
const SCALE_STEP = 0.1;

/** Other names a card is known by (other Chinese translations, Catholic names, alternate names), for search. */
const ALIASES: Partial<Record<CharacterId | EnemyId, string>> = {
  peter: "伯多祿 西門彼得 磯法 simon cephas",
  andrew: "安德肋",
  jamesZeb: "雅各伯 大雅各 james the great",
  johnApostle: "若望 宗徒",
  philipApostle: "斐理伯 菲利普 使徒腓利",
  nathanael: "巴多羅買 巴爾多祿茂 納塔納耳 bartholomew",
  thomas: "多默 低土馬 didymus",
  matthew: "瑪竇 利未 levi",
  jamesAlph: "小雅各 雅各伯 james the less",
  thaddaeus: "達陡 猶達 猶大 jude",
  simonZealot: "熱誠者西滿 西滿",
  matthias: "瑪弟亞",
  elizabeth: "依撒伯爾 伊莉莎白",
  mordecai: "摩爾德開",
  sarah: "撒辣 莎拉 撒萊",
  rebekah: "黎貝加 利百加 Rebecca",
  rachel: "辣黑耳 瑞秋",
  barak: "巴辣克",
  jael: "雅厄爾 雅億 Yael",
  josephArimathea: "阿黎瑪特雅的若瑟 若瑟 Arimathea",
  ananias: "阿納尼雅 大馬士革",
  job: "約伯記 苦難 忍耐",
  enoch: "哈諾客 與神同行",
  melchizedek: "默基瑟德 撒冷王 祭司",
  caleb: "加里布 探子",
  jeremiah: "耶肋米亞 流淚的先知",
  ezekiel: "厄則克耳 枯骨 骸骨",
  ezra: "厄斯德拉 文士 律法",
  nathan: "納堂 先知",
  hezekiah: "希則克雅 猶大王",
  josiah: "約史雅 猶大王 律法書",
  magi: "三博士 賢士 三王 Wise Men 黃金 乳香 沒藥",
  shepherds: "牧羊人 牧人 伯利恆 天使報喜",
  bartimaeus: "巴爾提買 瞎子 耶利哥",
  centurion: "百夫長 迦百農 羅馬軍官",
  jairus: "雅依洛 管會堂的 大利大古米",
  simonCyrene: "基勒乃人西滿 西門 十字架",
  thief: "強盜 右盜 犯人 樂園",
  jamesJust: "雅各伯 雅各書 義人雅各 耶路撒冷會議",
  mockingThief: "強盜 左盜 犯人 譏誚",
  jesusCross: "耶穌 十字架 各各他 成了 Jesus",
  widow: "寡婦 兩個小錢 奉獻",
  fisherman: "漁夫 漁網 加利利海",
  fourFriends: "四個朋友 癱子 房頂 擔架",
  pharaoh: "埃及王 法老王 出埃及",
  charioteer: "戰車 埃及兵 紅海",
  jezebel: "依則貝耳 王后 亞哈 拿伯",
  baalProphet: "巴耳 假先知 迦密山",
  haman: "哈曼 阿甲人 木架 普珥",
  delilah: "德里拉 參孫 梭烈谷",
  nebuchadnezzar: "拿步高 巴比倫王 金像 火窯",
  goodSamaritan: "好撒馬利亞人 好撒瑪利亞人 撒瑪利亞好鄰舍 好鄰舍 比喻",
  threeFriends: "但以理三友 三友 火窯 Shadrach Meshach Abednego 哈納尼雅 米沙耳 阿匝黎雅",
  judas: "猶達斯",
  paul: "掃羅 保祿 saul",
  mary: "瑪利亞 聖母",
  josephNaz: "若瑟",
  johnBaptist: "若翰 洗者若翰",
  moses: "梅瑟",
  mosesSinai: "梅瑟",
  elijah: "厄里亞",
  elisha: "厄里叟",
  isaiah: "依撒意亞",
  daniel: "達尼爾",
  david: "達味",
  solomon: "撒羅滿",
  noah: "諾厄",
  abraham: "亞巴郎 亞伯蘭 abram",
  jacob: "雅各伯 以色列 israel",
  joseph: "若瑟",
  eve: "厄娃",
  maryMagdalene: "瑪利亞瑪達肋納 抹大拉馬利亞",
  luke: "路加 路加醫生",
  johnMark: "馬爾谷",
};

/** Everything a search can match on a card — name, title and skills — in both languages, lower-cased. */
function searchText({ id, enemy }: Viewed): string {
  const keys = enemy
    ? [`v2.enemy.${id}.name`, `v3.card.${id}.title`]
    : [`char.${id}.name`, `v3.card.${id}.title`, ...CHARACTER_SKILLS[id as CharacterId].map((k) => `v2.skill.${k}.name`)];
  return [...(["zh", "en"] as const).flatMap((l) => keys.map((k) => translate(l, k))), ALIASES[id] ?? ""].join(" ").toLowerCase();
}
const SEARCH = new Map(CARDS.map((c) => [c.id, searchText(c)]));

const elementOf = ({ id, enemy }: Viewed) => (enemy ? ENEMY_ELEMENT[id as EnemyId] : CHARACTER_ELEMENT[id as CharacterId]);

export function CardDemo() {
  const t = useT();
  const [effects, setEffects] = useState(true);
  const [viewing, setViewing] = useState<Viewed | null>(null);
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const [query, setQuery] = useState("");
  // Restored after mount (the server always renders "all"), so hydration stays in step.
  useEffect(() => {
    const saved = safeStorage.getItem(FILTER_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of a saved preference
    if (saved && (RARITY_TABS as string[]).includes(saved)) setFilter(saved as Rarity);
  }, []);
  const choose = (f: Rarity | "all") => {
    setFilter(f);
    safeStorage.setItem(FILTER_KEY, f);
  };
  const q = query.trim().toLowerCase();
  const matches = q ? CARDS.filter((c) => SEARCH.get(c.id)!.includes(q)) : CARDS;
  const shown = filter === "all" ? matches : matches.filter((c) => CARD_RARITY[c.id] === filter);
  // Read once on the client; the scale only shows in the viewer, which never renders on the server.
  const [scale, setScale] = useState(() => (typeof window === "undefined" ? 1 : Number(safeStorage.getItem(SCALE_KEY)) || SCALE_DEFAULT));

  const adjust = (next: (current: number) => number) =>
    setScale((current) => {
      const clamped = Math.round(Math.min(4, Math.max(0.5, next(current))) * 100) / 100;
      safeStorage.setItem(SCALE_KEY, String(clamped));
      return clamped;
    });

  useEffect(() => {
    if (!viewing) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setViewing(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [viewing]);

  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_30%,#3b2f1a_0%,#1c1917_55%,#0c0a09_100%)] px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-bold">{t("v3.demo.title")}</h1>
        <p className="mt-1 text-sm text-stone-400">{t("v3.demo.hint")}</p>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("v3.demo.search")}
        aria-label={t("v3.demo.search")}
        className="w-full max-w-sm rounded-full border-2 border-stone-500 bg-stone-900/80 px-4 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-300 focus:outline-none"
      />
      <div role="tablist" aria-label={t("v3.demo.filter")} className="flex flex-wrap justify-center gap-2">
        {(["all", ...RARITY_TABS] as const).map((f) => {
          const count = f === "all" ? matches.length : matches.filter((c) => CARD_RARITY[c.id] === f).length;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => choose(f)}
              className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${filter === f ? "border-amber-300 bg-amber-500 text-stone-950" : "border-stone-500 text-stone-200 hover:bg-white/10"}`}
            >
              {f === "all" ? t("v3.demo.all") : f} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="grid w-full max-w-7xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] justify-items-center gap-x-4 gap-y-6 px-2 py-4">
        {shown.length === 0 && <p className="col-span-full py-8 text-sm text-stone-400">{t("v3.demo.noMatch")}</p>}
        {shown.map((card) => (
          <div key={card.id} className="flex flex-col items-center gap-2">
            <button type="button" onClick={() => setViewing(card)} aria-label={t("v3.demo.view")} className="cursor-zoom-in">
              <HoloCard element={elementOf(card)} effects={effects} rarity={CARD_RARITY[card.id]} className="w-[220px] text-[10.3px]">
                <CardFace {...card} />
              </HoloCard>
            </button>
            <span className="text-sm font-black tracking-widest text-amber-200">{CARD_RARITY[card.id]}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setEffects(!effects)}
          className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${effects ? "border-amber-300 bg-amber-500 text-stone-950" : "border-stone-500 text-stone-300"}`}
        >
          {effects ? t("v3.demo.effectsOn") : t("v3.demo.effectsOff")}
        </button>
      </div>

      {/* Sized from a real card (100% = actual size), 175% by default; capped to the screen so the card always fits. */}
      {viewing && (
        <div onClick={() => setViewing(null)} className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
          <motion.div
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="[--w:min(calc(var(--real)*var(--cal)),92vw,calc((100dvh-7rem)*63/88))]"
            style={{ "--real": REAL_SIZE, "--cal": scale, width: "var(--w)", fontSize: "calc(var(--w) * 0.0467)" } as React.CSSProperties}
          >
            <HoloCard element={elementOf(viewing)} effects={effects} rarity={viewing.rarity ?? CARD_RARITY[viewing.id]}>
              <CardFace {...viewing} />
            </HoloCard>
          </motion.div>
          <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center justify-center gap-2 text-sm text-stone-200">
            <span className="text-stone-400">{t("v3.demo.calibrate")}</span>
            <button onClick={() => adjust((v) => v - SCALE_STEP)} aria-label="−" className="h-8 w-8 rounded-full border border-stone-400 font-bold hover:bg-white/10">
              −
            </button>
            <span className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <button onClick={() => adjust((v) => v + SCALE_STEP)} aria-label="+" className="h-8 w-8 rounded-full border border-stone-400 font-bold hover:bg-white/10">
              +
            </button>
            <button onClick={() => adjust(() => 1)} className="rounded-full border border-stone-500 px-3 py-1 text-xs text-stone-300 hover:bg-white/10">
              1:1
            </button>
            <button onClick={() => adjust(() => SCALE_DEFAULT)} className="rounded-full border border-stone-500 px-3 py-1 text-xs text-stone-300 hover:bg-white/10">
              {t("v3.demo.reset")}
            </button>
            <button onClick={() => setViewing(null)} className="rounded-full border border-stone-400 px-4 py-1.5 hover:bg-white/10">
              ✕ {t("v3.ui.close")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
