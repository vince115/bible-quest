"use client";

// The arrival of a GR (God Rate) card: the room goes dark, a beam of light falls, and the card rises into it with its
// name. It is used when a GR card is first obtained (and to preview it in the card demo). Click anywhere to close.
import { motion } from "framer-motion";
import { useEffect } from "react";
import type { CharacterId } from "@/game/v2/types";
import { CHARACTER_ELEMENT } from "@/game/v2/data";
import { useT } from "@/game/locale";
import { playSfx } from "@/game/sfx";
import { CharacterCardFace, figureArea } from "./CharacterCardFace";
import { HoloCard } from "./HoloCard";

export function GrCeremony({ id, onClose }: { id: CharacterId; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    playSfx("divine");
    const close = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center gap-5 bg-black/92 p-4"
    >
      {/* The beam falls from the top of the screen and widens as it lands */}
      <motion.div
        aria-hidden
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "100%", opacity: 1 }}
        transition={{ duration: 1.4, ease: "easeIn", delay: 0.3 }}
        className="pointer-events-none absolute left-1/2 top-0 w-[46vmin] -translate-x-1/2"
        style={{ background: "linear-gradient(to bottom, rgb(255 246 210 / 0.9), rgb(255 230 150 / 0.25) 60%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 30%, #000 70%, transparent)", maskImage: "linear-gradient(to right, transparent, #000 30%, #000 70%, transparent)" }}
      />
      <motion.div
        initial={{ y: 120, scale: 0.55, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ delay: 1.5, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-[min(62vw,calc((100dvh-14rem)*63/88),22rem)] text-[length:calc(min(62vw,calc((100dvh-14rem)*63/88),22rem)*0.0467)]"
      >
        <HoloCard element={CHARACTER_ELEMENT[id]} rarity="GR" figure={figureArea(id)} className="w-full">
          <CharacterCardFace id={id} />
        </HoloCard>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3, duration: 1 }} className="relative z-10 text-center">
        <div className="text-xs font-bold tracking-[0.5em] text-amber-200/80">GOD RATE</div>
        <div className="mt-1 text-3xl font-black text-[#fff4c4] [text-shadow:0_0_18px_rgb(255_220_120/0.8)]">{t(`char.${id}.name`)}</div>
      </motion.div>
    </motion.div>
  );
}
