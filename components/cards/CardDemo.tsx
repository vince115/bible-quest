"use client";

// /card-demo: every card in a grid, to compare frames and effects. Click a card to view it full size.
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CARDS_V2, CHARACTER_ELEMENT, CHARACTER_SKILLS, ENEMY_ELEMENT, ENEMY_ORDER } from "@/game/v2/data";
import { translate } from "@/game/i18n";
import type { CardId, CharacterId, EnemyId } from "@/game/v2/types";
import { safeStorage, useT } from "@/game/locale";
import { CharacterCardFace, figureArea } from "./CharacterCardFace";
import { EnemyCardFace } from "./EnemyCardFace";
import { FlipCard } from "./FlipCard";
import { GrCeremony } from "./GrCeremony";
import { HoloCard } from "./HoloCard";
import { ENERGY_ELEMENT, SCRIPTURE_CARDS, ScriptureCardBack, ScriptureCardFace } from "./ScriptureCardFace";
import { TIMELINE } from "./timeline";
import { CARD_RARITY, USED_TIERS, type Rarity } from "./rarity";
import { SCALE_DEFAULT, SCALE_KEY, SCALE_STEP, STORY_KEY, StoryPanel, VIEWER_WIDTH, savedScale, savedShowStory, viewerStyle } from "./viewer";

/** Rarity filter tabs, highest first; the choice is remembered in this browser. */
const RARITY_TABS: Rarity[] = USED_TIERS;
const FILTER_KEY = "bq-card-demo-rarity";

/** Every card in story order (see timeline.ts); the four opponent cards render with the enemy face. */
const CARDS: { id: CharacterId | EnemyId; enemy?: boolean }[] = TIMELINE.map((id) => ((ENEMY_ORDER as string[]).includes(id) ? { id, enemy: true } : { id }));

type Viewed = { id: CharacterId | EnemyId | CardId; enemy?: boolean; scripture?: boolean; rarity?: Rarity };

function CardFace({ id, enemy, scripture, rarity }: Viewed) {
  if (scripture) return <ScriptureCardFace id={id as CardId} />;
  return enemy ? <EnemyCardFace id={id as EnemyId} /> : <CharacterCardFace id={id as CharacterId} rarity={rarity} />;
}
/** Scripture (energy) cards have no rarity; they print plain. */
const rarityOf = (v: Viewed): Rarity => v.rarity ?? (v.scripture ? "N" : CARD_RARITY[v.id as CharacterId | EnemyId]);

