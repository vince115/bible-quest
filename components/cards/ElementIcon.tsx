"use client";

// An element's icon. Most are emoji; dark is a white crescent inside a purple-black disc (the 🌙 emoji is a bright
// yellow moon and doesn't read as darkness).
import type { Element } from "@/game/v2/types";
import { useId } from "react";
import { ELEMENT_ICON } from "./CharacterCardFace";

function DarkCrescent() {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-label="dark" viewBox="0 0 24 24" className="inline-block h-[1em] w-[1em] align-[-0.12em]">
      <defs>
        <radialGradient id={`night-${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#4c1d95" />
          <stop offset="0.6" stopColor="#2e1065" />
          <stop offset="1" stopColor="#0c0418" />
        </radialGradient>
      </defs>
      {/* Purple-black disc */}
      <circle cx="12" cy="12" r="11.5" fill={`url(#night-${id})`} />
      {/* White crescent, inset a little from the disc's edge: a smaller disc with an offset disc cut away */}
      <mask id={`cut-${id}`}>
        <circle cx="12" cy="12" r="9" fill="white" />
        <circle cx="14.6" cy="9.8" r="7.2" fill="black" />
      </mask>
      <circle cx="12" cy="12" r="9" fill="#ffffff" mask={`url(#cut-${id})`} />
      {/* A fine, soft rim so the icon still reads on light backgrounds */}
      <circle cx="12" cy="12" r="11.3" fill="none" stroke="#3b0764" strokeOpacity="0.3" strokeWidth="0.5" />
    </svg>
  );
}

export function ElementIcon({ element }: { element: Element }) {
  return element === "dark" ? <DarkCrescent /> : <>{ELEMENT_ICON[element]}</>;
}
