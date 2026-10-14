"use client";

// The pack stage: the kinds of pack stand on a ring. Turn it (arrows, swipe, or tap a pack) and choose the one in front.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/game/locale";
import type { PackKind } from "@/game/v3/gacha";
import { PackArt } from "./PackArt";

const PACK_W = 150; // px
const GAP = 1.25; // how much room each pack gets on the ring, in pack widths

export function PackCarousel({ packs, onPick }: { packs: PackKind[]; onPick: (pack: PackKind) => void }) {
  const t = useT();
  const n = packs.length;
  const step = 360 / n;
  const radius = Math.round((PACK_W * GAP) / 2 / Math.tan(Math.PI / n));
  const [turn, setTurn] = useState(0); // in packs; the ring is turned by turn * step degrees
  const [drag, setDrag] = useState<number | null>(null); // extra turn while dragging, in packs
  const start = useRef<{ x: number; turn: number } | null>(null);
  const moved = useRef(false);

  const front = ((Math.round(turn) % n) + n) % n; // the pack facing the player
  const live = turn + (drag ?? 0);

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, turn };
    moved.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    if (Math.abs(dx) > 6) moved.current = true;
    setDrag(-dx / (PACK_W * 0.9)); // dragging left brings the next pack round
  };
  const onPointerUp = () => {
    if (!start.current) return;
    if (drag !== null) setTurn(Math.round(start.current.turn + drag));
    start.current = null;
    setDrag(null);
  };
  const go = (d: number) => setTurn(Math.round(turn) + d);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        className="relative h-[290px] w-full max-w-2xl touch-pan-y select-none overflow-hidden [perspective:1100px]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute left-1/2 top-1/2 [transform-style:preserve-3d]"
          style={{
            width: PACK_W,
            height: (PACK_W * 14) / 9,
            marginLeft: -PACK_W / 2,
            marginTop: -(PACK_W * 14) / 18,
            transform: `translateZ(${-radius}px) rotateY(${-live * step}deg)`,
            transition: drag === null ? "transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
          }}
        >
          {packs.map((pack, i) => {
            // How far this pack is from the front, in packs, wrapped to the shortest way round
            let off = (((i - live) % n) + n) % n;
            if (off > n / 2) off -= n;
            const away = Math.abs(off);
            return (
              <button
                key={pack.id}
                type="button"
                aria-label={t(`v3.pack.${pack.id}.name`)}
                onClick={() => {
                  if (moved.current) return;
                  if (i === front) onPick(pack);
                  else setTurn(Math.round(turn) + (((i - front + n + n / 2) % n) - n / 2));
                }}
                className="absolute inset-0 text-[10px] [backface-visibility:hidden]"
                style={{
                  transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
                  opacity: Math.max(0.25, 1 - away * 0.32),
                  filter: away > 0.6 ? `brightness(${Math.max(0.45, 1 - away * 0.25)})` : undefined,
                  transition: "opacity 450ms, filter 450ms",
                }}
              >
                <PackArt pack={pack} />
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => go(-1)} aria-label={t("v3.gacha.prev")} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
          <ChevronLeft size={24} aria-hidden />
        </button>
        <button type="button" onClick={() => go(1)} aria-label={t("v3.gacha.nextPack")} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
          <ChevronRight size={24} aria-hidden />
        </button>
      </div>
      <div className="text-center">
        <div className="text-lg font-black text-amber-200">{t(`v3.pack.${packs[front].id}.name`)}</div>
      </div>
      <button onClick={() => onPick(packs[front])} className="rounded-2xl bg-amber-500 px-8 py-3 text-lg font-bold text-stone-950 shadow-lg hover:bg-amber-400">
        {t("v3.gacha.pick")}
      </button>
    </div>
  );
}
