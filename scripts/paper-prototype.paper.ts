// Builds the printable paper prototype of one campaign stage under the physical rules in docs/physical-core-draft.md:
// character cards, enemy cards, the boss's action track, the scripture (energy) deck, tokens, a rules sheet and a
// play-test record sheet. Run `STAGE=goliath pnpm paper`; it writes docs/paper-prototype/<stage>/index.html (print it
// from a browser, A4, no margins, "background graphics" on).
import { writeFileSync, mkdirSync } from "node:fs";
import { it } from "vitest";
import { CARD_RARITY, type Rarity } from "@/components/cards/rarity";
import { translate } from "@/game/i18n";
import {
  BAAL_CYCLE,
  basicDamage,
  CARDS_V2,
  CHARACTER_ELEMENT,
  CHARACTER_SKILLS,
  CHARIOTS_CYCLE,
  DECK_V2,
  ENEMY_ELEMENT,
  ENEMY_HP,
  FLOOD_CYCLE,
  HUNT_WEAKEST,
  LEGION_CYCLE,
  LIONS_CYCLE,
  MAX_HP,
  MULTI_TARGETS,
  PHASE1_CYCLE,
  PHASE2_CYCLE,
  SERPENT_CYCLE,
  SHOOTER_DAMAGE,
  SINGLE_TARGET,
  SKILLS,
  STAGE_BOSS,
  STAGE_GUARD,
  STAGE_SHOOTER,
  WALLS_CRACKED_CYCLE,
  WALLS_CYCLE,
  tableKind,
} from "@/game/v2/data";
import { actionBase, baseSupportAmount, elementMultiplier } from "@/game/v2/engine";
import type { BattleState, CardId, CharacterId, Element, EnemyId, GoliathActionId, SkillId } from "@/game/v2/types";
import { CAMPAIGN } from "@/game/v3/campaign";

const STAGE = process.env.STAGE ?? "goliath";
const zh = (key: string, params?: Record<string, string | number>) => translate("zh", key, params);
const has = (key: string) => zh(key) !== key;

/** How much Energy a character can hold (the total value of the cards stuck under them). */
const ENERGY_CAP: Record<Rarity, number> = { N: 3, R: 4, SR: 5, SSR: 6, UR: 8 };
const ELEMENTS: Element[] = ["metal", "wood", "water", "fire", "earth", "light", "dark"];
const RARITY_COLOR: Record<Rarity, string> = { N: "#7b8794", R: "#2f855a", SR: "#2b6cb0", SSR: "#b7791f", UR: "#c05621" };
const ENERGY_COLOR = { red: "#c53030", blue: "#2b6cb0", green: "#2f855a" } as const;

/** The physical rules replace "Faith" by blue Energy; skill texts are adapted. */
const adapt = (text: string) => text.replaceAll("護盾", "額外血量").replaceAll("✨", "藍能量 ").replaceAll("🗡️", "紅能量 ").replaceAll("🕊️", "藍能量 ").replaceAll("信心", "藍能量").replaceAll("攻擊能量", "紅能量").replaceAll("手上保留", "身上有");

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const img = (path: string) => `../../../public/cards/${path}`;

// ---------------------------------------------------------------- characters

function pips(kind: "attack" | "guard" | "faith", cost: number) {
  const color = kind === "attack" ? ENERGY_COLOR.red : kind === "guard" ? ENERGY_COLOR.green : ENERGY_COLOR.blue;
  return Array.from({ length: cost }, () => `<i class="pip" style="background:${color}"></i>`).join("");
}

function skillRow(skill: SkillId): string {
  const def = SKILLS[skill];
  const n = def.damage ?? baseSupportAmount(skill);
  const desc = adapt(zh(`v2.skill.${skill}.desc`, { n }));
  const ultimate = def.kind === "faith" ? `<b class="tag">大招</b>` : "";
  const value = def.damage ? `<span class="amt">${def.damage}</span>` : n >= 10 ? `<span class="amt">+${n}</span>` : "";
  return `<div class="skill"><div class="skill-head"><span class="pips">${pips(tableKind(skill), def.cost)}</span><span class="skill-name">${esc(zh(`v2.skill.${skill}.name`))}</span>${ultimate}${value}</div><div class="skill-desc">${esc(desc)}</div></div>`;
}

