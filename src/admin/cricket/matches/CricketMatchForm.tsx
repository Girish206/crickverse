import { Fragment, useEffect, useId, useState, type FormEvent, type Ref } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
import {
  ballsPerOverOf,
  type CricketBallType,
  type CricketMatch,
  type CricketMe,
  type CricketMatchStage,
  type CricketMatchType,
  type CricketPitchType,
  type CricketPlayer,
  type CricketTournament,
} from "../../../api/types";
import { ModalActions } from "../../components/ModalActions";
import CustomButton from "../../dms/components/CustomButton";
import { FormIdContext } from "../../dms/components/modalContext";
import { avatarColorFor } from "../avatarColor";
import { BottomSheet } from "../BottomSheet";
import { BallTypeChoice, ChipChoice } from "../CricketChoices";
import { SwitchRow } from "../SwitchRow";
import { MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { normalizeMobile } from "../mobile";
import { STAGES, stageLabel, teamKeyOf, usePlayerNames } from "./matchUtils";
import { useSuggestions } from "../useSuggestions";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerPicker } from "./PlayerPicker";
import { fetchTeamInvite } from "../../../api/hooks/cricket/useCricketTeamInvites";
import { messageFor } from "../../../api/mutationErrors";
import { QrScannerSheet, type ScanReply } from "../qr/QrScannerSheet";
import type { QrTarget } from "../qr/qrLinks";
import { TeamMark } from "../teams/TeamMark";
import { useSwipeTabs } from "../../useSwipeTabs";

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
export function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Teams a one-off match can pick (your saved teams, tournament teams, and the
// one-off sides of matches you play in, follow or organise), once each by
// teamKeyOf, so two different teams with the same name are both listed and
// kept apart.
function knownTeams(tournaments: CricketTournament[] | undefined, me: CricketMe | undefined) {
  const teams = new Map<string, { key: string; name: string; note: string; playerIds: Set<number>; logoUrl: string | null }>();
  // Teams made outside a tournament: picking one fills the side with its players.
  for (const team of me?.savedTeams ?? []) {
    teams.set(team.teamKey, {
      key: team.teamKey,
      name: team.name.trim(),
      note: "Your team",
      playerIds: new Set(team.playerIds),
      logoUrl: team.logoUrl,
    });
  }
  for (const t of tournaments ?? []) {
    t.teams.forEach((team, index) => {
      const key = `t:${t.id}:${index}`;
      teams.set(key, { key, name: team.name.trim(), note: t.name, playerIds: new Set(team.playerIds), logoUrl: team.logoUrl ?? null });
    });
  }
  const matches = me ? [...me.matches, ...me.followedMatches, ...me.followedPlayerMatches, ...me.createdMatches] : [];
  for (const match of matches.filter((m) => m.tournamentId === null)) {
    match.teams.forEach((side, slot) => {
      const key = teamKeyOf(match, slot);
      const team = teams.get(key) ?? {
        key,
        name: side.name.trim(),
        note: "Friendly team",
        playerIds: new Set<number>(),
        logoUrl: side.logoUrl ?? null,
      };
      side.playerIds.forEach((id) => team.playerIds.add(id));
      teams.set(key, team);
    });
  }
  return [...teams.values()]
    .filter((team) => team.name)
    .map((team) => ({
      key: team.key,
      name: team.name,
      logoUrl: team.logoUrl,
      note: team.playerIds.size ? `${team.note} · ${team.playerIds.size} players` : team.note,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.note.localeCompare(b.note));
}

// Overs a match can have, and the most one bowler may bowl (the API's limits).
const MAX_OVERS = 100;
const MAX_BOWLER_OVERS = 50;


type CaptainLookup =
  { status: "idle" | "looking" } | { status: "found"; player: CricketPlayer } | { status: "new"; mobile: string };

// A saved match in the shape the form submits, to spot unchanged details.
export function existingInput(match: CricketMatch) {
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
  // `formRef` when moving on. A new match gets a Schedule / Start Match button.
  formRef?: Ref<HTMLFormElement>;
  initialStartMode?: "immediate" | "scheduled";
  onSaved: () => void;
}

export function CricketMatchForm({
  existing,
  tournamentId: fixedTournament,
  formRef,
  initialStartMode,
  onSaved,
}: CricketMatchFormProps) {
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
  const startMode = initialStartMode ?? "immediate";
  const [teamA, setTeamA] = useState<number | null>(existing?.teams[0].teamIndex ?? 0);
  const [teamB, setTeamB] = useState<number | null>(existing?.teams[1].teamIndex ?? 1);
  // A standalone match names its own sides.
  const [teamAName, setTeamAName] = useState("");
  const [teamBName, setTeamBName] = useState("");
  // Which known team each one-off side was picked from (null = a new team).
  const [teamKeys, setTeamKeys] = useState<[string | null, string | null]>([null, null]);
  const [overs, setOvers] = useState(String(existing?.overs ?? 6));
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(existing?.scheduledAt ?? new Date().toISOString()));
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [matchType, setMatchType] = useState<CricketMatchType | null>(existing?.matchType ?? null);
  const [ballType, setBallType] = useState<CricketBallType | null>(existing?.ballType ?? null);
  const [pitchType, setPitchType] = useState<CricketPitchType | null>(existing?.pitchType ?? null);
  const [stage, setStage] = useState<CricketMatchStage>(existing?.stage ?? "league");
  // Playing conditions. The Hundred bowls 5-ball overs; a live match keeps
  // the length of its overs.
  const [ballsPerOver, setBallsPerOver] = useState(existing ? ballsPerOverOf(existing) : 6);
  const [bowlerLimit, setBowlerLimit] = useState(existing?.bowlerOverLimit ? String(existing.bowlerOverLimit) : "");
  const [lastManStands, setLastManStands] = useState(Boolean(existing?.lastManStands));
  const [freeHit, setFreeHit] = useState(existing?.freeHit !== false);
  const [isPublic, setIsPublic] = useState(Boolean(existing?.isPublic));
  // A rain-cut chase's new target (blank = first innings + 1).
  const [revisedTarget, setRevisedTarget] = useState(existing?.revisedTarget ? String(existing.revisedTarget) : "");
  const live = existing?.status === "live";
  // Finished (edited for a day after): where and when, not how it was played.
  const finished = existing?.status === "completed" || existing?.status === "abandoned";
  const chasing = live && (existing?.innings.length ?? 0) >= 2;
  // Form errors show inline and as a toast, so they're seen even when the
  // inline message is scrolled out of view.
  const [error, setInlineError] = useState<string | null>(null);
  const setError = (message: string | null) => {
    setInlineError(message);
    if (message) toast.error(message, { duration: 5000 });
  };
  // Set after a submit without match / ball type, to flag those fields.
  const [missingType, setMissingType] = useState(false);
  const [choosingStage, setChoosingStage] = useState(false);
  // The side whose team sheet is open, and a new name typed into it.
  const [choosingTeam, setChoosingTeam] = useState<0 | 1 | null>(null);
  const [newTeam, setNewTeam] = useState("");
  // A one-off match's team sheet: pick a known team, or name a new one.
  const [teamTab, setTeamTab] = useState<"existing" | "new">("existing");
  const teamTabSwipeRef = useSwipeTabs(["existing", "new"] as const, teamTab, setTeamTab);
  const [teamSearch, setTeamSearch] = useState("");
  // The side whose team is being scanned from its invite QR code — any
  // team, even one you don't follow (its captain shows you the code).
  const [scanningTeam, setScanningTeam] = useState<0 | 1 | null>(null);
  // A new team's captain, by mobile: a known number shows who it is, a new
  // one asks for their name.
  const [captainMobile, setCaptainMobile] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainLookup, setCaptainLookup] = useState<CaptainLookup>({ status: "idle" });
  const [newTeamError, setInlineTeamError] = useState<string | null>(null);
  const setNewTeamError = (message: string | null) => {
    setInlineTeamError(message);
    if (message) toast.error(message, { duration: 5000 });
  };
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
    pickMatchType(t.matchType);
    if (t.isPublic) setIsPublic(true);
    setBallType(t.ballType);
    setPitchType(t.pitchType);
    // The tournament's playing conditions (after the match type, which may
    // have set 5-ball overs for The Hundred).
    if (t.ballsPerOver) setBallsPerOver(t.ballsPerOver);
    setBowlerLimit(t.bowlerOverLimit ? String(t.bowlerOverLimit) : "");
    setLastManStands(Boolean(t.lastManStands));
    setFreeHit(t.freeHit !== false);
  }
  // The Hundred plays 5-ball overs; moving off it goes back to 6.
  function pickMatchType(type: CricketMatchType | null) {
    setMatchType(type);
    if (live) return;
    if (type === "hundred") setBallsPerOver(5);
    else if (matchType === "hundred" && ballsPerOver === 5) setBallsPerOver(6);
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
        .map((team, index) => ({
          name: team.name,
          index,
          key: null as string | null,
          note: null as string | null,
          logoUrl: team.logoUrl ?? null,
        }))
        .filter(({ index }) => index !== otherIndex);
    }
    const other = sideName(slot === 0 ? 1 : 0).toLowerCase();
    return knownTeams(tournaments, me)
      .filter((team) => team.name.toLowerCase() !== other)
      .map((team) => ({
        name: team.name,
        index: null as number | null,
        key: team.key as string | null,
        note: team.note as string | null,
        logoUrl: team.logoUrl,
      }));
  }
  // Each side's logo: its tournament team's, or the picked known team's.
  const sideLogo = (slot: 0 | 1) => {
    if (!standalone) {
      const index = slot === 0 ? teamA : teamB;
      return index === null ? null : (tournament?.teams[index]?.logoUrl ?? null);
    }
    const key = teamKeys[slot];
    return key === null ? null : (knownTeams(tournaments, me).find((team) => team.key === key)?.logoUrl ?? null);
  };
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
  async function onTeamScan(slot: 0 | 1, target: QrTarget): Promise<ScanReply> {
    if (target.kind !== "team") return;
    try {
      const team = await fetchTeamInvite(target.code);
      if (team.teamKey === teamKeys[slot === 0 ? 1 : 0]) return { tone: "error", text: `${team.name} is already the other side` };
      if (team.name.trim().toLowerCase() === sideName(slot === 0 ? 1 : 0).toLowerCase()) {
        return { tone: "error", text: "The other side already has this name" };
      }
      setScanningTeam(null);
      pickTeam(slot, team.name, null, null, team.teamKey);
    } catch (err) {
      return { tone: "error", text: messageFor(err) };
    }
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

  async function submitMatch(mode: "immediate" | "scheduled" = startMode) {
    const oversNumber = Number(overs);
    const names: [string, string] = [teamAName.trim(), teamBName.trim()];
    if (standalone) {
      if (!existing && (!names[0] || !names[1])) return setError("Select both teams.");
      if (!existing && names[0].toLowerCase() === names[1].toLowerCase()) {
        return setError("Select two different teams.");
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
    if (!Number.isInteger(oversNumber) || oversNumber < 1 || oversNumber > MAX_OVERS) {
      return setError(`Overs must be a whole number from 1 to ${MAX_OVERS}.`);
    }
    const limit = bowlerLimit.trim() ? Number(bowlerLimit) : null;
    const maxLimit = Math.min(oversNumber, MAX_BOWLER_OVERS);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > maxLimit)) {
      return setError(`Overs per bowler must be from 1 to ${maxLimit}, or blank for no limit.`);
    }
    const target = revisedTarget.trim() ? Number(revisedTarget) : null;
    if (target !== null && (!Number.isInteger(target) || target < 1)) {
      return setError("The revised target must be a whole number of runs.");
    }
    if (!matchType || !ballType) {
      setMissingType(true);
      return setError("Choose the match type and ball type.");
    }
    setMissingType(false);
    setError(null);
    const matchScheduledAt = !existing && mode === "immediate"
      ? new Date().toISOString()
      : (scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString());
    const input = {
      teamAIndex: teamA ?? 0,
      teamBIndex: teamB ?? 1,
      overs: oversNumber,
      scheduledAt: matchScheduledAt,
      venue: venue.trim() || null,
      city: city.trim() || null,
      matchType,
      ballType,
      pitchType,
      stage,
      ballsPerOver,
      bowlerOverLimit: limit,
      lastManStands,
      freeHit,
      isPublic,
    };
    if (existing) {
      // The setup sheet submits on every "Start Scoring"; skip the request
      // when nothing was changed.
      const saved = existingInput(existing);
      const targetChanged = chasing && target !== (existing.revisedTarget ?? null);
      const unchanged =
        scheduledAt === toLocalInput(existing.scheduledAt) &&
        (Object.keys(saved) as (keyof typeof saved)[]).every((key) => input[key] === saved[key]) &&
        ballsPerOver === ballsPerOverOf(existing) &&
        limit === (existing.bowlerOverLimit ?? null) &&
        lastManStands === Boolean(existing.lastManStands) &&
        freeHit === (existing.freeHit !== false) &&
        isPublic === Boolean(existing.isPublic) &&
        !targetChanged;
      if (!unchanged) {
        try {
          await updateMatch.mutateAsync({ id: existing.id, ...input, ...(chasing && { revisedTarget: target }) });
        } catch {
          // The global handler already toasted the server's reason.
          return setInlineError("Couldn't save the match details — try again.");
        }
      }
      onSaved();
    } else {
      let created;
      try {
        created = await createMatch.mutateAsync({
          tournamentId: tournament?.id ?? null,
          ...input,
          ...(standalone && { teamNames: names, teamKeys, captainIds: captains }),
        });
      } catch (err) {
        // The global handler already toasted it; keep it inline too.
        return setInlineError(messageFor(err));
      }
      onSaved();
      if (mode === "immediate") {
        navigate(`/matches/${created.id}/setup`);
      } else {
        navigate(`/matches/${created.id}`);
      }
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submitMatch(startMode);
  }

  const oversNumber = Number(overs) || 0;
  const suggestedLimit = Math.min(Math.ceil(oversNumber / 5), MAX_BOWLER_OVERS);
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
                      {name ? (
                        <TeamMark className="cricket-setup-logo" name={name} logoUrl={sideLogo(slot)} />
                      ) : (
                        <span className="cricket-setup-logo is-empty" aria-hidden="true">
                          <i className="fa-solid fa-shield-halved"></i>
                        </span>
                      )}
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
          {!finished && (
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
                  max={MAX_OVERS}
                  aria-label="Overs per innings"
                  value={overs}
                  onChange={(e) => setOvers(e.target.value)}
                />
                <button
                  type="button"
                  aria-label="More overs"
                  disabled={oversNumber >= MAX_OVERS}
                  onClick={() => setOvers(String(Math.min(MAX_OVERS, oversNumber + 1)))}
                >
                  <i className="fa-solid fa-plus" aria-hidden="true"></i>
                </button>
              </span>
            </div>
          )}
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
            onChange={pickMatchType}
            error={missingType && !matchType ? "Choose a match type." : null}
          />
          <BallTypeChoice
            required
            value={ballType}
            onChange={setBallType}
            error={missingType && !ballType ? "Choose a ball type." : null}
          />
          <ChipChoice
            label="Pitch type"
            options={PITCH_TYPES}
            value={pitchType}
            onChange={(val) => setPitchType(val ? (val as CricketPitchType) : null)}
          />
        </div>

        <h2 className="cricket-app-group-title">Playing conditions</h2>
        <div className="cricket-app-group">
          {!finished && (
            <>
              <div className="cricket-app-row">
                <span className="cricket-app-row-label">
                  <i className="fa-solid fa-baseball" aria-hidden="true"></i> Balls per over
                </span>
                <span className="cricket-app-stepper">
                  <button
                    type="button"
                    aria-label="Fewer balls an over"
                    disabled={live || ballsPerOver <= 4}
                    onClick={() => setBallsPerOver(ballsPerOver - 1)}
                  >
                    <i className="fa-solid fa-minus" aria-hidden="true"></i>
                  </button>
                  <input type="number" aria-label="Balls per over" value={ballsPerOver} readOnly />
                  <button
                    type="button"
                    aria-label="More balls an over"
                    disabled={live || ballsPerOver >= 10}
                    onClick={() => setBallsPerOver(ballsPerOver + 1)}
                  >
                    <i className="fa-solid fa-plus" aria-hidden="true"></i>
                  </button>
                </span>
              </div>
              <label className="cricket-app-row">
                <span className="cricket-app-row-label">
                  <i className="fa-solid fa-user-clock" aria-hidden="true"></i> Max overs per bowler
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={Math.min(oversNumber || MAX_BOWLER_OVERS, MAX_BOWLER_OVERS)}
                  placeholder="No limit"
                  value={bowlerLimit}
                  onChange={(e) => setBowlerLimit(e.target.value)}
                />
              </label>
              {/* The usual split: a fifth of the overs each, so five bowlers bowl. */}
              {!bowlerLimit && oversNumber >= 2 && (
                <div className="cricket-app-row is-hint">
                  <small className="admin-hint">
                    Usually a fifth of the overs —{" "}
                    <button type="button" className="admin-link-btn" onClick={() => setBowlerLimit(String(suggestedLimit))}>
                      use {suggestedLimit}
                    </button>
                  </small>
                </div>
          )}
          <SwitchRow
            icon="fa-solid fa-person"
            label="Last man stands"
            note="The last batter bats on alone"
            on={lastManStands}
            onChange={setLastManStands}
          />
          <SwitchRow
            icon="fa-solid fa-bolt"
            label="Free hit on a no-ball"
            note="The next ball can only be out run out"
            on={freeHit}
            onChange={setFreeHit}
          />
          </>
          )}
          <SwitchRow
            icon="fa-solid fa-globe"
            label="Anyone with the link can watch"
            note={isPublic ? "No sign-in needed to follow the score" : "Only signed-in people who follow can open it"}
            on={isPublic}
            onChange={setIsPublic}
          />
        </div>
        {live && <small className="admin-hint d-block">The length of an over can&apos;t change once the match has started.</small>}
        {finished && (
          <small className="admin-hint d-block">It&apos;s over, so the overs and playing conditions stay as it was scored.</small>
        )}

        {chasing && (
          <>
            <h2 className="cricket-app-group-title">Rain</h2>
            <div className="cricket-app-group">
              <label className="cricket-app-row">
                <span className="cricket-app-row-label">
                  <i className="fa-solid fa-cloud-rain" aria-hidden="true"></i> Revised target
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Not revised"
                  value={revisedTarget}
                  onChange={(e) => setRevisedTarget(e.target.value)}
                />
              </label>
            </div>
            <small className="admin-hint d-block">
              Rain cut the chase? Lower the overs above and set the runs they now need to win (e.g. by DLS). Leave it
              blank for the first innings&apos; score + 1.
            </small>
          </>
        )}

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
        {!existing && (
          <ModalActions>
            <CustomButton
              type="button"
              variant="outline"
              bg="custom-primary"
              disabled={createMatch.isPending}
              onClick={() => submitMatch("scheduled")}
            >
              <i className="fa-regular fa-calendar me-1" aria-hidden="true" />
              Schedule
            </CustomButton>
            <CustomButton
              type="button"
              variant="normal"
              bg="custom-primary"
              className="admin-form-submit"
              loading={createMatch.isPending}
              onClick={() => submitMatch("immediate")}
            >
              <i className="fa-solid fa-bolt me-1" aria-hidden="true" />
              Start Match
            </CustomButton>
          </ModalActions>
        )}

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
                  <div ref={teamTabSwipeRef} className="admin-segmented cricket-tabs" role="tablist" aria-label="Team">
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
              {standalone && teamTab === "existing" && (
                <button type="button" className="cricket-qr-scan-btn" onClick={() => setScanningTeam(choosingTeam)}>
                  <i className="fa-solid fa-qrcode" aria-hidden="true"></i> Scan a team's QR code
                </button>
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
                    .map(({ name, index, key, note, logoUrl }) => {
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
                            <TeamMark className="cricket-picker-avatar" name={name} logoUrl={logoUrl} />
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
        {scanningTeam !== null && (
          <QrScannerSheet
            title={`Scan Team ${scanningTeam + 1}`}
            hint="Point the camera at the team's invite QR code (its page → Players → Invite link)"
            accept={["team"]}
            onScan={(target) => onTeamScan(scanningTeam, target)}
            onClose={() => setScanningTeam(null)}
          />
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
