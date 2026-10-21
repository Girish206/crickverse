import { useState, type ReactElement } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMyFollows } from "../../../api/hooks/cricket/useCricketFollows";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch, CricketMe, CricketTournament } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { ListCard } from "../../components/ListCard";
import { CricketKpis } from "../CricketKpis";
import { PillSelect } from "../PillSelect";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { usePlayerNames } from "../matches/matchUtils";
import { CricketPlayerProfile } from "../players/CricketPlayerProfile";
import { battingCard, bowlingCard, oversText, playerOfMatch } from "../stats";
import { TournamentLogo } from "../tournaments/TournamentLogo";
import { avatarColorFor } from "../avatarColor";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

// /: super admins start on the dashboard; players get their home page.
export function CricketHome() {
  const { admin } = useAdminAuth();
  return admin?.isSuperAdmin ? <Navigate to="/dashboard" replace /> : <PlayerHome />;
}

function PlayerHome() {
  const { me, fallback } = useMyCricket("Home");
  if (!me) return fallback;
  return <FollowedPlayerMatches me={me} />;
}

// Loads the signed-in player, or explains why there isn't one.
function useMyCricket(title: string): { me: CricketMe; fallback: null } | { me: null; fallback: ReactElement } {
  const { data: me, isLoading } = useCricketMe();
  const { admin } = useAdminAuth();
  if (isLoading || !me) {
    return { me: null, fallback: <ListCard title={title}><Loader /></ListCard> };
  }
  if (!me.player) {
    return {
      me: null,
      fallback: (
        <ListCard title={title}>
          <div className="admin-empty-state">
            <p className="mb-2">Your account isn't linked to a player yet.</p>
            <p className="admin-hint mb-0">
              {me.accountMobile
                ? `No player has your mobile number (${me.accountMobile}). `
                : "Your account has no mobile number. "}
              {admin?.isSuperAdmin
                ? "Add your mobile number to your Girish Creations account (Admin Accounts there) and to your player in Players — the same number links them."
                : "Check the mobile number in My Profile, or ask the organiser to add it to your player."}
            </p>
          </div>
        </ListCard>
      ),
    };
  }
  return { me, fallback: null };
}

export function MyCricketStats() {
  const { me, fallback } = useMyCricket("My Stats");
  if (!me) return fallback;
  return (
    <ListCard title="My Stats">
      <CricketPlayerProfile player={me.player!} matches={me.matches} tournaments={me.tournaments} />
    </ListCard>
  );
}

// The players I follow, and their lines in a match: "Asha: 23 (15) · Ravi".
function useFollowedPlayerLines() {
  const { data: mine } = useMyFollows();
  const nameOf = usePlayerNames();
  const followedIds = (mine?.follows ?? []).filter((f) => f.kind === "player").map((f) => f.targetId);
  const footnote = (match: CricketMatch) => {
    const lines = followedIds
      .filter((id) => match.teams.some((team) => team.playerIds.includes(id)))
      .map((id) => {
        const line = myLine(match, id);
        return line ? `${nameOf(id)}: ${line}` : nameOf(id);
      });
    return lines.length ? lines.join(" · ") : null;
  };
  return { followedIds, footnote };
}

// Home page: matches of the players I follow, each with their lines in it.
function FollowedPlayerMatches({ me }: { me: CricketMe }) {
  const { data: tournaments } = useCricketTournaments();
  const { followedIds, footnote } = useFollowedPlayerLines();
  const tournamentNames = new Map((tournaments ?? []).map((t) => [t.id, t.name]));
  return (
    <ListCard title="Players You Follow">
      {followedIds.length === 0 ? (
        <div className="admin-empty-state">
          Follow players to see their matches here. <Link to="/following">Find players to follow</Link>.
        </div>
      ) : (
        <MatchesBoard
          matches={me.followedPlayerMatches}
          tournamentNames={tournamentNames}
          footnote={footnote}
        />
      )}
    </ListCard>
  );
}

