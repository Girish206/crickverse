import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { fetchTeamInvite } from "../../../api/hooks/cricket/useCricketTeamInvites";
import { messageFor } from "../../../api/mutationErrors";
import {
  useAddCricketTeams,
  useCricketTournaments,
  useSetCricketTeamLogo,
  useUpdateCricketTeam,
} from "../../../api/hooks/cricket/useCricketTournaments";
import { isGeneratedTeam, type CricketTournament } from "../../../api/types";
import { Button } from "../../components/Button";
import { ModalForm } from "../../components/ModalForm";
import { SubmitButton } from "../../components/SubmitButton";
import InputComp from "../../dms/components/InputComp";
import { AddPlayerByMobile } from "../players/AddPlayerByMobile";
import { PlayerCard } from "../players/PlayerCard";
import { QrScannerSheet, type ScanReply } from "../qr/QrScannerSheet";
import type { QrTarget } from "../qr/qrLinks";
import { TeamLogoField } from "../teams/TeamLogoField";
import { useImagePick } from "./CricketTournamentForm";
import { NO_ROLES, rolesOf, rolesWithout, TeamRoleChips, type TeamRoles } from "./TeamRoleChips";

export const MAX_TEAMS = 16;

const nameKey = (name: string) => name.trim().toLowerCase();

// "Team A", "Team B", ... skipping names the tournament already has.
export function defaultTeamNames(tournament: CricketTournament, count: number) {
  const taken = new Set(tournament.teams.map((team) => nameKey(team.name)));
  const names: string[] = [];
  for (let i = 0; names.length < count; i++) {
    const name = `Team ${i < 26 ? String.fromCharCode(65 + i) : i + 1}`;
    if (!taken.has(nameKey(name))) names.push(name);
  }
  return names;
}

// Which team each player of this tournament is on.
const teamOfPlayer = (tournament: CricketTournament) =>
  new Map(tournament.teams.flatMap((team, index) => team.playerIds.map((id) => [id, index] as const)));

