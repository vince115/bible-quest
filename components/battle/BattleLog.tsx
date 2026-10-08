"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/game/types";
import { useT } from "@/game/locale";

const TONE: Record<LogEntry["kind"], string> = {
  player: "text-amber-200",
  ally: "text-emerald-300",
  enemy: "text-red-300",
  system: "text-stone-400 italic",
};

export function BattleLog({ log }: { log: LogEntry[] }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [log.length]);

  return (
    <section className="flex h-full min-h-48 flex-col rounded-2xl border border-stone-700 bg-stone-900/80 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400">{t("ui.battleLog")}</h3>
      <div ref={ref} className="flex-1 space-y-1 overflow-y-auto pr-1 text-xs lg:max-h-[calc(100vh-10rem)]">
        {log.map((l) => (
          <div key={l.id} className={TONE[l.kind]}>
            {t(l.key, l.params)}
          </div>
        ))}
      </div>
    </section>
  );
}
