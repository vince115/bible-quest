// The site's buttons, in one look (antique gold): the main action in a gold fill with dark ink; an important step that
// ends something (End turn) in a wine fill with a gold line and gold lettering; everything else in a soft gold wash with
// no line. Chips that pick one of a set (tabs, filters) use the main look when chosen and the other look when not.
export type ButtonKind = "primary" | "important" | "secondary";
export type ButtonSize = "sm" | "md" | "lg";

const KIND: Record<ButtonKind, string> = {
  primary: "bg-[#d4b35f] font-semibold text-[#2b1d07] shadow-md enabled:hover:bg-[#e0c272] [&:is(a)]:hover:bg-[#e0c272]",
  important: "border border-[#d4b35f] bg-[#7a2230] font-semibold text-[#f2d27a] shadow-md enabled:hover:bg-[#8c2a39] [&:is(a)]:hover:bg-[#8c2a39]",
  secondary: "bg-[#d4b35f]/15 text-[#efe2bd] enabled:hover:bg-[#d4b35f]/25 [&:is(a)]:hover:bg-[#d4b35f]/25",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-5 py-2 text-sm",
  lg: "px-7 py-2.5 text-base",
};

/** A button's classes: its kind and size (place it with your own margin or width classes). */
export const button = (kind: ButtonKind = "secondary", size: ButtonSize = "md") =>
  `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${KIND[kind]} ${SIZE[size]}`;

/** A chip in a set the player picks one of (tabs, filters, stages): the main look when chosen. */
export const chip = (chosen: boolean, size: ButtonSize = "md") => button(chosen ? "primary" : "secondary", size);

/** A round button holding only an icon or an arrow (size it with h-/w- classes). */
export const ICON_BUTTON = "inline-flex items-center justify-center rounded-full bg-[#d4b35f]/15 text-[#efe2bd] transition hover:bg-[#d4b35f]/25";