// A player's line in one match: "23 (15) · 2/18".
function myLine(match: CricketMatch, playerId: number) {
  const parts: string[] = [];
  for (const innings of match.innings) {
    const bat = battingCard(innings).find((row) => row.playerId === playerId);
    if (bat) parts.push(`${bat.runs}${bat.outBall ? "" : "*"} (${bat.balls})`);
    const bowl = bowlingCard(innings).find((row) => row.playerId === playerId);
    if (bowl) parts.push(`${bowl.wickets}/${bowl.runs} in ${oversText(bowl.legalBalls)} ov`);
  }
  return parts.join(" · ");
}

type Show = "mine" | "following" | "organising";

// Playing / Following / Organising dropdown in the header of My Matches and
// My Tournaments. Organising shows up once they've created something.
function ShowSelect({ value, onChange, followingCount, organisingCount }: {
  value: Show;
  onChange: (value: Show) => void;
  followingCount: number;
  organisingCount: number;
}) {
  return (
    <PillSelect
      label="Show"
      value={value}
      options={[
        { value: "mine", label: "Playing" },
        { value: "following", label: `Following (${followingCount})` },
        ...(organisingCount > 0 ? [{ value: "organising" as const, label: `Organising (${organisingCount})` }] : []),
      ]}
      onChange={onChange}
    />
  );
}

const nothingFollowed = (what: string) => (
  <div className="admin-empty-state">
    You don't follow any {what} yet. <Link to="/following">Find some to follow</Link>.
  </div>
);

// Matches of followed tournaments and teams plus followed players, once each, newest first.
function followingMatches(me: CricketMe) {
  const byId = new Map([...me.followedMatches, ...me.followedPlayerMatches].map((m) => [m.id, m]));
  const when = (m: CricketMatch) => m.scheduledAt ?? m.createdAt;
  return [...byId.values()].sort((a, b) => when(b).localeCompare(when(a)));
}

export function MyCricketMatches() {
  const [show, setShow] = useState<Show>("mine");
  const { me, fallback } = useMyCricket("My Matches");
  const { data: tournaments } = useCricketTournaments();
  const { followedIds, footnote } = useFollowedPlayerLines();
  if (!me) return fallback;
  const playerId = me.player!.id;
  const following = followingMatches(me);
  const tournamentNames = new Map(
    [...(tournaments ?? []), ...me.tournaments, ...me.followedTournaments, ...me.createdTournaments].map((t) => [
      t.id,
      t.name,
    ]),
  );
  const played = me.matches.filter((m) => m.status === "completed");
  const won = played.filter((m) => m.winner !== null && m.teams[m.winner].playerIds.includes(playerId)).length;
  const potm = me.matches.filter((m) => playerOfMatch(m) === playerId).length;
  return (
    <ListCard
      title="My Matches"
      action={
        <ShowSelect
          value={show}
          onChange={setShow}
          followingCount={following.length}
          organisingCount={me.createdMatches.length}
        />
      }
    >
      {show === "mine" ? (
        <>
          {/* Your own record, so only on the Playing side. */}
          <CricketKpis
            items={[
              { label: "Matches", value: me.matches.length, icon: "fa-calendar-days", tone: "total" },
              { label: "Won", value: won, icon: "fa-trophy", tone: "active" },
              { label: "Lost / tied", value: played.length - won, icon: "fa-scale-balanced", tone: "login" },
              { label: "Player of the match", value: potm, icon: "fa-medal", tone: "guest" },
            ]}
          />
          <MatchesBoard
            key="mine"
            matches={me.matches}
            tournamentNames={tournamentNames}
            footnote={(match) => {
              const line = myLine(match, playerId);
              return line ? `You: ${line}` : null;
            }}
          />
        </>
      ) : show === "organising" ? (
        <MatchesBoard key="organising" matches={me.createdMatches} tournamentNames={tournamentNames} />
      ) : me.followedTournaments.length === 0 && followedIds.length === 0 ? (
        nothingFollowed("tournaments, teams or players")
      ) : (
        <MatchesBoard key="following" matches={following} tournamentNames={tournamentNames} footnote={footnote} />
      )}
    </ListCard>
  );
}

