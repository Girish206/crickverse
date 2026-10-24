import { useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAddCricketTeams, useCricketTournament, useSetCricketTournamentScorers } from "../../../api/hooks/cricket/useCricketTournaments";
import { isGeneratedTeam, type CricketMatch, type CricketTournament } from "../../../api/types";
import { avatarColorFor } from "../avatarColor";
import { pointsTable } from "../stats";
import { AutoNextRounds } from "../format/AutoNextRounds";
import { ListCard } from "../../components/ListCard";
import { PageHeader, PageHeaderAction } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { BottomSheet } from "../BottomSheet";
import { CricketTournamentForm } from "./CricketTournamentForm";
import { defaultTeamNames, ExistingTeamPicker, MAX_TEAMS, TeamForm } from "./CricketTeamTools";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { canManageTournament } from "../canManage";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { CricketMatchForm } from "../matches/CricketMatchForm";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { FormatView } from "../format/FormatView";
import { TournamentBanner } from "./TournamentBanner";
import { TournamentInfo } from "./TournamentInfo";
import { TournamentStats } from "./TournamentStats";
import { FollowHeaderAction } from "../follow/FollowButton";
import { ScorersSheet } from "../ScorersSheet";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

type Tab = "info" | "teams" | "matches" | "points" | "stats" | "totals";

// How the teams are filled: generated from matched sets, or built by hand
// (new teams or copies of other tournaments' teams).

type TeamModal = { kind: "new" } | { kind: "existing" };

// Same underlined, sticky tabs as the match page.
const TABS: { value: Tab; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "matches", label: "Matches" },
  { value: "teams", label: "Teams" },
  { value: "points", label: "Standings" },
  { value: "stats", label: "Leaderboard" },
  { value: "totals", label: "Stats" },
];

