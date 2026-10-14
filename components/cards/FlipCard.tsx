"use client";

// A card that turns over on the spot: its front (as it is laid out), and the card back on the other side.
import type { ReactNode } from "react";
import { HoloCard } from "./HoloCard";
import { ScriptureCardBack } from "./ScriptureCardFace";

/** `effects` is the same switch the front has (the light and foil effects); the back gets them too. */
export function FlipCard({ flipped, effects = true, children }: { flipped: boolean; effects?: boolean; children: ReactNode }) {
  return (
    <div className="relative [perspective:1400px]">
      <div className="relative transition-transform duration-700 [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : "none" }}>
        <div className="[backface-visibility:hidden]">{children}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <HoloCard element="light" effects={effects} rarity="N" className="w-full">
            <ScriptureCardBack />
          </HoloCard>
        </div>
      </div>
    </div>
  );
}