// "Automatically": pick how many generated teams, then the squad / matched
// sets / generate steps fill them. Hand-built teams count towards the limit
// but aren't touched.
export function AutoTeamCount({ tournament }: { tournament: CricketTournament }) {
  const addTeams = useAddCricketTeams();
  const have = tournament.teams.filter(isGeneratedTeam).length;
  const room = MAX_TEAMS - (tournament.teams.length - have);
  const [count, setCount] = useState(Math.max(2, have));
  const counts = Array.from({ length: Math.max(0, room - 1) }, (_, i) => i + 2).filter((n) => n >= Math.max(2, have));

  return (
    <div className="mb-2">
      <p className="admin-hint">
        How many generated teams? Then pick the squad, match players of equal strength, and generate — each matched set is
        dealt out so every team gets one of each.
      </p>
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <div className="admin-segmented" role="radiogroup" aria-label="Number of teams">
          {counts.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={count === n}
              className={count === n ? "active" : ""}
              onClick={() => setCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          disabled={addTeams.isPending || count <= have}
          onClick={() =>
            addTeams.mutate({
              id: tournament.id,
              teams: defaultTeamNames(tournament, count - have).map((name) => ({ name, playerIds: [] })),
            })
          }
        >
          <i className="fa-solid fa-plus" aria-hidden="true"></i>{" "}
          {have === 0 ? `Create ${count} teams` : `Add ${count - have} more`}
        </Button>
      </div>
    </div>
  );
}

// "Manually": a new team (or an existing one being edited) — its name and
// players picked from the shared list.
export function TeamForm({
  tournament,
  index,
  onSaved,
}: {
  tournament: CricketTournament;
  index?: number;
  onSaved: () => void;
}) {
  const { data: players } = useCricketPlayers();
  const addTeams = useAddCricketTeams();
  const updateTeam = useUpdateCricketTeam();
  const setLogo = useSetCricketTeamLogo();
  const existing = index === undefined ? undefined : tournament.teams[index];
  const logo = useImagePick(existing?.logoUrl);
  const [name, setName] = useState(existing?.name ?? defaultTeamNames(tournament, 1)[0]);
  const [picked, setPicked] = useState<number[]>(existing?.playerIds ?? []);
  const [roles, setRoles] = useState<TeamRoles>(existing ? rolesOf(existing) : NO_ROLES);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onTeam = teamOfPlayer(tournament);
  // A player plays for one team in a tournament: anyone on another team is
  // left out of the list.
  const onOtherTeam = (playerId: number) => {
    const otherTeam = onTeam.get(playerId);
    return otherTeam !== undefined && otherTeam !== index;
  };
  // The tournament's squad plus anyone picked (e.g. added by mobile number);
  // the whole player list is too long to show. Saving puts picks in the squad.
  const listedIds = [...new Set([...tournament.playerIds, ...picked])].filter((id) => !onOtherTeam(id));
  const hiddenCount = new Set([...tournament.playerIds, ...picked]).size - listedIds.length;
  const visible = (players ?? []).filter(
    (player) => listedIds.includes(player.id) && player.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const saving = addTeams.isPending || updateTeam.isPending || setLogo.isPending;

  function toggle(playerId: number) {
    if (picked.includes(playerId)) {
      setPicked(picked.filter((id) => id !== playerId));
      setRoles(rolesWithout(roles, playerId));
    } else {
      setPicked([...picked, playerId]);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the team a name.");
    if (tournament.teams.some((team, i) => i !== index && nameKey(team.name) === nameKey(trimmed))) {
      return setError(`There's already a team called "${trimmed}".`);
    }
    const team = { name: trimmed, playerIds: picked, ...roles };
    const saved =
      index === undefined
        ? await addTeams.mutateAsync({ id: tournament.id, teams: [{ ...team, manual: true }] })
        : await updateTeam.mutateAsync({ id: tournament.id, index, ...team });
    // undefined = untouched; null = removed (only if there was one). A new
    // team is the last one.
    if (logo.file || (logo.file === null && existing?.logoUrl)) {
      await setLogo.mutateAsync({ id: tournament.id, index: index ?? saved.teams.length - 1, logo: logo.file });
    }
    onSaved();
  }

  return (
    <ModalForm onSubmit={onSubmit}>
      <TeamLogoField pick={logo} />
      <InputComp
        label="Team Name"
        required
        maxLength={60}
        value={name}
        error={error ?? undefined}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setName(e.target.value);
          setError(null);
        }}
      />
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label m-0">
          Players ({picked.length})
          {picked.length > 0 && <small className="text-muted fw-normal"> · tap C, VC or WK to pick leaders</small>}
        </label>
        {picked.length > 0 && (
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => {
              setPicked([]);
              setRoles(NO_ROLES);
            }}
          >
            Clear
          </button>
        )}
      </div>
      <AddPlayerByMobile
        blockedReason={(playerId) => {
          if (picked.includes(playerId)) return "Already in this team";
          const otherTeam = onTeam.get(playerId);
          return otherTeam !== undefined && otherTeam !== index ? `Already on ${tournament.teams[otherTeam].name}` : null;
        }}
        onAdded={(player) => setPicked((current) => [...current, player.id])}
      />
      <input
        type="search"
        className="form-control shadow-none my-2"
        placeholder="Search players"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {hiddenCount > 0 && (
        <small className="admin-hint d-block mb-2">
          {hiddenCount} player{hiddenCount === 1 ? " is" : "s are"} already on other teams, so not listed.
        </small>
      )}
      <div className="cricket-player-card-list cricket-team-pick-list">
        {visible.length === 0 ? (
          <div className="admin-empty-state">
            {listedIds.length
              ? "No players match."
              : hiddenCount
                ? "Everyone in the squad is already on a team — add more by mobile number above."
                : "No players yet — add them by mobile number above."}
          </div>
        ) : (
          visible.map((player) => {
            const isPicked = picked.includes(player.id);
            return (
              <PlayerCard key={player.id} player={player} selected={isPicked} onClick={() => toggle(player.id)}>
                <TeamRoleChips roles={roles} playerId={player.id} playerName={player.name} onChange={setRoles} />
              </PlayerCard>
            );
          })
        )}
      </div>
      <SubmitButton loading={saving}>{index === undefined ? "Add Team" : "Save"}</SubmitButton>
    </ModalForm>
  );
}

// Scan a team's invite QR code (its page → Players → Invite link) to copy
// it in: its name, players and leaders — any team, even one from someone
// else's tournament or a saved team you don't follow (the code is their
// say-so). Players already on a team here are left out. Closes once added.
export function ScanTeamSheet({
  tournament,
  onClose,
  onAdded = onClose,
}: {
  tournament: CricketTournament;
  onClose: () => void;
  onAdded?: () => void;
}) {
  const addTeams = useAddCricketTeams();

  async function onScan(target: QrTarget): Promise<ScanReply> {
    if (target.kind !== "team") return;
    if (tournament.teams.length >= MAX_TEAMS) return { tone: "error", text: `This tournament already has ${MAX_TEAMS} teams` };
    try {
      const team = await fetchTeamInvite(target.code);
      if (team.kind === "tournament" && team.tournamentId === tournament.id) {
        return { tone: "info", text: `${team.name} is already in this tournament` };
      }
      if (tournament.teams.some((t) => nameKey(t.name) === nameKey(team.name))) {
        return { tone: "error", text: `There's already a team called "${team.name}" here` };
      }
      const onTeam = teamOfPlayer(tournament);
      const playerIds = team.playerIds.filter((id) => !onTeam.has(id));
      await addTeams.mutateAsync({
        id: tournament.id,
        teams: [
          {
            name: team.name,
            playerIds,
            captainId: team.captainId,
            viceCaptainId: team.viceCaptainId,
            keeperId: team.keeperId,
            manual: true,
          },
        ],
      });
      const left = team.playerIds.length - playerIds.length;
      toast.success(
        `${team.name} added with ${playerIds.length} player${playerIds.length === 1 ? "" : "s"}` +
          (left ? ` (${left} already on a team here, left out)` : ""),
      );
      onAdded();
    } catch (err) {
      return { tone: "error", text: messageFor(err) };
    }
  }

  return (
    <QrScannerSheet
      title="Scan Team QR"
      hint="Point the camera at the team's invite QR code (its page → Players → Invite link)"
      accept={["team"]}
      onScan={onScan}
      onClose={onClose}
    />
  );
}

// "Choose from existing teams": every team in every other tournament,
// copied in (name and players). Players already on a team here are left out.
// Or scan a team's QR code to bring in one that isn't listed.
export function ExistingTeamPicker({ tournament, onSaved }: { tournament: CricketTournament; onSaved: () => void }) {
  const { data: tournaments } = useCricketTournaments();
  const addTeams = useAddCricketTeams();
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);

  // The same team (name + players) in several tournaments shows once, from
  // its newest one (the list comes newest first).
  const options = useMemo(() => {
    const seen = new Set<string>();
    return (tournaments ?? [])
      .filter((t) => t.id !== tournament.id)
      .flatMap((t) => t.teams.map((team) => ({ ...team, from: t.name })))
      .filter((team) => {
        const key = `${nameKey(team.name)}|${[...team.playerIds].sort((a, b) => a - b).join(",")}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [tournaments, tournament.id]);

  const onTeam = teamOfPlayer(tournament);
  const names = new Set(tournament.teams.map((team) => nameKey(team.name)));
  const full = tournament.teams.length >= MAX_TEAMS;
  const query = search.trim().toLowerCase();
  const visible = options.filter(
    (team) => team.name.toLowerCase().includes(query) || team.from.toLowerCase().includes(query),
  );

  async function add(team: (typeof options)[number]) {
    const playerIds = team.playerIds.filter((id) => !onTeam.has(id));
    await addTeams.mutateAsync({ id: tournament.id, teams: [{ name: team.name, playerIds, manual: true }] });
    onSaved();
  }

  return (
    <div>
      <button type="button" className="cricket-qr-scan-btn" disabled={full} onClick={() => setScanning(true)}>
        <i className="fa-solid fa-qrcode" aria-hidden="true"></i> Scan a team's QR code
      </button>
      {scanning && <ScanTeamSheet tournament={tournament} onClose={() => setScanning(false)} onAdded={onSaved} />}
      <input
        type="search"
        className="form-control shadow-none mb-2"
        placeholder="Search teams or tournaments"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {full && <div className="admin-banner admin-banner-error mb-2">This tournament already has {MAX_TEAMS} teams.</div>}
      <div className="cricket-player-card-list cricket-team-pick-list">
        {visible.length === 0 ? (
          <div className="admin-empty-state">
            {options.length ? "No teams match." : "Teams from your other tournaments show up here."}
          </div>
        ) : (
          visible.map((team, i) => {
            const added = names.has(nameKey(team.name));
            const busy = team.playerIds.filter((id) => onTeam.has(id)).length;
            return (
              <div key={i} className="cricket-existing-team">
                <span className="cricket-existing-team-body">
                  <span className="cricket-player-name">{team.name}</span>
                  <small className="text-muted">
                    {team.from} · {team.playerIds.length} player{team.playerIds.length === 1 ? "" : "s"}
                    {busy > 0 && !added && ` · ${busy} already on a team here (left out)`}
                  </small>
                </span>
                <Button
                  variant="outline"
                  disabled={added || full || addTeams.isPending}
                  title={added ? "A team with this name is already in the tournament" : undefined}
                  onClick={() => add(team)}
                >
                  {added ? "Added" : "Add"}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
