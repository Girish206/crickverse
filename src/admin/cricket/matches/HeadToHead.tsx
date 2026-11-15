import { Link } from "react-router-dom";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import type { CricketMatch } from "../../../api/types";
import { headToHead } from "../analytics";
import { scoreText } from "../stats";
import "./analysis.css";

const SHOWN = 5;

// The two sides' earlier meetings: wins each, then the last few results.
// Looked up among the tournament's matches, or (super admins) every one-off;
// `canListOneOffs` says whether that second list can be fetched.
export function HeadToHead({ match, canListOneOffs }: { match: CricketMatch; canListOneOffs: boolean }) {
  const inTournament = match.tournamentId !== null;
  const { data: matches } = useCricketMatches(match.tournamentId ?? "none", { enabled: inTournament || canListOneOffs });
  if (!matches) return null;
  const h2h = headToHead(match, matches);
  if (h2h.matches.length === 0) return null;
  const [a, b] = match.teams.map((t) => t.name);
  const played = h2h.matches.length;

  return (
    <section className="cricket-awards cricket-h2h">
      <h2 className="cricket-section-title">
        <i className="fa-solid fa-code-compare" aria-hidden="true"></i> Head to head
        <small className="cricket-h2h-sub">{inTournament ? "in this tournament" : "one-off matches"}</small>
      </h2>
      <div className="cricket-h2h-tally">
        <div>
          <strong>{h2h.wins[0]}</strong>
          <span>{a}</span>
        </div>
        <div className="cricket-h2h-mid">
          <small>
            {played} played{h2h.noResult > 0 ? ` · ${h2h.noResult} tied / NR` : ""}
          </small>
          <div className="cricket-h2h-bar" aria-hidden="true">
            <span className="is-a" style={{ flexGrow: h2h.wins[0] || 0.0001 }}></span>
            <span className="is-n" style={{ flexGrow: h2h.noResult }}></span>
            <span className="is-b" style={{ flexGrow: h2h.wins[1] || 0.0001 }}></span>
          </div>
        </div>
        <div>
          <strong>{h2h.wins[1]}</strong>
          <span>{b}</span>
        </div>
      </div>
      <ul className="cricket-h2h-list">
        {h2h.matches.slice(0, SHOWN).map((m) => (
          <li key={m.id}>
            <Link to={`/matches/${m.id}`}>
              <span>{m.resultText ?? (m.status === "abandoned" ? "No result" : "Finished")}</span>
              <small>{m.innings.map((inn) => `${m.teams[inn.battingTeam].name} ${scoreText(inn)}`).join(" · ")}</small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
