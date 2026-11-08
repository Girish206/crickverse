import { useCallback, useState } from "react";
import { ShareSheet } from "../ShareMenu";
import { usePlayerPhotos } from "./matchUtils";
import { drawMatchCard, matchShareHeading, matchShareText, type MatchCardData } from "./matchShareCard";

// The share sheet for a match, with a picture of it that follows its status.
// It shares the match as it stood when opened: a new ball arriving mustn't
// redraw the card while someone is sending it.
export function MatchShareSheet({
  match,
  tournament,
  nameOf,
  note,
  onClose,
}: Omit<MatchCardData, "photoOf"> & { note: string; onClose: () => void }) {
  const photoOf = usePlayerPhotos();
  const [shared] = useState<MatchCardData>({ match, tournament, nameOf, photoOf });
  const draw = useCallback(() => drawMatchCard(shared), [shared]);
  const { id, status, teams } = shared.match;

  return (
    <ShareSheet
      heading={matchShareHeading(shared.match)}
      path={`/matches/${id}`}
      title={`${teams[0].name} vs ${teams[1].name}`}
      text={matchShareText(shared.match, shared.tournament?.name)}
      card={{ fileName: `runmitra-match-${id}-${status}.png`, draw }}
      note={note}
      onClose={onClose}
    />
  );
}
