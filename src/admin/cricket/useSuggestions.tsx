import { useEffect, useId, useState, type FocusEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

// The list scrolls; this just keeps a huge one from rendering in full.
const MAX_SHOWN = 50;

// Type-ahead suggestions for a free-text input (a ground, a city): spread
// `inputProps` on the input and render `menu` next to it. The list is
// portalled and fixed-positioned so a form group's overflow (or a bottom
// sheet) doesn't clip it. Picking one fills the input; anything else typed
// is kept as the user's own.
// Keyboard: arrows move, Enter picks, Escape closes.
export function useSuggestions({
  value,
  suggestions,
  onPick,
  icon = "fa-solid fa-location-dot",
}: {
  value: string;
  suggestions: string[];
  onPick: (value: string) => void;
  // Shown before each suggestion.
  icon?: string;
}) {
  const listId = useId();
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const typed = value.trim().toLowerCase();
  // Names starting with what's typed first, then ones containing it.
  const matches = suggestions
    .filter((s) => s.toLowerCase().includes(typed))
    .sort((a, b) => Number(!a.toLowerCase().startsWith(typed)) - Number(!b.toLowerCase().startsWith(typed)))
    .slice(0, MAX_SHOWN);
  const exact = suggestions.some((s) => s.toLowerCase() === typed);
  // Typing a new name offers it as the last row, so it's clear it can be kept.
  const rows = [...matches.map((s) => ({ value: s, isNew: false })), ...(typed && !exact ? [{ value: value.trim(), isNew: true }] : [])];
  const shown = open && rows.length > 0 && !(exact && matches.length === 1);

  // Follow the field (the whole row when it's in one) while the list is up.
  useEffect(() => {
    if (!shown || !input) return;
    const place = () => setRect((input.closest(".cricket-app-row, .input-group-custom") ?? input).getBoundingClientRect());
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [shown, input]);

  function pick(index: number) {
    const row = rows[index];
    if (!row) return;
    if (!row.isNew) onPick(row.value);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!shown) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => Math.max(0, Math.min(rows.length - 1, i + step)));
    } else if (e.key === "Enter" && active >= 0) {
      // Pick rather than submit the form.
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  }

  const inputProps = {
    autoComplete: "off",
    role: "combobox",
    "aria-autocomplete": "list" as const,
    "aria-expanded": shown,
    "aria-controls": listId,
    "aria-activedescendant": shown && active >= 0 ? `${listId}-${active}` : undefined,
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      setInput(e.currentTarget);
      setActive(-1);
      setOpen(true);
    },
    onBlur: () => setOpen(false),
    onInput: () => {
      setActive(-1);
      setOpen(true);
    },
    onKeyDown,
  };

  const menu =
    shown && rect
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            className="cricket-suggest-menu"
            style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
          >
            {rows.map((row, index) => (
              <li
                key={`${row.isNew}-${row.value}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`${index === active ? "is-active" : ""} ${row.isNew ? "is-new" : ""}`.trim()}
                onPointerEnter={() => setActive(index)}
                // Keeps focus in the input, so blur doesn't close it first.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(index)}
              >
                {row.isNew ? (
                  <>
                    <i className="fa-solid fa-plus" aria-hidden="true"></i>
                    <span>
                      Add "<strong>{row.value}</strong>"
                    </span>
                  </>
                ) : (
                  <>
                    <i className={icon} aria-hidden="true"></i>
                    <span>{row.value}</span>
                  </>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return { inputProps, menu };
}
