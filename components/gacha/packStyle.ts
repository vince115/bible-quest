// How each kind of pack looks: three foil colours (light, middle, dark), shared by the pack art on the page and the
// textures of the 3D stage.
export const FOIL: Record<string, [string, string, string]> = {
  beginnings: ["#6ee7a8", "#15803d", "#064e3b"],
  exodus: ["#fcd34d", "#b45309", "#78350f"],
  kingdom: ["#fda4af", "#be123c", "#881337"],
  prophets: ["#fdba74", "#c2410c", "#7c2d12"],
  exile: ["#a5b4fc", "#4338ca", "#1e1b4b"],
  nativity: ["#f0abfc", "#a21caf", "#4a044e"],
  ministry: ["#7dd3fc", "#0369a1", "#082f49"],
  passion: ["#d6d3d1", "#57534e", "#1c1917"],
  church: ["#fde68a", "#ca8a04", "#713f12"],
};

export const foilOf = (id: string): [string, string, string] => FOIL[id] ?? FOIL.passion;
export const foilCss = (id: string) => {
  const [a, b, c] = foilOf(id);
  return `linear-gradient(160deg,${a} 0%,${b} 55%,${c} 100%)`;
};

/**
 * The picture printed on each kind of pack, one scene for each period of the Bible (public/packs/<id>.jpg).
 * A pack without a picture shows its featured card instead.
 */
const PACK_PICTURES: Record<string, string> = Object.fromEntries(Object.keys(FOIL).map((id) => [id, `/packs/${id}.jpg`]));
export const packPicture = (pack: { id: string; featured: string }) => PACK_PICTURES[pack.id] ?? `/cards/${pack.featured}.jpg`;

// ---------- the crimped foil seals ----------

/** The seals at the head and foot of a pack, as a share of the pack's height. */
export const SEAL_TOP = 0.11; // the top seal is 2.2 times as tall as the bottom one
export const SEAL_BOTTOM = 0.05;

