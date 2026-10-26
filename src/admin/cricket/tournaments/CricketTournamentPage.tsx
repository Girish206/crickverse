import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useAddCricketTeams,
  useCricketTournament,
  useCricketTournaments,
  useDeleteCricketTournament,
  useSetCricketTournamentScorers,
  useUpdateCricketTournament,
} from "../../../api/hooks/cricket/useCricketTournaments";
import { sameTarget, useMyFollows } from "../../../api/hooks/cricket/useCricketFollows";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import { isGeneratedTeam, type CricketFollowTarget, type CricketMatch, type CricketTournament } from "../../../api/types";
import { confirmAction } from "../../components/confirmDelete";
import { avatarColorFor } from "../avatarColor";
import { pointsTable } from "../stats";
import { AutoNextRounds } from "../format/AutoNextRounds";
import { ListCard } from "../../components/ListCard";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { BottomSheet } from "../BottomSheet";
import { CricketTournamentForm, tournamentInputOf } from "./CricketTournamentForm";
import { confirmTournamentDelete } from "./confirmTournamentDelete";
import { OrganisersSheet } from "./OrganisersSheet";
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
import { ShareFixturesSheet, upcomingFixtures } from "./ShareFixturesSheet";
import { FollowButton, useFollowMenuItem } from "../follow/FollowButton";
import { SettingsMenu } from "../SettingsMenu";
import { ScorersSheet } from "../ScorersSheet";
import { ShareSheet } from "../ShareMenu";
import { useTips, type TipStep } from "../TipsTour";
import { logoFor } from "./tournamentArt";
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
        const generated = isGeneratedTeam(team);
        const kind = generated ? "Balanced by the app" : "Picked by hand";
        return (
          <Link key={teamIndex} to={`/tournaments/${tournament.id}/teams/${teamIndex}`} className="cricket-team-card">
            <span className="cricket-team-card-logo" style={{ background: avatarColorFor(team.name) }} aria-hidden="true">
              {team.name.charAt(0).toUpperCase()}
              {showKind && (
                <span className="cricket-team-card-kind" title={kind}>
                  <i className={`fa-solid ${generated ? "fa-wand-magic-sparkles" : "fa-hand"}`}></i>
                </span>
              )}
            </span>
            <span className="cricket-team-card-text">
              <strong>
                {team.name}
                {showKind && <span className="visually-hidden"> ({kind})</span>}
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

const TOURNAMENT_TIPS: TipStep[] = [
  {
    target: "tabs",
    title: "Everything about the tournament",
    text: "Switch between Info, Matches, Teams, Standings, the Leaderboard and Stats. Swipe the tabs sideways to see them all.",
  },
  {
    target: "settings",
    title: "Share, follow and settings",
    text: "Share the link (or the fixtures as a picture), and follow the tournament to see its matches on your Home. Organisers pick scorers and edit it here too. Show tips again from here any time.",
  },
];

// A tournament the viewer can't open (403): they're not in it and don't
// follow it. Its name comes from the open list, and following it opens it.
function TournamentLocked({ id, backTo }: { id: number; backTo: string }) {
  const queryClient = useQueryClient();
  const { data: tournaments } = useCricketTournaments();
  const { data: follows } = useMyFollows();
  const name = tournaments?.find((t) => t.id === id)?.name;
  const target: CricketFollowTarget = { kind: "tournament", targetId: id, teamIndex: null };
  const following = Boolean(follows?.follows.some((f) => sameTarget(f, target)));

  // Once followed, ask again — it opens now.
  useEffect(() => {
    if (!following) return;
    queryClient.invalidateQueries({ queryKey: ["cricket-tournaments", id] });
    queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list", id] });
  }, [following, id, queryClient]);

  return (
    <>
      <PageHeader title={name ?? "Tournament"} subtitle="Tournament" back={backTo} />
      <ListCard>
        <div className="admin-empty-state cricket-tour-locked">
          <i className="fa-solid fa-trophy" aria-hidden="true"></i>
          {name && <strong>{name}</strong>}
          <p>Follow this tournament to see its teams, matches and table.</p>
          {follows?.playerId ? (
            <FollowButton target={target} />
          ) : (
            <p className="admin-hint">Add your player profile to follow tournaments.</p>
          )}
        </div>
      </ListCard>
    </>
  );
}

export function CricketTournamentPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: tournament, isLoading, error } = useCricketTournament(id);
  const setScorers = useSetCricketTournamentScorers();
  const updateTournament = useUpdateCricketTournament();
  const deleteTournament = useDeleteCricketTournament();
  const [pickingOrganisers, setPickingOrganisers] = useState(false);
  const addTeams = useAddCricketTeams();
  const [teamModal, setTeamModal] = useState<TeamModal | null>(null);

  const [editing, setEditing] = useState(false);
  // The share sheet, opened from the settings sheet's Share row.
  const [sharing, setSharing] = useState(false);
  const [pickingScorers, setPickingScorers] = useState(false);
  const [schedulingMatch, setSchedulingMatch] = useState(false);
  const [sharingFixtures, setSharingFixtures] = useState(false);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.value === requested) ? requested : "info";
  const { data: matches } = useCricketMatches(id);
  // Players see their tournament read-only; its creator, co-organisers and
  // super admins manage it.
  const { admin } = useAdminAuth();
  const { data: me } = useCricketMe();
  const followItem = useFollowMenuItem({ kind: "tournament", targetId: id, teamIndex: null });
  const canManage = canManageTournament(admin, tournament, me?.player?.id);
  const tips = useTips("tournament", TOURNAMENT_TIPS, Boolean(tournament));

  const backTo = admin?.isSuperAdmin ? "/tournaments" : "/my-tournaments";

  // Not theirs to see (not in it, not following it): offer to follow it.
  if (!tournament && isAxiosError(error) && error.response?.status === 403) {
    return <TournamentLocked id={id} backTo={backTo} />;
  }

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
  const hasFixtures = upcomingFixtures(tournament, matches ?? []).length > 0;
  const teamsOutdated =
    canAutoBuild && tournament.generatedAt !== null && !sameMembers(generatedPlayerIds, matchedIds);

  // Generating needs at least two generated teams (hand-built ones don't
  // count), so the builder starts with them (more can be added there) and
  // opens straight on the steps.
  // Finished / reopened, and public or not: the update is a full PUT, so
  // the tournament's other details go with it unchanged.
  const finished = Boolean(tournament.finishedAt);
  const isPublic = Boolean(tournament.isPublic);
  async function toggleFinished() {
    const ok = finished
      ? await confirmAction("Reopen the tournament?", "It shows as ongoing again (or as its dates say).", "Reopen")
      : await confirmAction(
          "Mark the tournament finished?",
          "It shows as completed everywhere. Matches can still be scored, and you can reopen it any time.",
          "Mark finished",
        );
    if (!ok) return;
    try {
      await updateTournament.mutateAsync({ id: tournament!.id, ...tournamentInputOf(tournament!), finished: !finished });
      toast.success(finished ? "Tournament reopened" : "Tournament marked finished");
    } catch {
      // Shown as a toast.
    }
  }
  async function togglePublic() {
    try {
      await updateTournament.mutateAsync({ id: tournament!.id, ...tournamentInputOf(tournament!), isPublic: !isPublic });
      toast.success(isPublic ? "Only signed-in people can see it now" : "Anyone with the link can see it now");
    } catch {
      // Shown as a toast.
    }
  }
  async function removeTournament() {
    if (!(await confirmTournamentDelete(tournament!.name))) return;
    try {
      await deleteTournament.mutateAsync(tournament!.id);
      toast.success("Tournament deleted");
      navigate(backTo, { replace: true });
    } catch {
      // Shown as a toast.
    }
  }

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
      {tips.element}
      <PageHeader
        title={tournament.name}
        subtitle="Tournament"
        back={backTo}
        backLabel={admin?.isSuperAdmin ? "All tournaments" : "My tournaments"}
        actions={
          <>
            <SettingsMenu
              title="Tournament settings"
              items={[
                {
                  icon: "fa-solid fa-share-nodes",
                  label: "Share tournament",
                  description: hasFixtures ? "WhatsApp, Telegram, the link or a fixtures card" : "WhatsApp, Telegram or copy the link",
                  onClick: () => setSharing(true),
                },
                ...(followItem ? [followItem] : []),
                { icon: "fa-solid fa-lightbulb", label: "Show tips", onClick: tips.start },
                ...(canManage
                  ? [
                      {
                        icon: "fa-solid fa-clipboard-user",
                        label: "Scorers",
                        description: "Who can score this tournament's matches",
                        onClick: () => setPickingScorers(true),
                      },
                      {
                        icon: "fa-solid fa-user-tie",
                        label: "Co-organisers",
                        description: "Who runs this tournament with you",
                        onClick: () => setPickingOrganisers(true),
                      },
                      { icon: "fa-solid fa-pen", label: "Edit tournament", onClick: () => setEditing(true) },
                      {
                        icon: isPublic ? "fa-solid fa-earth-asia" : "fa-solid fa-lock",
                        label: isPublic ? "Anyone with the link can see it" : "Only signed-in people can see it",
                        description: isPublic
                          ? "Tap to need a sign-in again"
                          : "Tap to let anyone with the link see it, no sign-in needed",
                        disabled: updateTournament.isPending,
                        onClick: togglePublic,
                      },
                      finished
                        ? {
                            icon: "fa-solid fa-rotate-left",
                            label: "Reopen tournament",
                            description: "It's marked finished",
                            disabled: updateTournament.isPending,
                            onClick: toggleFinished,
                          }
                        : {
                            icon: "fa-solid fa-flag-checkered",
                            label: "Mark tournament finished",
                            description: "Shows it as completed",
                            disabled: updateTournament.isPending,
                            onClick: toggleFinished,
                          },
                      {
                        icon: "fa-solid fa-trash",
                        label: "Delete tournament",
                        danger: true,
                        disabled: deleteTournament.isPending,
                        onClick: removeTournament,
                      },
                    ]
                  : []),
              ]}
            />
          </>
        }
      />
      {/* Banner + tabs: one header that stays pinned on phones. */}
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <TournamentBanner tournament={tournament} matches={matches} />
        </div>
  
        <div className="cricket-match-tabs" role="tablist" aria-label="Tournament sections" data-tour="tabs">
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

      {/* The next round, once its teams are known, for the organiser to
          check and schedule. */}
      <AutoNextRounds tournamentId={tournament.id} card />

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

      {sharingFixtures && (
        <ShareFixturesSheet tournament={tournament} matches={matches ?? []} onClose={() => setSharingFixtures(false)} />
      )}
      {sharing && (
        <ShareSheet
          heading="Share tournament"
          path={`/tournaments/${tournament.id}`}
          title={tournament.name}
          text={`${tournament.name} on CricDesk`}
          image={logoFor(tournament)}
          note={
            isPublic
              ? "Anyone with the link can see it, even without signing in."
              : "People need to sign in to CricDesk to open this link."
          }
          items={
            hasFixtures
              ? [
                  {
                    icon: "fa-solid fa-calendar-days",
                    label: "Fixtures card",
                    description: "Upcoming matches and playoffs as a picture",
                    onClick: () => setSharingFixtures(true),
                  },
                ]
              : []
          }
          onClose={() => setSharing(false)}
        />
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
      {pickingOrganisers && <OrganisersSheet tournament={tournament} onClose={() => setPickingOrganisers(false)} />}
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
