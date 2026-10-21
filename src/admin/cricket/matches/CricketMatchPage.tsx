import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useCricketMatch,
  useDeleteCricketMatch,
  useSetCricketPlayerOfMatch,
} from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import { ListCard } from "../../components/ListCard";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { confirmDelete } from "../../components/confirmDelete";
import DefaultModal from "../../dms/components/DefaultModal";
import SelectInput from "../../dms/components/SelectInput";
import { CricketMatchForm } from "./CricketMatchForm";
import { LiveScorer } from "./LiveScorer";
import { MatchSetup } from "./MatchSetup";
import { BallByBall, Scorecard } from "./Scorecard";
import { MatchHero } from "./MatchHero";
import { MatchAwards } from "./MatchAwards";
import { MatchInfo } from "./MatchInfo";
import { MatchInsights } from "./MatchInsights";
import { LiveView } from "./LiveView";
import { MatchMvp } from "./MatchMvp";
import { MatchSquads } from "./MatchSquads";
import { matchImpact, tookPart } from "../stats";
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
  const setPlayerOfMatch = useSetCricketPlayerOfMatch();
  const nameOf = usePlayerNames();
  const [editing, setEditing] = useState(false);
  // Players follow along read-only (scorecard + ball by ball).
  const { admin } = useAdminAuth();
  const canManage = Boolean(admin?.isSuperAdmin);

  if (isLoading || !match) {
    return (
      <ListCard title="Match">
        <p>{isLoading ? "Loading..." : "Match not found."}</p>
      </ListCard>
    );
  }

  // Same tabs as CricHeroes. "Live" (before and during the match) is the
  // setup / scorer for the organiser and a read-only view for players; once
  // it's over it becomes "Summary".
  const over = match.status === "completed" || match.status === "abandoned";
  const tabs: { value: Tab; label: string }[] = [
    { value: "info", label: "Info" },
    { value: "live", label: over ? "Summary" : "Live" },
    { value: "scorecard", label: "Scorecard" },
    { value: "insights", label: "Insights" },
    { value: "overs", label: "Overs" },
    { value: "squads", label: "Squads" },
    { value: "mvp", label: "MVP" },
  ];
  const fallback: Tab = match.status === "live" || (canManage && match.status === "scheduled") ? "live" : "info";
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && tabs.some((t) => t.value === requested) ? requested : fallback;

  async function handleDelete() {
    if (await confirmDelete("match", `${match!.teams[0].name} vs ${match!.teams[1].name}`)) {
      await deleteMatch.mutateAsync(match!.id);
      navigate("/matches");
    }
  }

  const players = match.teams.flatMap((team) => team.playerIds);
  const autoPotm = match.status === "completed" ? (matchImpact(match).find(tookPart)?.playerId ?? null) : null;

  return (
    <div className="cricket-page">
      <MatchHero
        match={match}
        tournamentName={tournament?.name}
        nameOf={nameOf}
        onEdit={canManage && match.status === "scheduled" ? () => setEditing(true) : undefined}
        onDelete={canManage ? handleDelete : undefined}
      />

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
          ) : match.status === "scheduled" ? (
            <MatchSetup match={match} nameOf={nameOf} />
          ) : match.status === "live" ? (
            <LiveScorer match={match} nameOf={nameOf} />
          ) : (
            <div className="cricket-summary">
              {match.resultText && <div className="admin-banner admin-banner-success mb-3">{match.resultText}</div>}
              <MatchAwards match={match} nameOf={nameOf} />
              {match.status === "completed" && (
                <div className="cricket-summary-potm">
                  <SelectInput
                    label="Override player of the match"
                    placeholder={autoPotm !== null ? `Auto: ${nameOf(autoPotm)}` : "Auto"}
                    options={players.map((playerId) => ({ value: playerId, label: nameOf(playerId) }))}
                    value={match.playerOfMatchId ?? ""}
                    onChange={(value) => setPlayerOfMatch.mutate({ id: match.id, playerId: value || null })}
                  />
                  <p className="admin-hint mb-0">Leave empty to use the top impact score.</p>
                </div>
              )}
            </div>
          ))}
        {tab === "scorecard" && <Scorecard match={match} nameOf={nameOf} />}
        {tab === "insights" && <MatchInsights match={match} nameOf={nameOf} />}
        {tab === "overs" && <BallByBall match={match} nameOf={nameOf} />}
        {tab === "squads" && <MatchSquads match={match} tournament={tournament} nameOf={nameOf} />}
        {tab === "mvp" && <MatchMvp match={match} nameOf={nameOf} />}
      </ListCard>

      {editing && (
        <DefaultModal
          title="Edit Match"
          onClose={() => setEditing(false)}
          showFooter={false}
          size="lg"
          component={<CricketMatchForm existing={match} onSaved={() => setEditing(false)} />}
        />
      )}
    </div>
  );
}
