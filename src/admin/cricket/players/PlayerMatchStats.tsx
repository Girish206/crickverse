import { ballsPerOverOf, type CricketMatch, type CricketPlayer } from "../../../api/types";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "./PlayerAvatar";
import { Scoreline } from "../me/SummaryBanner";
import { usePlayerNames } from "../matches/matchUtils";
import {
  battingCard,
  bowlingCard,
  dismissalText,
  isWicket,
  matchAwards,
  oversText,
  points,
  rate,
  strikeRate,
} from "../stats";

// One player's part in one match: each innings they batted or bowled in,
// their fielding, MVP points and any award — the profile sheet's
// "This Match" view.
export function PlayerMatchStats({ player, match }: { player: CricketPlayer; match: CricketMatch }) {
  const nameOf = usePlayerNames();
  const perOver = ballsPerOverOf(match);
  const role = roleOf(player.role);
  const slot = match.teams.findIndex((team) => team.playerIds.includes(player.id));
  const awards = matchAwards(match);
  const row = awards.rows.find((r) => r.playerId === player.id);
  const rank = row ? awards.rows.indexOf(row) + 1 : null;
  const badges = [
    awards.playerOfMatch?.playerId === player.id && match.status === "completed" && "Player of the Match",
    awards.bestBatter?.playerId === player.id && "Best Batter",
    awards.bestBowler?.playerId === player.id && "Best Bowler",
    awards.bestFielder?.playerId === player.id && "Best Fielder",
  ].filter((badge): badge is string => Boolean(badge));
  // Two innings a side once there's a super over, so name each one.
  const inningsLabel = (index: number) => (match.innings.length > 2 ? `Innings ${index + 1}` : "");

  const batting = match.innings.flatMap((innings, index) => {
    const card = battingCard(innings).find((r) => r.playerId === player.id);
    return card ? [{ index, card }] : [];
  });
  const bowling = match.innings.flatMap((innings, index) => {
    const card = bowlingCard(innings, perOver).find((r) => r.playerId === player.id);
    return card ? [{ index, card }] : [];
  });

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
  const title = (icon: string, text: string, note?: string) => (
    <h4 className="cricket-section-title">
      <i className={`fa-solid ${icon}`} aria-hidden="true"></i> {text}
      {note && <small className="cricket-match-stats-note"> · {note}</small>}
    </h4>
  );

  const runs = batting.reduce((sum, b) => sum + b.card.runs, 0);
  const wickets = bowling.reduce((sum, b) => sum + b.card.wickets, 0);
  const dismissals = row ? row.catches + row.stumpings + row.runOuts : 0;

  return (
    <div className="cricket-profile">
      <section className="cricket-home-hero cricket-profile-hero cv-hero-compact">
        <div className="cricket-home-hero-top">
          <PlayerAvatar
            name={player.name}
            photoUrl={player.photoUrl}
            className="cricket-player-avatar cricket-home-hero-avatar"
          />
          <div className="cricket-home-hero-name">
            <small>
              {slot === -1 ? "Not in the playing XI" : match.teams[slot].name}
              {role ? ` · ${role.label}` : ""}
            </small>
            <h2>{player.name}</h2>
          </div>
        </div>
        <Scoreline
          stats={[
            { label: "Runs", value: batting.length ? runs : "–" },
            { label: "Wickets", value: bowling.length ? wickets : "–" },
            { label: "Catches", value: row?.catches ?? 0 },
            {
              label: "MVP",
              value: row ? points(row.total) : "–",
              title: rank ? `Ranked #${rank} in this match` : undefined,
            },
          ]}
        />
        {badges.length > 0 && (
          <div className="cricket-match-stats-badges">
            {badges.map((badge) => (
              <span key={badge} className="cricket-match-stats-badge">
                <i className="fa-solid fa-medal" aria-hidden="true"></i> {badge}
              </span>
            ))}
          </div>
        )}
      </section>

      {!row ? (
        <div className="admin-empty-state">
          {match.status === "scheduled"
            ? "The match hasn't started yet."
            : "Hasn't batted, bowled or fielded in this match yet."}
        </div>
      ) : (
        <>
          {batting.map(({ index, card }) => {
            const out = card.outBall !== null;
            return (
              <div key={`bat-${index}`}>
                {title("fa-baseball-bat-ball", "Batting", inningsLabel(index))}
                {rows([
                  ["Runs", `${card.runs}${out && isWicket(card.outBall!) ? "" : "*"}`],
                  ["Balls", card.balls],
                  ["Strike rate", strikeRate(card.runs, card.balls)],
                  ["4s / 6s", `${card.fours} / ${card.sixes}`],
                  ["Batted at", `#${battingCard(match.innings[index]).indexOf(card) + 1}`],
                  ["Status", out ? dismissalText(card.outBall!, nameOf) || "Out" : "Not out"],
                ])}
              </div>
            );
          })}
          {bowling.map(({ index, card }) => (
            <div key={`bowl-${index}`}>
              {title("fa-baseball", "Bowling", inningsLabel(index))}
              {rows([
                ["Figures", `${card.wickets}/${card.runs}`],
                ["Overs", oversText(card.legalBalls, perOver)],
                ["Economy", rate(card.runs, card.legalBalls, perOver)],
                ["Maidens", card.maidens],
                ["Dots", card.dots],
                ["Wides / No-balls", `${card.wides} / ${card.noBalls}`],
              ])}
            </div>
          ))}
          {dismissals > 0 && (
            <div>
              {title("fa-hand", "Fielding")}
              {rows([
                ["Catches", row.catches],
                ["Stumpings", row.stumpings],
                ["Run-outs", row.runOuts],
              ])}
            </div>
          )}
          <div>
            {title("fa-bolt", "MVP points", rank ? `#${rank} of ${awards.rows.length}` : undefined)}
            {rows([
              ["Total (MVP)", points(row.total)],
              ["Batting", points(row.batting)],
              ["Bowling", points(row.bowling)],
              ["Fielding", points(row.fielding)],
            ])}
          </div>
        </>
      )}
    </div>
  );
}