function TournamentCard({ tournament, chip, matchCount }: {
  tournament: CricketTournament;
  chip: { text: string; ready: boolean };
  matchCount: number;
}) {
  const navigate = useNavigate();
  const open = () => navigate(`/tournaments/${tournament.id}`);
  return (
    <div
      className="card admin-item-card cricket-tournament-card"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      <div className="cricket-tour-card-title">
        <TournamentLogo tournament={tournament} />
        <h3 className="admin-item-card-title">{tournament.name}</h3>
      </div>
      <div className="cricket-chip-row">
        <span className={`cricket-status ${chip.ready ? "is-ready" : ""}`}>{chip.text}</span>
        <span className="cricket-chip">
          <i className="fa-solid fa-calendar-days" aria-hidden="true"></i> {matchCount} matches
        </span>
      </div>
      <small className="text-muted">{tournament.teams.map((team) => team.name).join(" vs ")}</small>
    </div>
  );
}

export function MyCricketTournaments() {
  const [show, setShow] = useState<Show>("mine");
  const { me, fallback } = useMyCricket("My Tournaments");
  if (!me) return fallback;
  const playerId = me.player!.id;
  const allMatches = [
    ...new Map([...me.matches, ...me.followedMatches, ...me.createdMatches].map((m) => [m.id, m])).values(),
  ];
  const matchCount = (tournament: CricketTournament) =>
    allMatches.filter((m) => m.tournamentId === tournament.id).length;

  let list: ReactElement;
  if (show === "mine") {
    list =
      me.tournaments.length === 0 ? (
        <div className="admin-empty-state">You haven't been picked for a tournament yet.</div>
      ) : (
        <div className="admin-card-grid">
          {me.tournaments.map((tournament) => {
            const myTeam = tournament.teams.find((team) => team.playerIds.includes(playerId));
            return (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                chip={{ text: myTeam ? `My team: ${myTeam.name}` : "Teams not picked yet", ready: Boolean(myTeam) }}
                matchCount={matchCount(tournament)}
              />
            );
          })}
        </div>
      );
  } else if (show === "organising") {
    list = (
      <div className="admin-card-grid">
        {me.createdTournaments.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            chip={{ text: "Organiser", ready: true }}
            matchCount={matchCount(tournament)}
          />
        ))}
      </div>
    );
  } else {
    list =
      me.followedTournaments.length === 0 ? (
        nothingFollowed("tournaments")
      ) : (
        <div className="admin-card-grid">
          {me.followedTournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              chip={{ text: "Following", ready: true }}
              matchCount={matchCount(tournament)}
            />
          ))}
        </div>
      );
  }

  return (
    <ListCard
      title="My Tournaments"
      action={
        <ShowSelect
          value={show}
          onChange={setShow}
          followingCount={me.followedTournaments.length}
          organisingCount={me.createdTournaments.length}
        />
      }
    >
      {list}
      <p className="admin-hint mt-3 mb-0">
        Open a tournament for its teams, fixtures, points table and stats. <Link to="/me">My Stats</Link>{" "}
        has your career numbers.
      </p>
    </ListCard>
  );
}

interface MyTeam {
  key: string;
  name: string;
  // The tournament it plays in; null for friendly (one-off) match sides.
  tournament: CricketTournament | null;
  role: string;
  playerCount: number;
  matches: CricketMatch[];
  // The team's profile page.
  link: string | null;
}

function roleIn(team: { captainId?: number | null; viceCaptainId?: number | null; keeperId?: number | null }, id: number) {
  if (team.captainId === id) return "Captain";
  if (team.viceCaptainId === id) return "Vice-captain";
  if (team.keeperId === id) return "Wicket-keeper";
  return "Player";
}

