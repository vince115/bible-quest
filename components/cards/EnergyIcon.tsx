import type { ReactNode } from "react";
import type { EnergyKind } from "@/game/v2/types";

export const ENERGY_ICON_SRC: Record<EnergyKind, string> = {
  faith: "/icons/energy/faith.png",
  attack: "/icons/energy/attack.png",
  guard: "/icons/energy/guard.png",
};

/**
 * The round marks used for each kind of energy: glossy circles in the same red, green and blue as the circle emoji on
 * the scripture cards' badges. They are drawn (not text) so they scale exactly with the card, however small it is.
 */
export const ENERGY_DISC: Record<EnergyKind, string> = {
  attack: "radial-gradient(circle at 34% 28%, #ff8c82 0%, #e5362d 45%, #a31d17 100%)",
  faith: "radial-gradient(circle at 34% 28%, #8fc0ff 0%, #3a7fe6 45%, #1d4fb0 100%)",
  guard: "radial-gradient(circle at 34% 28%, #94e08f 0%, #3bb04f 45%, #1f7a35 100%)",
};

export function EnergyIcon({
  kind,
  className = "inline-block h-[1em] w-[1em] object-contain align-middle",
  circle = false,
  tone,
}: {
  kind: EnergyKind;
  className?: string;
  /** Put the icon on a round background in the colour of the energy that pays for it, at 80% opacity. */
  circle?: boolean;
  /** The colour of the circle when it differs from the icon's kind. */
  tone?: EnergyKind;
}) {
  const icon = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ENERGY_ICON_SRC[kind]}
      alt={kind}
      draggable={false}
      aria-hidden
      className={`select-none ${circle ? "relative h-[62%] w-[62%] object-contain drop-shadow" : className}`}
    />
  );
  if (!circle) return icon;
  const size = className.match(/h-\[[^\]]+\]/)?.[0] ?? "h-[1.4em]";
  const width = className.match(/w-\[[^\]]+\]/)?.[0] ?? "w-[1.4em]";
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${size} ${width}`}>
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full opacity-80 shadow-[inset_0_-0.08em_0.12em_rgb(0_0_0/0.25)] ring-1 ring-black/50" style={{ background: ENERGY_DISC[tone ?? kind] }} />
      {icon}
    </span>
  );
}

/** A round mark in an energy's colour with the same semi-transparent black edge as the HP bar; the value goes inside it, in white with a 50% black outline. */
export function EnergyDisc({ kind, className = "h-4 w-4", children }: { kind: EnergyKind; className?: string; children?: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black leading-none text-white ring-[1.5px] ring-black/50 [-webkit-text-stroke:2.5px_rgb(0_0_0/0.5)] [paint-order:stroke_fill] ${className}`}
      style={{ background: ENERGY_DISC[kind] }}
    >
      {children}
    </span>
  );
}
