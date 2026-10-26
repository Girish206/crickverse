import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type QrScannerType from "qr-scanner";
import { BottomSheet } from "../BottomSheet";
import { parseQr, type QrTarget } from "./qrLinks";
import "./qr.css";

type Status = { tone: "info" | "error" | "success"; text: string };

// What a scan handler answers: a line to show under the camera (a success
// or why it didn't work). The sheet keeps scanning either way, so several
// players can be added one after another; the caller closes it when done.
export type ScanReply = Status | void;

const KIND_LABEL = { player: "a player's", team: "a team's" } as const;

// Scans CricDesk QR codes with the back camera (or from a photo of one),
// passing on the ones of the kinds asked for. The scanner library loads
// only when the sheet opens.
export function QrScannerSheet({
  title,
  hint,
  accept,
  onScan,
  onClose,
}: {
  title: string;
  hint: string;
  accept: QrTarget["kind"][];
  onScan: (target: QrTarget) => ScanReply | Promise<ScanReply>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const [status, setStatus] = useState<Status>({ tone: "info", text: hint });
  const [cameraError, setCameraError] = useState<string | null>(null);
  // The handler and what it last read, kept in refs so the camera (started
  // once) always calls the current handler and skips a code it just read.
  const handle = useRef<(text: string) => void>(() => undefined);
  const last = useRef<{ text: string; at: number } | null>(null);
  const busy = useRef(false);

  async function onCode(text: string) {
    const now = Date.now();
    if (busy.current || (last.current?.text === text && now - last.current.at < 3000)) return;
    last.current = { text, at: now };
    const target = parseQr(text);
    if (!target) return setStatus({ tone: "error", text: "That isn't a CricDesk QR code" });
    if (!accept.includes(target.kind)) {
      return setStatus({ tone: "error", text: `That's ${KIND_LABEL[target.kind]} code — scan ${accept.map((k) => KIND_LABEL[k]).join(" or ")} instead` });
    }
    busy.current = true;
    try {
      const reply = await onScan(target);
      if (reply) setStatus(reply);
      navigator.vibrate?.(60);
    } finally {
      busy.current = false;
      last.current = { text, at: Date.now() };
    }
  }
  useEffect(() => {
    handle.current = onCode;
  });

  useEffect(() => {
    let cancelled = false;
    import("qr-scanner")
      .then(({ default: QrScanner }) => {
        if (cancelled || !videoRef.current) return;
        const scanner = new QrScanner(videoRef.current, (result) => handle.current(result.data), {
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 8,
        });
        scannerRef.current = scanner;
        return scanner.start();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : String(err);
        setCameraError(
          /NotAllowed|Permission|denied/i.test(name)
            ? "Camera access is blocked. Allow it in your browser's site settings, or scan a photo of the code."
            : /NotFound|no camera/i.test(name)
              ? "No camera found. Scan a photo of the code instead."
              : "Couldn't start the camera. Scan a photo of the code instead.",
        );
      });
    return () => {
      cancelled = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  async function scanPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { default: QrScanner } = await import("qr-scanner");
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      last.current = null;
      await handle.current(result.data);
    } catch {
      setStatus({ tone: "error", text: "No QR code found in that photo" });
    }
  }

  return (
    <BottomSheet title={title} icon="fa-solid fa-qrcode" onClose={onClose}>
      <div className="cricket-qr-scan">
        {cameraError ? (
          <div className="cricket-qr-scan-blocked">
            <i className="fa-solid fa-camera-rotate" aria-hidden="true"></i>
            <p>{cameraError}</p>
          </div>
        ) : (
          <div className="cricket-qr-scan-view">
            <video ref={videoRef} muted playsInline aria-label="Camera" />
          </div>
        )}
        <p className={`cricket-qr-scan-status is-${status.tone}`} role="status" aria-live="polite">
          {status.tone === "success" && <i className="fa-solid fa-circle-check" aria-hidden="true"></i>}
          {status.tone === "error" && <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>}
          {status.text}
        </p>
        <label className="btn btn-sm btn-outline-secondary cricket-qr-scan-photo">
          <i className="fa-regular fa-image" aria-hidden="true"></i> Scan a photo
          <input type="file" accept="image/*" onChange={scanPhoto} hidden />
        </label>
      </div>
    </BottomSheet>
  );
}
