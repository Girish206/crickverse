import { useState } from "react";
import { ShareSheet } from "../ShareMenu";
import { TEAM_SHARE_HEADINGS, teamTabShare, type TeamCardData, type TeamShareTab } from "./teamTabCards";

// The share sheet for a team: a picture of the tab that's open, and a link
// straight to it. It shares the tab as it stood when opened.
export function TeamShareSheet({
  data,
  path,
  tab,
  note,
  onClose,
}: {
  data: TeamCardData;
  // The team page's address, without the tab.
  path: string;
  tab: TeamShareTab;
  note: string;
  onClose: () => void;
}) {
  const [share] = useState(() => teamTabShare(tab, data));
  const { team } = data;
  const slug = team.name.replace(/[^\w]+/g, "-").toLowerCase();

  return (
    <ShareSheet
      heading={TEAM_SHARE_HEADINGS[tab]}
      path={`${path}?tab=${tab}`}
      title={team.name}
      text={share.text}
      image={team.logoUrl ?? undefined}
      card={share.draw && { fileName: `runmitra-team-${slug}-${share.subject}.png`, draw: share.draw }}
      note={note}
      onClose={onClose}
    />
  );
}
