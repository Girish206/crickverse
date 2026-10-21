import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

// A compact pill-shaped dropdown in the app's own colours — a native
// <select> opens the OS's list (blue highlight, light even in dark mode).
// Keyboard: arrows / Home / End move, Enter or Space picks, Escape closes.
export function PillSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  // Accessible name of the control, e.g. "Leaderboard".
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function show() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function pick(index: number) {
    onChange(options[index].value);
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={`cricket-pill-select ${open ? "is-open" : ""} ${className}`.trim()}>
      <button
        ref={button}
        type="button"
        className="cricket-pill-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${options[selectedIndex]?.label ?? ""}`}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="cricket-pill-select-value">{options[selectedIndex]?.label}</span>
        <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="cricket-pill-select-menu">
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`${index === active ? "is-active" : ""} ${index === selectedIndex ? "is-selected" : ""}`.trim()}
              onPointerEnter={() => setActive(index)}
              onClick={() => pick(index)}
            >
              <span>{option.label}</span>
              {index === selectedIndex && <i className="fa-solid fa-check" aria-hidden="true"></i>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
