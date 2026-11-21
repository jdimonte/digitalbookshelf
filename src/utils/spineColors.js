// Default palette used when a theme has no custom spineColors set
export const DEFAULT_SPINE_COLORS = [
  "#db8faf",
  "#d44040",
  "#32b38c",
  "#0e457c",
  "#5305b3",
  "#d97759",
  "#6596ae",
];

export function getSpineColor(theme, coverId) {
  const palette = theme?.spineColors || DEFAULT_SPINE_COLORS;
  const index = ((coverId % palette.length) + palette.length) % palette.length;
  return palette[index];
}

const MONOCHROME_PALETTE = [
  { background: "#ffffff", foreground: "#111111" },
  { background: "#dedede", foreground: "#111111" },
  { background: "#111111", foreground: "#ffffff" },
  { background: "#f5f5f5", foreground: "#111111" },
  { background: "#777777", foreground: "#ffffff" },
  { background: "#b8b8b8", foreground: "#111111" },
];

export function getMonochromeSpineStyle(coverId) {
  const numericId =
    typeof coverId === "number"
      ? coverId
      : Array.from(String(coverId || ""), (character) =>
          character.charCodeAt(0),
        ).reduce((sum, value) => sum + value, 0);
  const index =
    ((numericId % MONOCHROME_PALETTE.length) +
      MONOCHROME_PALETTE.length) %
    MONOCHROME_PALETTE.length;
  return MONOCHROME_PALETTE[index];
}
