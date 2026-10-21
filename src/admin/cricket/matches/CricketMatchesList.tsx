import { useState } from "react";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch, CricketMatchStatus } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import { Button } from "../../components/Button";
import { BottomSheet } from "../BottomSheet";
import SelectInput from "../../dms/components/SelectInput";
import { CricketKpis } from "../CricketKpis";
import { CricketMatchForm } from "./CricketMatchForm";
import { MatchCard } from "./matchUi";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

type Filter = "all" | CricketMatchStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

// Status filter + card grid, shared by the Matches page and a tournament's
// Matches tab.
export function MatchesBoard({
  matches,
  tournamentNames,
  onNew,
  footnote,
}: {
  matches: CricketMatch[];
  tournamentNames?: Map<number, string>;
  onNew?: () => void;
  footnote?: (match: CricketMatch) => string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = matches.filter(
    (match) => filter === "all" || match.status === filter || (filter === "completed" && match.status === "abandoned"),
  );
  return (
    <>
      <div className="cricket-squad-toolbar">
        <div className="admin-segmented cricket-tabs" role="tablist" aria-label="Match status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={filter === f.value ? "active" : ""}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="admin-empty-state">
          {matches.length === 0 ? "No matches scheduled yet." : "No matches here."}
          {onNew && matches.length === 0 && (
            <div className="mt-2">
              <Button variant="primary" onClick={onNew}>
                + Schedule a match
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="cricket-match-grid">
          {visible.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              tournamentName={tournamentNames?.get(match.tournamentId)}
              footnote={footnote?.(match)}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function CricketMatchesList() {
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const { data: matches, isLoading } = useCricketMatches(tournamentId ?? undefined);
  const { data: tournaments } = useCricketTournaments();
  const [creating, setCreating] = useState(false);
  const tournamentNames = new Map((tournaments ?? []).map((t) => [t.id, t.name]));
  const all = matches ?? [];

  return (
    <ListCard
      title="Matches"
      action={
        <Button variant="primary" onClick={() => setCreating(true)} disabled={!tournaments?.length}>
          + Schedule
        </Button>
      }
    >
      <CricketKpis
        items={[
          { label: "Matches", value: all.length, icon: "fa-calendar-days", tone: "total" },
          { label: "Live now", value: all.filter((m) => m.status === "live").length, icon: "fa-tower-broadcast", tone: "active" },
          { label: "Upcoming", value: all.filter((m) => m.status === "scheduled").length, icon: "fa-clock", tone: "login" },
          {
            label: "Completed",
            value: all.filter((m) => m.status === "completed" || m.status === "abandoned").length,
            icon: "fa-flag-checkered",
            tone: "guest",
          },
        ]}
      />
      <div className="cricket-filter-select">
        <SelectInput
          label="Tournament"
          size="sm"
          options={(tournaments ?? []).map((t) => ({ value: t.id, label: t.name }))}
          value={tournamentId ?? ""}
          onChange={(value) => setTournamentId(value || null)}
        />
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : !tournaments?.length ? (
        <div className="admin-empty-state">Create a tournament and its teams first, then schedule matches.</div>
      ) : (
        <MatchesBoard matches={all} tournamentNames={tournamentNames} onNew={() => setCreating(true)} />
      )}

      {creating && (
        <BottomSheet title="Schedule Match" onClose={() => setCreating(false)} wide>
          <CricketMatchForm tournamentId={tournamentId ?? undefined} onSaved={() => setCreating(false)} />
        </BottomSheet>
      )}
    </ListCard>
  );
}
