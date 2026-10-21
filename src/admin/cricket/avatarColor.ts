// Deterministic pastel background for a transaction row's avatar circle —
// same category always gets the same color, without needing to store one.
const PALETTE = [
  "#F97066", "#F79009", "#EAAA08", "#66C61C",
  "#12B76A", "#15B79E", "#0BA5EC", "#2E90FA",
  "#7A5AF8", "#B54708", "#DD2590", "#875BF7",
];

export function avatarColorFor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
