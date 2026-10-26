// A row of run buttons (0–6 by default). `values` picks exactly which to
// offer instead (e.g. only those with the same parity, when correcting a ball).
export function RunChoice({
  value,
  onChange,
  min = 0,
  max = 6,
  values,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  values?: number[];
}) {
  const shown = values ?? Array.from({ length: max - min + 1 }, (_, i) => i + min);
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