/** Other names a card is known by (other Chinese translations, Catholic names, alternate names), for search. */
const ALIASES: Partial<Record<CharacterId | EnemyId, string>> = {
  peter: "伯多祿 西門彼得 磯法 simon cephas",
  andrew: "安德肋",
  jamesZeb: "雅各伯 大雅各 james the great",
  johnApostle: "若望 宗徒",
  johnPatmos: "約翰 若望 拔摩 帕特摩斯 啟示錄 默示錄 年老的約翰 新天新地",
  father: "耶和華 天父 聖父 父神 神 上帝 創造主 要有光 三位一體",
  holySpirit: "聖靈 聖神 保惠師 鴿子 三位一體 風",
  gabriel: "加百列 天使 報喜 傳報佳音 天使長",
  michael: "米迦勒 天使 天使長 龍 爭戰 誰像神",
  satanDisguised: "撒但 魔鬼 試探者 假扮 光明天使 惡者",
  satan: "撒但 魔鬼 惡魔 龍 古蛇 試探者 惡者",
  ehud: "厄胡得 左手 士師 伊磯倫 摩押 便雅憫",
  jephthah: "依弗大 士師 基列 亞捫 許願 陀伯",
  joab: "約阿布 元帥 洗魯雅 押尼珥 押沙龍 短槍",
  uriah: "烏利亞 赫人 烏黎雅 拔示巴 勇士",
  cyrus: "古列 居魯士 塞魯士 波斯王 歸回 詔書",
  zerubbabel: "所羅巴伯 則魯巴貝耳 聖殿 重建 根基 歸回",
  vashti: "瓦實提 瓦市提 王后 亞哈隨魯 波斯",
  michal: "米甲 米加爾 掃羅的女兒 大衛的妻子 窗戶",
  gehazi: "基哈西 革哈齊 以利沙的僕人 乃縵 大痲瘋",
  jehu: "耶戶 耶胡 耶斯列 耶洗別 巴力 趕車",
  canaanite: "迦南婦人 迦南 客納罕婦人 敘利非尼基 推羅 西頓 碎渣兒",
  richRuler: "富有的少年官 少年官 富少年 少年財主 永生 變賣",
  cleopas: "革流巴 克羅帕 克羅頗 以馬忤斯 厄瑪烏 擘餅",
  malchus: "馬勒古 瑪爾曷 大祭司的僕人 耳朵 客西馬尼",
  jailer: "腓立比獄卒 獄卒 禁卒 斐理伯 腓立比 地震",
  rhoda: "羅大 洛德 使女 彼得 敲門 馬可的母親",
  simonMagus: "西門 術士 行邪術 巫師 西滿 撒馬利亞 買聖靈",
  herodAgrippa: "希律 亞基帕 黑落德 阿格黎帕 希律王 該撒利亞 彼得出監",
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
  zarephath: "撒勒法 寡婦 匝爾法特 麵 油",
  shunammite: "書念 叔能婦人 以利沙 小樓 平安",
  naaman: "納阿曼 亞蘭 痲瘋 約旦河",
  maid: "小女子 以色列女孩 婢女 乃縵",
  bathsheba: "巴特舍巴 王母 所羅門",
  mephibosheth: "默黑巴耳 約拿單 瘸腿 王的筵席",
  sheba: "舍巴女王 南方女王 所羅門 香料",
  leah: "肋阿 雅各 拉結 猶大",
  esau: "厄撒烏 以東 雅各 紅湯 長子名分",
  hagar: "夏甲 以實瑪利 哈加爾 依市瑪耳 水井 曠野",
  lot: "羅特 羅得的妻子 所多瑪 鹽柱",
  jochebed: "約革貝得 摩西的母親 蒲草箱",
  pharaohDaughter: "法老女兒 公主 摩西 尼羅河",
  jethro: "耶特羅 流珥 米甸祭司 摩西岳父",
  zipporah: "漆頗拉 摩西的妻子 米甸 井",
  balaam: "巴郎 巴蘭的驢 驢 會說話的驢 巴勒 摩押",
  loisEunice: "羅以 友尼基 羅依達 歐尼基 提摩太 外祖母",
  absalom: "阿貝沙隆 王子 大衛之子",
  caiaphas: "蓋法 大祭司 公會",
  herod: "希律 黑落德 安提帕 分封王",
  barabbas: "巴辣巴 囚犯 釋放",
  herodias: "黑落狄雅 希律 施洗約翰",
  romanSoldier: "羅馬兵 兵丁 士兵 軍兵 步兵",
  romanSpearman: "長矛兵 長槍手 羅馬兵 士兵 保羅",
  romanArcher: "弓箭手 弓兵 羅馬兵 士兵 火箭",
  romanCavalry: "騎兵 馬兵 羅馬兵 士兵 保羅",
  romanCenturion: "百夫長 羅馬兵 士兵 十字架 神的兒子",
  sennacherib: "散乃黑黎布 亞述王 希西家 拉伯沙基",
  korah: "科辣黑 可拉黨 叛亂 香爐",
  achan: "阿干 亞割谷 艾城 當滅的物",
  sisera: "息色辣 耶賓 夏瑣 鐵車 基順河 他泊山 橛子",
  herodGreat: "大黑落德 希律王 黑落德 博士 伯利恆 埃及",
  belshazzar: "貝耳沙匝 巴比倫王 牆上的字 但以理",
  pilate: "比拉多 般雀比拉多 羅馬巡撫 洗手",
  sapphira: "亞拿尼亞 撒非喇 撒斐辣 阿納尼雅 欺哄聖靈 田產",
  pharaoh: "埃及王 法老王 出埃及",
  charioteer: "戰車 埃及兵 紅海",
  jezebel: "依則貝耳 王后 亞哈 拿伯",
  baalProphet: "巴耳 假先知 迦密山",
  haman: "哈曼 阿甲人 木架 普珥",
  delilah: "德里拉 參孫 梭烈谷",
  nebuchadnezzar: "拿步高 巴比倫王 金像 火窯",
  ahab: "阿哈布 以色列王 拿伯 葡萄園",
  legionFreed: "群 格拉森 格拉森人 被鬼附的人 鬼附 污鬼 豬群 低加波利 革辣森",
  prodigal: "浪子回頭 浪子 小兒子 比喻 上好的袍子 蕩子",
  ethiopian: "衣索比亞太監 衣索比亞 埃提阿伯 太監 官員 厄提約丕雅 以賽亞書",
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
  return [...(["zh", "en"] as const).flatMap((l) => keys.map((k) => translate(l, k))), ALIASES[id as CharacterId | EnemyId] ?? ""].join(" ").toLowerCase();
}
const SEARCH = new Map(CARDS.map((c) => [c.id, searchText(c)]));
/** The same search text for a character, so other screens (the free-mode picker) search the way the card demo does. */
export const characterSearchText = (id: CharacterId): string => searchText({ id } as Viewed);

