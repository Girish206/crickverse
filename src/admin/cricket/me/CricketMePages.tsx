import { useState, type ReactElement, type ReactNode } from "react";
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
import { TeamFootnote, TournamentCard, TournamentsBoard } from "../tournaments/TournamentCard";
import { avatarColorFor } from "../avatarColor";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

// The main menu pages' titles: icon (as in the sidebar) and what each is for.
type PageTitle = { title: string; icon: string; subtitle: string };
const TITLES = {
  home: { title: "Home", icon: "fa-solid fa-house", subtitle: "Matches of the players you follow" },
  stats: { title: "My Stats", icon: "fa-solid fa-id-card", subtitle: "Your whole career: every tournament and friendly match" },
  matches: { title: "My Matches", icon: "fa-solid fa-baseball-bat-ball", subtitle: "Every game you've played, organised or followed" },
  tournaments: { title: "My Tournaments", icon: "fa-solid fa-medal", subtitle: "The tournaments you play in, run or follow" },
  teams: { title: "My Teams", icon: "fa-solid fa-people-group", subtitle: "The sides you've turned out for" },
} satisfies Record<string, PageTitle>;

// /: super admins start on the dashboard; players get their home page.
export function CricketHome() {
  const { admin } = useAdminAuth();
  return admin?.isSuperAdmin ? <Navigate to="/dashboard" replace /> : <PlayerHome />;
}

function PlayerHome() {
  const { me, fallback } = useMyCricket(TITLES.home);
  if (!me) return fallback;
  return <FollowedPlayerMatches me={me} />;
}

// Loads the signed-in player, or explains why there isn't one.
function useMyCricket(title: PageTitle): { me: CricketMe; fallback: null } | { me: null; fallback: ReactElement } {
  const { data: me, isLoading } = useCricketMe();
  const { admin } = useAdminAuth();
  if (isLoading || !me) {
    return { me: null, fallback: <ListCard {...title}><Loader /></ListCard> };
  }
  if (!me.player) {
    return {
      me: null,
      fallback: (
        <ListCard {...title}>
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
  const { me, fallback } = useMyCricket(TITLES.stats);
  if (!me) return fallback;
  return (
    <ListCard {...TITLES.stats} plain>
      <CricketPlayerProfile player={me.player!} matches={me.matches} tournaments={me.tournaments} cards />
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
    <ListCard {...TITLES.home} plain>
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

// "Organising" also lists what they were made a scorer of, once each.
const organisingMatches = (me: CricketMe) => [
  ...new Map([...me.createdMatches, ...me.scoringMatches].map((m) => [m.id, m])).values(),
];
const organisingTournaments = (me: CricketMe) => [
  ...new Map([...me.createdTournaments, ...me.scoringTournaments].map((t) => [t.id, t])).values(),
];

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
  const { me, fallback } = useMyCricket(TITLES.matches);
  const { data: tournaments } = useCricketTournaments();
  const { followedIds, footnote } = useFollowedPlayerLines();
  if (!me) return fallback;
  const playerId = me.player!.id;
  const following = followingMatches(me);
  const tournamentNames = new Map(
    [...(tournaments ?? []), ...me.tournaments, ...me.followedTournaments, ...organisingTournaments(me)].map((t) => [
      t.id,
      t.name,
    ]),
  );
  const played = me.matches.filter((m) => m.status === "completed");
  const won = played.filter((m) => m.winner !== null && m.teams[m.winner].playerIds.includes(playerId)).length;
  const potm = me.matches.filter((m) => playerOfMatch(m) === playerId).length;
  return (
    <ListCard
      {...TITLES.matches}
      plain
      action={
        <ShowSelect
          value={show}
          onChange={setShow}
          followingCount={following.length}
          organisingCount={organisingMatches(me).length}
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
        <MatchesBoard key="organising" matches={organisingMatches(me)} tournamentNames={tournamentNames} />
      ) : me.followedTournaments.length === 0 && followedIds.length === 0 ? (
        nothingFollowed("tournaments, teams or players")
      ) : (
        <MatchesBoard key="following" matches={following} tournamentNames={tournamentNames} footnote={footnote} />
      )}
    </ListCard>
  );
}

export function MyCricketTournaments() {
  const [show, setShow] = useState<Show>("mine");
  const { me, fallback } = useMyCricket(TITLES.tournaments);
  if (!me) return fallback;
  const playerId = me.player!.id;
  const allMatches = [
    ...new Map([...me.matches, ...me.followedMatches, ...organisingMatches(me)].map((m) => [m.id, m])).values(),
  ];
  const card = (footnote: (tournament: CricketTournament) => ReactNode) => (tournament: CricketTournament) => (
    <TournamentCard
      key={tournament.id}
      tournament={tournament}
      matchCount={allMatches.filter((m) => m.tournamentId === tournament.id).length}
      footnote={footnote(tournament)}
    />
  );

  return (
    <ListCard
      {...TITLES.tournaments}
      plain
      action={
        <ShowSelect
          value={show}
          onChange={setShow}
          followingCount={me.followedTournaments.length}
          organisingCount={organisingTournaments(me).length}
        />
      }
    >
      {show === "mine" ? (
        <TournamentsBoard
          key="mine"
          tournaments={me.tournaments}
          empty="You haven't been picked for a tournament yet."
          renderCard={card((tournament) => {
            const myTeam = tournament.teams.find((team) => team.playerIds.includes(playerId));
            return <TeamFootnote teamName={myTeam?.name ?? null} />;
          })}
        />
      ) : show === "organising" ? (
        <TournamentsBoard
          key="organising"
          tournaments={organisingTournaments(me)}
          empty="You haven't created or been made a scorer of a tournament yet."
          renderCard={card(() => null)}
        />
      ) : me.followedTournaments.length === 0 ? (
        nothingFollowed("tournaments")
      ) : (
        <TournamentsBoard key="following" tournaments={me.followedTournaments} empty={null} renderCard={card(() => null)} />
      )}
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

type TeamFilter = "all" | "tournament" | "friendly";

const TEAM_FILTERS: { value: TeamFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tournament", label: "Tournament" },
  { value: "friendly", label: "Friendly" },
];

export function MyCricketTeams() {
  const [filter, setFilter] = useState<TeamFilter>("all");
  const { me, fallback } = useMyCricket(TITLES.teams);
  if (!me) return fallback;
  const playerId = me.player!.id;
  const teams = myTeams(me, playerId);
  const visible = teams.filter((team) => filter === "all" || (filter === "tournament") === Boolean(team.tournament));
  return (
    <ListCard {...TITLES.teams} plain>
      <div className="cricket-squad-toolbar">
        <div className="admin-segmented cricket-tabs cricket-text-tabs" role="tablist" aria-label="Team kind">
          {TEAM_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={filter === f.value ? "active" : ""}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="admin-empty-state">{teams.length === 0 ? "You're not on a team yet." : "No teams here."}</div>
      ) : (
        <div className="admin-card-grid">
          {visible.map((team) => (
            <TeamCard key={team.key} team={team} playerId={playerId} />
          ))}
        </div>
      )}
    </ListCard>
  );
}
