"use client";

// The panel shown when a battle ends (or a round of a two-round stage): dressed like the campaign list, with the
// ornate gold frame, the stage's picture fading into a dark ground, a gold title and pill buttons.
import type { ReactNode } from "react";
import { OrnateFrame } from "@/components/cards/viewer";
import { asset } from "@/game/assets";
import { button } from "@/components/ui/buttons";

const GOLD = "#f4c850";

/** A button of the panel: the main one is filled gold, the others are dark pills with a gold ring. */
export const resultButton = (primary: boolean) => button(primary ? "primary" : "secondary");

/** A section of the panel with no box of its own (the panel is already framed): a small gold title between two hairlines. */
export function ResultNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-5 flex flex-col items-center gap-2">
      <div className="flex w-full items-center gap-3">
        <span className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${GOLD}aa)` }} />
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300/90">{label}</span>
        <span className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${GOLD}aa)` }} />
      </div>
      {children}
    </section>
  );
}

export function ResultPanel({
  won,
  title,
  eyebrow,
  hint,
  facts,
  art,
  artFocus,
  sections = false,
  children,
  actions,
}: {
  /** A win (or a round won) is gold; a defeat is ash and dark red. */
  won: boolean;
  title: string;
  /** The stage's name, small above the title. */
  eyebrow?: string;
  hint?: string;
  /** Short facts in pills: the turns it took, a solo run. */
  facts: string[];
  /** The stage's picture, faded into the ground. */
  art?: string;
  /** Which part of the art shows (CSS object-position), as in the stage list. */
  artFocus?: string;
  /** Whether `children` holds sections (the dropped card, achievements), each with its own title line. */
  sections?: boolean;
  children?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative isolate m-auto w-full max-w-md px-[34px] py-[38px] text-center">
        {/* The ground inside the frame's line: the picture at the top melts into the dark */}
        <div aria-hidden className="absolute inset-[1px] -z-10 overflow-hidden rounded-[26px] bg-[#0b0810]">
          {art && (
            <div className="absolute inset-x-0 top-0 h-[60%]" style={{ WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 35%, transparent 100%)", maskImage: "linear-gradient(to bottom, #000 0%, #000 35%, transparent 100%)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- stage art is a plain file in /public */}
              <img src={asset(art)} alt="" className={`h-full w-full object-cover ${won ? "opacity-55" : "opacity-35 grayscale"}`} style={{ objectPosition: artFocus }} />
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{
              background: won
                ? "radial-gradient(ellipse at 50% 0%, rgb(244 200 80 / 0.28), transparent 60%), linear-gradient(to bottom, rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.72) 45%, rgb(0 0 0 / 0.86))"
                : "radial-gradient(ellipse at 50% 0%, rgb(140 30 30 / 0.28), transparent 60%), linear-gradient(to bottom, rgb(0 0 0 / 0.35), rgb(0 0 0 / 0.78) 45%, rgb(0 0 0 / 0.9))",
            }}
          />
        </div>
        <OrnateFrame size={22} />
        {/* The facts (the turns it took, a solo run) sit small in the top right corner, inside the frame */}
        {facts.length > 0 && (
          <div className="absolute right-[34px] top-[30px] flex flex-col items-end gap-1">
            {facts.map((f) => (
              <span key={f} className="text-xs font-semibold tracking-wide text-amber-100/90 [text-shadow:0_1px_4px_rgb(0_0_0/0.9)]">
                {f}
              </span>
            ))}
          </div>
        )}

        {eyebrow && <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300/80">{eyebrow}</div>}
        <h2
          className={`mt-3 text-5xl font-black tracking-[0.12em] drop-shadow-[0_2px_10px_rgb(0_0_0/0.8)] ${
            won ? "bg-gradient-to-b from-[#fffbe6] via-[#f4c850] to-[#b9821f] bg-clip-text text-transparent" : "text-red-200/90"
          }`}
        >
          {title}
        </h2>
        {/* A small ornament under the title, unless a section follows: that has its own line, and the two would pile up */}
        {!sections && (
          <div aria-hidden className="mx-auto mt-3 flex w-3/4 items-center gap-3 opacity-90">
            <span className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${won ? GOLD : "#a8584f"})` }} />
            <span style={{ color: won ? GOLD : "#a8584f" }}>✦</span>
            <span className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${won ? GOLD : "#a8584f"})` }} />
          </div>
        )}
        {hint && <p className="mt-3 text-sm leading-relaxed text-amber-100/90">{hint}</p>}
        {children}
        <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