function characterCard(id: CharacterId): string {
  const rarity = CARD_RARITY[id];
  const element = CHARACTER_ELEMENT[id];
  const weak = ELEMENTS.filter((e) => elementMultiplier(e, element, true) > 1).map((e) => zh(`v2.element.${e}`));
  const resist = ELEMENTS.filter((e) => elementMultiplier(e, element, true) < 1).map((e) => zh(`v2.element.${e}`));
  const notes: string[] = [];
  if (has(`v2.passive.${id}`)) notes.push(adapt(zh(`v2.passive.${id}`)));
  if (has(`v3.story.${id}`)) notes.push(`📖 ${adapt(zh(`v3.story.${id}`))}`);
  return `<article class="card char" style="--accent:${RARITY_COLOR[rarity]}">
    <header><div><div class="title">${esc(zh(`v3.card.${id}.title`))}</div><div class="name">${esc(zh(`char.${id}.name`))}</div></div>
      <div class="hp"><span class="rar">${rarity}</span><span class="hp-num"><small>HP</small>${MAX_HP[id]}</span></div></header>
    <div class="art" style="background-image:url(${img(`${id}.jpg`)})"></div>
    <div class="stats"><span class="chip">${zh(`v2.element.${element}`)}</span><span>能量上限 <b>${ENERGY_CAP[rarity]}</b></span><span class="wr">弱 ${weak.join("")||"—"} ／ 抗 ${resist.join("")||"—"}</span></div>
    <div class="skills"><div class="skill basic"><div class="skill-head"><span class="skill-name">基本攻擊</span><b class="tag">免費</b><span class="amt">${basicDamage(id)}</span></div><div class="skill-desc">不花能量，對一個敵人造成 ${basicDamage(id)} 傷害；用掉這回合的行動（和用技能二選一）。</div></div>${CHARACTER_SKILLS[id].map(skillRow).join("")}</div>
    ${notes.length ? `<div class="notes">${notes.map(esc).join("<br>")}</div>` : ""}
  </article>`;
}

// ---------------------------------------------------------------- enemies

const CYCLES: Record<string, { name: string; actions: GoliathActionId[] }[]> = {
  goliath: [
    { name: "第一階段（歌利亞被機弦甩石擊中前）", actions: PHASE1_CYCLE },
    { name: "第二階段（暴怒）", actions: PHASE2_CYCLE },
  ],
  eden: [{ name: "古蛇（半血蛻皮：毒牙 60 → 80）", actions: SERPENT_CYCLE }],
  ark: [{ name: "洪水（第 4 回合起每一擊 +20）", actions: FLOOD_CYCLE }],
  redSea: [{ name: "戰車（半血車輪脫落：失去一次行動、衝鋒降為 40）", actions: CHARIOTS_CYCLE }],
  jericho: [
    { name: "城牆", actions: WALLS_CYCLE },
    { name: "裂開（半血後）", actions: WALLS_CRACKED_CYCLE },
  ],
  carmel: [{ name: "巴力的先知（半血狂亂：求告扣藍能量、自割 80）", actions: BAAL_CYCLE }],
  lions: [{ name: "獅子", actions: LIONS_CYCLE }],
  gerasa: [{ name: "群（半血傾巢：我們多打全隊）", actions: LEGION_CYCLE }],
};

function actionLine(action: GoliathActionId, phase2: boolean): string {
  const fake = { goliath: { enraged: phase2 } } as unknown as BattleState;
  const n = actionBase(fake, action);
  const targets = SINGLE_TARGET.includes(action) ? "前線角色" : MULTI_TARGETS[action] ? `隨機 ${MULTI_TARGETS[action]} 名隊友` : HUNT_WEAKEST.includes(action) ? "最虛弱的隊友" : "全隊";
  const desc = adapt(zh(`v2.action.${action}.desc`, { n, targets }));
  return `<div class="act"><b>${esc(zh(`v2.action.${action}.name`))}</b> <span>${esc(desc)}</span></div>`;
}

