import { useState } from "react";
import type { CricketMatch } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import { chaseStartBalls, dlsPar, dlsResources, minResultBalls, type Interruption } from "../../dls";
import { inningsSummary } from "../../stats";

// Rain stops play: the scorer says how many overs the batting side has now
// (both sides, in the first innings), or that there's no more play in this
// innings. The revised target (or the result on par) is shown before it's
// recorded; the API works it out the same way (Duckworth-Lewis Standard
// Edition, see dls.ts).
export function RainSheet({
  match,
  busy,
  onRecord,
  onClose,
}: {
  match: CricketMatch;
  busy: boolean;
  onRecord: (overs: number | null) => void;
  onClose: () => void;
}) {
  const index = match.innings.length - 1;
  const now = inningsSummary(match.innings[index]);
  const minOvers = Math.floor(now.legalBalls / 6) + 1;
  const [stop, setStop] = useState(false);
  const [overs, setOvers] = useState(Math.max(minOvers, match.overs - 1));
  const scheduled = match.scheduledOvers ?? match.overs;
  const unsupported =
    (match.ballsPerOver ?? 6) !== 6
      ? "The DLS method works with six-ball overs."
      : scheduled > 50
        ? "The DLS tables go up to 50 overs a side."
        : minOvers >= match.overs
          ? "The last over is under way — only “No more play” is left."
          : null;
  const noCut = minOvers >= match.overs;
  const ending = stop || noCut;

  // What recording it would do.
  const added: Interruption = {
    innings: index,
    balls: now.legalBalls,
    wickets: now.wickets,
    ballsLeftBefore: match.overs * 6 - now.legalBalls,
    ballsLeftAfter: ending ? 0 : overs * 6 - now.legalBalls,
  };
  const interruptions = [...(match.interruptions ?? []), added];
  const firstRuns = inningsSummary(match.innings[0]).runs;
  const team = match.teams[match.innings[index].battingTeam].name;
  let preview: string;
  if (index === 0) {
    preview = ending
      ? `${team}'s innings ends at ${now.runs}/${now.wickets}. The chase's DLS target is set when it starts.`
      : `Both sides now have ${overs} overs. The chase's DLS target is set once ${team}'s innings ends.`;
  } else {
    const { r1, r2 } = dlsResources(scheduled, chaseStartBalls(interruptions, ending ? match.overs : overs), interruptions);
    const par = dlsPar(firstRuns, r1, r2);
    if (!ending) {
      preview = `New target: ${par + 1} from ${overs} overs (${Math.max(par + 1 - now.runs, 0)} more needed).`;
    } else if (now.legalBalls < minResultBalls(scheduled)) {
      preview = `Too few overs faced for a DLS result — it ends as a no result.`;
    } else {
      const diff = now.runs - par;
      preview =
        diff === 0
          ? `Par is ${par}: level, so the match is tied (DLS).`
          : `Par is ${par}: ${team} ${diff > 0 ? "win" : "lose"} by ${Math.abs(diff)} run${Math.abs(diff) === 1 ? "" : "s"} (DLS).`;
    }
  }

  return (
    <BottomSheet
      title="Rain interruption"
      icon="fa-solid fa-cloud-rain"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="cricket-sheet-submit"
          disabled={busy || (Boolean(unsupported) && !noCut)}
          onClick={() => onRecord(ending ? null : overs)}
        >
          <i className="fa-solid fa-check" aria-hidden="true"></i> {ending ? "No more play" : `Cut to ${overs} overs`}
        </button>
      }
    >
      <p className="cricket-sheet-context">
        <i className="fa-solid fa-cloud-rain" aria-hidden="true"></i> <strong>{team}</strong> {now.runs}/{now.wickets}{" "}
        after {Math.floor(now.legalBalls / 6)}.{now.legalBalls % 6} of {match.overs} overs
      </p>
      {unsupported && !noCut ? (
        <div className="admin-banner admin-banner-error">{unsupported}</div>
      ) : (
        <>
          {!noCut && (
            <div className="cricket-chip-choice mb-3" role="radiogroup" aria-label="What happens">
              <button type="button" role="radio" aria-checked={!stop} className={!stop ? "active" : ""} onClick={() => setStop(false)}>
                Overs cut
              </button>
              <button type="button" role="radio" aria-checked={stop} className={stop ? "active" : ""} onClick={() => setStop(true)}>
                No more play
              </button>
            </div>
          )}
          {!ending && (
            <>
              <label className="cricket-sheet-label">{index === 0 ? "Overs per side now" : `Overs for ${team} now`}</label>
              <span className="cricket-app-stepper mb-3">
                <button type="button" aria-label="Fewer overs" disabled={overs <= minOvers} onClick={() => setOvers(overs - 1)}>
                  <i className="fa-solid fa-minus" aria-hidden="true"></i>
                </button>
                <input type="number" aria-label="Overs" value={overs} readOnly />
                <button
                  type="button"
                  aria-label="More overs"
                  disabled={overs >= match.overs - 1}
                  onClick={() => setOvers(overs + 1)}
                >
                  <i className="fa-solid fa-plus" aria-hidden="true"></i>
                </button>
              </span>
            </>
          )}
          <div className="cricket-rain-preview">
            <i className="fa-solid fa-calculator" aria-hidden="true"></i>
            <span>{preview}</span>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
