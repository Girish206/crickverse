import { Fragment, useEffect, useId, useState, type FormEvent, type Ref } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateCricketMatch,
  useCricketPlaces,
  useUpdateCricketMatch,
} from "../../../api/hooks/cricket/useCricketMatches";
import {
  useCreateCricketPlayer,
  useCricketMe,
  useCricketPlayers,
  lookupCricketPlayer,
} from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type {
  CricketBallType,
  CricketMatch,
  CricketMe,
  CricketMatchStage,
  CricketMatchType,
  CricketPitchType,
  CricketPlayer,
  CricketTournament,
} from "../../../api/types";
import { SubmitButton } from "../../components/SubmitButton";
import { FormIdContext } from "../../dms/components/modalContext";
import { avatarColorFor } from "../avatarColor";
import { BottomSheet } from "../BottomSheet";
import { BallTypeChoice, ChipChoice } from "../CricketChoices";
import { MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { normalizeMobile } from "../mobile";
import { STAGES, stageLabel, teamKeyOf, usePlayerNames } from "./matchUtils";
import { useSuggestions } from "../useSuggestions";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerPicker } from "./PlayerPicker";

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Teams a one-off match can pick (tournament teams, and the one-off sides
// of matches you play in, follow or organise), once each by teamKeyOf, so
// two different teams with the same name are both listed and kept apart.
function knownTeams(tournaments: CricketTournament[] | undefined, me: CricketMe | undefined) {
  const teams = new Map<string, { key: string; name: string; note: string; playerIds: Set<number> }>();
  for (const t of tournaments ?? []) {
    t.teams.forEach((team, index) => {
      const key = `t:${t.id}:${index}`;
      teams.set(key, { key, name: team.name.trim(), note: t.name, playerIds: new Set(team.playerIds) });
    });
  }
  const matches = me ? [...me.matches, ...me.followedMatches, ...me.followedPlayerMatches, ...me.createdMatches] : [];
  for (const match of matches.filter((m) => m.tournamentId === null)) {
    match.teams.forEach((side, slot) => {
      const key = teamKeyOf(match, slot);
      const team = teams.get(key) ?? { key, name: side.name.trim(), note: "Friendly team", playerIds: new Set<number>() };
      side.playerIds.forEach((id) => team.playerIds.add(id));
      teams.set(key, team);
    });
  }
  return [...teams.values()]
    .filter((team) => team.name)
    .map((team) => ({
      key: team.key,
      name: team.name,
      note: team.playerIds.size ? `${team.note} · ${team.playerIds.size} players` : team.note,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.note.localeCompare(b.note));
}

type CaptainLookup =
  { status: "idle" | "looking" } | { status: "found"; player: CricketPlayer } | { status: "new"; mobile: string };

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
  // Set when scheduling from inside a tournament; without it a new match is
  // a standalone one.
  tournamentId?: number;
  // Editing has no save button: the setup page submits it through
  // `formRef` when moving on. A new match gets a Schedule Match button.
  formRef?: Ref<HTMLFormElement>;
  onSaved: () => void;
}

export function CricketMatchForm({ existing, tournamentId: fixedTournament, formRef, onSaved }: CricketMatchFormProps) {
  const navigate = useNavigate();
  const { data: tournaments } = useCricketTournaments();
  const { data: me } = useCricketMe();
  const { data: places } = useCricketPlaces();
  const createMatch = useCreateCricketMatch();
  const createPlayer = useCreateCricketPlayer();
  const { data: players } = useCricketPlayers();
  const nameOf = usePlayerNames();
  const updateMatch = useUpdateCricketMatch();

  const tournamentId = existing?.tournamentId ?? fixedTournament ?? null;
  const [teamA, setTeamA] = useState<number | null>(existing?.teams[0].teamIndex ?? 0);
  const [teamB, setTeamB] = useState<number | null>(existing?.teams[1].teamIndex ?? 1);
  // A standalone match names its own sides.
  const [teamAName, setTeamAName] = useState("");
  const [teamBName, setTeamBName] = useState("");
  // Which known team each one-off side was picked from (null = a new team).
  const [teamKeys, setTeamKeys] = useState<[string | null, string | null]>([null, null]);
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
  // The side whose team sheet is open, and a new name typed into it.
  const [choosingTeam, setChoosingTeam] = useState<0 | 1 | null>(null);
  const [newTeam, setNewTeam] = useState("");
  // A one-off match's team sheet: pick a known team, or name a new one.
  const [teamTab, setTeamTab] = useState<"existing" | "new">("existing");
  const [teamSearch, setTeamSearch] = useState("");
  // A new team's captain, by mobile: a known number shows who it is, a new
  // one asks for their name.
  const [captainMobile, setCaptainMobile] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainLookup, setCaptainLookup] = useState<CaptainLookup>({ status: "idle" });
  const [newTeamError, setNewTeamError] = useState<string | null>(null);
  // A one-off match's captains (each joins their side's squad), and the
  // side whose captain picker is open, with a new player typed into it.
  // Only a newly named side picks a captain; a known team doesn't.
  const [captains, setCaptains] = useState<[number | null, number | null]>([null, null]);
  const [newSides, setNewSides] = useState<[boolean, boolean]>([false, false]);
  const [choosingCaptain, setChoosingCaptain] = useState<0 | 1 | null>(null);
  const [newCaptain, setNewCaptain] = useState({ name: "", mobile: "" });
  const [captainError, setCaptainError] = useState<string | null>(null);
  // Lets the Schedule Match button, portaled into the sheet footer, submit.
  const formId = useId();

  // Looks the captain's number up once it's a full one.
  const captainNumber = normalizeMobile(captainMobile);
  useEffect(() => {
    if (!captainNumber) return setCaptainLookup({ status: "idle" });
    let current = true;
    setCaptainLookup({ status: "looking" });
    const timer = setTimeout(() => {
      lookupCricketPlayer(captainNumber)
        .then((player) => {
          if (current)
            setCaptainLookup(player ? { status: "found", player } : { status: "new", mobile: captainNumber });
        })
        .catch(() => {
          if (!current) return;
          setCaptainLookup({ status: "idle" });
          setNewTeamError("Couldn't look up that number — try again.");
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [captainNumber]);

  const standalone = tournamentId === null;
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
  // Each side's name so far, for the team cards.
  const sideName = (slot: 0 | 1) => {
    if (standalone) return (slot === 0 ? teamAName : teamBName).trim();
    const index = slot === 0 ? teamA : teamB;
    return index === null ? "" : (tournament?.teams[index]?.name ?? "");
  };
  // The team sheet's list: a tournament's teams, or (one-off match) every
  // known team, or a new one typed in. Either way it leaves out the side
  // picked for the other slot.
  function teamChoices(slot: 0 | 1) {
    if (!standalone) {
      const otherIndex = slot === 0 ? teamB : teamA;
      return (tournament?.teams ?? [])
        .map((team, index) => ({ name: team.name, index, key: null as string | null, note: null as string | null }))
        .filter(({ index }) => index !== otherIndex);
    }
    const other = sideName(slot === 0 ? 1 : 0).toLowerCase();
    return knownTeams(tournaments, me)
      .filter((team) => team.name.toLowerCase() !== other)
      .map((team) => ({ name: team.name, index: null as number | null, key: team.key as string | null, note: team.note as string | null }));
  }
  // A new team comes with its captain (null for a known team, which comes
  // with its key instead).
  function pickTeam(slot: 0 | 1, name: string, index: number | null, captainId: number | null = null, key: string | null = null) {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return;
    if (standalone) {
      (slot === 0 ? setTeamAName : setTeamBName)(trimmed);
      setTeamKeys((current) => (slot === 0 ? [key, current[1]] : [current[0], key]));
      setCaptains((current) => (slot === 0 ? [captainId, current[1]] : [current[0], captainId]));
      setNewSides((current) => (slot === 0 ? [captainId !== null, current[1]] : [current[0], captainId !== null]));
    } else (slot === 0 ? setTeamA : setTeamB)(index);
    setNewTeam("");
    setCaptainMobile("");
    setCaptainName("");
    setNewTeamError(null);
    setChoosingTeam(null);
    setError(null);
  }
  async function addNewTeam(slot: 0 | 1) {
    const trimmed = newTeam.trim();
    if (!trimmed) return setNewTeamError("Enter the team name.");
    if (trimmed.toLowerCase() === sideName(slot === 0 ? 1 : 0).toLowerCase()) {
      return setNewTeamError("The other side already has this name.");
    }
    if (captainLookup.status === "found") {
      if (captainLookup.player.id === captains[slot === 0 ? 1 : 0]) {
        return setNewTeamError(`${captainLookup.player.name} already captains the other side.`);
      }
      return pickTeam(slot, trimmed, null, captainLookup.player.id);
    }
    if (captainLookup.status !== "new") return setNewTeamError("Enter the captain's 10-digit mobile number.");
    if (!captainName.trim()) return setNewTeamError("Enter the captain's name.");
    try {
      const player = await createPlayer.mutateAsync({
        name: captainName.trim(),
        role: null,
        mobile: captainLookup.mobile,
      });
      pickTeam(slot, trimmed, null, player.id);
    } catch {
      setNewTeamError("Couldn't add the captain — try again.");
    }
  }
  function pickCaptain(slot: 0 | 1, playerId: number | null) {
    setCaptains((current) => (slot === 0 ? [playerId, current[1]] : [current[0], playerId]));
    setChoosingCaptain(null);
    setNewCaptain({ name: "", mobile: "" });
    setCaptainError(null);
  }
  // Someone not on the player list yet: the mobile number says who it is
  // (an existing number just picks that player).
  async function addCaptain(slot: 0 | 1) {
    const mobile = normalizeMobile(newCaptain.mobile);
    if (!newCaptain.name.trim()) return setCaptainError("Enter the captain's name.");
    if (!mobile) return setCaptainError("Add their 10-digit mobile number too.");
    try {
      const player = await createPlayer.mutateAsync({
        name: newCaptain.name.trim(),
        role: null,
        mobile,
      });
      pickCaptain(slot, player.id);
    } catch {
      setCaptainError("Couldn't add that player — try again.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const oversNumber = Number(overs);
    const names: [string, string] = [teamAName.trim(), teamBName.trim()];
    if (standalone) {
      if (!existing && (!names[0] || !names[1])) return setError("Name both teams.");
      if (!existing && names[0].toLowerCase() === names[1].toLowerCase()) {
        return setError("The two teams need different names.");
      }
      const missing = ([0, 1] as const).find((slot) => newSides[slot] && captains[slot] === null);
      if (!existing && missing !== undefined) {
        setChoosingCaptain(missing);
        return setError(`Choose ${names[missing]}'s captain.`);
      }
    } else {
      if (!tournament) return setError("Choose a tournament.");
      if (tournament.teams.length < 2) return setError("Add at least two teams on the tournament's Teams tab first.");
      if (teamA === null || teamB === null || teamA === teamB) return setError("Choose two different teams.");
    }
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
      teamAIndex: teamA ?? 0,
      teamBIndex: teamB ?? 1,
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
      const created = await createMatch.mutateAsync({
        tournamentId: tournament?.id ?? null,
        ...input,
        ...(standalone && { teamNames: names, teamKeys, captainIds: captains }),
      });
      onSaved();
      navigate(`/matches/${created.id}`);
    }
  }

  const oversNumber = Number(overs) || 0;
  const groundSuggest = useSuggestions({ value: venue, suggestions: places?.grounds ?? [], onPick: setVenue });
  const citySuggest = useSuggestions({
    value: city,
    suggestions: places?.cities ?? [],
    onPick: setCity,
    icon: "fa-solid fa-city",
  });
  return (
    <FormIdContext.Provider value={formId}>
      <form id={formId} className="cricket-app-form" ref={formRef} onSubmit={onSubmit} noValidate>
        {/* A scheduled match keeps its teams; only its details are edited. */}
        {!existing && (
          <>
            <h2 className="cricket-app-group-title">Teams</h2>
            <div className="cricket-setup-teams">
              {([0, 1] as const).map((slot) => {
                const name = sideName(slot);
                return (
                  <Fragment key={slot}>
                    {slot === 1 && <span className="cricket-setup-vs">vs</span>}
                    <div className="cricket-setup-team">
                      <span
                        className={`cricket-setup-logo ${name ? "" : "is-empty"}`.trim()}
                        style={name ? { background: avatarColorFor(name) } : undefined}
                        aria-hidden="true"
                      >
                        {name ? name.charAt(0).toUpperCase() : <i className="fa-solid fa-shield-halved"></i>}
                      </span>
                      <strong className="cricket-setup-team-name">{name || `Team ${slot + 1}`}</strong>
                      {/* Only a newly named side has a captain to show (and change). */}
                      {standalone && captains[slot] !== null && (
                        <button
                          type="button"
                          className="cricket-setup-captain cricket-setup-captain-btn"
                          onClick={() => setChoosingCaptain(slot)}
                        >
                          <span className="cricket-role-tag">C</span> {nameOf(captains[slot])}
                        </button>
                      )}
                      <button
                        type="button"
                        className="cricket-setup-squad-btn"
                        onClick={() => {
                          setTeamTab(teamChoices(slot).length ? "existing" : "new");
                          setTeamSearch("");
                          setNewTeam("");
                          setCaptainMobile("");
                          setCaptainName("");
                          setNewTeamError(null);
                          setChoosingTeam(slot);
                        }}
                      >
                        <i className="fa-solid fa-people-group" aria-hidden="true"></i>{" "}
                        {name ? "Change" : "Select Team"}
                      </button>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </>
        )}

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
              {...groundSuggest.inputProps}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
            {groundSuggest.menu}
          </label>
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-city" aria-hidden="true"></i> City
            </span>
            <input
              placeholder="Add city"
              maxLength={100}
              {...citySuggest.inputProps}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            {citySuggest.menu}
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

        {!existing && tournament && (
          <small className="admin-hint d-block">
            Filled in from {tournament.name}; change anything for this match.
          </small>
        )}
        {!existing && standalone && (
          <small className="admin-hint d-block">
            A new team's captain joins its squad now; the rest are picked when the match starts.
          </small>
        )}
        {error && <div className="admin-banner admin-banner-error">{error}</div>}
        {!existing && <SubmitButton loading={createMatch.isPending}>Schedule Match</SubmitButton>}

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
        {choosingTeam !== null && (
          <BottomSheet
            title={`Team ${choosingTeam + 1}`}
            icon="fa-solid fa-people-group"
            onClose={() => setChoosingTeam(null)}
            fullScreen
          >
            <div className="cricket-team-sheet">
              {standalone && (
                <div className="cricket-team-sheet-head">
                  <div className="admin-segmented cricket-tabs" role="tablist" aria-label="Team">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={teamTab === "existing"}
                      className={teamTab === "existing" ? "active" : ""}
                      onClick={() => setTeamTab("existing")}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={teamTab === "new"}
                      className={teamTab === "new" ? "active" : ""}
                      onClick={() => setTeamTab("new")}
                    >
                      <i className="fa-solid fa-plus" aria-hidden="true"></i> New
                    </button>
                  </div>
                  {teamTab === "existing" && teamChoices(choosingTeam).length > 0 && (
                    <input
                      type="search"
                      className="form-control form-control-sm shadow-none"
                      placeholder="Search teams"
                      aria-label="Search teams"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                    />
                  )}
                </div>
              )}
              {/* Not a nested <form>: its submit would bubble to the match form. */}
              {standalone && teamTab === "new" ? (
                <div className="cricket-newteam">
                  <div className="cricket-newteam-hero">
                    <span
                      className={`cricket-newteam-crest ${newTeam.trim() ? "" : "is-empty"}`.trim()}
                      style={newTeam.trim() ? { background: avatarColorFor(newTeam.trim()) } : undefined}
                      aria-hidden="true"
                    >
                      {newTeam.trim() ? (
                        newTeam.trim().charAt(0).toUpperCase()
                      ) : (
                        <i className="fa-solid fa-shield-halved"></i>
                      )}
                    </span>
                    <div className="cricket-newteam-hero-text">
                      <small>New team</small>
                      <input
                        placeholder="Enter team name"
                        aria-label="New team name"
                        maxLength={60}
                        autoFocus
                        value={newTeam}
                        onChange={(e) => {
                          setNewTeam(e.target.value);
                          setNewTeamError(null);
                        }}
                      />
                    </div>
                  </div>

                  <div className={`cricket-newteam-card ${newTeam.trim() ? "" : "is-locked"}`.trim()}>
                    <div className="cricket-newteam-card-head">
                      <i className="fa-solid fa-user-tie" aria-hidden="true"></i>
                      <span>Captain</span>
                      {!newTeam.trim() && <small>Name the team first</small>}
                    </div>
                    <label className="cricket-newteam-field">
                      <i className="fa-solid fa-mobile-screen" aria-hidden="true"></i>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        placeholder="Mobile number"
                        aria-label="Captain's mobile number"
                        maxLength={20}
                        disabled={!newTeam.trim()}
                        value={captainMobile}
                        onChange={(e) => {
                          setCaptainMobile(e.target.value);
                          setCaptainName("");
                          setNewTeamError(null);
                        }}
                      />
                      {captainLookup.status === "looking" && (
                        <span className="spinner-border spinner-border-sm" aria-label="Looking up"></span>
                      )}
                    </label>
                    {captainLookup.status === "found" && (
                      <div className="cricket-newteam-found">
                        <PlayerAvatar
                          name={captainLookup.player.name}
                          photoUrl={captainLookup.player.photoUrl}
                          className="cricket-picker-avatar"
                        />
                        <span className="cricket-newteam-found-text">
                          <strong>{captainLookup.player.name}</strong>
                          <small>Registered player</small>
                        </span>
                        <span className="cricket-role-tag">C</span>
                      </div>
                    )}
                    {captainLookup.status === "new" && (
                      <>
                        <p className="cricket-newteam-note">
                          <i className="fa-solid fa-circle-info" aria-hidden="true"></i> New number — add their name.
                        </p>
                        <label className="cricket-newteam-field">
                          <i className="fa-regular fa-user" aria-hidden="true"></i>
                          <input
                            placeholder="Captain's name"
                            aria-label="Captain's name"
                            maxLength={100}
                            autoFocus
                            value={captainName}
                            onChange={(e) => {
                              setCaptainName(e.target.value);
                              setNewTeamError(null);
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {newTeamError && <small className="input-error">{newTeamError}</small>}
                  <button
                    type="button"
                    className="btn btn-custom-primary cricket-newteam-submit"
                    disabled={!newTeam.trim() || captainLookup.status === "looking" || createPlayer.isPending}
                    onClick={() => void addNewTeam(choosingTeam)}
                  >
                    {createPlayer.isPending ? (
                      <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                    ) : (
                      <i className="fa-solid fa-plus" aria-hidden="true"></i>
                    )}{" "}
                    Add Team
                  </button>
                </div>
              ) : teamChoices(choosingTeam).length === 0 ? (
                <div className="admin-empty-state">
                  {standalone ? "No teams yet — create a new one." : "Add teams on the tournament's Teams tab first."}
                </div>
              ) : (
                <ul className="cricket-picker-list">
                  {teamChoices(choosingTeam)
                    .filter(({ name }) => name.toLowerCase().includes(teamSearch.trim().toLowerCase()))
                    .map(({ name, index, key, note }) => {
                      const selected = standalone
                        ? teamKeys[choosingTeam] === key
                        : sideName(choosingTeam).toLowerCase() === name.toLowerCase();
                      return (
                        <li key={key ?? index ?? name}>
                          <button
                            type="button"
                            className={`cricket-picker-item ${selected ? "is-selected" : ""}`}
                            onClick={() => pickTeam(choosingTeam, name, index, null, key)}
                          >
                            <span className="cricket-picker-avatar" style={{ background: avatarColorFor(name) }}>
                              {name.charAt(0).toUpperCase()}
                            </span>
                            <span className="cricket-picker-text">
                              <strong>{name}</strong>
                              {note && <small>{note}</small>}
                            </span>
                            {selected && (
                              <i className="fa-solid fa-circle-check cricket-picker-check" aria-hidden="true"></i>
                            )}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </BottomSheet>
        )}
        {choosingCaptain !== null && (
          <PlayerPicker
            title={`${sideName(choosingCaptain) || `Team ${choosingCaptain + 1}`} — Captain`}
            icon="fa-solid fa-user-tie"
            items={(players ?? [])
              .filter((player) => player.id !== captains[choosingCaptain === 0 ? 1 : 0])
              .map((player) => ({ id: player.id }))}
            nameOf={nameOf}
            selectedId={captains[choosingCaptain]}
            onPick={(playerId) => pickCaptain(choosingCaptain, playerId)}
            onClose={() => setChoosingCaptain(null)}
            footer={
              <div className="cricket-captain-add">
                <div className="cricket-quick-add">
                  <input
                    className="form-control shadow-none"
                    placeholder="New player's name"
                    maxLength={100}
                    value={newCaptain.name}
                    onChange={(e) => setNewCaptain({ ...newCaptain, name: e.target.value })}
                  />
                  <input
                    className="form-control shadow-none"
                    type="tel"
                    inputMode="tel"
                    placeholder="Mobile number"
                    maxLength={20}
                    value={newCaptain.mobile}
                    onChange={(e) => setNewCaptain({ ...newCaptain, mobile: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-custom-primary"
                    disabled={createPlayer.isPending || !newCaptain.name.trim()}
                    onClick={() => void addCaptain(choosingCaptain)}
                  >
                    <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Add
                  </button>
                </div>
                {captainError && <small className="input-error">{captainError}</small>}
                {captains[choosingCaptain] !== null && (
                  <button type="button" className="admin-link-btn" onClick={() => pickCaptain(choosingCaptain, null)}>
                    Remove captain
                  </button>
                )}
              </div>
            }
          />
        )}
      </form>
    </FormIdContext.Provider>
  );
}