function enemyCard(id: EnemyId, role: string, extra: string): string {
  const element = ENEMY_ELEMENT[id];
  return `<article class="card enemy" style="--accent:#822727">
    <header><div><div class="title">${esc(role)}</div><div class="name">${esc(zh(`v2.enemy.${id}.name`))}</div></div>
      <div class="hp"><span class="rar">敵</span><span class="hp-num"><small>HP</small>${ENEMY_HP[id]}</span></div></header>
    <div class="art" style="background-image:url(${img(`${id}.jpg`)});background-color:#2d3748"></div>
    <div class="stats"><span class="chip">${zh(`v2.element.${element}`)}</span><span class="wr">屬性剋制 +10／被剋 −10</span></div>
    <div class="skills">${extra}</div>
  </article>`;
}

function trackCard(boss: EnemyId): string {
  const phases = CYCLES[STAGE] ?? [];
  const body = phases
    .map((ph, pi) => `<div class="phase"><div class="phase-name">${esc(ph.name)}</div>${ph.actions.map((a, i) => `<div class="step"><span class="no">${i + 1}</span>${actionLine(a, pi === 1 && STAGE === "goliath")}</div>`).join("")}</div>`)
    .join("");
  return `<article class="card track" style="--accent:#822727">
    <header><div><div class="title">行動軌</div><div class="name">${esc(zh(`v2.enemy.${boss}.name`))}</div></div></header>
    <div class="track-note">標記放在目前的格子；每回合敵人做完該格的行動後，標記前進一格，繞回第 1 格。下一格的行動也攤開，讓玩家看見。</div>
    <div class="skills">${body}</div>
  </article>`;
}

// ---------------------------------------------------------------- scripture cards

function scriptureCard(id: CardId, copy: number): string {
  const def = CARDS_V2[id];
  const color = def.energy === "attack" ? ENERGY_COLOR.red : def.energy === "faith" ? ENERGY_COLOR.blue : ENERGY_COLOR.green;
  const kind = def.energy === "attack" ? "紅・攻擊能量" : def.energy === "faith" ? "藍・法力能量" : "綠・回血能量";
  const rule = `貼在一名角色旁（算入他的能量上限；每回合最多貼 2 張）`;
  const cond = def.condition === "turn3" ? "第 3 回合起才能打出" : def.condition === "needFaith" ? "需要我方至少一個角色身上有藍能量" : "";
  return `<article class="card scripture" style="--accent:${color}">
    <header style="background:${color}"><div><div class="title">${kind}</div><div class="name">${esc(zh(`v2.card.${id}.name`))}</div></div><div class="val">${def.energy === "guard" ? def.amount : def.amount}</div></header>
    <div class="art" style="background-image:url(${img(`scripture/${id}.jpg`)})"></div>
    <div class="verse">${esc(zh(`v2.card.${id}.verse`))}<br><b>— ${esc(zh(`v2.card.${id}.ref`))}</b></div>
    <div class="notes" style="font-size:6.6pt">${esc(rule)}${cond ? `<br><b>${esc(cond)}</b>` : ""}</div>
    <div class="copy">${copy > 1 ? `第 ${copy} 張` : ""}</div>
  </article>`;
}

// ---------------------------------------------------------------- pages

