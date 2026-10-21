import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  title: string;
  // Font Awesome class, e.g. "fa-solid fa-person-running".
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  // Pinned under the content — usually the confirm button.
  footer?: ReactNode;
  // Fill the whole screen on phones (long lists).
  fullScreen?: boolean;
}

// A sheet that slides up from the bottom of the screen (a centred card on
// wider screens) — quicker to reach with a thumb than a modal mid-screen.
export function BottomSheet({ title, icon, onClose, children, footer, fullScreen = false }: BottomSheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="cricket-sheet-backdrop" onClick={onClose}>
      <div
        className={`cricket-sheet ${fullScreen ? "is-full" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="cricket-sheet-handle" aria-hidden="true"></span>
        <header className="cricket-sheet-head">
          {icon && (
            <span className="cricket-sheet-icon">
              <i className={icon} aria-hidden="true"></i>
            </span>
          )}
          <h2>{title}</h2>
          <button type="button" className="cricket-sheet-close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>
        <div className="cricket-sheet-body">{children}</div>
        {footer && <footer className="cricket-sheet-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
