// Draft card art from an image API. Nothing here runs by itself and nothing goes into the game directly: pictures are
// written to art-drafts/<id>.png (git-ignored) for you to look at; move the good ones to public/cards/<id>.jpg.
//
//   pnpm art                          prompts for every character card that has no picture yet; prints them (a dry run)
//   ART_IDS=moses,ruth pnpm art       only these cards (character or enemy ids)
//   ART_CALL=1 pnpm art               really call the API (needs a key, see below); a dry run is the default
//   ART_FORCE=1 ART_CALL=1 pnpm art   draw again even if art-drafts/<id>.png exists
//
// Keys live in .env.local (never committed, never shipped to the browser):
//   OPENAI_API_KEY=...   ART_PROVIDER=openai (default)   OPENAI_IMAGE_MODEL=gpt-image-1.5
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
  "Traditional hand-painted watercolor on textured cold-pressed paper, translucent washes, soft pigment blooms and delicate " +
  "colored-pencil details, in the realistic storybook look of a biblical picture book. " +
  "A full-length figure stands in the middle of a square picture, in three-quarter view, gently looking off to one side, " +
  "head in the upper third and feet near the bottom, nothing cut off. Behind them the real landscape of their story " +
  "under a bright sky with soft clouds, a few tiny figures far in the distance. Warm golden light, gentle natural colours: " +
  "earth-tone, rough-spun, historically plausible clothing with one muted blue or green accent, and one simple object in " +
  "hand that tells who they are. A calm, dignified, child-friendly atmosphere. " +
  "No violence, no blood, no horror effects, no modern objects, no text, no lettering, no watermark, no frame, no border.";

const en = (key: string) => translate("en", key);
const known = (key: string) => en(key) !== key;
/** The first couple of sentences of a longer text. */
const gist = (text: string) => text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");

/** The medium and mood of every picture, without the one-figure composition of a card (packs show a whole scene). */
const MEDIUM =
  "Traditional hand-painted watercolor on textured cold-pressed paper, translucent washes, soft pigment blooms and delicate " +
  "colored-pencil details, in the realistic storybook look of a biblical picture book. Square composition, warm golden light, " +
  "gentle natural colours, a calm, dignified, child-friendly atmosphere. " +
  "No violence, no blood, no horror effects, no modern objects, no text, no lettering, no watermark, no frame, no border.";

/** The scene printed on each kind of pack (ids as in game/v3/gacha.ts); ask for one with ART_IDS=pack-beginnings. */
const PACK_SCENES: Record<string, string> = {
  beginnings: "The Garden of Eden at first light: a river through lush trees heavy with fruit, a wide tree at the centre, gentle animals, soft mist, the sky just turning gold.",
  exodus: "The people of Israel walking through the Red Sea on dry ground between two tall walls of blue water, with a pillar of cloud glowing above them, a long line of travellers carrying bundles and leading flocks.",
  kingdom: "A young shepherd boy with a sling standing on a hillside above the Valley of Elah at dawn, sheep grazing nearby, the tents of two armies faint in the distance.",
  prophets: "Mount Carmel at evening: a stone altar with an offering, a lone prophet in a plain robe lifting his hands toward the sky, a small cloud rising far over the sea.",
  exile: "A wise old man in simple robes kneeling in prayer at an open window in a Babylonian house at dusk, the city's towers and palm trees glowing outside.",
  nativity: "A quiet night in Bethlehem: a simple stable lit by a warm glow, a mother and father bending over a manger, shepherds and sheep arriving, a bright star above the hills.",
  ministry: "The shore of the Sea of Galilee at sunrise: fishing boats, nets drying on the sand, a crowd gathering on the hillside to listen, fishermen turning toward a teacher.",
  passion: "Three wooden crosses on a hill at the quiet hour of evening, a soft light breaking through heavy clouds over Jerusalem in the distance, a few women watching from afar. Gentle and reverent, no suffering shown.",
  church: "Early believers sharing bread in a courtyard in Jerusalem, a small flame of light resting above them, travellers with scrolls setting out along a road toward the sea.",
};

/**
 * Page backdrops (ART_IDS=bg-light, bg-night, bg-glass): not a scene, nothing recognisable, only light and texture for the
 * pointer's glow to uncover on pages that have no theme. Wide pictures (set ART_SIZE=1536x1024).
 */