const css = `
@page { size: A4; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif; color: #1a202c; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.page { width: 210mm; height: 297mm; padding: 16.5mm 10.5mm; page-break-after: always; position: relative }
.sheet { display: grid; grid-template-columns: repeat(3, 63mm); grid-auto-rows: 88mm }
.card { width: 63mm; height: 88mm; border: 0.35mm solid #1a202c; background: #fffdf7; position: relative; overflow: hidden; display: flex; flex-direction: column; outline: 0.2mm dashed #a0aec0; outline-offset: -0.2mm }
.card header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.2mm 1.8mm; background: var(--accent); color: #fff; min-height: 9mm }
.title { font-size: 6pt; opacity: .9 } .name { font-size: 11.5pt; font-weight: 800; line-height: 1.1 }
.hp { display: flex; align-items: center; gap: 1.2mm } .rar { font-size: 7pt; font-weight: 800; background: #fff; color: var(--accent); border-radius: 1mm; padding: .2mm 1mm }
.hp-num { font-size: 13pt; font-weight: 900; line-height: 1 } .hp-num small { font-size: 5pt; margin-right: .6mm; font-weight: 700 }
.art { height: 28mm; background-size: cover; background-position: center 18%; background-color: #cbd5e0; border-bottom: 0.25mm solid #1a202c }
.stats { display: flex; gap: 1.5mm; align-items: center; font-size: 6.2pt; padding: .8mm 1.8mm; background: #edf2f7; border-bottom: .2mm solid #cbd5e0 }
.chip { background: #1a202c; color: #fff; border-radius: 1mm; padding: .1mm 1.2mm; font-weight: 800; font-size: 7pt } .wr { margin-left: auto; color: #4a5568 }
.skills { padding: 1mm 1.6mm; display: flex; flex-direction: column; gap: 1mm; flex: 1 }
.skill-head { display: flex; align-items: center; gap: 1mm } .pips { display: inline-flex; gap: .5mm } .pip { width: 3mm; height: 3mm; border-radius: 50%; border: .2mm solid #1a202c; display: inline-block }
.skill-name { font-size: 9pt; font-weight: 800 } .basic { background: #fffaf0; border: .2mm dashed #d69e2e; border-radius: 1mm; padding: .4mm 1mm } .tag { font-size: 5pt; background: #1a202c; color: #fff; border-radius: .8mm; padding: 0 .8mm }
.amt { margin-left: auto; font-size: 13pt; font-weight: 900 } .skill-desc { font-size: 7pt; line-height: 1.3; color: #2d3748 }
.notes { font-size: 6.2pt; line-height: 1.3; padding: .8mm 1.8mm; background: #fffaf0; border-top: .2mm solid #ecc94b; color: #744210 }
.scripture header { color: #fff } .val { font-size: 17pt; font-weight: 900; line-height: 1 } .scripture .art { height: 31mm }
.verse { font-size: 7pt; line-height: 1.35; padding: 1.4mm 1.8mm; flex: 1 } .copy { position: absolute; right: 1.5mm; bottom: .8mm; font-size: 4.5pt; color: #a0aec0 }
.track-note { font-size: 6.4pt; padding: 1mm 1.8mm; background: #fff5f5; color: #742a2a } .phase-name { font-size: 7.6pt; font-weight: 800; border-bottom: .2mm solid #1a202c; margin-bottom: .6mm }
.step { display: flex; gap: 1mm; font-size: 6.8pt; line-height: 1.3; margin-bottom: .8mm } .no { width: 3.6mm; height: 3.6mm; flex: none; border-radius: 50%; background: #822727; color: #fff; text-align: center; font-weight: 800; line-height: 3.6mm }
.act b { font-weight: 800 } .act span { color: #2d3748 }
.rules { column-count: 2; column-gap: 8mm; font-size: 9.6pt; line-height: 1.5 } .rules h2 { font-size: 11pt; margin: 3mm 0 1mm; border-bottom: .3mm solid #1a202c } .rules h1 { column-span: all; font-size: 17pt; margin: 0 0 2mm }
.rules ul { margin: 0 0 1mm 4mm; padding: 0 } .rules p { margin: 0 0 1mm } .rules .t { width: 100%; border-collapse: collapse; font-size: 7.8pt; margin: 1mm 0 } .rules .t td, .rules .t th { border: .2mm solid #718096; padding: .6mm 1.2mm; text-align: left }
.tokens { display: flex; flex-wrap: wrap; gap: 2mm; align-content: flex-start } .tk { display: flex; align-items: center; justify-content: center; font-weight: 900; border: .3mm dashed #4a5568 }
.tk.c { width: 14mm; height: 14mm; border-radius: 50% } .tk.s { width: 18mm; height: 14mm; border-radius: 1.5mm; font-size: 7pt }
.rec table { width: 100%; border-collapse: collapse; font-size: 9pt } .rec td, .rec th { border: .3mm solid #4a5568; padding: 2.2mm; vertical-align: top } .rec h1 { font-size: 16pt; margin: 0 0 3mm } .rec p { font-size: 8.6pt; margin: 0 0 2mm }
`;

function page(inner: string, extra = "") {
  return `<section class="page ${extra}">${inner}</section>`;
}
const sheet = (cards: string[]) => `<div class="sheet">${cards.join("")}</div>`;

