import { useEffect, useRef, useState } from "react";
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useCricketMatch,
  useDeleteCricketMatch,
  useScoringSeat,
  useSetCricketMatchScorers,
  useUpdateCricketMatch,
} from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import { ListCard } from "../../components/ListCard";
import { PageHeader, PageHeaderAction } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { matchAccess } from "../canManage";
import { ScorersSheet } from "../ScorersSheet";
import { BottomSheet } from "../BottomSheet";
import { CricketMatchForm } from "./CricketMatchForm";
import { confirmAction, confirmDelete } from "../../components/confirmDelete";
import { LiveScorer } from "./LiveScorer";
import { BallByBall, Scorecard } from "./Scorecard";
import { MatchHero } from "./MatchHero";
import { MatchStatusBadge } from "./matchUi";
import { MatchAwards } from "./MatchAwards";
import { PotmPicker } from "./PotmPicker";
import { MatchInfo } from "./MatchInfo";
import { MatchInsights } from "./MatchInsights";
import { LiveView } from "./LiveView";
import { MatchMvp } from "./MatchMvp";
import { MatchSquads } from "./MatchSquads";
import { RescheduleSheet } from "./RescheduleSheet";
import { formatMatchDate, usePlayerNames } from "./matchUtils";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

type Tab = "info" | "live" | "scorecard" | "insights" | "overs" | "squads" | "mvp";

