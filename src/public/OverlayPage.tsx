import { useEffect, useLayoutEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ballsPerOverOf } from "../api/types";
import { usePublicMatch } from "../api/hooks/cricket/useCricketPublic";
import { winProbability } from "../admin/cricket/analytics";
import { BallBurst } from "../admin/cricket/matches/BallBurst";
import { BallCalls } from "../admin/cricket/matches/BallCalls";
import {
  ballChipClass,
  ballLabel,
  battingCard,
  bowlingCard,
  chaseInfo,
  inningsSummary,
  isFreeHitNext,
  oversOf,
  oversText,
  rate,
} from "../admin/cricket/stats";
import { useNameOf } from "./publicNames";
import "../admin/cricket/cricket.css";
import "./overlay.css";

const NO_PLAYERS: never[] = [];

// /overlay/:id — a scorebug for live streams: add it to OBS or Streamlabs as
// a Browser source (1920×1080) over the camera. A see-through page with the
// score along the bottom (?pos=top for the top), following the match ball by
// ball like a shared link (so the match, or its tournament, must be public).
// The four / six / wicket bursts play over it too; ?burst=0 leaves them out.
export function OverlayPage() {
  const id = Number(useParams().id);
  const [params] = useSearchParams();
  const { data, error } = usePublicMatch(id);
  const queryClient = useQueryClient();
  const players = data?.players;
  const nameOf = useNameOf(players ?? NO_PLAYERS);

  // The burst looks names up in the shared player list, as on the public page.
  useLayoutEffect(() => {
    if (players) queryClient.setQueryData(["cricket-players"], players);
  }, [players, queryClient]);

  // See-through, whatever the app's theme paints behind pages.
  useEffect(() => {
    document.documentElement.classList.add("cv-overlay-root");
    return () => document.documentElement.classList.remove("cv-overlay-root");
  }, []);

  if (!data) {
    return error ? <div className="cv-overlay-note">Overlay unavailable: is the match public?</div> : null;
  }
  const { match } = data;
  const top = params.get("pos") === "top";
  const innings = match.innings[match.innings.length - 1];
  const showBurst = params.get("burst") !== "0";

  if (!innings || match.status === "scheduled") {
    return (
      <div className={`cv-overlay ${top ? "is-top" : ""}`}>
        <div className="cv-overlay-bar is-simple">
          <strong>
            {match.teams[0].name} <span>vs</span> {match.teams[1].name}
          </strong>
          <span>Starting soon</span>
        </div>
      </div>
    );
  }

  const perOver = ballsPerOverOf(match);
  const summary = inningsSummary(innings, perOver);
  const chase = innings === match.innings[1] ? chaseInfo(match) : null;
  const batting = battingCard(innings);
  const bowler = bowlingCard(innings, perOver).find((r) => r.playerId === innings.bowlerId);
  const thisOver = oversOf(innings, perOver).at(-1);
  const odds = winProbability(match);
  const over = match.status !== "live";
  const team = match.teams[innings.battingTeam];
  const other = match.teams[1 - innings.battingTeam];

  return (
    <div className={`cv-overlay ${top ? "is-top" : ""}`}>
      {showBurst && <BallBurst match={match} nameOf={nameOf} />}
      <BallCalls match={match} nameOf={nameOf} />
      <div className="cv-overlay-bar">
        <div className="cv-overlay-score">
          <span className="cv-overlay-team">{team.name}</span>
          <strong>
            {summary.runs}-{summary.wickets}
          </strong>
          <small>{summary.overs} ov</small>
          {match.innings.length === 1 && <span className="cv-overlay-vs">v {other.name}</span>}
        </div>

        {over ? (
          <div className="cv-overlay-result">{match.resultText ?? "Match over"}</div>
        ) : (
          <>
            <div className="cv-overlay-batters">
              {[innings.strikerId, innings.nonStrikerId].map((playerId, i) => {
                if (playerId === null) return null;
                const row = batting.find((r) => r.playerId === playerId);
                return (
                  <span key={playerId} className={i === 0 ? "is-striker" : undefined}>
                    {nameOf(playerId)}
                    {i === 0 ? "*" : ""} <b>{row?.runs ?? 0}</b>
                    <small>({row?.balls ?? 0})</small>
                  </span>
                );
              })}
            </div>
            {innings.bowlerId !== null && (
              <div className="cv-overlay-bowler">
                <span>{nameOf(innings.bowlerId)}</span>
                <b>
                  {bowler?.wickets ?? 0}-{bowler?.runs ?? 0}
                </b>
                <small>{oversText(bowler?.legalBalls ?? 0, perOver)}</small>
              </div>
            )}
            <div className="cv-overlay-over" aria-label="This over">
              {thisOver?.balls.map((ball, i) => (
                <span key={i} className={ballChipClass(ball)}>
                  {ballLabel(ball)}
                </span>
              ))}
            </div>
            <div className="cv-overlay-status">
              {isFreeHitNext(match, innings) ? (
                <span className="cv-overlay-freehit">FREE HIT</span>
              ) : chase ? (
                <span>
                  Need <b>{Math.max(chase.need, 0)}</b> off <b>{chase.ballsLeft}</b>
                  {chase.ballsLeft > 0 && <small> · RRR {chase.requiredRate}</small>}
                </span>
              ) : (
                <span>CRR {rate(summary.runs, summary.legalBalls, perOver)}</span>
              )}
            </div>
          </>
        )}
      </div>
      {odds && !over && (
        <div className="cv-overlay-odds">
          <span style={{ width: `${odds.percent}%` }}>
            {match.teams[odds.chasing].name} {odds.percent}%
          </span>
          <span style={{ width: `${100 - odds.percent}%` }}>
            {100 - odds.percent}% {match.teams[1 - odds.chasing].name}
          </span>
        </div>
      )}
    </div>
  );
}
