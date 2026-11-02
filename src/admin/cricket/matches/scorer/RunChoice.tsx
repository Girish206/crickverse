// A row of run buttons (0–6 by default).
export function RunChoice({
  value,
  onChange,
  min = 0,
  max = 6,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const shown = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <div className="cricket-run-choice" role="radiogroup" style={{ ["--choices" as string]: shown.length }}>
      {shown.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={value === n ? "active" : ""}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
