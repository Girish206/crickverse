import { useFollowCounts } from "../../../api/hooks/cricket/useCricketFollows";
import { useCricketPlayerCareer } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch, CricketPlayer, CricketTournament } from "../../../api/types";
import { CricketKpis } from "../CricketKpis";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "./PlayerAvatar";
import { FollowButton } from "../follow/FollowButton";
import { battingAverage, bestBowling, impactPerMatch, playerStats, points, rate, strikeRate } from "../stats";
import { Loader } from "../../components/Loader";

// Anyone viewing a player's profile (loads that player's matches).
export function CricketPlayerProfileLoader({ player }: { player: CricketPlayer }) {
  const { data, isLoading } = useCricketPlayerCareer(player.id);
  if (isLoading) return <Loader />;
  return <CricketPlayerProfile player={player} matches={data?.matches ?? []} tournaments={data?.tournaments ?? []} />;
}

// Career stats over the given matches (all of the player's). `cards` lays
// it out straight on the page (My Stats) — the header and each section as
// its own card, like the match lists — rather than inside a sheet or card.
export function CricketPlayerProfile({
  player,
  matches,
  tournaments,
  cards,
}: {
  player: CricketPlayer;
  matches: CricketMatch[];
  tournaments: CricketTournament[];
  cards?: boolean;
}) {
  const s = playerStats(matches).get(player.id);
  const role = roleOf(player.role);
  const inTournaments = tournaments.filter((t) => t.playerIds.includes(player.id));
  // The whole career: every tournament and friendly match, not one of them.
  const friendlies = matches.filter((m) => m.tournamentId === null).length;
  const { data: follows } = useFollowCounts({ kind: "player", targetId: player.id, teamIndex: null });
  // Under the name, evenly spaced like a social profile.
  const counts: [string, number | string][] = [
    [inTournaments.length === 1 ? "Tournament" : "Tournaments", inTournaments.length],
    [friendlies === 1 ? "Friendly" : "Friendlies", friendlies],
    [follows?.followers === 1 ? "Follower" : "Followers", follows?.followers ?? "–"],
    ["Following", follows ? (follows.following ?? 0) : "–"],
  ];

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

  const section = (title: string, icon: string, items: [string, string | number][]) =>
    cards ? (
      <section className="cricket-stat-card" key={title}>
        <h4 className="cricket-section-title">
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}
        </h4>
        {rows(items)}
      </section>
    ) : (
      <div key={title}>
        <h4 className="cricket-section-title">{title}</h4>
        {rows(items)}
      </div>
    );

  return (
    <div className={`cricket-profile ${cards ? "is-cards" : ""}`.trim()}>
      <div className={`cricket-profile-head ${cards ? "cricket-stat-card" : ""}`.trim()}>
        <div className="cricket-profile-top">
          <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="cricket-player-avatar is-large" viewable />
          <div className="cricket-profile-name">
            <h3>{player.name}</h3>
            <span className="cricket-profile-role">{role ? role.label : "Role not set"}</span>
          </div>
          <FollowButton target={{ kind: "player", targetId: player.id, teamIndex: null }} />
        </div>
        <dl className="cricket-profile-counts">
          {counts.map(([label, value]) => (
            <div key={label}>
              <dd>{value}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
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
          <div className={cards ? "cricket-stat-cards" : undefined}>
            {section("Batting", "fa-baseball-bat-ball", [
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
            {section("Bowling", "fa-baseball", [
              ["Innings", s.bowlingInnings],
              ["Overs", `${Math.floor(s.ballsBowled / 6)}.${s.ballsBowled % 6}`],
              ["Wickets", s.wickets],
              ["Best", bestBowling(s)],
              ["Economy", rate(s.runsConceded, s.ballsBowled)],
              ["Average", s.wickets ? (s.runsConceded / s.wickets).toFixed(2) : "–"],
              ["Maidens", s.maidens],
              ["3+ wicket hauls", s.threeWickets],
            ])}
            {section("Fielding", "fa-hand", [
              ["Catches", s.catches],
              ["Stumpings", s.stumpings],
              ["Run-outs", s.runOuts],
            ])}
            {section("Impact points", "fa-bolt", [
              ["Total (MVP)", points(s.impact)],
              ["Per match", impactPerMatch(s)],
              ["Batting", points(s.battingImpact)],
              ["Bowling", points(s.bowlingImpact)],
              ["Fielding", points(s.fieldingImpact)],
            ])}
          </div>
        </>
      )}
    </div>
  );
}
