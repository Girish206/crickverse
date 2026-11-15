import { flushSync } from "react-dom";

const DURATION_MS = 650;
// Slow to start, quick through the middle, settling at the end.
const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
// The width of the reveal's soft edge (the mask in dark.css).
const FEATHER_PX = 90;

// The reveal's radius, as a typed property so it can be animated (dark.css
// draws the soft-edged circle from it). Where the browser can't register
// it, the circle is a hard-edged clip instead.
let featherSupported: boolean | null = null;
function canFeather() {
  if (featherSupported === null) {
    try {
      CSS.registerProperty({ name: "--theme-reveal-r", syntax: "<length>", inherits: false, initialValue: "0px" });
      featherSupported = true;
    } catch (error) {
      // Already registered (a hot reload) counts; no registerProperty doesn't.
      featherSupported = error instanceof DOMException && error.name === "InvalidModificationError";
    }
  }
  return featherSupported;
}

// Applies a theme change as a soft-edged circle of the new theme spreading
// out of the button that was pressed, while its icon spins from moon to sun
// (dark.css). Where the browser can't, or the visitor has asked for less
// motion, the theme simply switches.
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
  const feather = canFeather();

  const root = document.documentElement;
  root.style.setProperty("--theme-reveal-x", `${x}px`);
  root.style.setProperty("--theme-reveal-y", `${y}px`);

  // flushSync: the browser pictures the new page as soon as this returns, so
  // React has to have finished applying the theme by then.
  const transition = document.startViewTransition(() => flushSync(apply));

  transition.ready
    .then(() => {
      const timing: KeyframeAnimationOptions = {
        duration: DURATION_MS,
        easing: EASING,
        fill: "forwards",
        pseudoElement: "::view-transition-new(root)",
      };
      if (feather) {
        // Past the corner by the edge's width, so no soft edge is left over.
        root.animate({ "--theme-reveal-r": ["0px", `${radius + FEATHER_PX}px`] } as PropertyIndexedKeyframes, timing);
      } else {
        root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, timing);
      }
    })
    // Skipped (a hidden tab, say): the theme has still changed, just unanimated.
    .catch(() => undefined);

  transition.finished.finally(() => {
    root.style.removeProperty("--theme-reveal-x");
    root.style.removeProperty("--theme-reveal-y");
  });
}
