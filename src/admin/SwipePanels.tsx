import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { Pager, SwipeRef } from "./useSwipeTabs";
import "./swipePanels.css";

const GAP = 16;

// A tab set's content, one panel per tab, for swiping between them like
// WhatsApp: the neighbouring tab follows the finger in beside this one. A tab
// stays mounted (hidden) once opened, so it shows straight away and keeps
// updating with its data; one not opened yet comes in blank.
//
// `eager` (a match, tournament or team page) opens every tab in the
// background once the first has shown: all their data loads together, a
// swipe always shows the next tab's content, and moving between tabs never
// reloads (pull to refresh does).
export function SwipePanels<T extends string>({
  swipe,
  values,
  current,
  eager = false,
  children,
}: {
  swipe: SwipeRef;
  values: readonly T[];
  current: T;
  eager?: boolean;
  children: (value: T) => ReactNode;
}) {
  const [visited, setVisited] = useState<ReadonlySet<T>>(() => new Set([current]));
  if (!visited.has(current)) setVisited(new Set(visited).add(current));

  const allValues = values.join("|");
  useEffect(() => {
    if (!eager) return;
    const timer = setTimeout(() => {
      setVisited((seen) => (values.every((v) => seen.has(v)) ? seen : new Set([...seen, ...values])));
    }, 300);
    return () => clearTimeout(timer);
  }, [eager, allValues]); // values by content: a new array each render

  const root = useRef<HTMLDivElement>(null);
  const blank = useRef<HTMLDivElement>(null);
  const panels = useRef(new Map<T, HTMLDivElement>());
  const state = useRef({ values, current, visited });
  state.current = { values, current, visited };
  // After a swipe lands: the slid-in tab is held where it is until the new
  // tab has rendered (a tab kept in the URL arrives a moment later), so the
  // old one never flashes back in between.
  const landing = useRef<{ target: T; settle: () => void } | null>(null);

  useLayoutEffect(() => {
    if (landing.current?.target === current) landing.current.settle();
  }, [current]);

  useEffect(() => {
    let active: HTMLElement | null = null;
    let neighbour: HTMLElement | null = null;
    let next: T | undefined;
    let dir: 1 | -1 = 1;
    let offset = 0;
    // Undoes the room held below a short tab after a swipe (see `settle`).
    let release: (() => void) | null = null;
    const width = () => (root.current?.clientWidth ?? window.innerWidth) + GAP;
    const reset = (el: HTMLElement | null) => {
      if (el) el.style.cssText = "";
    };

    const pager: Pager = {
      root: () => root.current,
      begin(d, top) {
        const { values, current, visited } = state.current;
        next = values[values.indexOf(current) + d];
        dir = d;
        // A tab not opened yet renders now, so it slides in with its content
        // rather than blank.
        if (next !== undefined && !visited.has(next)) {
          const add = next;
          flushSync(() => setVisited((seen) => new Set(seen).add(add)));
        }
        active = panels.current.get(current) ?? null;
        neighbour = (next !== undefined ? panels.current.get(next) : null) ?? blank.current;
        if (!root.current || !active || !neighbour) return;
        // The neighbour lines up with the top of what's on screen, not the
        // top of a long page (or sheet) scrolled out of view — below the
        // fixed header when the tab bar has scrolled away under it.
        const sheet = root.current.closest(".cricket-sheet-body");
        const header = sheet
          ? sheet.getBoundingClientRect().top
          : Math.max(0, ...[...document.querySelectorAll(".cv-page-header, .navbar, .cv-public-bar")].map((el) => el.getBoundingClientRect().bottom));
        const visibleTop = Math.max(top, header);
        offset = Math.max(0, visibleTop - root.current.getBoundingClientRect().top);
        root.current.classList.add("is-swiping");
        neighbour.style.cssText = `display:block;position:absolute;left:0;right:0;top:${offset}px;transform:translate3d(${dir * width()}px,0,0)`;
        // A longer tab coming in beside a short one ("No matches here")
        // stretches the card around it rather than spilling out below.
        const needed = offset + neighbour.offsetHeight;
        if (needed > root.current.offsetHeight) root.current.style.minHeight = `${needed}px`;
      },
      move(shift) {
        if (active) active.style.transform = `translate3d(${shift}px,0,0)`;
        if (neighbour) neighbour.style.transform = `translate3d(${shift + dir * width()}px,0,0)`;
      },
      end(commit, go, done) {
        const a = active;
        const n = neighbour;
        const to = commit ? -dir * width() : 0;
        const transition = "transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)";
        if (a) {
          a.style.transition = transition;
          a.style.transform = `translate3d(${to}px,0,0)`;
        }
        if (n) {
          n.style.transition = transition;
          n.style.transform = `translate3d(${to + dir * width()}px,0,0)`;
        }
        const target = next;
        const shift = offset;
        setTimeout(() => {
          const sheet = root.current?.closest<HTMLElement>(".cricket-sheet-body");
          const scroller = sheet ?? document.scrollingElement ?? document.documentElement;
          const settle = () => {
            if (landing.current?.settle === settle) landing.current = null;
            const el = root.current;
            // Where the page must scroll to so the new tab stays where it
            // was on screen, its top showing.
            const target = scroller.scrollTop - (commit ? shift : 0);
            release?.();
            reset(a);
            reset(n);
            el?.classList.remove("is-swiping");
            if (el) {
              // No animated shrinking here: it would drag the page around.
              el.style.transition = "none";
              el.style.minHeight = "";
              // A short tab after a long one leaves too little page to
              // scroll there: hold that room below it (no jump back), until
              // the page is scrolled up out of it.
              const lacking = target + scroller.clientHeight - scroller.scrollHeight;
              if (commit && lacking > 0) {
                el.style.minHeight = `${el.offsetHeight + lacking}px`;
                const free = target - lacking;
                const scrollee = sheet ?? window;
                const onScroll = () => scroller.scrollTop <= free && release?.();
                release = () => {
                  scrollee.removeEventListener("scroll", onScroll);
                  el.style.minHeight = "";
                  el.style.transition = "";
                  release = null;
                };
                scrollee.addEventListener("scroll", onScroll, { passive: true });
              } else {
                el.style.transition = "";
              }
            }
            if (commit && shift) scroller.scrollTop = target;
            active = neighbour = null;
            done();
          };
          if (!commit || target === undefined) {
            settle();
            return;
          }
          landing.current = { target, settle };
          flushSync(go);
          // Should the new tab never arrive, don't leave things mid-swipe.
          setTimeout(() => landing.current?.settle === settle && settle(), 1000);
        }, 250);
      },
    };
    swipe.setPager(pager);
    return () => {
      swipe.setPager(null);
      release?.();
    };
  }, [swipe]);

  return (
    <div ref={root} className="cv-swipe-panels">
      {values.map((value) =>
        visited.has(value) ? (
          <div
            key={value}
            ref={(el) => {
              if (el) panels.current.set(value, el);
              else panels.current.delete(value);
            }}
            className={`cv-swipe-panel ${value === current ? "is-active" : ""}`}
            inert={value !== current}
          >
            {children(value)}
          </div>
        ) : null
      )}
      <div ref={blank} className="cv-swipe-panel cv-swipe-blank" aria-hidden="true" />
    </div>
  );
}
