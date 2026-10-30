import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";

// Phones: a sideways swipe moves to the neighbouring tab — left for the next,
// right for the previous. Each tab set listens within its area: its own tab
// bar and <SwipePanels> content, or else its scope (by default the page, or
// the sheet it sits in). Where tab sets nest — a stats category inside a
// match tab, a list filter on a bottom-nav screen — the innermost one under
// the finger moves first, and past its first or last tab the swipe passes to
// the one around it; anywhere else on the page it's the outer one's.
//
// A tab set whose content sits in <SwipePanels> drags its neighbour in beside
// it, WhatsApp style; any other just slides its content out and the next in.

type Scope = string | (() => Element | null);

/** What <SwipePanels> does with a drag: see SwipePanels.tsx. */
export interface Pager {
  root: () => HTMLElement | null;
  begin: (dir: 1 | -1, top: number) => void;
  move: (shift: number) => void;
  end: (commit: boolean, go: () => void, done: () => void) => void;
}

interface Entry {
  el: HTMLElement | null;
  scope?: Scope;
  count: number;
  current: number;
  go: (index: number) => void;
  pager: Pager | null;
}

export type SwipeRef = ((el: HTMLElement | null) => void) & { setPager: (pager: Pager | null) => void };

const DEFAULT_SCOPE = ".cricket-sheet-body, .scrollable-main";
const entries = new Set<{ current: Entry }>();

const depth = (el: Element) => {
  let d = 0;
  for (let p = el.parentElement; p; p = p.parentElement) d++;
  return d;
};

const scopeOf = (entry: Entry): Element | null => {
  if (!entry.el?.isConnected) return null;
  if (typeof entry.scope === "function") return entry.scope();
  return entry.el.closest(entry.scope ?? DEFAULT_SCOPE) ?? (entry.scope ? null : document.body);
};

// Where a swipe starting on `target` (at height `y`) belongs to this tab
// set, if it does: a tab set with its content in <SwipePanels> (and no scope
// of its own) owns just its tab bar and that content — and the empty page or
// sheet below short content ("No matches here"), down to the screen's end.
const areaOf = (entry: Entry, target: Element, y: number): Element | null => {
  if (!entry.el?.isConnected) return null;
  if (entry.pager && entry.scope === undefined) {
    const root = entry.pager.root();
    if (entry.el.contains(target)) return entry.el;
    if (!root) return null;
    if (root.contains(target)) return root;
    // On bare space (a box around the content, not something else in it)
    // below the content.
    return target.contains(root) && y > root.getBoundingClientRect().bottom ? root : null;
  }
  const scope = scopeOf(entry);
  return scope?.contains(target) ? scope : null;
};

// What slides without a pager: everything after the tab bar (or after the
// header holding it) within the scope — or the whole scope for a bar
// outside it.
const panelsOf = (entry: Entry, scope: Element): HTMLElement[] => {
  const el = entry.el;
  if (!el || !scope.contains(el)) return [...scope.children] as HTMLElement[];
  for (let row: HTMLElement | null = el; row && row !== scope; row = row.parentElement) {
    const after: HTMLElement[] = [];
    for (let s = row.nextElementSibling; s; s = s.nextElementSibling) after.push(s as HTMLElement);
    if (after.length) return after;
  }
  return [];
};

const style = (els: HTMLElement[], transform: string, opacity: string, transition: string) => {
  for (const el of els) {
    el.style.transition = transition;
    el.style.transform = transform;
    el.style.opacity = opacity;
  }
};

