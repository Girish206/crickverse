import { useEffect, useState } from "react";
import "./qr.css";

// A QR code for `value`, drawn as an SVG (dark on white, so any camera
// reads it, in either theme). The encoder loads only when one is shown; if
// it can't load (offline, or a new app version), it says so with a retry
// rather than leaving a blank square.
export function QrCode({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState<{ value: string; markup: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    import("qrcode")
      .then((qr) => (qr.default ?? qr).toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" }))
      .then((markup) => live && setSvg({ value, markup }))
      .catch(() => live && setFailed(value));
    return () => {
      live = false;
    };
  }, [value, attempt]);

  if (failed === value && svg?.value !== value) {
    return (
      <div className="cricket-qr is-failed" role="alert">
        <p>Couldn't draw the QR code.</p>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => {
            setFailed(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  const markup = svg?.value === value ? svg.markup : null;
  return (
    <div
      className={`cricket-qr ${markup ? "" : "is-loading"}`.trim()}
      role="img"
      aria-label={label}
      // The encoder's own markup: an <svg> of paths, nothing from users.
      dangerouslySetInnerHTML={markup ? { __html: markup } : undefined}
    />
  );
}