const figureOf = ({ id, enemy, scripture }: Viewed) => (enemy || scripture ? undefined : figureArea(id as CharacterId));
const elementOf = ({ id, enemy, scripture }: Viewed) =>
  scripture ? ENERGY_ELEMENT[CARDS_V2[id as CardId].energy] : enemy ? ENEMY_ELEMENT[id as EnemyId] : CHARACTER_ELEMENT[id as CharacterId];

export function CardDemo() {
  const t = useT();
  const [effects, setEffects] = useState(true);
  const [viewing, setViewing] = useState<Viewed | null>(null);
  const [flipped, setFlipped] = useState(false); // the viewed card turned to its back
  const [ceremony, setCeremony] = useState<CharacterId | null>(null); // previewing how a GR card arrives
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a different card always opens face up
    setFlipped(false);
  }, [viewing?.id]);
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
  // Read once on the client, like the scale: the story panel only shows in the viewer.
  const [showStory, setShowStory] = useState(() => savedShowStory());
  const toggleStory = () =>
    setShowStory((on) => {
      safeStorage.setItem(STORY_KEY, on ? "off" : "on");
      return !on;
    });
  const [scale, setScale] = useState(savedScale);

  const adjust = (next: (current: number) => number) =>
    setScale((current) => {
      const clamped = Math.round(Math.min(4, Math.max(0.5, next(current))) * 100) / 100;
      safeStorage.setItem(SCALE_KEY, String(clamped));
      return clamped;
    });

  // Flip through the cards on screen (the current search and rarity tab), wrapping at either end.
  const at = viewing ? shown.findIndex((c) => c.id === viewing.id) : -1;
  const step = (d: number) =>
    setViewing((cur) => {
      const i = cur ? shown.findIndex((c) => c.id === cur.id) : -1;
      return i < 0 || shown.length < 2 ? cur : shown[(i + d + shown.length) % shown.length];
    });
  const swipeFrom = useRef<number | null>(null);

  useEffect(() => {
    if (!viewing) return;
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewing(null);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  return (
    <main className="flex min-h-[calc(100dvh-3rem)] flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
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
              <HoloCard element={elementOf(card)} effects={effects} rarity={CARD_RARITY[card.id]} figure={figureOf(card)} className="w-[220px] text-[10.3px]">
                <CardFace {...card} />
              </HoloCard>
            </button>
            <span className="text-sm font-black tracking-widest text-amber-200">{CARD_RARITY[card.id]}</span>
          </div>
        ))}
      </div>
      {/* Scripture (energy) cards, printed at the same size */}
      <section className="w-full max-w-7xl px-2">
        <h2 className="text-center text-lg font-bold">{t("v3.scripture.title")}</h2>
        <p className="mt-1 text-center text-sm text-stone-400">{t("v3.scripture.hint")}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] justify-items-center gap-x-4 gap-y-6 py-4">
          {SCRIPTURE_CARDS.map((id) => (
            <button key={id} type="button" onClick={() => setViewing({ id, scripture: true })} aria-label={t("v3.demo.view")} className="cursor-zoom-in">
              <HoloCard element={ENERGY_ELEMENT[CARDS_V2[id].energy]} effects={effects} rarity="N" className="w-[220px] text-[10.3px]">
                <ScriptureCardFace id={id} />
              </HoloCard>
            </button>
          ))}
        </div>
      </section>

      {/* The back every card is dealt with (the deck pile, and a card in a pack before it is turned over) */}
      <section className="w-full max-w-7xl px-2">
        <h2 className="text-center text-lg font-bold">{t("v3.demo.back")}</h2>
        <div className="flex justify-center py-4">
          <HoloCard element="light" effects={effects} rarity="N" className="w-[220px] text-[10.3px]">
            <ScriptureCardBack />
          </HoloCard>
        </div>
      </section>

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
        <div
          onClick={() => setViewing(null)}
          onTouchStart={(e) => (swipeFrom.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const from = swipeFrom.current;
            swipeFrom.current = null;
            if (from === null) return;
            const dx = e.changedTouches[0].clientX - from;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
          className="fixed inset-0 z-[60] flex flex-col items-center gap-3 overflow-y-auto bg-black/80 p-4"
        >
          {shown.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label={t("v3.demo.prev")}
                title={`${t("v3.demo.prev")} (←)`}
                className="fixed left-2 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-2 border-stone-400 bg-stone-900/70 text-2xl font-bold text-stone-100 hover:bg-white/15 sm:left-6"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label={t("v3.demo.next")}
                title={`${t("v3.demo.next")} (→)`}
                className="fixed right-2 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-2 border-stone-400 bg-stone-900/70 text-2xl font-bold text-stone-100 hover:bg-white/15 sm:right-6"
              >
                ›
              </button>
            </>
          )}
          <div className="mt-auto flex max-w-full flex-col items-center gap-4 lg:flex-row lg:items-stretch">
          <motion.div
            key={viewing.id}
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => {
              e.stopPropagation();
              setFlipped((f) => !f); // a tap on the card turns it over
            }}
            className={`${VIEWER_WIDTH} cursor-pointer`}
            style={viewerStyle(scale)}
          >
            <FlipCard flipped={flipped} effects={effects}>
              <HoloCard element={elementOf(viewing)} effects={effects} rarity={rarityOf(viewing)} figure={figureOf(viewing)}>
                <CardFace {...viewing} />
              </HoloCard>
            </FlipCard>
          </motion.div>
          {showStory && !viewing.scripture && <StoryPanel id={viewing.id as CharacterId | EnemyId} enemy={viewing.enemy} />}
          </div>
          <div onClick={(e) => e.stopPropagation()} className="mb-auto flex flex-wrap items-center justify-center gap-2 text-sm text-stone-200">
            {at >= 0 && <span className="tabular-nums text-stone-400">{at + 1} / {shown.length}</span>}
            {!viewing.scripture && !viewing.enemy && CARD_RARITY[viewing.id as CharacterId] === "GR" && (
              <button onClick={() => setCeremony(viewing.id as CharacterId)} className="rounded-full border border-amber-200 bg-amber-100/90 px-3 py-1 text-xs font-bold text-stone-900 hover:bg-white">
                ✦ {t("v3.demo.ceremony")}
              </button>
            )}
            {!viewing.scripture && (
              <button
                onClick={toggleStory}
                aria-pressed={showStory}
                className={`rounded-full border px-3 py-1 text-xs ${showStory ? "border-amber-300 bg-amber-500/90 font-bold text-stone-950" : "border-stone-500 text-stone-300 hover:bg-white/10"}`}
              >
                {t("v3.demo.story")}：{showStory ? t("v3.demo.on") : t("v3.demo.off")}
              </button>
            )}
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
      {ceremony && <GrCeremony id={ceremony} onClose={() => setCeremony(null)} />}
    </main>
  );
}
