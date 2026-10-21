import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch, CricketPlayer, CricketTournament } from "../../../api/types";
import { CricketKpis } from "../CricketKpis";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "./PlayerAvatar";
import { battingAverage, bestBowling, impactPerMatch, playerStats, points, rate, strikeRate } from "../stats";

// A super admin viewing any player's profile (all matches are loaded).
export function CricketPlayerProfileLoader({ player }: { player: CricketPlayer }) {
  const { data: matches, isLoading } = useCricketMatches();
  const { data: tournaments } = useCricketTournaments();
  if (isLoading) return <p>Loading...</p>;
  return <CricketPlayerProfile player={player} matches={matches ?? []} tournaments={tournaments ?? []} />;
}

// Career stats over the given matches (all of the player's).
export function CricketPlayerProfile({
  player,
  matches,
  tournaments,
}: {
  player: CricketPlayer;
  matches: CricketMatch[];
  tournaments: CricketTournament[];
}) {
  const s = playerStats(matches).get(player.id);
  const role = roleOf(player.role);
  const inTournaments = tournaments.filter((t) => t.playerIds.includes(player.id));

  const rows = (items: [string, string | number][]) => (
    <dl className="cricket-profile-stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="cricket-profile">
      <div className="cricket-profile-head">
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="cricket-player-avatar is-large" />
        <div>
          <h3>{player.name}</h3>
          <span className="text-muted">
            {role ? role.label : "Role not set"}
            {inTournaments.length > 0 && ` · ${inTournaments.map((t) => t.name).join(", ")}`}
          </span>
        </div>
      </div>

      {!s || s.matches === 0 ? (
        <div className="admin-empty-state">No matches played yet.</div>
      ) : (
        <>
          <CricketKpis
            items={[
              { label: "Matches", value: s.matches, icon: "fa-calendar-days", tone: "total" },
              { label: "Runs", value: s.runs, icon: "fa-baseball-bat-ball", tone: "active" },
              { label: "Wickets", value: s.wickets, icon: "fa-baseball", tone: "login" },
              { label: "Player of the match", value: s.playerOfMatch, icon: "fa-medal", tone: "guest" },
            ]}
          />
          <h4 className="cricket-section-title">Batting</h4>
          {rows([
            ["Innings", s.innings],
            ["Runs", s.runs],
            ["Highest", `${s.highest}${s.highestNotOut ? "*" : ""}`],
            ["Average", battingAverage(s)],
            ["Strike rate", strikeRate(s.runs, s.ballsFaced)],
            ["Balls faced", s.ballsFaced],
            ["Not outs", s.notOuts],
            ["50s / 100s", `${s.fifties} / ${s.hundreds}`],
            ["4s / 6s", `${s.fours} / ${s.sixes}`],
            ["Ducks", s.ducks],
          ])}
          <h4 className="cricket-section-title">Bowling</h4>
          {rows([
            ["Innings", s.bowlingInnings],
            ["Overs", `${Math.floor(s.ballsBowled / 6)}.${s.ballsBowled % 6}`],
            ["Wickets", s.wickets],
            ["Best", bestBowling(s)],
            ["Economy", rate(s.runsConceded, s.ballsBowled)],
            ["Average", s.wickets ? (s.runsConceded / s.wickets).toFixed(2) : "–"],
            ["Maidens", s.maidens],
            ["3+ wicket hauls", s.threeWickets],
          ])}
          <h4 className="cricket-section-title">Fielding</h4>
          {rows([
            ["Catches", s.catches],
            ["Stumpings", s.stumpings],
            ["Run-outs", s.runOuts],
          ])}
          <h4 className="cricket-section-title">Impact points</h4>
          {rows([
            ["Total (MVP)", points(s.impact)],
            ["Per match", impactPerMatch(s)],
            ["Batting", points(s.battingImpact)],
            ["Bowling", points(s.bowlingImpact)],
            ["Fielding", points(s.fieldingImpact)],
          ])}
        </>
      )}
    </div>
  );
}