function sameMembers(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

// The Teams tab: one card per team — initial, name, player count and
// record — opening the team's own page (CricketTeamPage).
// Organisers also see whether each team was generated or built by hand.
function TeamCards({
  tournament,
  matches,
  showKind = false,
}: {
  tournament: CricketTournament;
  matches: CricketMatch[];
  showKind?: boolean;
}) {
  const record = new Map(pointsTable(tournament, matches).map((row) => [row.teamIndex, row]));
  return (
    <div className="cricket-team-cards">
      {tournament.teams.map((team, teamIndex) => {
        const row = record.get(teamIndex);
        return (
          <Link key={teamIndex} to={`/tournaments/${tournament.id}/teams/${teamIndex}`} className="cricket-team-card">
            <span className="cricket-team-card-logo" style={{ background: avatarColorFor(team.name) }} aria-hidden="true">
              {team.name.charAt(0).toUpperCase()}
            </span>
            <span className="cricket-team-card-text">
              <strong>
                {team.name}
                {showKind && <span className="cricket-role-tag">{isGeneratedTeam(team) ? "Auto" : "Manual"}</span>}
              </strong>
              <small>
                {team.playerIds.length} player{team.playerIds.length === 1 ? "" : "s"}
                {row && row.played > 0 && ` · W${row.won} L${row.lost} · ${row.points} pts`}
              </small>
            </span>
            <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </Link>
        );
      })}
    </div>
  );
}

export function CricketTournamentPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: tournament, isLoading } = useCricketTournament(id);
  const setScorers = useSetCricketTournamentScorers();
  const addTeams = useAddCricketTeams();
  const [teamModal, setTeamModal] = useState<TeamModal | null>(null);

  const [editing, setEditing] = useState(false);
  const [pickingScorers, setPickingScorers] = useState(false);
  const [schedulingMatch, setSchedulingMatch] = useState(false);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.value === requested) ? requested : "info";
  const { data: matches } = useCricketMatches(id);
  // Players see their tournament read-only; its creator and super admins
  // manage it.
  const { admin } = useAdminAuth();
  const canManage = canManageTournament(admin, tournament);

  const backTo = admin?.isSuperAdmin ? "/tournaments" : "/my-tournaments";

  if (isLoading || !tournament) {
    return (
      <>
        <PageHeader title="Tournament" back={backTo} />
        {isLoading ? (
          <Loader page />
        ) : (
          <ListCard title="Tournament">
            <p>Tournament not found.</p>
          </ListCard>
        )}
      </>
    );
  }

  const teamCount = tournament.teams.length;
  const generatedTeams = tournament.teams.filter(isGeneratedTeam);
  const onManualTeam = new Set(tournament.teams.filter((team) => !isGeneratedTeam(team)).flatMap((team) => team.playerIds));
  // Generating fills only the generated teams, from the matched players
  // not on a hand-built team.
  const matchedIds = tournament.matchSets.flatMap((set) => set.playerIds).filter((id) => !onManualTeam.has(id));
  const generatedPlayerIds = generatedTeams.flatMap((team) => team.playerIds);
  // Generating reshuffles the generated teams, so it's only offered until the first
  // match is scheduled (with no teams yet there are no matches either).
  const canAutoBuild = (matches ?? []).length === 0;
  const teamsOutdated =
    canAutoBuild && tournament.generatedAt !== null && !sameMembers(generatedPlayerIds, matchedIds);

  // Generating needs at least two generated teams (hand-built ones don't
  // count), so the builder starts with them (more can be added there) and
  // opens straight on the steps.
  async function openTeamBuilder() {
    const missing = 2 - generatedTeams.length;
    if (missing > 0) {
      const names = defaultTeamNames(tournament!, missing);
      try {
        await addTeams.mutateAsync({ id: tournament!.id, teams: names.map((name) => ({ name, playerIds: [] })) });
      } catch {
        return; // Shown as a toast.
      }
    }
    navigate(`/tournaments/${tournament!.id}/create-teams`);
  }

  return (
    <div className="cricket-page">
      <AutoNextRounds tournamentId={tournament.id} />
      <PageHeader
        title={tournament.name}
        subtitle="Tournament"
        back={backTo}
        backLabel={admin?.isSuperAdmin ? "All tournaments" : "My tournaments"}
        actions={
          <>
            <FollowHeaderAction target={{ kind: "tournament", targetId: tournament.id, teamIndex: null }} />
            {canManage && (
              <>
                <PageHeaderAction icon="fa-solid fa-user-pen" label="Scorers" onClick={() => setPickingScorers(true)} />
                <PageHeaderAction icon="fa-solid fa-pen" label="Edit tournament" onClick={() => setEditing(true)} />
              </>
            )}
          </>
        }
      />
      {/* Banner + tabs: one header that stays pinned on phones. */}
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <TournamentBanner tournament={tournament} />
        </div>
  
        <div className="cricket-match-tabs" role="tablist" aria-label="Tournament sections">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={tab === t.value ? "active" : ""}
              onClick={() => setParams({ tab: t.value }, { replace: true, state: location.state })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "info" && (
        <ListCard>
          <TournamentInfo tournament={tournament} matches={matches ?? []} />
        </ListCard>
      )}

      {tab === "teams" && !canManage && (
        <ListCard>
          {teamCount === 0 ? (
            <div className="admin-empty-state">The teams haven't been picked yet.</div>
          ) : (
            <TeamCards tournament={tournament} matches={matches ?? []} />
          )}
        </ListCard>
      )}

      {tab === "teams" && canManage && (
        <>
        <ListCard>
          {teamCount === 0 ? (
            <div className="admin-empty-state">No teams yet — create them automatically or add them by hand below.</div>
          ) : (
            <>
              {teamsOutdated && (
                <div className="admin-banner admin-banner-error mb-3">
                  The matched sets have changed since the teams were generated. Open the team builder and regenerate to include the changes.
                </div>
              )}
              <TeamCards tournament={tournament} matches={matches ?? []} showKind />
            </>
          )}
        </ListCard>

        <ListCard title="Add Teams">
          <p className="admin-hint">
            {canAutoBuild ? "Build balanced teams from matched players, make" : "Make"} a new team and pick its players, or
            bring in a team from another tournament.
          </p>
          <div className="cricket-add-team-actions">
            {canAutoBuild && (
              <Button variant="primary" disabled={addTeams.isPending} onClick={openTeamBuilder}>
                <i className="fa-solid fa-shuffle" aria-hidden="true"></i> {tournament.generatedAt ? "Team builder" : "Auto create"}
              </Button>
            )}
            <Button
              variant={canAutoBuild ? "outline" : "primary"}
              disabled={teamCount >= MAX_TEAMS}
              onClick={() => setTeamModal({ kind: "new" })}
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i> New team
            </Button>
            <Button variant="outline" disabled={teamCount >= MAX_TEAMS} onClick={() => setTeamModal({ kind: "existing" })}>
              <i className="fa-solid fa-people-group" aria-hidden="true"></i> Existing team
            </Button>
          </div>
        </ListCard>

        </>
      )}

      {tab === "matches" && (
        <ListCard
          action={
            canManage ? (
              <Button variant="primary" onClick={() => setSchedulingMatch(true)}>
                + Schedule
              </Button>
            ) : undefined
          }
        >
          <MatchesBoard matches={matches ?? []} onNew={canManage ? () => setSchedulingMatch(true) : undefined} />
        </ListCard>
      )}

      {tab === "points" && (
        <ListCard>
          <FormatView tournament={tournament} matches={matches ?? []} canManage={canManage} />
        </ListCard>
      )}

      {tab === "stats" && (
        <ListCard>
          <LeaderboardGrid matches={matches ?? []} />
        </ListCard>
      )}

      {tab === "totals" && (
        <ListCard>
          <TournamentStats matches={matches ?? []} />
        </ListCard>
      )}

      {schedulingMatch && (
        <BottomSheet
          title="Schedule Match"
          icon="fa-solid fa-baseball-bat-ball"
          onClose={() => setSchedulingMatch(false)}
          wide
          fullScreen
        >
          <CricketMatchForm tournamentId={tournament.id} onSaved={() => setSchedulingMatch(false)} />
        </BottomSheet>
      )}

      {teamModal && (
        <BottomSheet
          title={teamModal.kind === "new" ? "New Team" : "Choose From Existing Teams"}
          onClose={() => setTeamModal(null)}
          wide
        >
          {teamModal.kind === "existing" ? (
            <ExistingTeamPicker tournament={tournament} onSaved={() => setTeamModal(null)} />
          ) : (
            <TeamForm tournament={tournament} onSaved={() => setTeamModal(null)} />
          )}
        </BottomSheet>
      )}

      {editing && (
        <BottomSheet title="Edit Tournament" onClose={() => setEditing(false)} wide>
          <CricketTournamentForm existing={tournament} onSaved={() => setEditing(false)} />
        </BottomSheet>
      )}
      {pickingScorers && (
        <ScorersSheet
          title="Tournament Scorers"
          note="Scorers can edit and score every match in this tournament. Each match's captains can already score it."
          scorerIds={tournament.scorerIds}
          squads={tournament.teams}
          saving={setScorers.isPending}
          onSave={(playerIds) => setScorers.mutateAsync({ id: tournament.id, playerIds })}
          onClose={() => setPickingScorers(false)}
        />
      )}
    </div>
  );
}
