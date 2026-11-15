import { useCallback, useRef } from "react";

// A ref for a `position: sticky` tab bar that pins under the page header.
// While it's pinned (scrolled up to its `top`), <html> carries
// `data-tabs-pinned`, so the header can square off its rounded bottom and
// the two read as one bar; scrolled back, the corners come back. Set straight
// on the element, so it costs no re-render while scrolling. `forward` is
// another (stable) callback ref for the same element, such as useSwipeTabs's.
export function useStuck<T extends HTMLElement>(forward?: (el: T | null) => void) {
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((el: T | null) => {
    forward?.(el);
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;

    const root = document.documentElement;
    let frame = 0;
    const check = () => {
      frame = 0;
      const top = parseFloat(getComputedStyle(el).top) || 0;
      // Pinned when it sits at its sticky top, right against the header
      // (scrolled there, or there from the start with nothing above it).
      const pinned = el.getBoundingClientRect().top <= top + 1;
      if (pinned) root.dataset.tabsPinned = "";
      else delete root.dataset.tabsPinned;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    check();
    // Scroll doesn't bubble, but it can be caught on the way down, from
    // whichever box is scrolling.
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    cleanup.current = () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      delete root.dataset.tabsPinned;
    };
  }, [forward]);
}
