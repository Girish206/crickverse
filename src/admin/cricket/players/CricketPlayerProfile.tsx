import { useCricketPlayerCareer } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch, CricketPlayer, CricketTournament } from "../../../api/types";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "./PlayerAvatar";
import { FollowButton } from "../follow/FollowButton";
import { battingAverage, bestBowling, impactPerMatch, playerStats, points, rate, strikeRate } from "../stats";
import { Loader } from "../../components/Loader";
import { Scoreline } from "../me/SummaryBanner";
import { StatSectionCard, type StatSection } from "../me/StatSectionCard";
import { ProfileCounts } from "./ProfileCounts";

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
  const friendlies = matches.filter((m) => m.tournamentId === null);

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

  // On My Stats each section is a card led by its main figures (see
  // StatSectionCard); in a sheet, a plain heading over every figure.
  const section = (part: StatSection) =>
    cards ? (
      <StatSectionCard key={part.title} section={part} />
    ) : (
      <div key={part.title}>
        <h4 className="cricket-section-title">{part.title}</h4>
        {rows(part.items)}
      </div>
    );

  return (
    <div className={`cricket-profile ${cards ? "is-cards" : ""}`.trim()}>
      {/* The compact hero: who they are, their career in four numbers, and
          their tournaments, friendlies and follows as the last line. */}
      <section className="cricket-home-hero cricket-profile-hero cv-hero-compact">
        <div className="cricket-home-hero-top">
          <PlayerAvatar
            name={player.name}
            photoUrl={player.photoUrl}
            className="cricket-player-avatar cricket-home-hero-avatar"
          />
          <div className="cricket-home-hero-name">
            <small>{role ? role.label : "Role not set"}</small>
            <h2>{player.name}</h2>
          </div>
          <FollowButton target={{ kind: "player", targetId: player.id, teamIndex: null }} />
        </div>
        <Scoreline
          stats={[
            { label: "Matches", value: s?.matches ?? 0 },
            { label: "Runs", value: s?.runs ?? 0 },
            { label: "Wickets", value: s?.wickets ?? 0 },
            { label: "POTM", value: s?.playerOfMatch ?? 0, title: "Player of the Match" },
          ]}
        />
        <ProfileCounts player={player} tournaments={inTournaments} friendlies={friendlies} />
      </section>

      {!s || s.matches === 0 ? (
        <div className="admin-empty-state">No matches played yet.</div>
      ) : (
        <>
          <div className={cards ? "cv-stat-cards" : undefined}>
            {section({
              tone: "batting",
              title: "Batting",
              icon: "fa-baseball-bat-ball",
              lead: ["Runs", "Average", "Strike rate"],
              items: [
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
              ],
              share: {
                title: "Runs in boundaries",
                summary: s.runs ? `${Math.round(((s.fours * 4 + s.sixes * 6) / s.runs) * 100)}%` : "–",
                parts: [
                  { label: "Fours", value: s.fours * 4, color: "#e8501f" },
                  { label: "Sixes", value: s.sixes * 6, color: "#ffcd00" },
                  { label: "Running", value: s.runs - s.fours * 4 - s.sixes * 6, color: "#94a3b8" },
                ],
              },
            })}
            {section({
              tone: "bowling",
              title: "Bowling",
              icon: "fa-baseball",
              lead: ["Wickets", "Economy", "Best"],
              items: [
                ["Innings", s.bowlingInnings],
                ["Overs", `${Math.floor(s.ballsBowled / 6)}.${s.ballsBowled % 6}`],
                ["Wickets", s.wickets],
                ["Best", bestBowling(s)],
                ["Economy", rate(s.runsConceded, s.ballsBowled)],
                ["Average", s.wickets ? (s.runsConceded / s.wickets).toFixed(2) : "–"],
                ["Maidens", s.maidens],
                ["3+ wicket hauls", s.threeWickets],
              ],
            })}
            {section({
              tone: "fielding",
              title: "Fielding",
              icon: "fa-hand",
              lead: ["Catches", "Stumpings", "Run-outs"],
              items: [
                ["Catches", s.catches],
                ["Stumpings", s.stumpings],
                ["Run-outs", s.runOuts],
              ],
            })}
            {section({
              tone: "impact",
              title: "MVP points",
              icon: "fa-bolt",
              lead: ["Total (MVP)", "Per match"],
              items: [
                ["Total (MVP)", points(s.impact)],
                ["Per match", impactPerMatch(s)],
                ["Batting", points(s.battingImpact)],
                ["Bowling", points(s.bowlingImpact)],
                ["Fielding", points(s.fieldingImpact)],
              ],
              share: {
                title: "Where the points come from",
                summary: `${points(s.impact)} pts`,
                parts: [
                  { label: "Batting", value: s.battingImpact, color: "#ffcd00", shown: points(s.battingImpact) },
                  { label: "Bowling", value: s.bowlingImpact, color: "#e8501f", shown: points(s.bowlingImpact) },
                  { label: "Fielding", value: s.fieldingImpact, color: "#16a34a", shown: points(s.fieldingImpact) },
                ],
              },
            })}
          </div>
        </>
      )}
    </div>
  );
}
