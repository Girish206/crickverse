import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ModalContext, type CloseVia } from "../dms/components/modalContext";

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

  const [heading, setHeading] = useState<{ title: string; subtitle?: string; icon?: string } | null>(null);
  const guardRef = useRef<((via: CloseVia) => boolean) | null>(null);
  const guardClose = useCallback((guard: ((via: CloseVia) => boolean) | null) => {
    guardRef.current = guard;
  }, []);

  const requestClose = useCallback((via: CloseVia = "back") => {
    if (closingRef.current) return;
    if (guardRef.current?.(via)) return;
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

  // A step of the content's own may retitle the sheet (see setHeading).
  const shownTitle = heading?.title ?? title;
  const shownIcon = heading ? heading.icon : icon;

  return createPortal(
    <div className={`cricket-sheet-backdrop ${closing ? "is-closing" : ""}`.trim()} onClick={() => requestClose("back")}>
      <div
        className={`cricket-sheet ${fullScreen ? "is-full" : ""} ${wide ? "is-wide" : ""} ${closing ? "is-closing" : ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={shownTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="cricket-sheet-handle" aria-hidden="true"></span>
        <header className="cricket-sheet-head">
          {shownIcon && (
            <span className="cricket-sheet-icon">
              <i className={shownIcon} aria-hidden="true"></i>
            </span>
          )}
          {heading?.subtitle ? (
            <div className="cricket-sheet-titles">
              <h2>{shownTitle}</h2>
              <small>{heading.subtitle}</small>
            </div>
          ) : (
            <h2>
              {shownTitle}
              {count !== undefined && <span className="cricket-sheet-count">{count}</span>}
            </h2>
          )}
          <button type="button" className="cricket-sheet-close" onClick={() => requestClose("close")} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>
        <ModalContext.Provider value={{ footer: footerSlot, close: () => requestClose("back"), guardClose, setHeading }}>
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
