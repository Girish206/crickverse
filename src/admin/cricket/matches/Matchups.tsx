import { useState } from "react";
import type { CricketMatch } from "../../../api/types";
import { matchupsOf, type Matchup } from "../analytics";
import { PillSelect } from "../PillSelect";
import { strikeRate, type NameOf } from "../stats";
import "./analysis.css";

type View = "batter" | "bowler";

const VIEWS: { value: View; label: string }[] = [
  { value: "batter", label: "Batter v bowler" },
  { value: "bowler", label: "Bowler v batter" },
];

// Who had whose number in this match, either way round: a batter against
// each bowler they faced, or a bowler against each batter they bowled to,
// in the order they met. Narrow it to one side, then to one of its players;
// it opens on the match's first ball (its batter, or its bowler).
export function Matchups({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const [view, setView] = useState<View>("batter");
  // null = not picked yet (the first ball's player); "" = both sides / everyone.
  const [pickedTeam, setTeam] = useState<string | null>(null);
  const [pickedPlayer, setPlayer] = useState<string | null>(null);
  const every = matchupsOf(match);
  if (every.length === 0) return null;

  const batting = view === "batter";
  // The side a row belongs to in this view: the batter's, or the bowler's.
  const sideOf = (r: Matchup) => (batting ? r.battingTeam : 1 - r.battingTeam);
  const playerOf = (r: Matchup) => (batting ? r.batterId : r.bowlerId);
  const opponentOf = (r: Matchup) => (batting ? r.bowlerId : r.batterId);

  const first = every[0];
  const team = pickedTeam ?? String(sideOf(first));
  const player = pickedPlayer ?? (pickedTeam === null ? String(playerOf(first)) : "");

  const ofTeam = team === "" ? every : every.filter((r) => String(sideOf(r)) === team);
  const players = [...new Set(ofTeam.map(playerOf))];
  const rows = player === "" ? ofTeam : ofTeam.filter((r) => String(playerOf(r)) === player);
  const sides = [...new Set(every.map(sideOf))].sort();

  function switchView(next: View) {
    setView(next);
    setTeam(null);
    setPlayer(null);
  }

  // OUT for the bowler's wicket; a run out, retired hurt and the like by its
  // name, in a quieter colour, as the bowler didn't take it.
  const outTag = (r: Matchup, lead: boolean) =>
    r.out ? (
      <span className="cricket-matchup-out" title="Bowler got them out">
        {lead ? " · " : ""}OUT
      </span>
    ) : (
      r.otherOut && (
        <span className="cricket-matchup-other-out" title="Not the bowler's wicket">
          {lead ? " · " : ""}
          {r.otherOut}
        </span>
      )
    );

  return (
    <section className="cricket-awards">
      <h2 className="cricket-section-title">
        <i className="fa-solid fa-user-group" aria-hidden="true"></i>
        <span className="cricket-insight-heading">
          Match-ups
          <small>Who had whose number</small>
        </span>
      </h2>
      <div className="admin-segmented cricket-tabs cricket-matchup-views" role="tablist" aria-label="Match-ups">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={view === v.value}
            className={view === v.value ? "active" : ""}
            onClick={() => switchView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="cricket-matchup-filters">
        <PillSelect
          label={batting ? "Batting team" : "Bowling team"}
          value={team}
          options={[
            { value: "", label: "Both teams" },
            ...sides.map((i) => ({ value: String(i), label: match.teams[i]?.name ?? `Team ${i + 1}` })),
          ]}
          onChange={(value) => {
            setTeam(value);
            setPlayer("");
          }}
        />
        <PillSelect
          label={batting ? "Batter" : "Bowler"}
          value={player}
          options={[
            { value: "", label: batting ? "All batters" : "All bowlers" },
            ...players.map((id) => ({ value: String(id), label: nameOf(id) })),
          ]}
          onChange={setPlayer}
        />
      </div>
      <div className="admin-table-wrap">
        <table className="cricket-table cricket-impact-table">
          <thead>
            <tr>
              <th>{player !== "" ? (batting ? "Bowler" : "Batter") : batting ? "Batter v Bowler" : "Bowler v Batter"}</th>
              <th>R</th>
              <th>B</th>
              <th title="Dot balls">0s</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.batterId}:${r.bowlerId}`}>
                <td>
                  {/* One player picked: their name is in the pill, so each row names only the other. */}
                  {player === "" ? (
                    <>
                      <span className="fw-semibold">{nameOf(playerOf(r))}</span>
                      <small className="cricket-impact-team">
                        v {nameOf(opponentOf(r))}
                        {outTag(r, true)}
                      </small>
                    </>
                  ) : (
                    <>
                      <span className="fw-semibold">{nameOf(opponentOf(r))}</span>
                      {(r.out || r.otherOut) && <small className="cricket-impact-team">{outTag(r, false)}</small>}
                    </>
                  )}
                </td>
                <td>{r.runs}</td>
                <td>{r.balls}</td>
                <td>{r.dots}</td>
                <td>{r.fours}</td>
                <td>{r.sixes}</td>
                <td>{strikeRate(r.runs, r.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
