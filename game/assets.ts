/**
 * Where the big media (card art, stage art, music) is served from.
 * NEXT_PUBLIC_ASSET_BASE (e.g. the Cloudflare R2 public URL) moves /cards, /stages and /audio there; unset, they come from /public.
 * The bucket mirrors the public folder: <base>/cards/adam.jpg, <base>/stages/eden.jpg, <base>/audio/bgm/eden.mp3.
 * Card frames, textures, element and energy icons are small UI chrome and always come from /public.
 */
const BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "").replace(/\/$/, "");
const LOCAL_ONLY = /^\/cards\/(frame-|scripture-(frame|gilt-frame|leather))/;
const MOVED = /^\/(cards|stages|audio)\//;

/** The URL of a media file given its path under /public (e.g. "/cards/adam.jpg"). */
export function asset(path: string): string {
  if (!BASE || !MOVED.test(path) || LOCAL_ONLY.test(path)) return path;
  return `${BASE}${path}`;
}
