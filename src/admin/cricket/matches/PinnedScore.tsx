// "Pin score": one match's score floats over every screen of the app,
// following along ball by ball, until it's unpinned. Tapping it opens the
// match. The pin is remembered on this device. On desktop Chrome / Edge it
// can also pop out into a small always-on-top window (scoreWindow.ts), so it
// stays in view over other apps.

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ballsPerOverOf } from "../../../api/types";
import { useCricketMatch } from "../../../api/hooks/cricket/useCricketMatches";
import { inningsSummary } from "../stats";
import { battingOrder, formatMatchDate, matchStageLabel, matchStateLine, matchTeamColors } from "./matchUtils";
import { TeamMark } from "../teams/TeamMark";
import { setPinnedMatch, usePinnedMatch } from "./pinnedMatch";
import { canPopOutScore, closeScoreWindow, popOutScore, useScoreWindow } from "./scoreWindow";
import "./pinnedScore.css";

// Mounted once by the layout; shows nothing unless a match is pinned.
export function PinnedScore() {
  const id = usePinnedMatch();
  const popped = useScoreWindow();

  // Unpinned: the popped-out window goes too.
  useEffect(() => {
    if (id === null) closeScoreWindow();
  }, [id]);

  if (id === null) return null;
  return <PinnedScoreCard key={id} id={id} popped={popped} />;
}

function PinnedScoreCard({ id, popped }: { id: number; popped: Window | null }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: match, isError } = useCricketMatch(id);
  const drag = useDragAnywhere();

  // Gone (deleted, or no longer visible to this account): drop the pin.
  useEffect(() => {
    if (isError && !match) setPinnedMatch(null);
  }, [isError, match]);

  // Only live matches stay pinned. One that ends while it's on screen keeps
  // its result showing until it's closed; one found already over (or not
  // started) when the app opens is unpinned.
  const seenLive = useRef(false);
  const matchStatus = match?.status;
  useEffect(() => {
    if (matchStatus === "live") seenLive.current = true;
    else if (matchStatus && !seenLive.current) setPinnedMatch(null);
  }, [matchStatus]);

  if (!match) return null;
  const onOwnPage = pathname === `/matches/${id}` || pathname.startsWith(`/matches/${id}/`);
  // Popped out it's always shown (it's outside the app); in the app, the
  // match's own pages already show the score.
  if (!popped && onOwnPage) return null;

  const perOver = ballsPerOverOf(match);
  const live = match.status === "live";
  const upcoming = match.status === "scheduled";
  const over = !live && !upcoming;
  const colors = matchTeamColors(match);
  const current = match.innings[match.innings.length - 1];
  const rows = battingOrder(match).map((slot) => {
    const innings = match.innings.find((inn) => inn.battingTeam === slot);
    const summary = innings ? inningsSummary(innings, perOver) : null;
    return {
      slot,
      team: match.teams[slot],
      runs: summary ? `${summary.runs}/${summary.wickets}` : null,
      overs: summary?.overs ?? null,
      batting: live && current?.battingTeam === slot,
      won: over && match.winner === slot,
      lost: over && match.winner !== null && match.winner !== slot,
    };
  });
  const line = live
    ? (matchStateLine(match) ?? "Live")
    : upcoming
      ? match.scheduledAt
        ? formatMatchDate(match.scheduledAt)
        : "Yet to start"
      : (match.resultText ?? "Match over");
  const status = live ? "Live" : upcoming ? "Upcoming" : "Result";

  const openMatch = () => {
    // From the popped-out window: bring the app's tab forward.
    if (popped) window.focus();
    navigate(`/matches/${id}`);
  };

  async function popOut() {
    try {
      await popOutScore();
    } catch {
      toast.error("Couldn't open the score window");
    }
  }

  const card = (
    <div
      ref={popped ? undefined : drag.ref}
      className={`cv-pinned-score is-${status.toLowerCase()} ${popped ? "is-popped" : "is-draggable"}`}
      style={popped ? undefined : drag.style}
      onPointerDown={popped ? undefined : drag.onPointerDown}
      onClickCapture={popped ? undefined : drag.onClickCapture}
      role="region"
      aria-label="Pinned score"
    >
      <div className="cv-pinned-score-head">
        <span className="cv-pinned-score-status">
          {live && <i className="cv-pinned-score-dot" aria-hidden="true"></i>}
          {status}
        </span>
        <span className="cv-pinned-score-stage">{matchStageLabel(match)}</span>
        {!popped && canPopOutScore() && (
          <button
            type="button"
            className="cv-pinned-score-icon"
            aria-label="Pop out: keep the score on top of other tabs and apps"
            title="Pop out — stays on top of other tabs and apps"
            onClick={() => void popOut()}
          >
            <i className="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
          </button>
        )}
        <button
          type="button"
          className="cv-pinned-score-icon"
          aria-label="Unpin score"
          title="Unpin"
          onClick={() => setPinnedMatch(null)}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <button type="button" className="cv-pinned-score-body" onClick={openMatch} title="Open the match">
        {rows.map((row) => (
          <span
            key={row.slot}
            className={`cv-pinned-score-row${row.batting ? " is-batting" : ""}${row.won ? " is-won" : ""}${row.lost ? " is-lost" : ""}`}
          >
            <TeamMark
              className="cv-pinned-score-badge"
              name={row.team.name}
              logoUrl={row.team.logoUrl}
              color={colors[row.slot]}
            />
            <span className="cv-pinned-score-team" title={row.team.name}>
              {row.team.name}
            </span>
            {row.batting && <i className="fa-solid fa-baseball-bat-ball cv-pinned-score-bat" aria-label="Batting"></i>}
            {row.won && <i className="fa-solid fa-trophy cv-pinned-score-trophy" aria-label="Won"></i>}
            {row.runs ? (
              <span className="cv-pinned-score-runs">
                <strong>{row.runs}</strong>
                <small>{row.overs} ov</small>
              </span>
            ) : (
              <span className="cv-pinned-score-runs is-empty">{upcoming ? "" : "Yet to bat"}</span>
            )}
          </span>
        ))}
      </button>
      <div className="cv-pinned-score-foot" title={line}>
        <i
          className={live ? "fa-solid fa-bolt" : upcoming ? "fa-regular fa-calendar" : "fa-solid fa-flag-checkered"}
          aria-hidden="true"
        ></i>
        <span>{line}</span>
      </div>
    </div>
  );

  return popped ? createPortal(card, popped.document.body) : card;
}

