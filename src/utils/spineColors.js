// Default palette used when a theme has no custom spineColors set
export const DEFAULT_SPINE_COLORS = [
  "#7B3F00",
  "#8B0000",
  "#1B4D3E",
  "#2C3E50",
  "#4A148C",
  "#5D4037",
  "#37474F",
];

export function getSpineColor(theme, coverId) {
  const palette = theme?.spineColors || DEFAULT_SPINE_COLORS;
  const index = ((coverId % palette.length) + palette.length) % palette.length;
  return palette[index];
}
