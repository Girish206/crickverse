import { useState } from "react";
import { useUpdateCricketMatch } from "../../../api/hooks/cricket/useCricketMatches";
import type { CricketMatch } from "../../../api/types";
import { BottomSheet } from "../BottomSheet";
import { existingInput, toLocalInput } from "./CricketMatchForm";
import { formatMatchDate } from "./matchUtils";

// Moves an upcoming match to a new date and time (and ground), leaving the
// rest of its details as they are.
export function RescheduleSheet({ match, onClose }: { match: CricketMatch; onClose: () => void }) {
  const updateMatch = useUpdateCricketMatch();
  const [when, setWhen] = useState(toLocalInput(match.scheduledAt));
  const [venue, setVenue] = useState(match.venue ?? "");
  const [error, setError] = useState<string | null>(null);
  const unchanged = when === toLocalInput(match.scheduledAt) && venue.trim() === (match.venue ?? "");

  async function save() {
    if (!when) return setError("Choose the new date and time.");
    setError(null);
    try {
      await updateMatch.mutateAsync({
        id: match.id,
        ...existingInput(match),
        scheduledAt: new Date(when).toISOString(),
        venue: venue.trim() || null,
      });
    } catch {
      return setError("Couldn't reschedule the match — try again.");
    }
    onClose();
  }

  return (
    <BottomSheet
      title="Reschedule match"
      icon="fa-regular fa-calendar"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="cricket-sheet-submit"
          disabled={updateMatch.isPending || unchanged}
          onClick={save}
        >
          <i className="fa-solid fa-check" aria-hidden="true"></i> Reschedule
        </button>
      }
    >
      <p className="cricket-sheet-context">
        {match.scheduledAt ? `Currently ${formatMatchDate(match.scheduledAt)}.` : "No date set yet."}
      </p>
      <div className="cricket-app-form">
        <div className="cricket-app-group">
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-regular fa-calendar" aria-hidden="true"></i> New date & time
            </span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-location-dot" aria-hidden="true"></i> Ground
            </span>
            <input type="text" value={venue} maxLength={150} placeholder="Ground" onChange={(e) => setVenue(e.target.value)} />
          </label>
        </div>
      </div>
      {error && <div className="admin-banner admin-banner-error mt-3">{error}</div>}
    </BottomSheet>
  );
}