const clear = (els: HTMLElement[]) => {
  for (const el of els) {
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
  }
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Drag {
  x: number;
  y: number;
  t: number;
  target: HTMLElement;
  // Set once the finger has clearly gone sideways (or up and down).
  axis?: "x" | "y";
  entry?: Entry;
  next?: number;
  panels: HTMLElement[];
  // Rows under the finger that scroll sideways, and where each started.
  scrollers: { el: HTMLElement; left: number }[];
}

// Pixels of sideways overflow (or scroll left) that don't count.
const SLACK = 8;

let drag: Drag | null = null;
let animating = false;

// Tab sets whose area holds the touch, innermost area first, then the
// deeper tab bar (the bottom nav sits outside the page, so it comes last).
// The first that has a tab in this direction takes the swipe.
const pick = (target: HTMLElement, y: number, dir: number) => {
  const candidates = [...entries]
    .map(({ current: entry }) => ({ entry, area: areaOf(entry, target, y), scope: scopeOf(entry) }))
    .filter(({ entry, area }) => area && entry.current >= 0 && entry.el!.getClientRects().length > 0)
    .map((c) => ({ ...c, areaDepth: depth(c.area!), elDepth: depth(c.entry.el!) }))
    .sort((a, b) => b.areaDepth - a.areaDepth || b.elDepth - a.elDepth);
  for (const { entry, scope } of candidates) {
    const next = entry.current + dir;
    if (next >= 0 && next < entry.count) return { entry, next, panels: entry.pager ? [] : panelsOf(entry, scope!) };
  }
  // Nothing that way: the innermost content just gives a little.
  const first = candidates[0];
  return first ? { entry: undefined, next: undefined, panels: panelsOf(first.entry, first.scope!) } : null;
};

const onStart = (e: TouchEvent) => {
  drag = null;
  if (animating || e.touches.length !== 1 || window.innerWidth > 769) return;
  const target = e.target as HTMLElement;
  const touch = e.touches[0];
  // Not from the screen edge (the browser's back gesture), and not on
  // anything with its own sideways drag.
  if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
  if (target.closest("input, textarea, select, [contenteditable], [data-no-swipe]")) return;
  // Rows that really scroll sideways — not a box that scrolls up and down
  // (a sheet's body), nor one a shadow or rounding pushes a pixel wider.
  const scrollers: Drag["scrollers"] = [];
  for (let el: HTMLElement | null = target; el && el !== document.body; el = el.parentElement) {
    const ox = getComputedStyle(el).overflowX;
    if (
      (ox === "auto" || ox === "scroll") &&
      el.scrollWidth - el.clientWidth > SLACK &&
      el.scrollHeight - el.clientHeight <= SLACK
    ) {
      scrollers.push({ el, left: el.scrollLeft });
    }
  }
  drag = { x: touch.clientX, y: touch.clientY, t: Date.now(), target, panels: [], scrollers };
};

const onMove = (e: TouchEvent) => {
  if (!drag || drag.axis === "y") return;
  const touch = e.touches[0];
  const dx = touch.clientX - drag.x;
  const dy = touch.clientY - drag.y;
  if (!drag.axis) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) {
      drag.axis = "y";
      return;
    }
    // A row of cards (or a tab strip) scrolls first; with one card, or at
    // its end, the swipe moves the tabs instead.
    const canScroll = drag.scrollers.some(({ el, left }) =>
      dx < 0 ? el.scrollWidth - el.clientWidth - left > SLACK : left > SLACK
    );
    if (canScroll) {
      drag = null;
      return;
    }
    const picked = pick(drag.target, drag.y, dx < 0 ? 1 : -1);
    if (!picked) {
      drag = null;
      return;
    }
    drag.axis = "x";
    Object.assign(drag, picked);
    const { entry } = drag;
    // The neighbour shows from the bottom of the tab bar (it may be pinned).
    if (entry?.pager) entry.pager.begin(dx < 0 ? 1 : -1, Math.max(entry.el!.getBoundingClientRect().bottom, 0));
  }
  // Sideways now: keep the page from scrolling under the finger.
  if (e.cancelable) e.preventDefault();
  // Heading back past the start, or with no tab that way: resist.
  const free = drag.entry && Math.sign(dx) === (drag.next! > drag.entry.current ? -1 : 1);
  if (drag.entry?.pager) {
    drag.entry.pager.move(free ? dx : dx * 0.15);
    return;
  }
  if (reducedMotion()) return;
  const shift = free ? dx * 0.6 : dx * 0.15;
  style(drag.panels, `translate3d(${shift}px, 0, 0)`, String(1 - Math.min(Math.abs(shift) / window.innerWidth, 0.5)), "none");
};

