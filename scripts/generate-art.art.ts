// Draft card art from an image API. Nothing here runs by itself and nothing goes into the game directly: pictures are
// written to art-drafts/<id>.png (git-ignored) for you to look at; move the good ones to public/cards/<id>.jpg.
//
//   pnpm art                          prompts for every character card that has no picture yet; prints them (a dry run)
//   ART_IDS=moses,ruth pnpm art       only these cards (character or enemy ids)
//   ART_CALL=1 pnpm art               really call the API (needs a key, see below); a dry run is the default
//   ART_FORCE=1 ART_CALL=1 pnpm art   draw again even if art-drafts/<id>.png exists
//
// Keys live in .env.local (never committed, never shipped to the browser):
//   OPENAI_API_KEY=...   ART_PROVIDER=openai (default)   OPENAI_IMAGE_MODEL=gpt-image-1
//   GEMINI_API_KEY=...   ART_PROVIDER=gemini             GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
//   LEONARDO_API_KEY=... ART_PROVIDER=leonardo          LEONARDO_MODEL_ID=<the id of the model you draw with on leonardo.ai>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { CHARACTER_ELEMENT, ENEMY_ELEMENT } from "@/game/v2/data";
import { translate } from "@/game/i18n";
import { COLLECTIBLE } from "@/game/v3/gacha";

// .env.local is not read by vitest for plain variables, so read it here.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const provider = (process.env.ART_PROVIDER ?? "openai") as "openai" | "gemini" | "leonardo";
const call = process.env.ART_CALL === "1";
const force = process.env.ART_FORCE === "1";
const DRAFTS = "art-drafts";

/**
 * The look every card shares, matched to the art we already have (moses, ruth, david…): soft watercolour-and-gouache
 * storybook realism, a full-length figure standing in the middle in three-quarter view and looking off to one side,
 * in the real landscape of their story with a few small figures far behind, warm golden light, rough-spun earth-tone
 * clothing with one muted accent colour, and one object that says who they are. The card layout crops the picture
 * around the figure (head in the upper third, feet near the bottom), so the figure stays centred and fully in frame.
 */
const STYLE =
  "Soft watercolour and gouache storybook illustration with a realistic, painterly look and visible paper texture. " +
  "A full-length figure stands in the middle of a square picture, in three-quarter view, gently looking off to one side, " +
  "head in the upper third and feet near the bottom, nothing cut off. Behind them the real landscape of their story " +
  "under a bright sky with soft clouds, a few tiny figures far in the distance. Warm golden light, gentle natural colours: " +
  "earth-tone, rough-spun, historically plausible clothing with one muted blue or green accent, and one simple object in " +
  "hand that tells who they are. Calm, dignified expression. No text, no letters, no captions, no frame, no border.";

const en = (key: string) => translate("en", key);
const known = (key: string) => en(key) !== key;
/** The first couple of sentences of a longer text. */
const gist = (text: string) => text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");

/** The prompt for a card: the shared style, then who it is and the scene to paint. */
function promptFor(id: string): string {
  const isEnemy = id in ENEMY_ELEMENT && !(id in CHARACTER_ELEMENT);
  const name = isEnemy ? en(`v2.enemy.${id}.name`) : en(`char.${id}.name`);
  const title = en(`v3.card.${id}.title`);
  const ref = known(`v3.card.${id}.ref`) ? en(`v3.card.${id}.ref`) : "";
  const bio = known(`v3.bio.${id}`) ? gist(en(`v3.bio.${id}`)) : "";
  return [STYLE, `Subject: ${name}${title && title !== `v3.card.${id}.title` ? `, ${title}` : ""}.`, ref && `Scripture: ${ref}.`, bio && `Story: ${bio}`]
    .filter(Boolean)
    .join(" ");
}

/** Leonardo.ai: start a generation, wait for it to finish, download the picture. */
async function generateWithLeonardo(prompt: string): Promise<Buffer> {
  const key = process.env.LEONARDO_API_KEY;
  const modelId = process.env.LEONARDO_MODEL_ID;
  if (!key) throw new Error("LEONARDO_API_KEY is not set (put it in .env.local)");
  if (!modelId) throw new Error("LEONARDO_MODEL_ID is not set: the id of the model you use on leonardo.ai");
  const base = "https://cloud.leonardo.ai/api/rest/v1";
  const headers = { "Content-Type": "application/json", accept: "application/json", authorization: `Bearer ${key}` };
  const start = await fetch(`${base}/generations`, { method: "POST", headers, body: JSON.stringify({ prompt, modelId, width: 1024, height: 1024, num_images: 1 }) });
  if (!start.ok) throw new Error(`Leonardo ${start.status}: ${await start.text()}`);
  const id = ((await start.json()) as { sdGenerationJob: { generationId: string } }).sdGenerationJob.generationId;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const poll = await fetch(`${base}/generations/${id}`, { headers });
    if (!poll.ok) throw new Error(`Leonardo ${poll.status}: ${await poll.text()}`);
    const job = ((await poll.json()) as { generations_by_pk: { status: string; generated_images: { url: string }[] } }).generations_by_pk;
    if (job.status === "FAILED") throw new Error("Leonardo: the generation failed");
    if (job.status === "COMPLETE" && job.generated_images[0]) return Buffer.from(await (await fetch(job.generated_images[0].url)).arrayBuffer());
  }
  throw new Error("Leonardo: timed out waiting for the picture");
}

async function generate(prompt: string): Promise<Buffer> {
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set (put it in .env.local)");
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const item = ((await res.json()) as { data: { b64_json?: string; url?: string }[] }).data[0];
    if (item.b64_json) return Buffer.from(item.b64_json, "base64");
    if (item.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
    throw new Error("OpenAI returned no image");
  }
  if (provider === "leonardo") return generateWithLeonardo(prompt);
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set (put it in .env.local)");
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const parts = ((await res.json()) as { candidates: { content: { parts: { inlineData?: { data: string } }[] } }[] }).candidates?.[0]?.content?.parts ?? [];
  const data = parts.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("Gemini returned no image");
  return Buffer.from(data, "base64");
}

it("draws draft card art", async () => {
  const wanted = process.env.ART_IDS
    ? process.env.ART_IDS.split(",").map((s) => s.trim()).filter(Boolean)
    : COLLECTIBLE.filter((id) => !existsSync(`public/cards/${id}.jpg`));
  mkdirSync(DRAFTS, { recursive: true });
  const lines: string[] = [];
  for (const id of wanted) {
    const prompt = promptFor(id);
    lines.push(`${id}\n  ${prompt}\n`);
    if (!call) continue;
    const out = `${DRAFTS}/${id}.png`;
    if (existsSync(out) && !force) {
      lines.push(`  (skipped: ${out} exists)\n`);
      continue;
    }
    writeFileSync(out, await generate(prompt));
    lines.push(`  -> ${out}\n`);
  }
  // Vitest swallows console output of passing tests: write the summary where it can be read.
  writeFileSync(`${DRAFTS}/last-run.txt`, `${call ? "CALLED" : "DRY RUN"} ${provider}: ${wanted.length} cards\n\n${lines.join("\n")}`);
});
