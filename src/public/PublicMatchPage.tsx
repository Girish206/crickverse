import { useLayoutEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { isNotPublic, usePublicMatch, type PublicMatchData } from "../api/hooks/cricket/useCricketPublic";
import { useNameOf } from "./publicNames";
import { ListCard } from "../admin/components/ListCard";
import { ShareSheet } from "../admin/cricket/ShareMenu";
import { logoFor } from "../admin/cricket/tournaments/tournamentArt";
import { BallBurst } from "../admin/cricket/matches/BallBurst";
import { BallByBall, Scorecard } from "../admin/cricket/matches/Scorecard";
import { LiveView } from "../admin/cricket/matches/LiveView";
import { MatchHero } from "../admin/cricket/matches/MatchHero";
import { MatchInfo } from "../admin/cricket/matches/MatchInfo";
import { MatchInsights } from "../admin/cricket/matches/MatchInsights";
import { MatchMvp } from "../admin/cricket/matches/MatchMvp";
import { MatchSquads } from "../admin/cricket/matches/MatchSquads";
import { MatchStatusBadge } from "../admin/cricket/matches/matchUi";
import { PublicShell, PublicState } from "./PublicShell";
import "../admin/dms/css/adminDisplays.css";
import "../admin/admin.css";
import "../admin/cricket/cricket.css";

type Tab = "info" | "live" | "scorecard" | "insights" | "overs" | "squads" | "mvp";

// /matches/:id for someone signed out (a shared link to a public match):
// the same tabs a signed-in follower sees on CricketMatchPage — Live,
// Scorecard, Insights, Overs, Squads, MVP — read-only, without the scorer
// or the match settings. While live it follows along every few seconds
// (usePublicMatch).
export function PublicMatchPage({ id }: { id: number }) {
  const { data, isLoading, error, refetch } = usePublicMatch(id);
  const queryClient = useQueryClient();

  // The match's components look up photos and squads in the shared player
  // list, which needs sign-in: hand them the players this match brought.
  // Before paint, so nothing shows without them.
  const players = data?.players;
  useLayoutEffect(() => {
    if (players) queryClient.setQueryData(["cricket-players"], players);
  }, [players, queryClient]);
  useLayoutEffect(() => () => queryClient.removeQueries({ queryKey: ["cricket-players"], exact: true }), [queryClient]);

  if (!data) {
    return (
      <PublicState
        loading={isLoading}
        error={error}
        // A bad id ("/matches/abc") can't be anyone's match: same screen.
        notPublic={isNotPublic(error) || !(id > 0)}
        what="match"
        onRetry={() => void refetch()}
      />
    );
  }
  return (
    <PublicShell>
      <div className="cricket-module">
        <MatchView data={data} />
      </div>
    </PublicShell>
  );
}

function MatchView({ data: { match, tournament, players } }: { data: PublicMatchData }) {
  const nameOf = useNameOf(players);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [sharing, setSharing] = useState(false);

  const upcoming = match.status === "scheduled";
  const live = match.status === "live";
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
  const fallback: Tab = upcoming ? "info" : "live";
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && tabs.some((t) => t.value === requested) ? requested : fallback;

  return (
    <div className="cricket-page">
      {/* A four, six or wicket plays over the page, as for signed-in followers. */}
      <BallBurst match={match} nameOf={nameOf} />

      {/* Tournament logo, the match's status over its title, and Share. The
          card below names both teams, so the title is the tournament's
          name, except while live, when the card is left out. */}
      <header className="cv-pm-head">
        {/* The match's status rides on the logo as a small tag. */}
        <div className="cv-pm-logo-wrap">
          {tournament ? (
            <img className="cv-pm-logo" src={logoFor(tournament)} alt="" />
          ) : (
            <span className="cv-pm-logo is-icon" aria-hidden="true">
              <i className="fa-solid fa-baseball-bat-ball"></i>
            </span>
          )}
          <MatchStatusBadge status={match.status} />
        </div>
        <div className="cv-pm-head-title">
          {/* A small caps label over the title, as in the app's page headers. */}
          {(live || tournament) && (
            <small className="cv-pm-eyebrow">{live ? tournament?.name ?? "Match" : "Tournament"}</small>
          )}
          <h1>
            {live ? (
              `${match.teams[0].name} vs ${match.teams[1].name}`
            ) : (
              tournament?.name ?? "Match"
            )}
          </h1>
          {tournament?.isPublic && (
            <Link to={`/tournaments/${tournament.id}`} className="cv-pm-head-link">
              View tournament <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </Link>
          )}
        </div>
        <button type="button" className="cv-pm-share" aria-label="Share match" title="Share match" onClick={() => setSharing(true)}>
          <i className="fa-solid fa-share-nodes" aria-hidden="true"></i>
        </button>
      </header>

      {/* While it's live the Live tab shows the score, so the card is left out. */}
      {!live && <MatchHero match={match} />}

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
        {tab === "info" && <MatchInfo match={match} tournament={tournament ?? undefined} />}
        {tab === "live" && <LiveView match={match} nameOf={nameOf} />}
        {tab === "scorecard" && <Scorecard match={match} nameOf={nameOf} />}
        {tab === "insights" && <MatchInsights match={match} nameOf={nameOf} />}
        {tab === "overs" && <BallByBall match={match} nameOf={nameOf} />}
        {tab === "squads" && <MatchSquads match={match} nameOf={nameOf} />}
        {tab === "mvp" && <MatchMvp match={match} nameOf={nameOf} />}
      </ListCard>

      {sharing && (
        <ShareSheet
          heading="Share match"
          path={`/matches/${match.id}`}
          title={`${match.teams[0].name} vs ${match.teams[1].name}`}
          text={`${match.status === "live" ? "LIVE: " : ""}${match.teams[0].name} vs ${match.teams[1].name}${tournament ? ` · ${tournament.name}` : ""}`}
          image={tournament ? logoFor(tournament) : undefined}
          note="Anyone with the link can watch — no sign-in needed."
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