export function CricketMatchPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { data: match, isLoading } = useCricketMatch(id);
  const { data: tournament } = useCricketTournament(match?.tournamentId ?? 0, Boolean(match?.tournamentId));
  const deleteMatch = useDeleteCricketMatch();
  const setScorers = useSetCricketMatchScorers();
  const [pickingScorers, setPickingScorers] = useState(false);
  // The top bar's settings: changing players, details, scorers, ending...
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const detailsForm = useRef<HTMLFormElement>(null);
  const updateMatch = useUpdateCricketMatch();
  const nameOf = usePlayerNames();
  // Others follow along read-only (scorecard + ball by ball). Its
  // organisers, both captains and its scorers edit and score it; only the
  // organisers delete it, and they and the captains pick the scorers.
  const { admin } = useAdminAuth();
  const { data: me } = useCricketMe();
  const access = matchAccess(admin, match, tournament, me?.player?.id);
  const canManage = access !== null;
  // Several people may be allowed to score, but only one does at a time:
  // the first to open the Live tab, until they hand it over or stop. The
  // rest follow the live view. (A live match opens on Live.)
  const onLiveTab = (params.get("tab") ?? "live") === "live";
  const seat = useScoringSeat(match, canManage && onLiveTab, admin?.sub);
  const [handingOver, setHandingOver] = useState(false);
  // The scorer can't just walk away: leaving the match asks them to hand
  // scoring over (or stop) first. Tab changes stay on the page, so they pass.
  const guarding = match?.status === "live" && seat.mine;
  const leaving = useBlocker(
    ({ currentLocation, nextLocation }) => guarding && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!guarding) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [guarding]);
  // /matches is super admin only; players have their own list.
  const matchesList = admin?.isSuperAdmin ? "/matches" : "/my-matches";

  if (isLoading || !match) {
    return (
      <>
        <PageHeader title="Match" back={matchesList} />
        {isLoading ? (
          <Loader page />
        ) : (
          <ListCard title="Match">
            <p>Match not found.</p>
          </ListCard>
        )}
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
      navigate(matchesList);
    }
  }

  // The scorer is open: its own options (players, end innings, abandon)
  // join the settings sheet, which it renders.
  const scoring = tab === "live" && canManage && match.status === "live" && seat.mine;
  // While they're scoring the settings are mostly about that, so they open on Live.
  function openSettings() {
    if (match!.status === "live" && tab !== "live" && seat.mine) {
      setParams({ tab: "live" }, { replace: true, state: location.state });
    }
    setSettingsOpen(true);
  }
  const closeSettings = () => setSettingsOpen(false);
  const settingsThen = (action: () => void) => () => {
    closeSettings();
    action();
  };

  // The match's own options, under the scorer's in the settings sheet.
  const matchSettings = (
    <>
      <h3 className="cricket-sheet-label">Match</h3>
      <div className="cricket-settings-list">
        {seat.mine && match.status === "live" && (
          <>
            <button type="button" className="cricket-settings-item" onClick={settingsThen(() => setHandingOver(true))}>
              <i className="fa-solid fa-people-arrows" aria-hidden="true"></i>
              <span>
                Hand over scoring
                <small>Pass it to someone from either squad, or by mobile number</small>
              </span>
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
            <button type="button" className="cricket-settings-item" onClick={settingsThen(handleStopScoring)}>
              <i className="fa-solid fa-circle-stop" aria-hidden="true"></i>
              <span>
                Stop scoring
                <small>Leave it free for any of the match's scorers to pick up</small>
              </span>
            </button>
          </>
        )}
        {upcoming && (
          <button type="button" className="cricket-settings-item" onClick={settingsThen(() => setRescheduling(true))}>
            <i className="fa-regular fa-calendar" aria-hidden="true"></i>
            <span>
              Reschedule match
              <small>{match.scheduledAt ? `Now ${formatMatchDate(match.scheduledAt)}` : "Set a date and time"}</small>
            </span>
            <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
        )}
        {(upcoming || match.status === "live") && (
          <button
            type="button"
            className="cricket-settings-item"
            onClick={settingsThen(() => (upcoming ? navigate(`/matches/${match.id}/setup`) : setEditingDetails(true)))}
          >
            <i className="fa-solid fa-pen" aria-hidden="true"></i>
            <span>
              Edit match details
              <small>Overs, ground, date and match type</small>
            </span>
            <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
        )}
        {(access === "organise" || access === "captain") && (
          <button type="button" className="cricket-settings-item" onClick={settingsThen(() => setPickingScorers(true))}>
            <i className="fa-solid fa-user-pen" aria-hidden="true"></i>
            <span>
              Change scorers
              <small>
                {match.scorerIds.length === 0
                  ? "Only the organisers and captains so far"
                  : `${match.scorerIds.length} scorer${match.scorerIds.length === 1 ? "" : "s"} added`}
              </small>
            </span>
            <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
        )}
        {access === "organise" && (
          <button
            type="button"
            className="cricket-settings-item is-danger"
            disabled={deleteMatch.isPending}
            onClick={settingsThen(handleDelete)}
          >
            <i className="fa-solid fa-trash" aria-hidden="true"></i>
            <span>
              Delete match
              <small>Removes it and its scores for good</small>
            </span>
          </button>
        )}
      </div>
    </>
  );

  // Only an organiser can take the scorer from someone (say their phone
  // died); everyone else waits for it to be handed over.
  async function handleTakeOver() {
    if (
      await confirmAction(
        "Take over scoring?",
        `${seat.holder} will stop scoring and see the live view instead.`,
        "Take over",
      )
    ) {
      // Lost a race: the banner shows whoever has it now.
      await seat.takeOver().catch(() => undefined);
    }
  }

  async function handleStopScoring() {
    if (
      await confirmAction(
        "Stop scoring?",
        "Any of the match's scorers can then pick it up from the Live tab.",
        "Stop scoring",
      )
    ) {
      // A failure shows its own toast; stay put.
      return seat.release().then(
        () => true,
        () => false,
      );
    }
    return false;
  }

  async function handOver(playerId: number) {
    try {
      await seat.handOver(playerId);
    } catch {
      // The toast says why (e.g. they haven't signed in yet); pick again.
      return;
    }
    setHandingOver(false);
    if (leaving.state === "blocked") leaving.proceed();
  }

  return (
    <div className={`cricket-page ${canManage && upcoming ? "has-action-bar" : ""}`.trim()}>
      <PageHeader
        title={`${match.teams[0].name} vs ${match.teams[1].name}`}
        subtitle={tournament?.name ?? "Match"}
        back={match.tournamentId === null ? matchesList : `/tournaments/${match.tournamentId}?tab=matches`}
        backLabel={match.tournamentId === null ? "Back to matches" : "Back to tournament"}
        actions={
          <>
            {canManage && <PageHeaderAction icon="fa-solid fa-sliders" label="Match settings" onClick={openSettings} />}
            <MatchStatusBadge status={match.status} />
          </>
        }
      />
      {/* While it's live the Live tab shows the score, so the card is left out. */}
      {match.status !== "live" && <MatchHero match={match} nameOf={nameOf} />}

      <div className="cricket-match-tabs" role="tablist" aria-label="Match sections">
        {tabs.map((t) => (
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

      <ListCard title="" bodyClassName={tab === "live" ? "cricket-live-body" : undefined}>
        {tab === "info" && <MatchInfo match={match} tournament={tournament} />}
        {tab === "live" &&
          (!canManage ? (
            <LiveView match={match} nameOf={nameOf} />
          ) : match.status === "live" && !seat.mine ? (
            <>
              {seat.holder && (
                <div className="admin-banner cricket-seat-banner mb-3">
                  <span>
                    <i className="fa-solid fa-user-lock" aria-hidden="true"></i> <strong>{seat.holder}</strong> is scoring
                    this match. Only one person scores at a time — they can hand it over to you.
                  </span>
                  {access === "organise" && (
                    <Button variant="outline" onClick={handleTakeOver} disabled={seat.busy}>
                      <i className="fa-solid fa-hand" aria-hidden="true"></i> Take over scoring
                    </Button>
                  )}
                </div>
              )}
              <LiveView match={match} nameOf={nameOf} />
            </>
          ) : match.status === "live" ? (
            <LiveScorer
              match={match}
              nameOf={nameOf}
              settingsOpen={settingsOpen}
              onCloseSettings={closeSettings}
              matchSettings={matchSettings}
            />
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

      {settingsOpen && !scoring && (
        <BottomSheet title="Match settings" icon="fa-solid fa-sliders" onClose={closeSettings}>
          {matchSettings}
        </BottomSheet>
      )}

      {leaving.state === "blocked" && !handingOver && (
        <BottomSheet title="You're scoring this match" icon="fa-solid fa-user-lock" onClose={() => leaving.reset()}>
          <p className="cricket-sheet-context">
            No one else can score while you have it. Hand it over before you leave, or stop scoring so another scorer
            can pick it up.
          </p>
          <div className="cricket-settings-list">
            <button type="button" className="cricket-settings-item" onClick={() => setHandingOver(true)}>
              <i className="fa-solid fa-people-arrows" aria-hidden="true"></i>
              <span>
                Hand over and leave
                <small>Choose who scores next</small>
              </span>
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              className="cricket-settings-item"
              disabled={seat.busy}
              onClick={async () => {
                if (await handleStopScoring()) leaving.proceed();
              }}
            >
              <i className="fa-solid fa-circle-stop" aria-hidden="true"></i>
              <span>
                Stop scoring and leave
                <small>Any of the match's scorers can pick it up</small>
              </span>
            </button>
            <button type="button" className="cricket-settings-item" onClick={() => leaving.reset()}>
              <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i>
              <span>
                Keep scoring
                <small>Stay on this match</small>
              </span>
            </button>
          </div>
        </BottomSheet>
      )}

      {handingOver && (
        <ScorersSheet
          title="Hand over scoring"
          note="Pick who scores next — from either squad, or by mobile number. They need to have signed in to CrickVerse; you'll follow the live view."
          scorerIds={match.scorerIds}
          squads={match.teams}
          saving={false}
          onSave={async () => undefined}
          onClose={() => setHandingOver(false)}
          handOver={{ excludeIds: me?.player ? [me.player.id] : [], onPick: handOver }}
        />
      )}

      {editingDetails && (
        <BottomSheet
          title="Match details"
          icon="fa-solid fa-pen"
          wide
          onClose={() => setEditingDetails(false)}
          footer={
            <button
              type="button"
              className="cricket-sheet-submit"
              disabled={updateMatch.isPending}
              onClick={() => detailsForm.current?.requestSubmit()}
            >
              <i className="fa-solid fa-check" aria-hidden="true"></i> Save details
            </button>
          }
        >
          <CricketMatchForm existing={match} formRef={detailsForm} onSaved={() => setEditingDetails(false)} />
        </BottomSheet>
      )}

      {rescheduling && <RescheduleSheet match={match} onClose={() => setRescheduling(false)} />}

      {pickingScorers && (
        <ScorersSheet
          title="Match Scorers"
          note="Both captains can already edit and score this match. Add anyone else who will score it."
          scorerIds={match.scorerIds}
          squads={match.teams}
          saving={setScorers.isPending}
          onSave={(playerIds) => setScorers.mutateAsync({ id: match.id, playerIds })}
          onClose={() => setPickingScorers(false)}
        />
      )}

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
