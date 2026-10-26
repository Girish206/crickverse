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
import { Loader } from "../../components/Loader";

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
  counts = false,
}: {
  matches: CricketMatch[];
  tournamentNames?: Map<number, string>;
  onNew?: () => void;
  footnote?: (match: CricketMatch) => string | null;
  // Show how many matches each tab holds (My Matches).
  counts?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  // Oldest first (by start time; undated ones by when they were made), so
  // they read in the order they're played.
  const visible = matches
    .filter((match) => filter === "all" || match.status === filter || (filter === "completed" && match.status === "abandoned"))
    .sort((a, b) => (a.scheduledAt ?? a.createdAt).localeCompare(b.scheduledAt ?? b.createdAt));
  const countOf = (value: Filter) =>
    matches.filter((m) => value === "all" || m.status === value || (value === "completed" && m.status === "abandoned")).length;
  const list =
    visible.length === 0 ? (
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
            tournamentName={match.tournamentId === null ? undefined : tournamentNames?.get(match.tournamentId)}
            footnote={footnote?.(match)}
          />
        ))}
      </div>
    );
  return (
    <>
      <div className="cricket-squad-toolbar">
        <div className="admin-segmented cricket-tabs cricket-text-tabs" role="tablist" aria-label="Match status">
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
              {counts && <span className="cricket-tab-count">{countOf(f.value)}</span>}
            </button>
          ))}
        </div>
      </div>
      {list}
    </>
  );
}

export function CricketMatchesList() {
  // null = all matches, "none" = the standalone ones.
  const [tournamentId, setTournamentId] = useState<number | "none" | null>(null);
  const { data: matches, isLoading } = useCricketMatches(tournamentId ?? undefined);
  const { data: tournaments } = useCricketTournaments();
  const [creating, setCreating] = useState(false);
  const tournamentNames = new Map((tournaments ?? []).map((t) => [t.id, t.name]));
  const all = matches ?? [];

  return (
    <ListCard
      title="Matches"
      icon="fa-solid fa-calendar-days"
      subtitle="Fixtures, live games and results"
      plain
      action={
        <Button variant="primary" onClick={() => setCreating(true)}>
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
          options={[
            { value: "none", label: "No tournament" },
            ...(tournaments ?? []).map((t) => ({ value: t.id, label: t.name })),
          ]}
          value={tournamentId ?? ""}
          onChange={(value) => setTournamentId(value || null)}
        />
      </div>
      {isLoading ? (
        <Loader />
      ) : (
        <MatchesBoard matches={all} tournamentNames={tournamentNames} onNew={() => setCreating(true)} />
      )}

      {creating && (
        <BottomSheet
          title="Schedule Match"
          icon="fa-solid fa-baseball-bat-ball"
          onClose={() => setCreating(false)}
          wide
          fullScreen
        >
          <CricketMatchForm
            tournamentId={typeof tournamentId === "number" ? tournamentId : undefined}
            onSaved={() => setCreating(false)}
          />
        </BottomSheet>
      )}
    </ListCard>
  );
}