it("builds the paper prototype", () => {
  const stage = CAMPAIGN.find((s) => s.id === STAGE);
  if (!stage || !stage.battle) throw new Error(`no such campaign stage: ${STAGE}`);
  const battle = stage.battle;
  const boss = STAGE_BOSS[battle];
  const guard = STAGE_GUARD[battle];
  const shooter = STAGE_SHOOTER[battle];
  const stageName = zh(`v3.campaign.${stage.id}.name`);

  const characters = stage.pool.map(characterCard);
  const enemies: string[] = [];
  if (guard) enemies.push(enemyCard(guard, "護衛", `<div class="skill"><div class="skill-head"><span class="skill-name">保護頭目</span></div><div class="skill-desc">他還站著時，一般攻擊不能選頭目為目標；他倒下後，頭目才能被攻擊。</div></div>`));
  enemies.push(
    enemyCard(
      boss,
      "頭目",
      `<div class="skill"><div class="skill-desc">行動見「行動軌」卡。頭目 HP ${ENEMY_HP[boss]}，歸零即勝利。</div></div>`,
    ),
  );
  if (shooter) enemies.push(enemyCard(shooter, "射手", `<div class="skill"><div class="skill-head"><span class="skill-name">攻擊前線</span><span class="amt">${SHOOTER_DAMAGE[shooter] ?? 0}</span></div><div class="skill-desc">敵人行動時，對前線角色造成 ${SHOOTER_DAMAGE[shooter] ?? 0} 傷害。他倒下後不再攻擊。</div></div>`));

  const counts = new Map<CardId, number>();
  const deck = DECK_V2.map((id) => {
    const copy = (counts.get(id) ?? 0) + 1;
    counts.set(id, copy);
    return scriptureCard(id, (DECK_V2.filter((x) => x === id).length > 1 ? copy : 1));
  });

  const rules = `<div class="rules"><h1>Bible Quest 紙上原型：${esc(stageName)}</h1>
<p>合作對抗敵方。你從本關的 ${stage.pool.length} 張角色卡中選 ${stage.pick} 張出戰，打倒頭目就贏；三名角色全部倒下就輸。</p>
<h2>準備</h2><ul><li>選 ${stage.pick} 張角色卡排成一列，最左邊是<b>前線</b>。</li><li>敵人卡擺在對面：護衛、頭目、射手；把「行動軌」放在旁邊，標記放第 1 格。</li><li>經文牌 ${DECK_V2.length} 張洗好成牌庫，抽 5 張。</li><li>傷害指示物放在桌邊；角色與敵人的 HP 都是 10 的倍數，受傷就在卡上放指示物（10 一個，50 一個大的）。指示物數 ≥ HP 就倒下。</li></ul>
<h2>每回合（玩家）</h2><ol><li><b>抽牌</b>：第 1 回合已抽 5 張；之後每回合抽 3 張。手牌上限 7 張。</li><li><b>貼能量（每回合最多 2 張）</b>：把紅卡、綠卡或藍卡從手牌貼到角色旁（露出數值），<b>每回合最多貼 2 張</b>，想貼的選好給誰。每個角色身上的能量<b>總數值</b>不能超過卡上的「能量上限」。「第 3 回合起」的卡第 3 回合才能打。</li><li><b>行動</b>：每個角色可以用<b>一個技能，或做一次免費的基本攻擊</b>（卡面最上面那一行，不花能量，二選一）。費用是卡上的圓點，<b>紅點用紅能量付（攻擊）、綠點用綠能量付（回血與防禦）、藍點用藍能量付（法力：依角色可以回血或傷敵）</b>：從該角色身上棄掉對應顏色的卡，總數值 ≥ 費用即可，<b>不找零</b>。用完把該角色卡橫放。</li><li><b>技能獲得能量</b>（例如「獲得 1 藍能量」）：拿對應顏色的能量代幣貼到任一角色旁，算在上限內。</li></ol>
<h2>敵人回合</h2><ol><li>看行動軌標記所在的格子，頭目照做（傷害打前線或指定對象）。</li><li>射手攻擊前線。護衛只是擋人，不攻擊。</li><li>標記前進一格（頭目被「機弦甩石」擊中時改走第二階段，從第 1 格開始）。</li><li>護盾棄掉，角色卡轉回直立，驚恐標記拿掉。</li></ol>
<h2>其他規則</h2><ul><li><b>屬性</b>：攻擊方的屬性剋制對方屬性時傷害 +10；被剋制時 −10（最少 0）。剋制圈：木剋土、土剋水、水剋火、火剋金、金剋木；光與暗互剋。風歸木、雷歸金。</li><li><b>額外血量</b>：黃色的「血 +10」指示物放在角色上，疊在原本血量之上；受傷時先扣額外血量，扣完才扣真正的血量。不會自己消失，回血也補不了它，最多 +60。技能裡寫的「護盾」就是額外血量。</li><li><b>驚恐</b>：放驚恐標記在角色上，他下回合不能行動；有額外血量的角色不會驚恐。</li><li><b>每場一次</b>：用過後在技能旁放「已使用」標記。</li><li><b>前線</b>：每回合開始前可以免費調換前線一次；前線倒下時，立刻選一個倒下前的隊友補上。</li><li><b>勝負</b>：頭目 HP 歸零贏；三人都倒下輸。</li></ul>
<h2>要記錄的</h2><p>這是測試版，請玩完用最後一頁的紀錄表寫下：打了幾回合、哪裡卡住、哪些規則很難記、哪張牌或技能太強太弱。</p></div>`;

  const tokens = `<h2 style="margin:0 0 3mm">指示物（剪下使用）</h2><div class="tokens">${[
    ...Array.from({ length: 36 }, () => `<div class="tk c" style="font-size:12pt">10</div>`),
    ...Array.from({ length: 10 }, () => `<div class="tk c" style="font-size:12pt;background:#fefcbf;border-style:solid">50</div>`),
    ...Array.from({ length: 10 }, () => `<div class="tk c" style="font-size:8pt;background:${ENERGY_COLOR.red};color:#fff">紅 1</div>`),
    ...Array.from({ length: 10 }, () => `<div class="tk c" style="font-size:8pt;background:${ENERGY_COLOR.green};color:#fff">綠 1</div>`),
    ...Array.from({ length: 10 }, () => `<div class="tk c" style="font-size:8pt;background:${ENERGY_COLOR.blue};color:#fff">藍 1</div>`),
    ...Array.from({ length: 12 }, () => `<div class="tk c" style="font-size:9pt;background:#faf089;border-style:solid">血+10</div>`),
    ...Array.from({ length: 6 }, () => `<div class="tk s" style="background:#e9d8fd">驚恐</div>`),
    ...Array.from({ length: 8 }, () => `<div class="tk s" style="background:#e2e8f0">已使用</div>`),
    `<div class="tk s" style="background:#fed7d7">行動軌標記 ▶</div>`,
    `<div class="tk s" style="background:#fed7d7">前線</div>`,
  ].join("")}</div>`;

  const record = `<div class="rec"><h1>測試紀錄表（每場一張）</h1><p>日期：______　選的角色：______________________　結果：勝／敗　共 ____ 回合</p>
<table><tr><th style="width:35%">問題</th><th>紀錄</th></tr>
<tr><td>哪裡讓你卡住、要翻規則？</td><td style="height:22mm"></td></tr>
<tr><td>貼能量時有沒有為難（每回合 2 張夠不夠、不知道給誰、上限太緊或太鬆、不找零太浪費）？</td><td style="height:22mm"></td></tr>
<tr><td>手牌有沒有打不出去、或一直爆手牌？</td><td style="height:16mm"></td></tr>
<tr><td>哪個技能太強、太弱、或根本用不到？</td><td style="height:22mm"></td></tr>
<tr><td>屬性 ±10 有感覺嗎？</td><td style="height:12mm"></td></tr>
<tr><td>每回合大約花多久？有哪一步要算很久？</td><td style="height:16mm"></td></tr>
<tr><td>想改的規則、想要的功能</td><td style="height:26mm"></td></tr></table></div>`;

  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>Bible Quest 紙上原型：${esc(stageName)}</title><style>${css}</style></head><body>
${page(rules)}
${page(sheet([...characters.slice(0, 6), ...enemies]))}
${page(sheet([trackCard(boss), ...deck.slice(0, 8)]))}
${page(sheet(deck.slice(8)))}
${page(tokens)}
${page(record)}
</body></html>`;

  const dir = `docs/paper-prototype/${STAGE}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html);
});
