"use client";

import { useEffect, useState } from "react";
import { useAudioStore } from "@/game/audio";
import { useT } from "@/game/locale";

export function AudioToggle() {
  const muted = useAudioStore((s) => s.muted);
  const toggleMuted = useAudioStore((s) => s.toggleMuted);
  const t = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Rehydrate the saved setting, then switch from the default to the stored value (after the first paint).
    void Promise.resolve(useAudioStore.persist.rehydrate()).then(() => setMounted(true));
  }, []);

  // Before rehydrating, render with default to prevent hydration mismatch
  const isMuted = mounted ? muted : false;

  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={isMuted ? t("ui.soundOff") : t("ui.soundOn")}
      title={isMuted ? t("ui.soundOff") : t("ui.soundOn")}
      className={`fixed top-2.5 right-24 sm:top-auto sm:bottom-3 sm:right-28 z-40 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-stone-600 bg-stone-900/90 text-xs sm:text-sm shadow-lg backdrop-blur-sm transition active:scale-95 hover:bg-stone-800 ${
        isMuted ? "opacity-70 hover:opacity-100" : "text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.25)]"
      }`}
    >
      <span className="select-none" aria-hidden="true">
        {isMuted ? "🔇" : "🎵"}
      </span>
    </button>
  );
}
