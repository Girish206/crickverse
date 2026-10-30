import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ModalContext } from "../dms/components/modalContext";

// Open sheets, innermost last — Escape closes only the top one.
const openSheets: object[] = [];

interface BottomSheetProps {
  title: string;
  // Font Awesome class, e.g. "fa-solid fa-person-running".
  icon?: string;
  // How many the sheet lists, as a small pill beside the title.
  count?: number | string;
  onClose: () => void;
  children: ReactNode;
  // Pinned under the content — usually the confirm button.
  footer?: ReactNode;
  // Fill the whole screen on phones (long lists).
  fullScreen?: boolean;
  // Wider card on desktop, for full forms.
  wide?: boolean;
}

// A sheet that slides up from the bottom of the screen (a centred card on
// wider screens) — quicker to reach with a thumb than a modal mid-screen.
// Admin forms (SubmitButton / ModalActions) portal their Cancel/Save buttons
// into its footer, just as they do inside a DefaultModal.
export function BottomSheet({
  title,
  icon,
  count,
  onClose,
  children,
  footer,
  fullScreen = false,
  wide = false,
}: BottomSheetProps) {
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => {
      onCloseRef.current();
    }, 200);
  }, []);

  useEffect(() => {
    const self = {};
    openSheets.push(self);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openSheets.at(-1) === self && requestClose();
    // The page stays locked while any sheet is open. Restoring a saved value
    // instead would leave it stuck when sheets close out of order (e.g. a
    // parent sheet unmounting before the one opened from it).
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      openSheets.splice(openSheets.indexOf(self), 1);
      if (openSheets.length === 0) document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [requestClose]);

  return createPortal(
    <div className={`cricket-sheet-backdrop ${closing ? "is-closing" : ""}`.trim()} onClick={requestClose}>
      <div
        className={`cricket-sheet ${fullScreen ? "is-full" : ""} ${wide ? "is-wide" : ""} ${closing ? "is-closing" : ""}`.trim()}
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
          <h2>
            {title}
            {count !== undefined && <span className="cricket-sheet-count">{count}</span>}
          </h2>
          <button type="button" className="cricket-sheet-close" onClick={requestClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>
        <ModalContext.Provider value={{ footer: footerSlot, close: requestClose }}>
          <div className="cricket-sheet-body">{children}</div>
        </ModalContext.Provider>
        {footer ? (
          <footer className="cricket-sheet-foot">{footer}</footer>
        ) : (
          // Empty until a form portals its actions in; hidden while empty.
          <footer className="cricket-sheet-foot cricket-sheet-slot" ref={setFooterSlot} />
        )}
      </div>
    </div>,
    document.body,
  );
}
