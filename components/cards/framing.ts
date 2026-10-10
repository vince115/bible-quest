// One framing rule for every card illustration, so all characters stand at the same size and height on their cards.
// Each picture only records where its figure is (measured on the square source image, as fractions of its size);
// the crop, zoom and zoom origin are worked out here.

/**
 * Where the figure is in the source image: body centre-line, top of the head, and the feet (0–1).
 * size: draw this figure bigger than the shared target (Goliath is a giant); his head then rises toward the top.
 * gaze: which way the figure looks; the figure is set off-centre the other way, leaving open space in front of
 * the eyes (lead room).
 */
export interface Figure {
  cx: number;
  head: number;
  feet: number;
  size?: number;
  gaze?: "left" | "right";
}

/** The card face is taller than wide; a square picture filling its height is this many face-widths wide. */
const IMAGE_WIDTH = 1.436;
/** Target on the card face: top of the head at 16% from the top, head-to-feet spanning 95% of the face height. */
const HEAD_AT = 0.16;
const FIGURE_HEIGHT = 0.95;
/** Lead room: the figure's centre-line sits this far from the middle, away from where it is looking. */
const LEAD = 0.08;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** CSS for an <img> filling the card face (object-fit: cover) so the figure lands on the shared target. */
export function frameFigure({ cx, head, feet, size = 1, gaze = "right" }: Figure) {
  // Zoom so the figure reaches the target height (never below 1, so the picture always covers the face).
  const scale = Math.max(1, (FIGURE_HEIGHT * size) / (feet - head));
  // A bigger figure keeps its feet where the others' are, so its head sits higher.
  const headAt = HEAD_AT - (size - 1) * FIGURE_HEIGHT * 0.3;
  // Horizontal crop that puts the figure's centre-line just off the middle, leaving space where it looks.
  const target = gaze === "right" ? 0.5 - LEAD : 0.5 + LEAD;
  const x = clamp((IMAGE_WIDTH * cx - target) / (IMAGE_WIDTH - 1), 0, 1);
  // Vertical zoom origin that puts the head at the target; kept inside the face so no gap opens at the top.
  const oy = scale > 1 ? clamp((headAt - head * scale) / (1 - scale), 0, 1) : 0.5;
  return {
    objectPosition: `${pct(x)} 50%`,
    transform: `scale(${Math.round(scale * 1000) / 1000})`,
    transformOrigin: `50% ${pct(oy)}`,
  };
}

/** Where the figure ends up on the card face (fractions of the face): its centre-line, head and feet. */
export function figureOnFace(figure: Figure): { x: number; top: number; bottom: number } {
  const { cx, head, feet, size = 1, gaze = "right" } = figure;
  const scale = Math.max(1, (FIGURE_HEIGHT * size) / (feet - head));
  const headAt = HEAD_AT - (size - 1) * FIGURE_HEIGHT * 0.3;
  const target = gaze === "right" ? 0.5 - LEAD : 0.5 + LEAD;
  const x = clamp((IMAGE_WIDTH * cx - target) / (IMAGE_WIDTH - 1), 0, 1);
  const oy = scale > 1 ? clamp((headAt - head * scale) / (1 - scale), 0, 1) : 0.5;
  // object-fit: cover puts the square picture's left edge x·(width−1) face-widths off the face; then the zoom.
  const faceX = IMAGE_WIDTH * cx - x * (IMAGE_WIDTH - 1);
  const zoom = (v: number, origin: number) => origin + (v - origin) * scale;
  return { x: zoom(faceX, 0.5), top: zoom(head, oy), bottom: zoom(feet, oy) };
}
