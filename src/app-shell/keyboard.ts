// The on-screen keyboard, for the website, the PWA and the Android app alike.
//
// With the keyboard up only the area above it is visible. index.html's
// viewport (interactive-widget=resizes-content) makes Chrome shrink the page
// to that area, as the Android app already does (MainActivity), so fixed bars
// and 100dvh fit above it. On top of that:
//   - <html> gets .is-keyboard-open, so things that only get in the way then
//     can step aside (the bottom tab bar: BottomNav.css);
//   - the field being typed in is brought into view once the keyboard is up;
//   - visibleArea() tells dropdowns how much room there really is above and
//     below a field (SelectInput, useSuggestions).

// A drop this big in the visible height, with a field focused, is the keyboard
// (a toolbar or the URL bar hiding is far less).
const KEYBOARD_MIN_PX = 150;

const EDITABLE =
  "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=range]):not([type=color]):not([type=file]), textarea, select, [contenteditable=''], [contenteditable='true']";

// The part of the page that can be seen, in the page's own (layout)
// coordinates: what getBoundingClientRect() and position: fixed use.
export function visibleArea() {
  const viewport = window.visualViewport;
  const top = viewport ? viewport.offsetTop : 0;
  const height = viewport ? viewport.height : window.innerHeight;
  return { top, bottom: top + height, height };
}

function editableFocused(): Element | null {
  const active = document.activeElement;
  return active && active.matches(EDITABLE) ? active : null;
}

export function installKeyboardWatch() {
  const root = document.documentElement;
  // The tallest the visible area has been at this width: the height with no
  // keyboard. Turning the phone changes the width and starts again.
  let fullHeight = 0;
  let width = 0;
  let open = false;

  const update = () => {
    const { height } = visibleArea();
    if (window.innerWidth !== width) {
      width = window.innerWidth;
      fullHeight = height;
    }
    fullHeight = Math.max(fullHeight, height);
    const field = editableFocused();
    const nowOpen = !!field && fullHeight - height > KEYBOARD_MIN_PX;
    if (nowOpen === open) return;
    open = nowOpen;
    root.classList.toggle("is-keyboard-open", open);
    if (open && field) {
      // Once the page has settled at its new size: if the field ended up
      // behind the keyboard or under the top bar, centre it.
      window.setTimeout(() => {
        if (document.activeElement !== field) return;
        const rect = field.getBoundingClientRect();
        const area = visibleArea();
        if (rect.bottom > area.bottom - 8 || rect.top < area.top + 64) {
          field.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 120);
    }
  };

  window.visualViewport?.addEventListener("resize", update);
  window.addEventListener("resize", update);
  // Focus moving between fields, or leaving one, can change it without a resize.
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", () => window.setTimeout(update, 0));
  update();
}
