import type { EnergyKind } from "@/game/v2/types";

export const ENERGY_ICON_SRC: Record<EnergyKind, string> = {
  faith: "/icons/energy/faith.png",
  attack: "/icons/energy/attack.png",
  guard: "/icons/energy/guard.png",
};

export function EnergyIcon({
  kind,
  className = "inline-block h-[1em] w-[1em] object-contain align-middle",
}: {
  kind: EnergyKind;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ENERGY_ICON_SRC[kind]}
      alt={kind}
      draggable={false}
      aria-hidden
      className={`select-none ${className}`}
    />
  );
}
