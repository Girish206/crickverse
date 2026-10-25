import { useEffect } from "react";
import { createPortal } from "react-dom";

// A photo, logo or banner shown over everything (sheets included): a banner
// full size, a photo or logo (`round`) as a modest circle. Tap anywhere or
// press Escape to close.
export function ImageViewer({
  src,
  alt,
  round = false,
  onClose,
}: {
  src: string;
  alt: string;
  round?: boolean;
  onClose: () => void;
}) {
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

  return createPortal(
    <div
      className="cricket-image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button type="button" className="cricket-image-viewer-close" aria-label="Close">
        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
      <img src={src} alt={alt} className={round ? "is-round" : undefined} />
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