/** A #rrggbb or rgb(r,g,b) colour as its three numbers. */
const rgb = (c: string): number[] => (c.startsWith("#") ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : (c.match(/\d+/g) ?? ["0", "0", "0"]).map(Number));
/** Mixes two colours (t = 0 gives a, 1 gives b) into an rgb() string. */
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [rgb(a), rgb(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};
const seeded = (text: string) => {
  let s = 0;
  for (const ch of text) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * One crimped foil seal, drawn into the rectangle (x, y, w, h) of a canvas; `top` says which end of the pack it is.
 * Made like the real thing: metallic foil in the pack's colour with a few broad, soft reflections; a plain
 * flat margin along the cut edge, which is pinked (cut in small teeth); then the crimp itself, fine ridges running
 * across the seal whose spacing and strength wander a little, as if pressed by hand; and a plain hem on the picture
 * side with a bright lip and a soft shadow on the picture. Everything is scaled from a pack that is 360 px wide.
 */
export function drawSeal(g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, top: boolean, shadow = true, hole: "punch" | "dark" | "none" = "none") {
  const [light, mid, dark] = FOIL[id] ?? FOIL.passion;
  const u = w / 360;
  const rnd = seeded(`${id}${top}`);
  g.save();
  g.translate(x, y);
  if (!top) {
    g.translate(0, h);
    g.scale(1, -1); // draw every seal as a top one; the foot is its mirror image
  }
  g.beginPath();
  g.rect(0, 0, w, h);
  g.clip();

  // Foil: the pack's colour, with a few broad reflections across it
  const body = g.createLinearGradient(0, 0, w, 0);
  const stops = 9;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const shine = 0.5 + 0.5 * Math.sin(t * Math.PI * 3.3 + rnd() * 2);
    body.addColorStop(t, mix(dark, mix(light, "#ffffff", 0.3), 0.2 + 0.6 * shine * (0.6 + rnd() * 0.4)));
  }
  g.fillStyle = body;
  g.fillRect(0, 0, w, h);
  const across = g.createLinearGradient(0, 0, 0, h);
  across.addColorStop(0, "rgba(0,0,0,0.3)");
  across.addColorStop(0.5, "rgba(255,255,255,0.1)");
  across.addColorStop(1, "rgba(0,0,0,0.25)");
  g.fillStyle = across;
  g.fillRect(0, 0, w, h);

  // The crimp: ridges across the seal, between a flat margin at the cut edge and a hem on the picture side
  const y0 = h * 0.2;
  const y1 = h * 0.82;
  let cx = 0;
  while (cx < w) {
    const pitch = (2.1 + rnd() * 0.7) * u;
    const lean = (rnd() - 0.5) * 0.9 * u; // each ridge leans a little
    const bend = (rnd() - 0.5) * 0.6 * u;
    const strength = 0.55 + rnd() * 0.45;
    for (const [dx, fill] of [
      [0, `rgba(255,255,255,${0.34 * strength})`],
      [pitch * 0.5, `rgba(0,0,0,${0.3 * strength})`],
    ] as const) {
      g.beginPath();
      g.moveTo(cx + dx, y0);
      g.quadraticCurveTo(cx + dx + bend, (y0 + y1) / 2, cx + dx + lean, y1);
      g.lineTo(cx + dx + lean + pitch * 0.42, y1);
      g.quadraticCurveTo(cx + dx + bend + pitch * 0.42, (y0 + y1) / 2, cx + dx + pitch * 0.42, y0);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    }
    cx += pitch;
  }
  // The ridges end softly where the flat margin and the hem begin
  for (const [from, to] of [[y0 - 1.5 * u, y0 + 2 * u], [y1 - 2 * u, y1 + 1.5 * u]]) {
    const edge = g.createLinearGradient(0, from, 0, to);
    edge.addColorStop(0, "rgba(0,0,0,0.22)");
    edge.addColorStop(1, "rgba(255,255,255,0.18)");
    g.fillStyle = edge;
    g.fillRect(0, from, w, to - from);
  }

  // The cut edge is pinked: a row of small teeth, light and dark by turns
  const tooth = 5 * u;
  const depth = Math.max(2, h * 0.11);
  for (let tx = 0, k = 0; tx < w; tx += tooth, k++) {
    g.beginPath();
    g.moveTo(tx, 0);
    g.lineTo(tx + tooth / 2, depth);
    g.lineTo(tx + tooth, 0);
    g.closePath();
    g.fillStyle = k % 2 ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.3)";
    g.fill();
  }

  // The lip along the picture side
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.fillRect(0, h - 1.6 * u, w, 1.2 * u);
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(0, h - 0.5 * u, w, 0.5 * u);

  // The hang hole of the top seal, in the middle of it: a wide rounded slot with a round bump above its centre
  // (shops hang the pack on a peg by it)
  if (top && hole !== "none") {
    const pw = 42 * u; // the slot
    const ph = 10.8 * u;
    const r = 8.1 * u; // the bump
    const cx2 = w / 2;
    const top0 = h / 2 - (ph + r) / 2 + 2 * u; // the whole shape sits in the middle of the seal, 2 px lower
    const slotTop = top0 + r;
    const shape = () => {
      g.beginPath();
      g.roundRect(cx2 - pw / 2, slotTop, pw, ph, ph / 2);
      g.moveTo(cx2 + r, slotTop);
      g.arc(cx2, slotTop, r, 0, Math.PI * 2);
    };
    // The film around the hole is a little stiffer and catches the light
    shape();
    g.lineJoin = "round";
    g.lineWidth = 4 * u;
    g.strokeStyle = "rgba(255,255,255,0.2)";
    g.stroke();
    shape();
    if (hole === "punch") {
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = "#000";
      g.fill();
      g.globalCompositeOperation = "source-over";
    } else {
      g.fillStyle = "rgba(12,10,20,0.92)";
      g.fill();
    }
    shape();
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 1 * u;
    g.stroke();
  }
  g.restore();

  if (shadow) {
    // The shadow the seal throws on the picture
    g.save();
    g.translate(x, y);
    if (!top) {
      g.translate(0, h);
      g.scale(1, -1);
    }
    const fall = g.createLinearGradient(0, h, 0, h + 9 * u);
    fall.addColorStop(0, "rgba(0,0,0,0.45)");
    fall.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fall;
    g.fillRect(0, h, w, 9 * u);
    g.restore();
  }
}
