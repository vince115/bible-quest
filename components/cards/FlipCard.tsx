"use client";

// A card that turns over on the spot: its front (as it is laid out), and the card back on the other side.
import type { ReactNode } from "react";
import { ScriptureCardBack } from "./ScriptureCardFace";

export function FlipCard({ flipped, children }: { flipped: boolean; children: ReactNode }) {
  return (
    <div className="relative [perspective:1400px]">
      <div className="relative transition-transform duration-700 [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : "none" }}>
        <div className="[backface-visibility:hidden]">{children}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <ScriptureCardBack />
        </div>
      </div>
    </div>
  );
}
