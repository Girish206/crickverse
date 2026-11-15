import type { CricketExtraType } from "../../../../api/types";

// How the scorer names and shows each extra (the pad and the extras sheet).
export const EXTRA_LABELS: Record<CricketExtraType, string> = {
  wide: "Wide",
  "no-ball": "No ball",
  bye: "Bye",
  "leg-bye": "Leg bye",
  penalty: "Penalty runs",
};

export const EXTRA_ICONS: Record<CricketExtraType, string> = {
  wide: "fa-arrows-left-right",
  "no-ball": "fa-ban",
  bye: "fa-person-running",
  "leg-bye": "fa-shoe-prints",
  penalty: "fa-gavel",
};
