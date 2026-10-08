import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">Scripture Card Adventure</p>
        <h1 className="mt-2 text-5xl font-bold text-stone-100">Bible Quest</h1>
        <p className="mt-3 text-stone-400">Gameplay prototype · Stage 1: David vs Goliath</p>
      </div>

      <ol className="max-w-lg space-y-1 text-left text-sm text-stone-300">
        <li>
          <span className="text-purple-400">1. Fear</span> — Goliath&apos;s taunts weaken your team. Spend
          Courage or use Scripture to remove Fear.
        </li>
        <li>
          <span className="text-amber-300">2. Faith</span> — Build David&apos;s Faith with Samuel and Scripture.
        </li>
        <li>
          <span className="text-amber-400">3. Break Armor</span> — At 10 Faith, David&apos;s Sling Stone shatters
          Goliath&apos;s Armor.
        </li>
        <li>
          <span className="text-red-400">4. Defeat Goliath</span> — Survive his rage and bring him down.
        </li>
      </ol>

      <Link
        href="/battle"
        className="rounded-2xl bg-amber-500 px-8 py-4 text-lg font-bold text-stone-950 shadow-lg hover:bg-amber-400"
      >
        Start Battle
      </Link>
    </main>
  );
}
