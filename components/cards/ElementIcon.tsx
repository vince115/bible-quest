"use client";

// An element's icon: painted artwork in public/elements, cut out of the designer's icon sheet.
import type { Element } from "@/game/v2/types";
import { useT } from "@/game/locale";

export function ElementIcon({ element }: { element: Element }) {
  const t = useT();
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny inline icon sized in em, next/image adds nothing here
    <img
      src={`/elements/${element}.webp`}
      alt={t(`v2.element.${element}`)}
      draggable={false}
      className="inline-block h-[1.15em] w-[1.15em] align-[-0.2em] drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]"
    />
  );
}
