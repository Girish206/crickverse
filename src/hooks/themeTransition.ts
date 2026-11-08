import { flushSync } from "react-dom";

const DURATION_MS = 500;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

// Applies a theme change as a circle of the new theme growing out of the
// button that was pressed, with the button's icon turning in as it does.
// Where the browser can't, or the visitor has asked for less motion, the
// theme simply switches.
export function revealThemeChange(apply: () => void, from: HTMLElement) {
  if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    apply();
    return;
  }

  const { left, top, width, height } = from.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  // To the farthest corner, so the circle ends up covering the whole screen.
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  // flushSync: the browser pictures the new page as soon as this returns, so
  // React has to have finished applying the theme by then.
  const transition = document.startViewTransition(() => flushSync(apply));

  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: DURATION_MS, easing: EASING, pseudoElement: "::view-transition-new(root)" },
      );
      from.firstElementChild?.animate(
        { transform: ["rotate(-90deg) scale(0.5)", "none"], opacity: [0, 1] },
        { duration: DURATION_MS, easing: EASING },
      );
    })
    // Skipped (a hidden tab, say): the theme has still changed, just unanimated.
    .catch(() => undefined);
}
