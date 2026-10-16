"use client";

// Tearing a pack open: drag across the top of the pack and the strip tears away, following the finger.
import { Scissors } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/game/locale";
import { playSfx } from "@/game/sfx";
import type { PackKind } from "@/game/v3/gacha";
import { PackArt } from "./PackArt";

const STRIP = 13; // the torn-off top strip (the pack's top foil seal), percent of its height
const NEEDED = 0.85; // how much of the width has to be torn to open it

export function PackTear({ pack, onTorn }: { pack: PackKind; onTorn: () => void }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0..1 across the pack
  const [done, setDone] = useState(false);
  const active = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [fromRight, setFromRight] = useState(false); // which end the tear began from
  const side = useRef<"left" | "right">("left");

  const finish = () => {
    if (done) return;
    setDone(true);
    setProgress(1);
    playSfx("tear");
    window.setTimeout(onTorn, 650);
  };
  const toward = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const onDown = (e: React.PointerEvent) => {
    if (done) return;
    // Only a grab on the sealed top edge starts a tear, from whichever end is nearer.
    const r = box.current!.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    if (y > STRIP / 100 + 0.12) return;
    active.current = true;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    side.current = toward(e.clientX) < 0.5 ? "left" : "right";
    setFromRight(side.current === "right");
    setProgress(0);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!active.current || done) return;
    // How far across from the end the tear began, following the pointer back and forth.
    const x = toward(e.clientX);
    const p = side.current === "left" ? x : 1 - x;
    setProgress(p);
    if (p >= 0.97) {
      active.current = false;
      setDragging(false);
      finish();
    }
  };
  const onUp = () => {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    if (progress >= NEEDED) finish();
    else setProgress(0);
  };
  const shown = done ? 1 : progress;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div
        ref={box}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative w-[220px] touch-none select-none text-[14px]"
        style={{ animation: done ? undefined : "bq-pop 400ms ease-out" }}
      >
        {/* The body of the pack, below the tear line */}
        <div style={{ clipPath: `inset(${STRIP}% 0 0 0)` }}>
          <PackArt pack={pack} />
        </div>
        {/* The strip: it lifts and curls up as the tear goes across */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 0 ${100 - STRIP}% 0)`,
            transformOrigin: fromRight ? "0% 100%" : "100% 100%",
            transform: done ? undefined : `rotate(${(fromRight ? 1 : -1) * shown * 16}deg) translateY(${-shown * 6}px)`,
            animation: done ? "bq-strip-off 600ms ease-in forwards" : undefined,
            transition: dragging ? "none" : "transform 200ms",
          }}
        >
          <PackArt pack={pack} />
        </div>
        {/* The tear line, with a flash of light along the part already torn */}
        <div aria-hidden className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-white/70" style={{ top: `${STRIP}%` }} />
        <div aria-hidden className="pointer-events-none absolute h-[3px] bg-white shadow-[0_0_10px_3px_rgb(255_255_255/0.8)]" style={{ top: `${STRIP}%`, width: `${shown * 100}%`, ...(fromRight ? { right: 0 } : { left: 0 }) }} />
        {!done && (
          <Scissors aria-hidden size={22} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" style={{ left: `${(fromRight ? 1 - shown : shown) * 100}%`, top: `${STRIP}%` }} />
        )}
        {done && <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 blur-xl" style={{ animation: "bq-burst 650ms ease-out forwards" }} />}
      </div>
      {!done && (
        <>
          <p className="text-sm text-stone-300">{t("v3.gacha.tear")}</p>
          <button onClick={finish} className="rounded-full border border-stone-500 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10">
            {t("v3.gacha.tearButton")}
          </button>
        </>
      )}
    </div>
  );
}
