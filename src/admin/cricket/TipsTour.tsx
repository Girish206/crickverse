import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./TipsTour.css";

// One tip: the element it points at (its data-tour="…" value) and what to say.
export interface TipStep {
  target: string;
  title: string;
  text: string;
}

const KEY_PREFIX = "cv-tips:";
// Room around the highlighted element, and between it and the tip card.
const PAD = 6;
const GAP = 12;
// The page's side gutter on phones.
const EDGE = 16;

function seen(id: string) {
  try {
    return localStorage.getItem(KEY_PREFIX + id) === "seen";
  } catch {
    return true; // No storage (private mode): don't keep showing them.
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(KEY_PREFIX + id, "seen");
  } catch {
    // Nothing to remember it in.
  }
}

// Shows every screen's tips again (My Profile's "Show tips again").
export function resetTips() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing stored.
  }
}

// The first of the target's elements that's on screen — the bottom nav on
// phones and the sidebar on desktop can share one.
function findTarget(target: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].find(
    (el) => el.getClientRects().length > 0,
  );
}

// A screen's tips: the first visit walks through them, highlighting each
// control in turn; `start` shows them again (a "Show tips" menu item).
// Steps whose element isn't on the page (e.g. an organiser-only button) are
// left out. Wait with `ready` until the page has loaded.
export function useTips(id: string, steps: TipStep[], ready = true): { start: () => void; element: ReactNode } {
  const [shown, setShown] = useState<TipStep[] | null>(null);
  // Steps are a new array every render; start reads the latest.
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  });

  const start = useCallback(() => {
    const onPage = stepsRef.current.filter((step) => findTarget(step.target));
    if (onPage.length > 0) setShown(onPage);
  }, []);

  useEffect(() => {
    if (!ready || seen(id)) return;
    // Let the page settle (lazy tabs, fonts) before measuring.
    const timer = window.setTimeout(start, 700);
    return () => window.clearTimeout(timer);
  }, [id, ready, start]);

  const close = useCallback(() => {
    markSeen(id);
    setShown(null);
  }, [id]);

  return {
    start,
    element: shown && <TipsOverlay steps={shown} onClose={close} />,
  };
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function TipsOverlay({ steps, onClose }: { steps: TipStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Bring the element into view, then follow it as the page scrolls or resizes.
  useLayoutEffect(() => {
    const el = findTarget(step.target);
    if (!el) {
      setBox(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step.target]);

  useLayoutEffect(() => {
    if (card) setCardHeight(card.offsetHeight);
  }, [card, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  useEffect(() => {
    card?.querySelector<HTMLButtonElement>(".cv-tip-next")?.focus();
  }, [card, index]);

  // The card goes under the element when it fits, else above it; across,
  // it lines up with the element but stays inside the screen.
  const width = Math.min(320, window.innerWidth - EDGE * 2);
  let cardStyle: CSSProperties = { width, left: (window.innerWidth - width) / 2, bottom: EDGE };
  let arrowLeft: number | null = null;
  let below = true;
  if (box) {
    const centre = box.left + box.width / 2;
    const left = Math.min(Math.max(centre - width / 2, EDGE), window.innerWidth - width - EDGE);
    below = box.top + box.height + GAP + cardHeight <= window.innerHeight - EDGE || box.top < cardHeight + GAP + EDGE;
    const top = below ? box.top + box.height + GAP : box.top - GAP - cardHeight;
    cardStyle = { width, left, top: Math.min(Math.max(top, EDGE), window.innerHeight - cardHeight - EDGE) };
    arrowLeft = Math.min(Math.max(centre - left, 20), width - 20);
  }

  return createPortal(
    <div className="cv-tips" role="dialog" aria-modal="true" aria-label="Tips">
      {/* Clicks outside the card do nothing, so a stray tap doesn't skip a tip. */}
      <div className="cv-tips-blocker" />
      {box ? (
        <div className="cv-tips-spot" style={box} aria-hidden="true" />
      ) : (
        <div className="cv-tips-dim" aria-hidden="true" />
      )}
      <div
        ref={setCard}
        className={`cv-tip-card ${box ? (below ? "is-below" : "is-above") : ""}`.trim()}
        style={cardStyle}
        aria-live="polite"
      >
        {arrowLeft !== null && <span className="cv-tip-arrow" style={{ left: arrowLeft }} aria-hidden="true" />}
        <div className="cv-tip-head">
          <span className="cv-tip-icon">
            <i className="fa-solid fa-lightbulb" aria-hidden="true"></i>
          </span>
          <strong>{step.title}</strong>
          <small>
            {index + 1} of {steps.length}
          </small>
        </div>
        <p>{step.text}</p>
        <div className="cv-tip-foot">
          <div className="cv-tip-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.target} className={i === index ? "is-on" : ""} />
            ))}
          </div>
          {!last && (
            <button type="button" className="cv-tip-skip" onClick={onClose}>
              Skip
            </button>
          )}
          {index > 0 && (
            <button type="button" className="cv-tip-back" onClick={() => setIndex(index - 1)} aria-label="Previous tip">
              <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
            </button>
          )}
          <button type="button" className="cv-tip-next" onClick={last ? onClose : () => setIndex(index + 1)}>
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
