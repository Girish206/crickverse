import "./Loader.css";

// The in-page loading state: a spinner with a short label, centred in the
// space the content will fill. `page` gives it a taller area, for a whole
// screen under its PageHeader.
export function Loader({ label = "Loading", page }: { label?: string; page?: boolean }) {
  return (
    <div className={`cv-loader ${page ? "is-page" : ""}`.trim()} role="status" aria-live="polite">
      <span className="cv-loader-spinner" aria-hidden="true" />
      <span className="cv-loader-label">{label}…</span>
    </div>
  );
}
