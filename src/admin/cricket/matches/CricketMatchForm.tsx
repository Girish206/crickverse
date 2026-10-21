import { useState, type ChangeEvent, type FormEvent } from "react";
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
import { BallTypeChoice, ChipChoice } from "../CricketChoices";
import { MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { STAGES } from "./matchUtils";

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export interface CricketMatchFormProps {
  existing?: CricketMatch;
  // Fixed when scheduling from inside a tournament.
  tournamentId?: number;
  onSaved: () => void;
}

export function CricketMatchForm({ existing, tournamentId: fixedTournament, onSaved }: CricketMatchFormProps) {
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

  const tournament = tournaments?.find((t) => t.id === tournamentId);

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
      await updateMatch.mutateAsync({ id: existing.id, ...input });
      onSaved();
    } else {
      const created = await createMatch.mutateAsync({ tournamentId: tournament.id, ...input });
      onSaved();
      navigate(`/matches/${created.id}`);
    }
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
      <ChipChoice label="Match type" options={MATCH_TYPES} value={matchType} onChange={setMatchType} />
      <BallTypeChoice value={ballType} onChange={setBallType} />
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
