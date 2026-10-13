"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./locale";

interface AudioStore {
  muted: boolean;
  volume: number;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setVolume: (volume: number) => void;
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      muted: false,
      volume: 0.45,
      setMuted: (muted) => set({ muted }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: "bible-quest-audio",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
    },
  ),
);

// --- Background Music Manager ---
let activeAudio: HTMLAudioElement | null = null;
let currentSrc: string | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let isBattleContext = false;
let unlockListenersAttached = false;

function clearFade() {
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

function fadeVolume(audio: HTMLAudioElement, target: number, durationMs = 1000, onComplete?: () => void) {
  clearFade();
  const start = audio.volume;
  const delta = target - start;
  if (Math.abs(delta) < 0.02) {
    audio.volume = target;
    onComplete?.();
    return;
  }
  const steps = 20;
  const intervalMs = Math.max(16, durationMs / steps);
  let step = 0;
  fadeTimer = setInterval(() => {
    step++;
    const progress = Math.min(1, step / steps);
    audio.volume = Math.max(0, Math.min(1, start + delta * progress));
    if (step >= steps) {
      clearFade();
      audio.volume = target;
      onComplete?.();
    }
  }, intervalMs);
}

function getAudioElement(src: string): HTMLAudioElement {
  if (!activeAudio) {
    activeAudio = new Audio(src);
    activeAudio.loop = true;
    activeAudio.preload = "auto";
    currentSrc = src;
  } else if (currentSrc !== src) {
    activeAudio.src = src;
    currentSrc = src;
  }
  return activeAudio;
}

/** Attach one-time global user gesture listener if browser blocks autoplay. */
function attachUnlockGesture(audio: HTMLAudioElement, targetVolume: number) {
  if (unlockListenersAttached) return;
  unlockListenersAttached = true;

  const unlock = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
    unlockListenersAttached = false;

    if (!isBattleContext) return;
    const { muted } = useAudioStore.getState();
    if (muted) return;

    if (audio.paused) {
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          fadeVolume(audio, targetVolume, 1200);
        })
        .catch(() => {});
    }
  };

  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
}

export function playBattleBgm(src = "/audio/bgm/battle.mp3") {
  if (typeof window === "undefined") return;
  isBattleContext = true;
  const { muted, volume } = useAudioStore.getState();
  const srcChanged = currentSrc !== src;
  const audio = getAudioElement(src);

  if (muted) {
    audio.pause();
    return;
  }

  if (audio.paused || srcChanged) {
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        fadeVolume(audio, volume, 1200);
      })
      .catch(() => {
        // Autoplay blocked by browser policy: wait for first tap/click
        attachUnlockGesture(audio, volume);
      });
  } else {
    fadeVolume(audio, volume, 500);
  }
}

export function stopBattleBgm(fadeMs = 800) {
  if (typeof window === "undefined" || !activeAudio) return;
  isBattleContext = false;
  const audio = activeAudio;
  fadeVolume(audio, 0, fadeMs, () => {
    if (!isBattleContext) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
}

// Global window event listeners (visibility change & store subscription)
if (typeof window !== "undefined") {
  // Pause BGM if tab is hidden / minimized; resume when user returns
  document.addEventListener("visibilitychange", () => {
    if (!activeAudio || !isBattleContext) return;
    const { muted, volume } = useAudioStore.getState();
    if (document.hidden) {
      if (!activeAudio.paused) {
        activeAudio.pause();
      }
    } else {
      if (!muted && activeAudio.paused) {
        activeAudio.volume = 0;
        activeAudio
          .play()
          .then(() => fadeVolume(activeAudio!, volume, 800))
          .catch(() => {});
      }
    }
  });

  // Sync when user toggles mute or changes volume in store
  useAudioStore.subscribe((state, prev) => {
    if (!activeAudio) return;

    if (state.muted !== prev.muted) {
      if (state.muted) {
        fadeVolume(activeAudio, 0, 400, () => {
          activeAudio?.pause();
        });
      } else if (isBattleContext) {
        activeAudio.volume = 0;
        activeAudio
          .play()
          .then(() => fadeVolume(activeAudio!, state.volume, 800))
          .catch(() => {
            attachUnlockGesture(activeAudio!, state.volume);
          });
      }
    } else if (state.volume !== prev.volume && !state.muted && !activeAudio.paused) {
      fadeVolume(activeAudio, state.volume, 200);
    }
  });
}
