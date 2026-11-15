import { useState } from "react";
import { BottomSheet } from "../../BottomSheet";
import { PlayerAvatar } from "../../players/PlayerAvatar";
import { RunChoice } from "./RunChoice";

type Batter = { id: number; name: string; photoUrl: string | null };

// A short run: the batters ran, but one of them didn't make their ground at
// the turn. That run isn't scored, but they end up where the running left
// them — two run with one short scores 1 and the striker keeps strike. The
// scorer confirms who faces next (the system's guess picked), in case the
// batters ended up otherwise.
export function ShortRunSheet({
  bowler,
  striker,
  nonStriker,
  overEnds,
  busy,
  onRecord,
  onClose,
}: {
  bowler: string;
  striker: Batter;
  // Null when the batter is alone at the crease.
  nonStriker: Batter | null;
  // This ball finishes the over (the ends change again after it).
  overEnds: boolean;
  busy: boolean;
  onRecord: (ball: { runs: number; shortRuns: number }, nextStrikerId: number) => void;
  onClose: () => void;
}) {
  const [ran, setRan] = useState(2);
  const [short, setShort] = useState(1);
  const shortRuns = Math.min(short, ran);
  const scored = ran - shortRuns;
  // Who the system will put on strike: odd runs run change ends, and so
  // does the end of the over.
  const swaps = (ran % 2 === 1) !== overEnds;
  const expected = swaps && nonStriker ? nonStriker : striker;
  const [picked, setPicked] = useState<number | null>(null);
  const nextStrikerId = picked ?? expected.id;
  const batters = nonStriker ? [striker, nonStriker] : [striker];

  return (
    <BottomSheet
      title="Short run"
      icon="fa-solid fa-person-running"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="cricket-sheet-submit"
          onClick={() => onRecord({ runs: scored, shortRuns }, nextStrikerId)}
          disabled={busy}
        >
          <i className="fa-solid fa-check" aria-hidden="true"></i> Record {scored} run{scored === 1 ? "" : "s"}
        </button>
      }
    >
      <div className="cricket-short-run">
        <p className="cricket-sheet-context mb-0">
          <i className="fa-solid fa-baseball" aria-hidden="true"></i> {bowler} to {striker.name}
        </p>
        <span className="cricket-sheet-label">How many runs did they run?</span>
        <RunChoice
          value={ran}
          onChange={(n) => {
            setRan(n);
            setShort((s) => Math.min(s, n));
            setPicked(null);
          }}
          min={1}
          max={4}
        />
        <span className="cricket-sheet-label">How many were short?</span>
        <RunChoice
          value={shortRuns}
          onChange={(n) => {
            setShort(n);
            setPicked(null);
          }}
          min={1}
          max={Math.min(ran, 3)}
        />
        <p className="cricket-short-run-sum" aria-live="polite">
          {ran} ran − {shortRuns} short ={" "}
          <strong>
            {scored} run{scored === 1 ? "" : "s"}
          </strong>{" "}
          {scored === 1 ? "counts" : "count"}
        </p>
        <div className="cricket-short-run-strike">
          <span className="cricket-sheet-label">{overEnds ? "On strike next over" : "On strike next"}</span>
          <div className="cricket-short-run-batters" role="radiogroup" aria-label="On strike next">
            {batters.map((batter) => {
              const on = nextStrikerId === batter.id;
              return (
                <button
                  key={batter.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`cricket-short-run-batter ${on ? "is-on" : ""}`.trim()}
                  onClick={() => setPicked(batter.id)}
                >
                  <PlayerAvatar
                    name={batter.name}
                    photoUrl={batter.photoUrl}
                    className="cricket-short-run-avatar"
                    viewable={false}
                    eager
                  />
                  <span className="cricket-short-run-batter-check" aria-hidden="true">
                    {on && <i className="fa-solid fa-check"></i>}
                  </span>
                  <span className="cricket-short-run-batter-caption">
                    {on && (
                      <span className="cricket-short-run-batter-tag">
                        <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> On strike
                      </span>
                    )}
                    <span className="cricket-short-run-batter-name">{batter.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
