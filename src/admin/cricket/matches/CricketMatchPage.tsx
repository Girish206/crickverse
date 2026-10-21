import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCricketMatch, useDeleteCricketMatch } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import { ListCard } from "../../components/ListCard";
import { PageHeader, PageHeaderAction } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { confirmDelete } from "../../components/confirmDelete";
import { LiveScorer } from "./LiveScorer";
import { BallByBall, Scorecard } from "./Scorecard";
import { MatchHero } from "./MatchHero";
import { MatchAwards } from "./MatchAwards";
import { PotmPicker } from "./PotmPicker";
import { MatchInfo } from "./MatchInfo";
import { MatchInsights } from "./MatchInsights";
import { LiveView } from "./LiveView";
import { MatchMvp } from "./MatchMvp";
import { MatchSquads } from "./MatchSquads";
import { usePlayerNames } from "./matchUtils";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

type Tab = "info" | "live" | "scorecard" | "insights" | "overs" | "squads" | "mvp";

export function CricketMatchPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: match, isLoading } = useCricketMatch(id);
  const { data: tournament } = useCricketTournament(match?.tournamentId ?? 0, Boolean(match));
  const deleteMatch = useDeleteCricketMatch();
  const nameOf = usePlayerNames();
  // Players follow along read-only (scorecard + ball by ball).
  const { admin } = useAdminAuth();
  const canManage = Boolean(admin?.isSuperAdmin);

  if (isLoading || !match) {
    return (
      <>
        <PageHeader title="Match" back={canManage ? "/matches" : "/my-matches"} />
        <ListCard title="Match">
          <p>{isLoading ? "Loading..." : "Match not found."}</p>
        </ListCard>
      </>
    );
  }

  // Same tabs as CricHeroes. "Live" is the scorer for the organiser and a
  // read-only view for players; once it's over it becomes "Summary". An
  // upcoming match only has Info and Squads — editing and setup start from
  // the bottom action bar.
  const upcoming = match.status === "scheduled";
  const over = match.status === "completed" || match.status === "abandoned";
  const tabs: { value: Tab; label: string }[] = upcoming
    ? [
        { value: "info", label: "Info" },
        { value: "squads", label: "Squads" },
      ]
    : [
        { value: "info", label: "Info" },
        { value: "live", label: over ? "Summary" : "Live" },
        { value: "scorecard", label: "Scorecard" },
        { value: "insights", label: "Insights" },
        { value: "overs", label: "Overs" },
        { value: "squads", label: "Squads" },
        { value: "mvp", label: "MVP" },
      ];
  const fallback: Tab = match.status === "live" ? "live" : "info";
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && tabs.some((t) => t.value === requested) ? requested : fallback;

  async function handleDelete() {
    if (await confirmDelete("match", `${match!.teams[0].name} vs ${match!.teams[1].name}`)) {
      await deleteMatch.mutateAsync(match!.id);
      navigate("/matches");
    }
  }

  return (
    <div className={`cricket-page ${canManage && upcoming ? "has-action-bar" : ""}`.trim()}>
      <PageHeader
        title={`${match.teams[0].name} vs ${match.teams[1].name}`}
        subtitle={tournament?.name ?? "Match"}
        back={`/tournaments/${match.tournamentId}?tab=matches`}
        backLabel="Back to tournament"
        actions={
          canManage && (
            <PageHeaderAction
              icon="fa-solid fa-trash"
              label="Delete match"
              danger
              disabled={deleteMatch.isPending}
              onClick={handleDelete}
            />
          )
        }
      />
      <MatchHero match={match} nameOf={nameOf} />

      <div className="cricket-match-tabs" role="tablist" aria-label="Match sections">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={tab === t.value ? "active" : ""}
            onClick={() => setParams({ tab: t.value }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ListCard title="">
        {tab === "info" && <MatchInfo match={match} tournament={tournament} />}
        {tab === "live" &&
          (!canManage ? (
            <LiveView match={match} nameOf={nameOf} />
          ) : match.status === "live" ? (
            <LiveScorer match={match} nameOf={nameOf} />
          ) : (
            <div className="cricket-summary">
              {match.resultText && <div className="admin-banner admin-banner-success mb-3">{match.resultText}</div>}
              <MatchAwards match={match} nameOf={nameOf} />
              {match.status === "completed" && <PotmPicker match={match} nameOf={nameOf} />}
            </div>
          ))}
        {tab === "scorecard" && <Scorecard match={match} nameOf={nameOf} />}
        {tab === "insights" && <MatchInsights match={match} nameOf={nameOf} />}
        {tab === "overs" && <BallByBall match={match} nameOf={nameOf} />}
        {tab === "squads" && <MatchSquads match={match} tournament={tournament} nameOf={nameOf} />}
        {tab === "mvp" && <MatchMvp match={match} nameOf={nameOf} />}
      </ListCard>

      {canManage && upcoming && (
        <div className="cricket-action-bar">
          <Button variant="primary" onClick={() => navigate(`/matches/${match.id}/setup`)}>
            <i className="fa-solid fa-pen" aria-hidden="true"></i> Edit / Start Scoring
          </Button>
        </div>
      )}
    </div>
  );
}