// The in-app card can be dragged anywhere on screen (mouse or finger); where
// it was left is remembered on this device. A drag doesn't count as a tap.
const POS_KEY = "cv-pinned-score-pos";
type Pos = { x: number; y: number };

function loadPos(): Pos | null {
  try {
    const pos = JSON.parse(window.localStorage.getItem(POS_KEY) ?? "null") as Pos | null;
    return pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? pos : null;
  } catch {
    return null;
  }
}

function useDragAnywhere() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(loadPos);
  const [size, setSize] = useState({ w: 280, h: 120 });
  const dragged = useRef(false);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || event.button !== 0) return;
    const rect = el.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let moving = false;
    let last: Pos | null = null;
    dragged.current = false;

    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moving) {
        if (Math.hypot(dx, dy) < 5) return;
        // Only now: capturing on press would steal the buttons' clicks.
        moving = true;
        dragged.current = true;
        el.setPointerCapture(pointerId);
        el.classList.add("is-dragging");
        setSize({ w: rect.width, h: rect.height });
      }
      const x = Math.min(Math.max(8, rect.left + dx), window.innerWidth - rect.width - 8);
      const y = Math.min(Math.max(8, rect.top + dy), window.innerHeight - rect.height - 8);
      last = { x, y };
      setPos(last);
    };
    const end = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      el.classList.remove("is-dragging");
      if (last) {
        try {
          window.localStorage.setItem(POS_KEY, JSON.stringify(last));
        } catch {
          // Private mode: it stays put for this visit only.
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  // The click that ends a drag doesn't open the match or press a button.
  function onClickCapture(event: MouseEvent) {
    if (!dragged.current) return;
    dragged.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  // Kept on screen when the window is made smaller than where it was left.
  const style: CSSProperties | undefined = pos
    ? {
        left: `clamp(8px, ${pos.x}px, calc(100vw - ${size.w + 8}px))`,
        top: `clamp(8px, ${pos.y}px, calc(100vh - ${size.h + 8}px))`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return { ref, style, onPointerDown, onClickCapture };
}
