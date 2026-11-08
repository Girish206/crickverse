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

// The lines that make each one read as a ball: a tennis ball's two curves,
// a leather ball's stitched seam, a plain moulded line on anything else.
function BallSeams({ type }: { type: CricketBallType }) {
  return (
    <svg className="cricket-ball-seams" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {type === "tennis" && (
        <g stroke="#fff" strokeWidth="2.6" transform="rotate(-28 20 20)">
          <path d="M7 -2C17 9 17 31 7 42" />
          <path d="M33 -2C23 9 23 31 33 42" />
        </g>
      )}
      {type === "leather" && (
        <g transform="rotate(-32 20 20)">
          <path d="M15 -2C21 12 21 28 15 42" stroke="#fff3e2" strokeWidth="7" strokeDasharray="1.3 2.3" />
          <path d="M15 -2C21 12 21 28 15 42" stroke="#7a1810" strokeWidth="1.2" />
        </g>
      )}
      {type === "other" && (
        <g stroke="#fff" strokeOpacity="0.75" strokeWidth="1.8">
          <path d="M-2 25C10 15 30 15 42 25" />
          <path d="M-2 31C10 21 30 21 42 31" />
        </g>
      )}
    </svg>
  );
}

// The round ball pickers.
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
            <span className="cricket-ball-icon" style={{ backgroundColor: ball.color }}>
              <BallSeams type={ball.value} />
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
