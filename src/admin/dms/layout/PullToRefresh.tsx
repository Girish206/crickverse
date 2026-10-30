import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import "../css/PullToRefresh.css";

// Shown while pulling, a different one each time — like Slack's loading
// messages.
const MESSAGES = [
  "Rolling the arm over…",
  "Checking the pitch report…",
  "Sending it upstairs to the third umpire…",
  "Polishing the new ball…",
  "Setting the field…",
  "Taking a quick single…",
  "Padding up…",
  "Reviewing the DRS replay…",
  "Waiting for the covers to come off…",
  "Marking out the run-up…",
  "Counting the runs twice…",
  "Drinks break — back in a moment…",
];

const THRESHOLD = 70;
const MAX = 110;
const HOLD = 56;

// Phones: pulling down from the top of the page refetches everything on
// screen. Not in sheets (portalled out of the page) or on the scorer.
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(MESSAGES[0]);
  const busy = useRef(false);

  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    let pulling = false;
    let distance = 0;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (busy.current || e.touches.length !== 1 || window.innerWidth > 769 || window.scrollY > 0) return;
      const target = e.target as HTMLElement;
      if (!target.closest(".scrollable-main, .cv-public-main") || target.closest(".cricket-scorer-page, [data-no-pull]")) return;
      // A sheet is open (it locks the page), or the touch is in a box that
      // scrolls on its own and isn't at its top.
      if (document.body.style.overflow === "hidden") return;
      for (let el: HTMLElement | null = target; el && el !== document.body; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollTop > 0) return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!pulling) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Up, or more sideways (a tab swipe): not a pull.
        if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
          start = null;
          return;
        }
        pulling = true;
        setDragging(true);
        setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
      }
      // Keep the browser's own pull-to-refresh and bounce out of it.
      if (e.cancelable) e.preventDefault();
      distance = Math.min(MAX, Math.max(0, dy * 0.5));
      setPull(distance);
    };

    const onEnd = () => {
      if (!start) return;
      start = null;
      if (!pulling) return;
      pulling = false;
      setDragging(false);
      if (distance < THRESHOLD) {
        setPull(0);
        return;
      }
      busy.current = true;
      setRefreshing(true);
      setPull(HOLD);
      // Long enough to read the message, even when the refetch is quick.
      Promise.all([queryClient.refetchQueries({ type: "active" }), new Promise((r) => setTimeout(r, 900))])
        .catch(() => undefined)
        .finally(() => {
          busy.current = false;
          setRefreshing(false);
          setPull(0);
        });
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [queryClient]);

  const ready = pull >= THRESHOLD;
  return (
    <div
      className={`cv-ptr ${dragging ? "is-dragging" : ""} ${refreshing ? "is-refreshing" : ""}`}
      style={{ height: pull }}
      aria-live="polite"
    >
      <div className="cv-ptr-inner" style={{ opacity: Math.min(pull / 40, 1) }}>
        <i
          className={`fa-solid fa-baseball cv-ptr-ball ${refreshing ? "fa-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }}
          aria-hidden="true"
        ></i>
        <div className="cv-ptr-text">
          <strong>{message}</strong>
          <small>{refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}</small>
        </div>
      </div>
    </div>
  );
}
