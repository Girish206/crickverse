import { useState } from "react";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { usePlayerNames, usePlayerPhotos } from "../matches/matchUtils";
import { ShareSheet } from "../ShareMenu";
import { logoFor } from "./tournamentArt";
import { TOURNAMENT_SHARE_HEADINGS, tournamentTabShare, type TournamentShareTab } from "./tournamentTabCards";

// The share sheet for a tournament: a picture of the tab that's open, and a
// link straight to it. It shares the tab as it stood when opened.
export function TournamentShareSheet({
  tournament,
  matches,
  tab,
  note,
  onClose,
}: {
  tournament: CricketTournament;
  matches: CricketMatch[];
  tab: TournamentShareTab;
  note: string;
  onClose: () => void;
}) {
  const nameOf = usePlayerNames();
  const photoOf = usePlayerPhotos();
  const [share] = useState(() => tournamentTabShare(tab, { tournament, matches, nameOf, photoOf }));

  return (
    <ShareSheet
      heading={TOURNAMENT_SHARE_HEADINGS[tab]}
      path={`/tournaments/${tournament.id}?tab=${tab}`}
      title={tournament.name}
      text={share.text}
      image={logoFor(tournament)}
      card={share.draw && { fileName: `runmitra-tournament-${tournament.id}-${share.subject}.png`, draw: share.draw }}
      note={note}
      onClose={onClose}
    />
  );
}
