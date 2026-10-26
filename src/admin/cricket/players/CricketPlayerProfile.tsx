import { useFollowCounts } from "../../../api/hooks/cricket/useCricketFollows";
import { useCricketPlayerCareer } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch, CricketPlayer, CricketTournament } from "../../../api/types";
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
      {/* The Home hero: who they are, their career in four numbers, and
          their tournaments, friendlies and follows in a line below. */}
      <section className="cricket-home-hero cricket-profile-hero">
        <div className="cricket-home-hero-top">
          <PlayerAvatar
            name={player.name}
            photoUrl={player.photoUrl}
            className="cricket-player-avatar cricket-home-hero-avatar"
          />
          <div className="cricket-home-hero-name">
            <h2>{player.name}</h2>
            <span className="cricket-home-hero-role">
              {role ? role.label : "Role not set"}
            </span>
          </div>
          <FollowButton target={{ kind: "player", targetId: player.id, teamIndex: null }} />
        </div>
        <div className="cricket-home-hero-stats">
          {[
            { label: "Matches", value: s?.matches ?? 0 },
            { label: "Runs", value: s?.runs ?? 0 },
            { label: "Wickets", value: s?.wickets ?? 0 },
            { label: "POTM", value: s?.playerOfMatch ?? 0, title: "Player of the Match" },
          ].map((n) => (
            <div key={n.label} title={n.title}>
              <strong>{n.value}</strong>
              <small>{n.label}</small>
            </div>
          ))}
        </div>
        <dl className="cricket-profile-hero-counts">
          {counts.map(([label, value]) => (
            <div key={label}>
              <dd>{value}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {!s || s.matches === 0 ? (
        <div className="admin-empty-state">No matches played yet.</div>
      ) : (
        <>
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
