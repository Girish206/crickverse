import { useState } from "react";
import { toast } from "sonner";
import { useDeclareCricketResult } from "../../../../api/hooks/cricket/useCricketMatches";
import type { CricketMatch, CricketResultMethod } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import { ChipChoice } from "../../CricketChoices";
import { METHODS_FOR, RESULT_METHODS, previewResult, type ResultOutcome } from "./resultText";

const OUTCOMES: { value: ResultOutcome; label: string }[] = [
  { value: "win", label: "Win" },
  { value: "tie", label: "Tie" },
  { value: "no-result", label: "No result" },
];

export interface ResultSheetStart {
  outcome?: ResultOutcome;
  method?: CricketResultMethod;
}

// Organisers enter a result by hand: a super over, a walkover or forfeit,
// rain (DLS, or no result)… Any innings still going ends as it stands.
export function ResultSheet({
  match,
  start,
  onClose,
}: {
  match: CricketMatch;
  start?: ResultSheetStart;
  onClose: () => void;
}) {
  const declare = useDeclareCricketResult();
  const [outcome, setOutcome] = useState<ResultOutcome>(start?.outcome ?? "win");
  const [winner, setWinner] = useState<number | null>(match.winner);
  const [method, setMethod] = useState<CricketResultMethod>(start?.method ?? (match.status === "scheduled" ? "walkover" : "other"));
  const [margin, setMargin] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Keeps the method one the outcome allows.
  function pickOutcome(next: ResultOutcome) {
    setOutcome(next);
    setError(null);
    if (!METHODS_FOR[next].includes(method)) setMethod("other");
  }

  const preview = previewResult(match, outcome, winner, method, margin);
  // The super over's line has no margin; a no result's text is the reason.
  const showMargin = outcome === "no-result" || (outcome === "win" && method !== "super-over");

  async function save() {
    if (outcome === "win" && winner === null) return setError("Pick the winner.");
    setError(null);
    try {
      await declare.mutateAsync({
        id: match.id,
        outcome,
        winner: outcome === "win" ? winner : null,
        method,
        margin: showMargin ? margin.trim() || null : null,
      });
    } catch {
      return setError("Couldn't save the result — try again.");
    }
    toast.success("Result saved");
    onClose();
  }

  return (
    <BottomSheet
      title="Enter result"
      icon="fa-solid fa-flag-checkered"
      onClose={onClose}
      footer={
        <button type="button" className="cricket-sheet-submit" disabled={declare.isPending} onClick={save}>
          <i className="fa-solid fa-check" aria-hidden="true"></i> Save result
        </button>
      }
    >
      {match.status === "live" && (
        <p className="cricket-sheet-context">The innings in progress ends as it stands, and scoring stops.</p>
      )}
      <div className="cricket-result-form">
        <ChipChoice label="Outcome" required options={OUTCOMES} value={outcome} onChange={(v) => v && pickOutcome(v)} />
        {outcome === "win" && (
          <ChipChoice
            label="Winner"
            required
            options={match.teams.map((team, slot) => ({ value: String(slot), label: team.name }))}
            value={winner === null ? null : String(winner)}
            onChange={(v) => {
              setWinner(v === null ? null : Number(v));
              setError(null);
            }}
          />
        )}
        {outcome !== "no-result" && (
          <ChipChoice
            label="How it was decided"
            required
            options={RESULT_METHODS.filter((m) => METHODS_FOR[outcome].includes(m.value))}
            value={method}
            onChange={(v) => v && setMethod(v)}
          />
        )}
        {showMargin && (
          <label className="cricket-field">
            <span className="cricket-field-label">{outcome === "no-result" ? "Reason (optional)" : "Margin (optional)"}</span>
            <input
              className="form-control shadow-none"
              maxLength={60}
              placeholder={outcome === "no-result" ? "e.g. rain" : "e.g. by 12 runs"}
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
            />
          </label>
        )}
      </div>
      {preview && (
        <p className="cricket-result-preview">
          <small>It will read</small>
          <strong>{preview}</strong>
        </p>
      )}
      {error && <div className="admin-banner admin-banner-error mt-3">{error}</div>}
    </BottomSheet>
  );
}
