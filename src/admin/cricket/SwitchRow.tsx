// An on/off row in a settings group (match and tournament forms), like the
// scorer's shot map switch.
export function SwitchRow({
  icon,
  label,
  note,
  on,
  onChange,
}: {
  icon: string;
  label: string;
  note?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button type="button" className="cricket-app-row cricket-app-switch" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="cricket-app-row-label">
        <i className={icon} aria-hidden="true"></i>
        <span className="cricket-app-switch-text">
          {label}
          {note && <small>{note}</small>}
        </span>
      </span>
      <span className={`cricket-shot-toggle-knob ${on ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
    </button>
  );
}
