import { useState, type ChangeEvent, type FormEvent, type Ref } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateCricketMatch, useUpdateCricketMatch } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type {
  CricketBallType,
  CricketMatch,
  CricketMatchStage,
  CricketMatchType,
  CricketPitchType,
  CricketTournament,
} from "../../../api/types";
import { ModalForm } from "../../components/ModalForm";
import { SubmitButton } from "../../components/SubmitButton";
import InputComp from "../../dms/components/InputComp";
import SelectInput from "../../dms/components/SelectInput";
import { BottomSheet } from "../BottomSheet";
import { BallTypeChoice, ChipChoice } from "../CricketChoices";
import { MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { STAGES, stageLabel } from "./matchUtils";

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// A saved match in the shape the form submits, to spot unchanged details.
function existingInput(match: CricketMatch) {
  return {
    teamAIndex: match.teams[0].teamIndex,
    teamBIndex: match.teams[1].teamIndex,
    overs: match.overs,
    venue: match.venue,
    city: match.city,
    matchType: match.matchType,
    ballType: match.ballType,
    pitchType: match.pitchType,
    stage: match.stage ?? "league",
  };
}

export interface CricketMatchFormProps {
  existing?: CricketMatch;
  // Fixed when scheduling from inside a tournament.
  tournamentId?: number;
  // App-style grouped rows for the match setup sheet, instead of the
  // desktop form fields. It has no save button: the sheet submits it
  // through `formRef` when moving on.
  compact?: boolean;
  formRef?: Ref<HTMLFormElement>;
  onSaved: () => void;
}

export function CricketMatchForm({
  existing,
  tournamentId: fixedTournament,
  compact,
  formRef,
  onSaved,
}: CricketMatchFormProps) {
  const navigate = useNavigate();
  const { data: tournaments } = useCricketTournaments();
  const createMatch = useCreateCricketMatch();
  const updateMatch = useUpdateCricketMatch();

  const [tournamentId, setTournamentId] = useState<number | null>(
    existing?.tournamentId ?? fixedTournament ?? null,
  );
  const [teamA, setTeamA] = useState<number | null>(existing?.teams[0].teamIndex ?? 0);
  const [teamB, setTeamB] = useState<number | null>(existing?.teams[1].teamIndex ?? 1);
  const [overs, setOvers] = useState(String(existing?.overs ?? 6));
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(existing?.scheduledAt ?? null));
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [matchType, setMatchType] = useState<CricketMatchType | null>(existing?.matchType ?? null);
  const [ballType, setBallType] = useState<CricketBallType | null>(existing?.ballType ?? null);
  const [pitchType, setPitchType] = useState<CricketPitchType | null>(existing?.pitchType ?? null);
  const [stage, setStage] = useState<CricketMatchStage>(existing?.stage ?? "league");
  const [error, setError] = useState<string | null>(null);
  // Set after a submit without match / ball type, to flag those fields.
  const [missingType, setMissingType] = useState(false);
  const [choosingStage, setChoosingStage] = useState(false);

  const tournament =tournaments?.find((t) => t.id === tournamentId);

  // A new match takes the tournament's details (overs, ground, city, match /
  // ball / pitch type); they can still be changed for this one match.
  function fillFrom(t: CricketTournament | undefined) {
    if (!t) return;
    if (t.overs) setOvers(String(t.overs));
    setVenue(t.ground ?? "");
    setCity(t.city ?? "");
    setMatchType(t.matchType);
    setBallType(t.ballType);
    setPitchType(t.pitchType);
  }
  const [filledFor, setFilledFor] = useState<number | null>(existing ? existing.tournamentId : null);
  if (tournament && filledFor !== tournament.id) {
    setFilledFor(tournament.id);
    fillFrom(tournament);
  }
  const teamOptions = (tournament?.teams ?? []).map((team, index) => ({ value: index, label: team.name }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const oversNumber = Number(overs);
    if (!tournament) return setError("Choose a tournament.");
    if (tournament.teams.length < 2) return setError("Add at least two teams on the tournament's Teams tab first.");
    if (teamA === null || teamB === null || teamA === teamB) return setError("Choose two different teams.");
    if (!Number.isInteger(oversNumber) || oversNumber < 1 || oversNumber > 50) {
      return setError("Overs must be a whole number from 1 to 50.");
    }
    if (!matchType || !ballType) {
      setMissingType(true);
      return setError("Choose the match type and ball type.");
    }
    setMissingType(false);
    setError(null);
    const input = {
      teamAIndex: teamA,
      teamBIndex: teamB,
      overs: oversNumber,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      venue: venue.trim() || null,
      city: city.trim() || null,
      matchType,
      ballType,
      pitchType,
      stage,
    };
    if (existing) {
      // The setup sheet submits on every "Start Scoring"; skip the request
      // when nothing was changed.
      const saved = existingInput(existing);
      const unchanged =
        scheduledAt === toLocalInput(existing.scheduledAt) &&
        (Object.keys(saved) as (keyof typeof saved)[]).every((key) => input[key] === saved[key]);
      if (!unchanged) {
        try {
          await updateMatch.mutateAsync({ id: existing.id, ...input });
        } catch {
          return setError("Couldn't save the match details — try again.");
        }
      }
      onSaved();
    } else {
      const created = await createMatch.mutateAsync({ tournamentId: tournament.id, ...input });
      onSaved();
      navigate(`/matches/${created.id}`);
    }
  }

  if (compact) {
    const oversNumber = Number(overs) || 0;
    return (
      <form className="cricket-app-form" ref={formRef} onSubmit={onSubmit} noValidate>
        <h2 className="cricket-app-group-title">Match details</h2>
        <div className="cricket-app-group">
          <div className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-stopwatch" aria-hidden="true"></i> Overs
            </span>
            <span className="cricket-app-stepper">
              <button
                type="button"
                aria-label="Fewer overs"
                disabled={oversNumber <= 1}
                onClick={() => setOvers(String(Math.max(1, oversNumber - 1)))}
              >
                <i className="fa-solid fa-minus" aria-hidden="true"></i>
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                aria-label="Overs per innings"
                value={overs}
                onChange={(e) => setOvers(e.target.value)}
              />
              <button
                type="button"
                aria-label="More overs"
                disabled={oversNumber >= 50}
                onClick={() => setOvers(String(Math.min(50, oversNumber + 1)))}
              >
                <i className="fa-solid fa-plus" aria-hidden="true"></i>
              </button>
            </span>
          </div>
          <button type="button" className="cricket-app-row" onClick={() => setChoosingStage(true)}>
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-trophy" aria-hidden="true"></i> Stage
            </span>
            <span className="cricket-app-row-value">{stageLabel(stage)}</span>
            <i className="fa-solid fa-chevron-right cricket-app-row-chevron" aria-hidden="true"></i>
          </button>
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-regular fa-calendar" aria-hidden="true"></i> Date & time
            </span>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </label>
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-location-dot" aria-hidden="true"></i> Ground
            </span>
            <input
              placeholder="Add ground"
              maxLength={150}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
          </label>
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-city" aria-hidden="true"></i> City
            </span>
            <input placeholder="Add city" maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
        </div>

        <div className="cricket-app-group is-padded">
          <ChipChoice
            label="Match type"
            required
            options={MATCH_TYPES}
            value={matchType}
            onChange={setMatchType}
            error={missingType && !matchType ? "Choose a match type." : null}
          />
          <BallTypeChoice
            required
            value={ballType}
            onChange={setBallType}
            error={missingType && !ballType ? "Choose a ball type." : null}
          />
          <ChipChoice label="Pitch type" options={PITCH_TYPES} value={pitchType} onChange={setPitchType} />
        </div>

        {error && <div className="admin-banner admin-banner-error">{error}</div>}

        {choosingStage && (
          <BottomSheet title="Stage" icon="fa-solid fa-trophy" onClose={() => setChoosingStage(false)} fullScreen>
            <ul className="cricket-picker-list">
              {STAGES.map((s) => (
                <li key={s.value}>
                  <button
                    type="button"
                    className={`cricket-picker-item ${stage === s.value ? "is-selected" : ""}`}
                    onClick={() => {
                      setStage(s.value);
                      setChoosingStage(false);
                    }}
                  >
                    <span className="cricket-picker-avatar cricket-stage-icon">
                      <i className={`fa-solid ${s.icon}`} aria-hidden="true"></i>
                    </span>
                    <span className="cricket-picker-text">
                      <strong>{s.label}</strong>
                      <small>{s.note}</small>
                    </span>
                    {stage === s.value && (
                      <i className="fa-solid fa-circle-check cricket-picker-check" aria-hidden="true"></i>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </BottomSheet>
        )}
      </form>
    );
  }

  return (
    <ModalForm onSubmit={onSubmit}>
      {!existing && fixedTournament === undefined && (
        <SelectInput
          label="Tournament"
          required
          clearable={false}
          options={(tournaments ?? []).map((t) => ({ value: t.id, label: t.name }))}
          value={tournamentId ?? ""}
          onChange={(value) => {
            setTournamentId(value || null);
            setTeamA(0);
            setTeamB(1);
          }}
        />
      )}
      {/* A scheduled match keeps its teams; only its details are edited. */}
      {!existing && (
        <div className="cricket-form-row">
          <SelectInput
            label="Team 1"
            required
            clearable={false}
            options={teamOptions}
            value={teamA ?? ""}
            onChange={(value) => setTeamA(value ?? null)}
          />
          <SelectInput
            label="Team 2"
            required
            clearable={false}
            options={teamOptions}
            value={teamB ?? ""}
            onChange={(value) => setTeamB(value ?? null)}
          />
        </div>
      )}
      <div className="cricket-form-row">
        <InputComp
          label="Overs per innings"
          type="number"
          min={1}
          max={50}
          required
          value={overs}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setOvers(e.target.value)}
        />
        <SelectInput
          label="Stage"
          clearable={false}
          options={STAGES}
          value={stage}
          onChange={(value) => setStage(value ?? "league")}
        />
      </div>
      <div className="cricket-form-row">
        <InputComp
          label="Date & time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setScheduledAt(e.target.value)}
        />
        <InputComp
          label="Ground"
          value={venue}
          maxLength={150}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setVenue(e.target.value)}
        />
      </div>
      <div className="cricket-form-row">
        <InputComp
          label="City"
          value={city}
          maxLength={100}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
        />
      </div>
      <ChipChoice
        label="Match type"
        required
        options={MATCH_TYPES}
        value={matchType}
        onChange={setMatchType}
        error={missingType && !matchType ? "Choose a match type." : null}
      />
      <BallTypeChoice
        required
        value={ballType}
        onChange={setBallType}
        error={missingType && !ballType ? "Choose a ball type." : null}
      />
      <ChipChoice label="Pitch type" options={PITCH_TYPES} value={pitchType} onChange={setPitchType} />
      {tournament && (
        <small className="admin-hint d-block">Filled in from {tournament.name}; change anything for this match.</small>
      )}
      {error && <div className="admin-banner admin-banner-error mt-2">{error}</div>}
      <SubmitButton loading={createMatch.isPending || updateMatch.isPending}>
        {existing ? "Save" : "Schedule Match"}
      </SubmitButton>
    </ModalForm>
  );
}