// Every team I'm on: tournament teams, then friendly sides (grouped by name).
function myTeams(me: CricketMe, playerId: number): MyTeam[] {
  const tournamentTeams = me.tournaments.flatMap((tournament) =>
    tournament.teams.flatMap((team, index) =>
      team.playerIds.includes(playerId)
        ? [
            {
              key: `t${tournament.id}-${index}`,
              name: team.name,
              tournament,
              role: roleIn(team, playerId),
              playerCount: team.playerIds.length,
              matches: me.matches.filter((m) => m.tournamentId === tournament.id),
              link: `/tournaments/${tournament.id}/teams/${index}`,
            },
          ]
        : [],
    ),
  );
  const friendlies = new Map<string, MyTeam>();
  const when = (m: CricketMatch) => m.scheduledAt ?? m.createdAt;
  for (const match of [...me.matches].sort((a, b) => when(b).localeCompare(when(a)))) {
    if (match.tournamentId !== null) continue;
    const side = match.teams.find((team) => team.playerIds.includes(playerId));
    if (!side) continue;
    const key = side.name.trim().toLowerCase();
    const known = friendlies.get(key);
    if (known) known.matches.push(match);
    // The newest match comes first, so it sets the role and squad size.
    else
      friendlies.set(key, {
        key: `f-${key}`,
        name: side.name,
        tournament: null,
        role: roleIn(side, playerId),
        playerCount: side.playerIds.length,
        matches: [match],
        link: `/teams/friendly/${encodeURIComponent(side.name.trim())}`,
      });
  }
  return [...tournamentTeams, ...friendlies.values()];
}

function TeamCard({ team, playerId }: { team: MyTeam; playerId: number }) {
  const navigate = useNavigate();
  const played = team.matches.filter((m) => m.status === "completed");
  const won = played.filter((m) => m.winner !== null && m.teams[m.winner].playerIds.includes(playerId)).length;
  // Back on the team / match page returns here.
  const open = () => team.link && navigate(team.link, { state: { from: "/my-teams" } });
  return (
    <div
      className="card admin-item-card cricket-tournament-card cricket-my-team-card"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      <div className="cricket-tour-card-title">
        <span className="cricket-picker-avatar" style={{ background: avatarColorFor(team.name) }} aria-hidden="true">
          {team.name.charAt(0).toUpperCase()}
        </span>
        <span className="cricket-my-team-name">
          <h3 className="admin-item-card-title">{team.name}</h3>
          <small className="text-muted">{team.tournament ? team.tournament.name : "Matches"}</small>
        </span>
      </div>
      <div className="cricket-chip-row">
        <span className={`cricket-status ${team.role === "Player" ? "" : "is-ready"}`}>{team.role}</span>
        <span className="cricket-chip">
          <i className="fa-solid fa-users" aria-hidden="true"></i> {team.playerCount}
        </span>
        <span className="cricket-chip">
          <i className="fa-solid fa-calendar-days" aria-hidden="true"></i> {team.matches.length} matches
        </span>
        {played.length > 0 && (
          <span className="cricket-chip">
            <i className="fa-solid fa-trophy" aria-hidden="true"></i> {won}/{played.length} won
          </span>
        )}
      </div>
    </div>
  );
}

export function MyCricketTeams() {
  const { me, fallback } = useMyCricket("My Teams");
  if (!me) return fallback;
  const playerId = me.player!.id;
  const teams = myTeams(me, playerId);
  return (
    <ListCard title="My Teams">
      {teams.length === 0 ? (
        <div className="admin-empty-state">You're not on a team yet.</div>
      ) : (
        <div className="admin-card-grid">
          {teams.map((team) => (
            <TeamCard key={team.key} team={team} playerId={playerId} />
          ))}
        </div>
      )}
      <p className="admin-hint mt-3 mb-0">
        Tap a team for its profile: players, matches, leaderboard and stats.
      </p>
    </ListCard>
  );
}