const onEnd = (e: TouchEvent) => {
  const d = drag;
  drag = null;
  if (!d || d.axis !== "x") return;
  const dx = e.changedTouches[0].clientX - d.x;
  const dir = dx < 0 ? 1 : -1;
  const velocity = Math.abs(dx) / Math.max(Date.now() - d.t, 1);
  const commit = Boolean(
    e.type === "touchend" &&
      d.entry &&
      d.next === d.entry.current + dir &&
      (Math.abs(dx) > window.innerWidth * 0.3 || (Math.abs(dx) > 40 && velocity > 0.4))
  );
  const entry = d.entry;

  if (entry?.pager) {
    animating = true;
    entry.pager.end(
      commit,
      () => entry.go(d.next!),
      () => (animating = false)
    );
    return;
  }

  if (!commit) {
    style(d.panels, "", "", "transform 0.2s ease, opacity 0.2s ease");
    setTimeout(() => clear(d.panels), 220);
    return;
  }

  if (reducedMotion()) {
    clear(d.panels);
    entry!.go(d.next!);
    return;
  }

  animating = true;
  const width = window.innerWidth;
  style(d.panels, `translate3d(${-dir * width * 0.35}px, 0, 0)`, "0", "transform 0.14s ease-in, opacity 0.14s ease-in");
  setTimeout(() => {
    clear(d.panels);
    flushSync(() => entry!.go(d.next!));
    // The new tab's content comes in from the side the finger left.
    const scope = scopeOf(entry!) ?? (typeof entry!.scope === "function" ? entry!.scope() : null);
    const incoming = scope ? panelsOf(entry!, scope) : [];
    style(incoming, `translate3d(${dir * width * 0.35}px, 0, 0)`, "0", "none");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style(incoming, "", "", "transform 0.22s ease-out, opacity 0.22s ease-out");
        setTimeout(() => {
          clear(incoming);
          animating = false;
        }, 240);
      });
    });
  }, 140);
};

/** Returns a ref for the tab bar; swipes change `current` through `onChange`. */
export function useSwipeTabs<T>(values: readonly T[], current: T, onChange: (value: T) => void, scope?: Scope): SwipeRef {
  const entry = useRef<Entry>({ el: null, count: 0, current: -1, go: () => {}, pager: null });
  entry.current.scope = scope;
  entry.current.count = values.length;
  entry.current.current = values.indexOf(current);
  entry.current.go = (i) => onChange(values[i]);

  useEffect(() => {
    if (entries.size === 0) {
      document.addEventListener("touchstart", onStart, { passive: true });
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd, { passive: true });
      document.addEventListener("touchcancel", onEnd, { passive: true });
    }
    entries.add(entry);
    return () => {
      entries.delete(entry);
      if (entries.size === 0) {
        document.removeEventListener("touchstart", onStart);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
        document.removeEventListener("touchcancel", onEnd);
      }
    };
  }, []);

  // A tab bar that scrolls sideways brings the open tab into view (by
  // scrolling the bar, never the page) whenever it changes.
  const index = entry.current.current;
  const shown = useRef(false);
  useEffect(() => {
    // Straight there when the page opens; a smooth slide after.
    const smooth = shown.current && !reducedMotion();
    shown.current = true;
    const bar = entry.current.el;
    const tab = bar?.children[index] as HTMLElement | undefined;
    if (!bar || !tab || bar.scrollWidth <= bar.clientWidth) return;
    const barBox = bar.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const margin = 24;
    let left = bar.scrollLeft;
    if (tabBox.left < barBox.left + margin) left += tabBox.left - barBox.left - margin;
    else if (tabBox.right > barBox.right - margin) left += tabBox.right - barBox.right + margin;
    else return;
    bar.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  }, [index]);

  const ref = useCallback((el: HTMLElement | null) => {
    entry.current.el = el;
  }, []) as SwipeRef;
  ref.setPager = (pager) => {
    entry.current.pager = pager;
  };
  return ref;
}
