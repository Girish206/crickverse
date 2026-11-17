import { PillSelect } from "../PillSelect";

// A knockout match's two teams: by default the ones the table or bracket
// gives, but the organiser can put in any team of the tournament instead
// (a team pulling out, a result decided off the field...). Picking the team
// already on the other side swaps the two.
export function SlotTeamsPicker({
  teams,
  value,
  onChange,
  suggested,
}: {
  teams: { name: string }[];
  value: [number, number];
  onChange: (value: [number, number]) => void;
  // Who the format puts in, to offer going back to it.
  suggested?: [number, number] | null;
}) {
  const options = teams.map((team, index) => ({ value: String(index), label: team.name }));
  function pick(side: 0 | 1, teamIndex: number) {
    const other = value[1 - side];
    const next: [number, number] = [...value];
    next[side] = teamIndex;
    if (teamIndex === other) next[1 - side] = value[side];
    onChange(next);
  }
  const changed = suggested && (suggested[0] !== value[0] || suggested[1] !== value[1]);
  return (
    <>
      <div className="cricket-app-group">
        {([0, 1] as const).map((side) => (
          <div key={side} className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-shield-halved" aria-hidden="true"></i> Team {side + 1}
            </span>
            <PillSelect
              label={`Team ${side + 1}`}
              value={String(value[side])}
              options={options}
              onChange={(next) => pick(side, Number(next))}
            />
          </div>
        ))}
      </div>
      {suggested &&
        (changed ? (
          <p className="admin-hint mt-2 mb-0 mx-1">
            The format puts in {teams[suggested[0]]?.name} v {teams[suggested[1]]?.name}.{" "}
            <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => onChange(suggested)}>
              Use those
            </button>
          </p>
        ) : (
          <p className="admin-hint mt-2 mb-0 mx-1">Filled in from the table. Change either team if you need to.</p>
        ))}
    </>
  );
}
