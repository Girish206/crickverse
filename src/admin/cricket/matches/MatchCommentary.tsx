import { useState } from "react";
import type { CricketMatch } from "../../../api/types";
import { PillSelect } from "../PillSelect";
import type { NameOf } from "../stats";
import { Commentary } from "./Commentary";

// The "Commentary" tab: every ball of the match, newest first, or only the
// innings one side batted in.
export function MatchCommentary({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const [team, setTeam] = useState<number | null>(null);
  const hasBalls = match.innings.some((innings) => (team === null || innings.battingTeam === team) && innings.balls.length > 0);

  return (
    <div className="cricket-match-commentary">
      <PillSelect
        label="Commentary"
        value={team === null ? "full" : String(team)}
        options={[
          { value: "full", label: "Full" },
          ...[0, 1].map((slot) => ({ value: String(slot), label: match.teams[slot].name })),
        ]}
        onChange={(value) => setTeam(value === "full" ? null : Number(value))}
      />
      {hasBalls ? (
        <Commentary match={match} nameOf={nameOf} legalBalls={Infinity} battingTeam={team} />
      ) : (
        <div className="admin-empty-state">
          {team === null ? "Commentary appears once the first ball is bowled." : `${match.teams[team].name} haven't batted yet.`}
        </div>
      )}
    </div>
  );
}
