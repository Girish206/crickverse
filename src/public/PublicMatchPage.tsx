import { useLayoutEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { isNotPublic, usePublicMatch, type PublicMatchData } from "../api/hooks/cricket/useCricketPublic";
import { useNameOf } from "./publicNames";
import { ListCard } from "../admin/components/ListCard";
import { ShareSheet } from "../admin/cricket/ShareMenu";
import { logoFor } from "../admin/cricket/tournaments/tournamentArt";
import { BallBurst } from "../admin/cricket/matches/BallBurst";
import { Scorecard } from "../admin/cricket/matches/Scorecard";
import { LiveView } from "../admin/cricket/matches/LiveView";
import { MatchHero } from "../admin/cricket/matches/MatchHero";
import { MatchInfo } from "../admin/cricket/matches/MatchInfo";
import { MatchStatusBadge } from "../admin/cricket/matches/matchUi";
import { PublicShell, PublicState } from "./PublicShell";
import "../admin/dms/css/adminDisplays.css";
import "../admin/admin.css";
import "../admin/cricket/cricket.css";
import { useSwipeTabs } from "../admin/useSwipeTabs";
import { SwipePanels } from "../admin/SwipePanels";

type Tab = "info" | "live" | "scorecard" | "insights" | "overs" | "squads" | "mvp";

// What a signed-out visitor sees is the score; the rest is a reason to sign in.
const LOCKED_TABS: ReadonlySet<Tab> = new Set(["insights", "overs", "squads", "mvp"]);

// /matches/:id for someone signed out (a shared link to a public match):
// the same tabs a signed-in follower sees on CricketMatchPage, read-only.
// Info, Live and Scorecard are open; Insights, Overs, Squads and MVP ask
// them to sign in (LOCKED_TABS). While live it follows along every few
// seconds (usePublicMatch).
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
  const swipeRef = useSwipeTabs(tabs.map((t) => t.value), tab, (value) =>
    setParams({ tab: value }, { replace: true, state: location.state })
  );

  return (
    <div className="cricket-page">
      {/* A four, six or wicket plays over the page, as for signed-in followers. */}
      <BallBurst match={match} nameOf={nameOf} />

      {/* Tournament logo, the match's status over its title, and Share. The
          card below names both teams, so the title is the tournament's
          name, except while live (when the card is left out) or for a
          standalone match, which has no other name. */}
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
          <small className="cv-pm-eyebrow">{live ? tournament?.name ?? "Match" : tournament ? "Tournament" : "Match"}</small>
          <h1>{live || !tournament ? `${match.teams[0].name} vs ${match.teams[1].name}` : tournament.name}</h1>
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

      <div ref={swipeRef} className="cricket-match-tabs" role="tablist" aria-label="Match sections">
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
            {LOCKED_TABS.has(t.value) && <i className="fa-solid fa-lock cv-pm-tab-lock" aria-label="Sign in to see"></i>}
          </button>
        ))}
      </div>

      <SwipePanels swipe={swipeRef} values={tabs.map((t) => t.value)} current={tab} eager>
        {(tab) => (
          <ListCard title="" bodyClassName={tab === "live" ? "cricket-live-body" : undefined}>
            {tab === "info" && <MatchInfo match={match} tournament={tournament ?? undefined} />}
            {tab === "live" && <LiveView match={match} nameOf={nameOf} />}
            {tab === "scorecard" && <Scorecard match={match} nameOf={nameOf} />}
            {LOCKED_TABS.has(tab) && <SignInToSee label={tabs.find((t) => t.value === tab)!.label} tab={tab} />}
          </ListCard>
        )}
      </SwipePanels>

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

// In place of a locked tab: sign in, and come straight back to this tab.
function SignInToSee({ label, tab }: { label: string; tab: Tab }) {
  const from = `${useLocation().pathname}?tab=${tab}`;
  return (
    <div className="cv-pm-locked">
      <i className="fa-solid fa-lock cv-public-lock" aria-hidden="true"></i>
      <h2>Sign in to see {label}</h2>
      <p>Insights, ball-by-ball overs, squads and the MVP are for signed-in fans. It's free, and you'll come straight back here.</p>
      <Link to="/login" state={{ from }} className="cv-shell-btn is-primary">
        <i className="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Sign in
      </Link>
    </div>
  );
}
