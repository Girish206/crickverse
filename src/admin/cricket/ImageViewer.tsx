import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";

// A photo, logo or banner shown over everything (sheets included), with
// what it is along the top. A photo or logo (`round`) shows as a large
// rounded square, uncropped; a banner full width, and a tap zooms it in.
// Tap the backdrop, swipe down or press Escape to close.
export function ImageViewer({
  src,
  alt,
  title,
  subtitle,
  round = false,
  onClose,
}: {
  src: string;
  alt: string;
  // Whose it is and what it is, e.g. "Rahul S" / "Profile photo".
  title?: string;
  subtitle?: string;
  round?: boolean;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ y: number; id: number } | null>(null);

  useEffect(() => {
    // Captured first and stopped, so Escape doesn't also close a sheet
    // underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  // Swipe down to dismiss (not while zoomed, when a drag pans instead).
  const onPointerDown = (e: PointerEvent) => {
    if (zoomed || e.pointerType === "mouse") return;
    drag.current = { y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dragY > 110) onClose();
    else setDragY(0);
  };

  return createPortal(
    <div
      className={`cricket-image-viewer ${zoomed ? "is-zoomed" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={dragY ? ({ "--viewer-drag": `${dragY}px`, "--viewer-fade": Math.max(0.3, 1 - dragY / 400) } as CSSProperties) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        // A swipe that didn't go far enough isn't a tap.
        if (!dragY) onClose();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <header className="cricket-image-viewer-bar">
        <span className="cricket-image-viewer-caption">
          {title && <strong>{title}</strong>}
          {subtitle && <small>{subtitle}</small>}
        </span>
        <button type="button" className="cricket-image-viewer-close" aria-label="Close">
          <i className="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>
      <div className="cricket-image-viewer-stage">
        <img
          src={src}
          alt={alt}
          className={round ? "is-round" : undefined}
          draggable={false}
          onClick={(e) => {
            // A banner zooms in and out; a photo or logo is already as big as it gets.
            e.stopPropagation();
            if (!round) setZoomed((z) => !z);
          }}
        />
      </div>
      {!round && <p className="cricket-image-viewer-hint">{zoomed ? "Tap to zoom out" : "Tap to zoom in"}</p>}
    </div>,
    document.body,
  );
}

// Props that make an element open the viewer on click / Enter, without the
// click reaching a card or row it sits in.
export function viewerTrigger(open: () => void) {
  return {
    role: "button",
    tabIndex: 0,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      open();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.stopPropagation();
      open();
    },
  };
}
