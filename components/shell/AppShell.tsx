"use client";

// The site around every page that is not a battle: a top bar (menu button, where you are, blessing points, sound and
// language) and a left menu: a narrow icon rail that opens to labels on a desktop, a drawer that slides in on a phone.
// Styling is kept plain and in this file, so the look can be redone without touching what the pages do.
import { BookOpen, Gift, Home, LayoutGrid, Library, Menu, PanelLeftClose, PanelLeftOpen, Swords, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AudioToggle } from "@/components/AudioToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { safeStorage, useT } from "@/game/locale";
import { useProgressStore } from "@/game/v3/progress";
import { PageBackground } from "./PageBackground";

const COLLAPSED_KEY = "bq-nav-collapsed";

/**
 * The scene picture behind a page with a theme (none has one yet: the lists, the collection and the gacha are not about
 * one place); give a page one with an entry like `"/gacha": "/stages/eden.jpg"`. Battle pages draw their own backdrop
 * with their stage's scene.
 */
const PAGE_ART: Record<string, string> = {};

/**
 * The picture the pointer's glow uncovers on a page without a theme: not a scene, only light and texture. Three were
 * drawn (night, light, glass in /public/backgrounds); swap the name to change it.
 */
const DEFAULT_ART = "/backgrounds/night.jpg";

interface Item {
  href: string;
  label: string;
  icon: typeof Home;
  /** The page counts as this item when its path starts with `match` (the home page only when it is exactly "/"). */
  match: string;
}

const ITEMS: Item[] = [
  { href: "/", label: "nav.home", icon: Home, match: "/" },
  { href: "/campaign", label: "nav.campaign", icon: BookOpen, match: "/campaign" },
  { href: "/collection", label: "nav.collection", icon: Library, match: "/collection" },
  { href: "/gacha", label: "nav.gacha", icon: Gift, match: "/gacha" },
  { href: "/battle-v3", label: "nav.free", icon: Swords, match: "/battle-v3" },
  { href: "/card-demo", label: "nav.cards", icon: LayoutGrid, match: "/card-demo" },
];

const isActive = (item: Item, path: string) => (item.match === "/" ? path === "/" : path === item.match || path.startsWith(`${item.match}/`));

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const path = usePathname();
  const points = useProgressStore((s) => s.points);
  const [ready, setReady] = useState(false); // saved settings are read after mount, so the prerendered page matches
  const [collapsed, setCollapsed] = useState(true); // desktop rail: icons only until opened
  const [open, setOpen] = useState(false); // phone drawer
  const [prevPath, setPrevPath] = useState(path);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of the saved menu state
    setCollapsed(safeStorage.getItem(COLLAPSED_KEY) !== "open");
    void Promise.resolve(useProgressStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  // The drawer closes when you go to another page.
  if (path !== prevPath) {
    setPrevPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      safeStorage.setItem(COLLAPSED_KEY, c ? "open" : "closed");
      return !c;
    });
  const here = ITEMS.find((i) => isActive(i, path));

  const menu = (wide: boolean) => (
    <nav aria-label={t("nav.menu")} className="flex flex-col gap-1 p-2">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item, path);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={t(item.label)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[#d4b35f] text-[#2b1d07]" : "text-stone-300 hover:bg-[#d4b35f]/15"}`}
          >
            <Icon size={20} aria-hidden className="shrink-0" />
            {wide && <span className="truncate">{t(item.label)}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div
      onPointerMove={(e) => {
        // The backdrop is fixed to the screen, so the pointer is tracked in screen coordinates.
        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX}px`);
        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY}px`);
      }}
      className="relative flex min-h-[100dvh] flex-1 flex-col"
    >
      <PageBackground art={PAGE_ART[path] ?? DEFAULT_ART} />
      <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b border-stone-800 bg-stone-950/80 px-3 backdrop-blur">
        <button
          onClick={() => setOpen(true)}
          aria-label={t("nav.open")}
          className="rounded-lg p-2 text-stone-200 hover:bg-white/10 lg:hidden"
        >
          <Menu size={22} aria-hidden />
        </button>
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          className="hidden rounded-lg p-2 text-stone-200 hover:bg-white/10 lg:block"
        >
          {collapsed ? <PanelLeftOpen size={22} aria-hidden /> : <PanelLeftClose size={22} aria-hidden />}
        </button>
        <Link href="/" className="text-sm font-black tracking-wide text-amber-300">
          Bible Quest
        </Link>
        {here && here.href !== "/" && <span className="hidden truncate text-sm text-stone-400 sm:block">/ {t(here.label)}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Link href="/gacha" title={t("v3.gacha.points")} className="flex items-baseline gap-1.5 rounded-full bg-[#d4b35f]/15 px-3 py-1 transition hover:bg-[#d4b35f]/25">
            <span className="hidden text-xs text-stone-400 sm:inline">{t("v3.gacha.points")}</span>
            <span className="text-sm font-black tabular-nums text-[#f2d27a]">{ready ? points : "–"}</span>
          </Link>
          <AudioToggle inline />
          <LanguageToggle inline />
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className={`sticky top-12 z-30 hidden h-[calc(100dvh-3rem)] shrink-0 overflow-y-auto border-r border-stone-800 bg-stone-950/70 backdrop-blur transition-[width] lg:block ${collapsed ? "w-16" : "w-56"}`}>
          {menu(!collapsed)}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
          <button aria-label={t("nav.close")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[85vw] overflow-y-auto border-r border-stone-700 bg-stone-950 shadow-2xl">
            <div className="flex h-12 items-center justify-between border-b border-stone-800 px-3">
              <span className="text-sm font-black tracking-wide text-amber-300">Bible Quest</span>
              <button onClick={() => setOpen(false)} aria-label={t("nav.close")} className="rounded-lg p-2 text-stone-200 hover:bg-white/10">
                <X size={22} aria-hidden />
              </button>
            </div>
            {menu(true)}
          </div>
        </div>
      )}
    </div>
  );
}
