"use client";

// The backdrop behind every page, the same layers as the battle screens: a scene picture (only when the page has a
// theme), a dark veil, a red-to-blue tint, fine black dots that open into light around the pointer, and a faint glow.
// The pointer position comes from --mouse-x / --mouse-y set on an ancestor (see AppShell).
import { asset } from "@/game/assets";

export function PageBackground({ art }: { art?: string }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-stone-950">
      {art && (
        <div className="absolute inset-0 bq-reveal-spotlight">
          {/* eslint-disable-next-line @next/next/no-img-element -- scene art is a plain file */}
          <img src={asset(art)} alt="" className="h-full w-full scale-110 object-cover brightness-105" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bq-red-blue-mask" />
      <div className="absolute inset-0 bq-black-dots-dense" />
      <div className="absolute inset-0 bq-glowing-dots-dense" />
    </div>
  );
}
