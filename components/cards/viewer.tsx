"use client";

// The enlarged card view shared by /card-demo and the battle: its size, and the character story beside the card.
import { motion } from "framer-motion";
import type { CharacterId, EnemyId } from "@/game/v2/types";
import { safeStorage, useT } from "@/game/locale";

/**
 * Viewer size as a share of a real Pokémon card (63 × 88 mm). CSS millimetres run small on the designer's 24-inch
 * screen: a real card measured 115% of 63mm, so that is 100% here. Adjustable in /card-demo and remembered.
 */
export const REAL_SIZE = "calc(63mm * 1.15)";
export const SCALE_KEY = "bq-card-demo-real";
/** Whether the viewer shows the character story beside the card: on in /card-demo, off in battle, until switched. */
export const STORY_KEY = "bq-card-demo-story";
export const BATTLE_STORY_KEY = "bq-battle-story";
export const SCALE_DEFAULT = 1.75;
export const SCALE_STEP = 0.1;

/** The saved viewer scale (client only; the viewer never renders on the server). */
export const savedScale = () => (typeof window === "undefined" ? 1 : Number(safeStorage.getItem(SCALE_KEY)) || SCALE_DEFAULT);
export const savedShowStory = (key = STORY_KEY, byDefault = true) => {
  if (typeof window === "undefined") return byDefault;
  const saved = safeStorage.getItem(key);
  return saved === null ? byDefault : saved !== "off";
};

/** Card width in the viewer: the saved size, capped to the screen; on wide screens it leaves room for the side panel. */
export const VIEWER_WIDTH =
  "[--w:min(calc(var(--real)*var(--cal)),92vw,calc((100dvh-7rem)*63/88))] lg:[--w:min(calc(var(--real)*var(--cal)),calc(100vw-32rem),calc((100dvh-7rem)*63/88))]";
export const viewerStyle = (scale: number) =>
  ({ "--real": REAL_SIZE, "--cal": scale, width: "var(--w)", fontSize: "calc(var(--w) * 0.0467)" }) as React.CSSProperties;

/** The gold frame around a side panel: a 9-slice of public/ui-frame-gold.png, whose dark ground is transparent. */
export function GoldFrame() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ borderStyle: "solid", borderWidth: 34, borderImage: "url(/ui-frame-gold.png) 48 / 34px stretch" }}
    />
  );
}

/** The character's story beside the card (nothing when the card has no story yet). */
export function StoryPanel({ id, enemy }: { id: CharacterId | EnemyId; enemy?: boolean }) {
  const t = useT();
  const key = `v3.bio.${id}`;
  const story = t(key);
  if (story === key) return null;
  return (
    <motion.aside
      key={id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      onClick={(e) => e.stopPropagation()}
      className="relative w-full max-w-md px-[42px] py-[38px] text-stone-100 lg:w-80 lg:self-center"
    >
      <GoldFrame />
      <p className="text-xs font-bold tracking-widest text-amber-300/80">{t("v3.demo.story")}</p>
      {/* Same order as the card: title above, name below. */}
      <p className="mt-1 text-sm text-stone-400">{t(`v3.card.${id}.title`)}</p>
      <h2 className="text-xl font-black">{t(enemy ? `v2.enemy.${id}.name` : `char.${id}.name`)}</h2>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-stone-200">{story}</p>
      <p className="mt-3 text-xs text-amber-200/80">— {t(`v3.card.${id}.ref`)}</p>
    </motion.aside>
  );
}
