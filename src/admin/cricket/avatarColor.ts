// Deterministic background for a team or player's avatar circle, so the same
// name always gets the same colour without storing one. Muted, dark tones
// that all carry white text: enough to tell names apart, never a rainbow.
const PALETTE = [
  "#475467", "#4b5f7a", "#3f6b6b", "#5b5f7a",
  "#6b5b6e", "#6b6255", "#7a4a46", "#4e6650",
];

export function avatarColorFor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
