import { Link } from "react-router-dom";
import { isNotPublic, usePublicTournament, type PublicTournamentData } from "../api/hooks/cricket/useCricketPublic";
import type { CricketMatch, CricketTournament } from "../api/types";
import { countsForTable, pointsTable, standings, type PointsRow } from "../admin/cricket/stats";
import { formatMatchDate, matchStageLabel, teamInitials, teamScore } from "../admin/cricket/matches/matchUtils";
import { PublicShell, PublicState } from "./PublicShell";
import { useNameOf } from "./publicNames";

// /tournaments/:id for someone signed out (a shared link to a public
// tournament): the table, fixtures and results, and the teams. Its matches
// are public with it, so each one opens.
export function PublicTournamentPage({ id }: { id: number }) {
  const { data, isLoading, error, refetch } = usePublicTournament(id);

  if (!data) {
    return (
      <PublicState
        loading={isLoading}
        error={error}
        // A bad id ("/tournaments/abc") can't be anyone's tournament.
        notPublic={isNotPublic(error) || !(id > 0)}
        what="tournament"
        onRetry={() => void refetch()}
      />
    );
  }
  return (
    <PublicShell>
      <TournamentView data={data} />
    </PublicShell>
  );
}

const dateText = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;

function TournamentView({ data }: { data: PublicTournamentData }) {
  const { tournament, matches } = data;
  const nameOf = useNameOf(data.players);
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled");
  // Latest result first.
  const results = matches.filter((m) => m.status === "completed" || m.status === "abandoned").reverse();
  const dates = [dateText(tournament.startDate), dateText(tournament.endDate)].filter(Boolean).join(" – ");
  const place = [tournament.ground, tournament.city].filter(Boolean).join(", ");

  return (
    <div className="cv-public-stack">
      <section className="card cv-pt-hero">
        {tournament.bannerUrl && <img className="cv-pt-banner" src={tournament.bannerUrl} alt="" />}
        <div className="cv-pt-id">
          {tournament.logoUrl ? (
            <img className="cv-pt-logo" src={tournament.logoUrl} alt="" />
          ) : (
            <span className="cv-pt-logo is-initials" aria-hidden="true">
              {teamInitials(tournament.name)}
            </span>
          )}
          <div>
            <h1>{tournament.name}</h1>
            {(place || dates) && <p>{[place, dates].filter(Boolean).join(" · ")}</p>}
            {tournament.organiserName && <p>Organised by {tournament.organiserName}</p>}
          </div>
        </div>
      </section>

      <Tables tournament={tournament} matches={matches} />

      {live.length > 0 && <Fixtures title="Live now" matches={live} />}
      {upcoming.length > 0 && <Fixtures title="Fixtures" matches={upcoming} />}
      {results.length > 0 && <Fixtures title="Results" matches={results} />}
      {matches.length === 0 && (
        <section className="card cv-public-card">
          <p className="cv-public-muted m-0">No matches scheduled yet.</p>
        </section>
      )}

      {tournament.teams.length > 0 && (
        <section className="card cv-public-card">
          <h2 className="cv-public-h">Teams</h2>
          <div className="cv-pt-teams">
            {tournament.teams.map((team, i) => (
              <div key={i} className="cv-pt-team">
                <h3>
                  <span className="cv-pm-badge" aria-hidden="true">
                    {teamInitials(team.name)}
                  </span>
                  {team.name}
                </h3>
                {team.playerIds.length ? (
                  <ul>
                    {team.playerIds.map((pid) => (
                      <li key={pid}>
                        {nameOf(pid)}
                        {team.captainId === pid && " (c)"}
                        {team.keeperId === pid && " †"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cv-public-muted m-0">Players to be picked</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// The points table — one per group when the league is played in groups.
function Tables({ tournament, matches }: { tournament: CricketTournament; matches: CricketMatch[] }) {
  if (tournament.teams.length < 2) return null;
  const league = matches.filter(countsForTable);
  const groups = [...new Set(league.map((m) => m.group).filter((g): g is string => Boolean(g)))].sort();

  const tables: { title: string; rows: PointsRow[] }[] =
    groups.length > 1
      ? groups.map((group) => {
          const inGroup = league.filter((m) => m.group === group);
          const teamIndexes = [...new Set(inGroup.flatMap((m) => m.teams.map((t) => t.teamIndex)))];
          return {
            title: `Group ${group}`,
            rows: standings(
              teamIndexes.map((teamIndex) => ({ teamIndex, name: tournament.teams[teamIndex]?.name ?? "Team" })),
              inGroup,
            ),
          };
        })
      : [{ title: "Points table", rows: pointsTable(tournament, matches) }];

  return (
    <>
      {tables.map((table) => (
        <section key={table.title} className="card cv-public-card">
          <h2 className="cv-public-h">{table.title}</h2>
          <div className="cv-public-table-wrap">
            <table className="cv-public-table is-points">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>L</th>
                  <th>T/NR</th>
                  <th>NRR</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={row.teamIndex}>
                    <td>
                      <span className="cv-public-player">
                        <span className="cv-pt-rank">{i + 1}</span>
                        {row.name}
                      </span>
                    </td>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.lost}</td>
                    <td>{row.tied + row.noResult}</td>
                    <td>{(row.nrr >= 0 ? "+" : "") + row.nrr.toFixed(3)}</td>
                    <td>
                      <strong>{row.points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}

function Fixtures({ title, matches }: { title: string; matches: CricketMatch[] }) {
  return (
    <section className="card cv-public-card">
      <h2 className="cv-public-h">{title}</h2>
      <div className="cv-pt-fixtures">
        {matches.map((match) => (
          <Link key={match.id} to={`/matches/${match.id}`} className="cv-pt-fixture">
            <span className="cv-pt-fixture-meta">
              {matchStageLabel(match)}
              {match.status === "live" ? (
                <span className="cv-pm-status is-live">
                  <span className="cv-pm-dot" aria-hidden="true" />
                  Live
                </span>
              ) : (
                match.scheduledAt && <span>{formatMatchDate(match.scheduledAt)}</span>
              )}
            </span>
            {match.teams.map((team, slot) => {
              const score = teamScore(match, slot);
              return (
                <span key={slot} className={`cv-pt-fixture-team${match.winner === slot ? " is-winner" : ""}`}>
                  <span>{team.name}</span>
                  {score && (
                    <span>
                      {score.runs} <small>({score.overs})</small>
                    </span>
                  )}
                </span>
              );
            })}
            {match.resultText && <span className="cv-pt-fixture-result">{match.resultText}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
