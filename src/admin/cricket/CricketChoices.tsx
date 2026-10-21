import type { CricketBallType } from "../../api/types";
import { BALL_TYPES } from "./cricketOptions";

// A row of pill buttons; tapping the active one clears it unless `required`.
export function ChipChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <div className="cricket-field">
      <span className="cricket-field-label">
        {label}
        {required && <span className="cricket-required">*</span>}
      </span>
      <div className="cricket-chip-choice" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? "active" : ""}
            onClick={() => onChange(value === option.value && !required ? null : option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <small className="cricket-field-error">{error}</small>}
    </div>
  );
}

// The round ball pickers from the CricHeroes form.
export function BallTypeChoice({
  value,
  onChange,
  required,
  error,
}: {
  value: CricketBallType | null;
  onChange: (value: CricketBallType) => void;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <div className="cricket-field">
      <span className="cricket-field-label">
        Ball type{required && <span className="cricket-required">*</span>}
      </span>
      <div className="cricket-ball-choice" role="radiogroup" aria-label="Ball type">
        {BALL_TYPES.map((ball) => (
          <button
            key={ball.value}
            type="button"
            role="radio"
            aria-checked={value === ball.value}
            className={value === ball.value ? "active" : ""}
            onClick={() => onChange(ball.value)}
          >
            <span className="cricket-ball-icon" style={{ background: ball.color }}>
              {value === ball.value && <i className="fa-solid fa-check" aria-hidden="true"></i>}
            </span>
            {ball.label}
          </button>
        ))}
      </div>
      {error && <small className="cricket-field-error">{error}</small>}
    </div>
  );
}

// Coloured dot + label for read-only displays.
export function BallTypeBadge({ value }: { value: CricketBallType }) {
  const ball = BALL_TYPES.find((b) => b.value === value);
  if (!ball) return null;
  return (
    <span className="cricket-ball-badge">
      <span className="cricket-ball-dot" style={{ background: ball.color }}></span>
      {ball.label.toUpperCase()}
    </span>
  );
}
