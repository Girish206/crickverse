import { useState } from "react";
import { useStartCricketMatch } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch } from "../../../api/types";
import { Button } from "../../components/Button";
import type { NameOf } from "../stats";

// Toss + playing XI for both sides, then start. Each side defaults to its
// tournament roster; other squad players can be brought in.
export function MatchSetup({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const { data: tournament } = useCricketTournament(match.tournamentId);
  const startMatch = useStartCricketMatch();
  const [tossWinner, setTossWinner] = useState<number | null>(null);
  const [decision, setDecision] = useState<"bat" | "bowl" | null>(null);
  const [xi, setXi] = useState<[number[], number[]]>([match.teams[0].playerIds, match.teams[1].playerIds]);
  const [error, setError] = useState<string | null>(null);

  const rostered = new Set(match.teams.flatMap((team) => team.playerIds));
  const others = (tournament?.playerIds ?? []).filter((playerId) => !rostered.has(playerId));

  function toggle(slot: 0 | 1, playerId: number) {
    setXi((current) => {
      const next: [number[], number[]] = [[...current[0]], [...current[1]]];
      next[slot] = next[slot].includes(playerId)
        ? next[slot].filter((id) => id !== playerId)
        : [...next[slot], playerId];
      return next;
    });
  }

  function start() {
    if (tossWinner === null || decision === null) return setError("Record the toss first.");
    if (xi[0].length < 2 || xi[1].length < 2) return setError("Each side needs at least 2 players.");
    setError(null);
    startMatch.mutate({ id: match.id, tossWinner, tossDecision: decision, playerIds: xi });
  }

  return (
    <div className="cricket-setup">
      <section className="cricket-panel">
        <h2 className="cricket-section-title">Toss</h2>
        <label className="form-label">Won by</label>
        <div className="admin-segmented mb-3" role="radiogroup" aria-label="Toss won by">
          {match.teams.map((team, slot) => (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={tossWinner === slot}
              className={tossWinner === slot ? "active" : ""}
              onClick={() => setTossWinner(slot)}
            >
              {team.name}
            </button>
          ))}
        </div>
        <label className="form-label">Elected to</label>
        <div className="admin-segmented" role="radiogroup" aria-label="Elected to">
          {(["bat", "bowl"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={decision === choice}
              className={decision === choice ? "active" : ""}
              onClick={() => setDecision(choice)}
            >
              <i className={`fa-solid ${choice === "bat" ? "fa-baseball-bat-ball" : "fa-baseball"}`} aria-hidden="true"></i>{" "}
              {choice === "bat" ? "Bat" : "Bowl"}
            </button>
          ))}
        </div>
      </section>

      <div className="cricket-match-layout">
        {match.teams.map((team, index) => {
          const slot = index as 0 | 1;
          const otherXi = xi[1 - slot];
          const choices = [...team.playerIds, ...others].filter((playerId) => !otherXi.includes(playerId));
          return (
            <section className="cricket-panel" key={slot}>
              <div className="cricket-panel-head">
                <h2>
                  {team.name} — Playing XI ({xi[slot].length})
                </h2>
              </div>
              {choices.length === 0 ? (
                <div className="admin-empty-state">No players on this team — generate the tournament's teams first.</div>
              ) : (
                <div className="cricket-squad-grid">
                  {choices.map((playerId) => (
                    <label
                      key={playerId}
                      className={`cricket-check cricket-squad-item ${xi[slot].includes(playerId) ? "is-in" : ""}`}
                    >
                      <input type="checkbox" checked={xi[slot].includes(playerId)} onChange={() => toggle(slot, playerId)} />
                      <span className="cricket-player-name">{nameOf(playerId)}</span>
                      {!team.playerIds.includes(playerId) && <small className="cricket-set-tag">squad</small>}
                    </label>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {error && <div className="admin-banner admin-banner-error">{error}</div>}
      <div className="d-flex justify-content-end">
        <Button variant="primary" onClick={start} disabled={startMatch.isPending}>
          <i className="fa-solid fa-play" aria-hidden="true"></i> Start Match
        </Button>
      </div>
    </div>
  );
}
