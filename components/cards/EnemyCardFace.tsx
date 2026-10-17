"use client";

// Printed enemy card, in the same style as the character cards: frame, ornaments, art, moves, weakness, verse.
import { ENEMY_ELEMENT, ENEMY_HP, RULES_V2 as R, SHOOTER_DAMAGE } from "@/game/v2/data";
import { elementMultiplier } from "@/game/v2/engine";
import type { EnemyId, GoliathActionId } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { CardFrame } from "./CardFrame";
import { frameFigure, type Figure } from "./framing";
import { ELEMENTS, THEME } from "./CharacterCardFace";
import { ElementIcon } from "./ElementIcon";
import { Foil } from "./HoloCard";
import { CARD_RARITY, lookOf } from "./rarity";
import { RarityMark } from "./RarityMark";
import { asset } from "@/game/assets";

const PORTRAIT: Record<EnemyId, string> = {
  goliath: "🗿",
  bearer: "🛡️",
  archer: "🏹",
  serpent: "🐍",
  serpentTempter: "🐍",
  satanMan: "🎭",
  roaringLion: "🦁",
  fieryDarts: "🔥",
  satanFoe: "😈",
  flood: "🌊",
  chariots: "🐎",
  walls: "🧱",
  baalProphets: "🔥",
  lionRest: "🦁",
  lion: "🦁",
  lioness: "🦁",
  legion: "👥",
  fountains: "🌀",
  windows: "🌧️",
  pharaohHost: "👑",
  chariotCaptain: "🏹",
  jerichoKing: "👑",
  wallGuard: "🏹",
  ahabKing: "👑",
  jezebelQueen: "📜",
  presidents: "📜",
  princes: "🗡️",
  uncleanSpirits: "👤",
  swine: "🐗",
};
const CARD_NO: Record<EnemyId, string> = {
  goliath: "E01",
  bearer: "E02",
  archer: "E03",
  serpent: "E04",
  serpentTempter: "E35",
  satanMan: "E36",
  roaringLion: "E38",
  fieryDarts: "E39",
  satanFoe: "E37",
  flood: "E05",
  chariots: "E06",
  walls: "E07",
  baalProphets: "E08",
  lion: "E09",
  legion: "E10",
  fountains: "E11",
  windows: "E12",
  pharaohHost: "E13",
  chariotCaptain: "E14",
  jerichoKing: "E15",
  wallGuard: "E16",
  ahabKing: "E17",
  jezebelQueen: "E18",
  presidents: "E19",
  princes: "E20",
  uncleanSpirits: "E21",
  swine: "E22",
  lionRest: "E23",
  lioness: "E24",
};
/** Card illustrations in /public/cards and where the figure stands in each (see framing.ts). */
const ART: Partial<Record<EnemyId, { src: string; figure: Figure }>> = {
  goliath: { src: "/cards/goliath.jpg", figure: { cx: 0.385, head: 0.22, feet: 0.943, size: 1.15 } },
  archer: { src: "/cards/archer.jpg", figure: { cx: 0.48, head: 0.151, feet: 0.947 } },
  bearer: { src: "/cards/bearer.jpg", figure: { cx: 0.46, head: 0.156, feet: 0.947 } },
  // The serpent is coiled up the tree: frame the head and the tree, looking left.
  serpent: { src: "/cards/serpent.jpg", figure: { cx: 0.62, head: 0.02, feet: 0.97, gaze: "left" } },
  // The cunning serpent of the first round has the picture of the serpent card the player draws.
  // Satan in the wilderness has the pictures of the two Satan cards the player can draw.
  // The two he summons have borrowed pictures (the lion of the den, the archer) until they have their own.
  roaringLion: { src: "/cards/lion.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  fieryDarts: { src: "/cards/archer.jpg", figure: { cx: 0.48, head: 0.151, feet: 0.947 } },
  satanMan: { src: "/cards/satanDisguised.jpg", figure: { cx: 0.5, head: 0.11, feet: 0.93 } },
  satanFoe: { src: "/cards/satan.jpg", figure: { cx: 0.5, head: 0.1, feet: 0.9 } },
  serpentTempter: { src: "/cards/serpent-player.jpg", figure: { cx: 0.55, head: 0.2, feet: 0.931, gaze: "right" } },
  // Scenes with no figure (the sky, the flood): the whole picture is the frame.
  windows: { src: "/cards/windows.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  fountains: { src: "/cards/fountains.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  flood: { src: "/cards/flood.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  // Gerasa: Legion crowds the man at the left of Jesus; the unclean spirit sits among the tombs.
  legion: { src: "/cards/legion.jpg", figure: { cx: 0.4, head: 0.02, feet: 0.98 } },
  uncleanSpirits: { src: "/cards/uncleanSpirits.jpg", figure: { cx: 0.35, head: 0.02, feet: 0.98 } },
  // The herd of swine rushing down the slope: the whole scene is the frame.
  swine: { src: "/cards/swine.jpg", figure: { cx: 0.4, head: 0.02, feet: 0.98 } },
  // Daniel's rivals: the presidents go through the scrolls, the princes petition the king (the speaker stands left of centre).
  presidents: { src: "/cards/presidents.jpg", figure: { cx: 0.4, head: 0.02, feet: 0.98 } },
  princes: { src: "/cards/princes.jpg", figure: { cx: 0.4, head: 0.02, feet: 0.98 } },
  // The three lions of the den: a painting each, the whole picture is the frame.
  lion: { src: "/cards/lion.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  lionRest: { src: "/cards/lionRest.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  lioness: { src: "/cards/lioness.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  // The prophets of Baal crying out around the altar: the whole scene is the frame.
  baalProphets: { src: "/cards/baalProphets.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  // The king sits at the left of a throne-room scene.
  jerichoKing: { src: "/cards/jerichoKing.jpg", figure: { cx: 0.3, head: 0.2, feet: 0.8 } },
  // The shut gate of Jericho, dead centre.
  walls: { src: "/cards/walls.jpg", figure: { cx: 0.5, head: 0.02, feet: 0.98 } },
  // The guards on the wall look out to the right.
  wallGuard: { src: "/cards/wallGuard.jpg", figure: { cx: 0.4, head: 0.02, feet: 0.98 } },
  // The chariots charge in from the left, so the frame leans left of centre.
  chariots: { src: "/cards/chariots.jpg", figure: { cx: 0.4, head: 0.02, feet: 0.98 } },
  // Enemy versions of villains who also exist as player cards share their art (see CharacterCardFace).
  pharaohHost: { src: "/cards/pharaoh.jpg", figure: { cx: 0.5, head: 0.175, feet: 0.965 } },
  chariotCaptain: { src: "/cards/charioteer.jpg", figure: { cx: 0.44, head: 0.105, feet: 0.94 } },
  ahabKing: { src: "/cards/ahab.jpg", figure: { cx: 0.48, head: 0.08, feet: 0.95 } },
  jezebelQueen: { src: "/cards/jezebel.jpg", figure: { cx: 0.47, head: 0.09, feet: 0.955 } },
};

/** A guard's and a shooter's printed moves. */
const SHIELD = "shield"; // drawn as an icon, see MoveAmount
const guardMoves = () => [{ key: "v3.ui.protects", amount: SHIELD }];
const shooterMoves = (id: EnemyId) => [{ key: id === "archer" ? "v3.action.arrow" : "v3.action.strike", amount: String(SHOOTER_DAMAGE[id] ?? 0) }];

/** The moves printed on each enemy's card: [name key, amount]. */
const MOVES: Record<
  EnemyId,
  { action?: GoliathActionId; key: string; amount: string }[]
> = {
  goliath: [
    { action: "spear", key: "v2.action.spear.name", amount: String(R.spear) },
    { action: "crush", key: "v2.action.crush.name", amount: String(R.crush) },
    { action: "swing", key: "v2.action.swing.name", amount: String(R.swing) },
  ],
  archer: shooterMoves("archer"),
  bearer: guardMoves(),
  fountains: guardMoves(),
  windows: shooterMoves("windows"),
  pharaohHost: guardMoves(),
  chariotCaptain: shooterMoves("chariotCaptain"),
  jerichoKing: guardMoves(),
  wallGuard: shooterMoves("wallGuard"),
  ahabKing: guardMoves(),
  jezebelQueen: shooterMoves("jezebelQueen"),
  presidents: [
    { action: "decree", key: "v2.action.decree.name", amount: String(R.decree) },
    { action: "accuse", key: "v2.action.accuse.name", amount: `😨×${R.accuseTargets}` },
  ],
  lionRest: guardMoves(),
  lioness: shooterMoves("lioness"),
  princes: shooterMoves("princes"),
  uncleanSpirits: guardMoves(),
  swine: shooterMoves("swine"),
  serpent: [
    { action: "tempt", key: "v2.action.tempt.name", amount: `✨-${R.temptFaith}` },
    { action: "fang", key: "v2.action.fang.name", amount: `${R.fang}/${R.fangShed}` },
    { action: "coil", key: "v2.action.coil.name", amount: String(R.coil) },
  ],
  roaringLion: guardMoves(),
  fieryDarts: shooterMoves("fieryDarts"),
  satanMan: [
    { action: "tempt", key: "v2.action.tempt.name", amount: `✨-${R.temptFaith}` },
    { action: "pinnacle", key: "v2.action.pinnacle.name", amount: String(R.pinnacle) },
    { action: "kingdoms", key: "v2.action.kingdoms.name", amount: `😨×${R.accuseTargets}` },
    { action: "lure", key: "v2.action.lure.name", amount: String(R.lure) },
  ],
  satanFoe: [
    { action: "summon", key: "v2.action.summon.name", amount: "+1" },
    { action: "darts", key: "v2.action.darts.name", amount: `${R.darts}/${R.dartsRage}` },
    { action: "devour", key: "v2.action.devour.name", amount: `${R.devour}/${R.devourRage}` },
  ],
  serpentTempter: [
    { action: "tempt", key: "v2.action.tempt.name", amount: `✨-${R.temptFaith}` },
    { action: "fang", key: "v2.action.fang.name", amount: String(R.fang) },
  ],
  flood: [
    { action: "rain", key: "v2.action.rain.name", amount: `${R.rain}/${R.rain + R.prevailBonus}` },
    { action: "surge", key: "v2.action.surge.name", amount: `${R.surge}/${R.surge + R.prevailBonus}` },
    { action: "deluge", key: "v2.action.deluge.name", amount: `${R.deluge}/${R.deluge + R.prevailBonus}` },
  ],
  chariots: [
    { action: "pursue", key: "v2.action.pursue.name", amount: `${R.pursue}×${R.pursueTargets}` },
    { action: "charge", key: "v2.action.charge.name", amount: `${R.charge}/${R.chargeWheelsOff}` },
    { action: "arrows", key: "v2.action.arrows.name", amount: String(R.arrows) },
  ],
  walls: [
    { action: "stones", key: "v2.action.stones.name", amount: String(R.stones) },
    { action: "repair", key: "v2.action.repair.name", amount: `+${R.repair}` },
    { action: "boulder", key: "v2.action.boulder.name", amount: String(R.boulder) },
  ],
  baalProphets: [
    { action: "cry", key: "v2.action.cry.name", amount: `—/✨-${R.cryFaith}` },
    { action: "leap", key: "v2.action.leap.name", amount: String(R.leap) },
    { action: "cut", key: "v2.action.cut.name", amount: `${R.cut}/${R.cutFrenzy}` },
  ],
  lion: [
    { action: "roar", key: "v2.action.roar.name", amount: `😨×${R.roarTargets}` },
    { action: "pounce", key: "v2.action.pounce.name", amount: String(R.pounce) },
    { action: "maul", key: "v2.action.maul.name", amount: String(R.maul) },
  ],
  legion: [
    { action: "many", key: "v2.action.many.name", amount: `${R.many}×${R.manyTargets}` },
    { action: "chains", key: "v2.action.chains.name", amount: String(R.chains) },
    { action: "torment", key: "v2.action.torment.name", amount: `😨×${R.tormentTargets}` },
  ],
};

function Header({ id, light }: { id: EnemyId; light?: boolean }) {
  const t = useT();
  return (
    <div
      className={`flex items-end justify-between px-[6%] ${light ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]" : ""}`}
    >
      <div className="min-w-0">
        <div
          className={`text-[0.6em] font-semibold uppercase tracking-wider ${light ? "opacity-90" : "opacity-60"}`}
        >
          {t(`v3.card.${id}.title`)}
        </div>
        <div className="truncate text-[1.35em] font-black leading-none">
          {t(`v2.enemy.${id}.name`)}
        </div>
      </div>
      {/* HP and element in the top-right corner, where the battle HP badge covers them. */}
      <div className="absolute right-[2%] top-[calc(2.2%+10px)] flex items-baseline gap-1">
        <span className="text-[0.6em] font-bold">HP</span>
        <span className="text-[1.6em] font-black leading-none">
          {ENEMY_HP[id]}
        </span>
        <span className="relative -top-[3px] text-[1.3em] leading-none">
          <ElementIcon element={ENEMY_ELEMENT[id]} />
        </span>
      </div>
    </div>
  );
}

/** A move's number; "60/80" is two stages (before / after the boss falls to half HP), the second in red. */
function MoveAmount({ value, hint }: { value: string; hint: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- small icon
  if (value === SHIELD) return <img src="/icons/shield.png" alt="" aria-hidden draggable={false} className="h-[1.5em] w-[1.5em] object-contain drop-shadow-[0_0.06em_0.1em_rgb(0_0_0/0.5)]" />;
  const [first, second] = value.split("/");
  if (second === undefined) return <span className="text-[1.15em] font-black">{value}</span>;
  return (
    <span className="relative text-[1.15em] font-black">
      {first}
      <span className="px-[0.1em] text-stone-900/50">/</span>
      <span className="text-[#c0281f]">{second}</span>
      {/* Two words under the red number say what it is; they hang below without moving the row. */}
      <span className="pointer-events-none absolute right-0 top-full -mt-[0.6em] -translate-y-[0.25em] whitespace-nowrap text-[0.34em] font-bold leading-none text-[#c0281f]">{hint}</span>
    </span>
  );
}

function Body({ id }: { id: EnemyId }) {
  const t = useT();
  const element = ENEMY_ELEMENT[id];
  const weak = ELEMENTS.filter((e) => elementMultiplier(e, element, true) > 1);
  const resist = ELEMENTS.filter(
    (e) => elementMultiplier(e, element, true) < 1,
  );
  return (
    <>
      <div className="flex flex-col gap-[1.5%]">
        {MOVES[id].map((m) => (
          <div
            key={m.key}
            className="flex items-center gap-[3%] border-b border-stone-900/15 pb-[1%] last:border-0"
          >
            <span className="flex-1 text-[0.95em] font-black">{t(m.key)}</span>
            <MoveAmount value={m.amount} hint={t("v3.ui.stage2")} />
          </div>
        ))}
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
          BQ-{CARD_NO[id]}{" "}
          <b className={`font-black ${lookOf(id).mark}`}>{CARD_RARITY[id]}</b>
        </span>
      </div>
    </>
  );
}

export function EnemyCardFace({ id }: { id: EnemyId }) {
  const t = useT();
  const art = ART[id];
  const element = ENEMY_ELEMENT[id];
  const theme = THEME[element];

  if (art) {
    return (
      <>
        <CardFrame frame={theme.frame} rarity={CARD_RARITY[id]}>
          <div className="relative h-full overflow-hidden rounded-[0.6%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static card art */}
            <img
              src={asset(art.src)}
              alt={t(`v2.enemy.${id}.name`)}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
              style={frameFigure(art.figure)}
            />
            {lookOf(id).foil > 0 && <Foil element={element} strength={0.12} />}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 via-black/25 to-transparent px-[3%] pb-[8%] pt-[5%]">
              <Header id={id} light />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[1.5%] bg-gradient-to-b from-transparent via-amber-50/85 to-amber-50/95 px-[4%] pb-[3%] pt-[12%] text-stone-900">
              <Body id={id} />
            </div>
          </div>
        </CardFrame>
        <RarityMark
          rarity={CARD_RARITY[id]}
          element={ENEMY_ELEMENT[id]}
          className="left-[1.5%] top-[0.8%]"
        />
      </>
    );
  }

  return (
    <>
      <CardFrame frame={theme.frame} rarity={CARD_RARITY[id]}>
        <div
          className={`relative flex h-full flex-col gap-[2%] rounded-[0.6%] bg-gradient-to-b p-[3%] ${theme.panel}`}
        >
          <Header id={id} />
          <div
            className="relative flex-1 overflow-hidden rounded-[1%] border-[3px] border-yellow-100/80 shadow-inner"
            style={{ background: theme.art }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-[4.2em] drop-shadow-[0_6px_10px_rgb(0_0_0/0.5)]">
              {PORTRAIT[id]}
            </div>
            {lookOf(id).foil > 0 && <Foil element={element} strength={0.6} />}
          </div>
          <Body id={id} />
        </div>
      </CardFrame>
      <RarityMark
        rarity={CARD_RARITY[id]}
        element={ENEMY_ELEMENT[id]}
        className="left-[1.5%] top-[0.8%]"
      />
    </>
  );
}