const BACKDROPS: Record<string, string> = {
  light:
    "An abstract hand-painted watercolor backdrop on textured cold-pressed paper: soft golden light rays fanning out from the upper left across a warm, hazy wash of amber, ochre and pale rose, with gentle cloud-like pigment blooms and a few faint specks of gold. No landscape, no objects, no figures, no horizon.",
  night:
    "An abstract hand-painted watercolor backdrop on textured cold-pressed paper: deep indigo and violet washes melting into one another, with delicate drifting pigment blooms, a faint glow of warm gold in the lower right, and tiny scattered flecks of gold leaf like distant stars. No landscape, no objects, no figures, no horizon.",
  glass:
    "An abstract watercolor backdrop on textured cold-pressed paper, like light falling through a cathedral window: soft translucent panes of ruby, sapphire and amber with thin hand-drawn gold lines forming a loose geometric lattice, edges bleeding gently into one another, calm and luminous. No pictures, no symbols, no letters, no figures.",
};

/**
 * Card backs (ART_IDS=back-cross, back-dove, back-tree): the back of a card as the cover of a fine bound Bible, in the
 * gold-on-dark ornamental style of tarot card backs. Portrait (set ART_SIZE=1024x1536).
 */
const BACK_BASE =
  "The flat front view of the cover of a premium hand-bound leather Bible, designed as the back of a collectible card: " +
  "rich full-grain leather in deep midnight navy with subtle oxblood undertones, fine grain and soft worn highlights, " +
  "decorated with gilt gold-foil stamping and delicate blind embossing. Perfectly symmetrical, centred composition " +
  "inside an elegant double-line gold border with ornate corner flourishes, olive branches, wheat and grapevine " +
  "ornaments, small stars. Luxurious, reverent, hand-crafted bookbinding feel, gold glowing softly against the dark " +
  "leather. No text, no letters, no words, no captions, no watermark. Portrait card proportions, filling the whole picture edge to edge.";
const BACKS: Record<string, string> = {
  cross: "At the centre, a refined gold cross with radiating rays of light and a halo of fine gilt lines, small stars around it.",
  dove: "At the centre, a gold dove descending with outspread wings and an olive branch, surrounded by a sunburst of fine gilt rays.",
  tree: "At the centre, a gold Tree of Life with spreading branches, leaves and fruit inside a circular gilt medallion, with rays of light behind it.",
};
/** Backs with a Bible story at the centre (ART_IDS=back-nativity, back-ark, back-shepherd), in the manner of tarot card backs. */
const STORY_BASE =
  "A tarot-card-back style design drawn as the cover of a fine dark leather Bible: gilt gold-foil line art on deep midnight " +
  "navy leather with fine grain, a richly ornamented double-line gold border with flowing floral and vine corner flourishes, " +
  "olive branches, wheat, grapevines and small eight-pointed stars filling the frame. Perfectly symmetrical and centred. " +
  "In the middle, a glowing circular gilt medallion telling one Bible story in delicate engraved gold linework. " +
  "Reverent, luxurious, hand-crafted, gold softly glowing against the dark leather. " +
  "No text, no letters, no words, no watermark. Portrait card proportions, filling the whole picture edge to edge.";
const STORIES: Record<string, string> = {
  nativity: "The medallion shows the Nativity: a great star of Bethlehem radiating beams of light over a small stable with a manger, with a shepherd and sheep and the three wise men on camels in silhouette beneath.",
  ark: "The medallion shows Noah's Ark riding the waves under a wide rainbow, with a dove carrying an olive branch above it and pairs of animals along the shore.",
  shepherd: "The medallion shows the Good Shepherd: a robed shepherd with a staff carrying a lamb on his shoulders among his flock, under a bright star, with green pastures and still waters.",
};
const promptForBack = (id: string) => {
  const key = id.replace(/^back-/, "");
  return STORIES[key] ? `${STORY_BASE} ${STORIES[key]}` : `${BACK_BASE} ${BACKS[key] ?? ""}`;
};

/** The prompt for a pack picture. */
const promptForBackdrop = (id: string) => `${BACKDROPS[id.replace(/^bg-/, "")] ?? ""} Wide composition, calm and soft, no text, no lettering, no watermark, no frame, no border.`;

const promptForPack = (id: string) => `${MEDIUM} Scene: ${PACK_SCENES[id.replace(/^pack-/, "")] ?? ""}`;

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
      body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5", prompt, size: process.env.ART_SIZE ?? "1024x1024", n: 1 }),
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
    const prompt = id.startsWith("back-") ? promptForBack(id) : id.startsWith("bg-") ? promptForBackdrop(id) : id.startsWith("pack-") ? promptForPack(id) : promptFor(id);
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
