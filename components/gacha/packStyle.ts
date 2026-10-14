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
 * The picture printed on each kind of pack. For now every pack uses the one test picture (public/packs/test.jpg);
 * give a pack its own with an entry like `beginnings: "/packs/beginnings.jpg"`. A pack without a picture shows its
 * featured card instead.
 */
const TEST_PICTURE = "/packs/test.jpg";
const PACK_PICTURES: Record<string, string> = Object.fromEntries(Object.keys(FOIL).map((id) => [id, TEST_PICTURE]));
export const packPicture = (pack: { id: string; featured: string }) => PACK_PICTURES[pack.id] ?? `/cards/${pack.featured}.jpg`;
