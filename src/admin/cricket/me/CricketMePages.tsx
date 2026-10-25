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
import { useTips, type TipStep } from "../TipsTour";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { MatchCard, type MatchTag } from "../matches/matchUi";
import { teamKeyOf, usePlayerNames } from "../matches/matchUtils";
import { CricketPlayerProfile } from "../players/CricketPlayerProfile";
import { battingCard, bowlingCard, oversText, playerOfMatch, playerStats } from "../stats";
import { TeamFootnote, TournamentCard, TournamentsBoard, tournamentPhase } from "../tournaments/TournamentCard";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { roleOf } from "../playerRoles";
import { avatarColorFor } from "../avatarColor";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";
import { Button } from "../../components/Button";
import { BottomSheet } from "../BottomSheet";
import { CreateSavedTeamForm } from "../teams/SavedTeamPage";

// The main menu pages' titles: icon (as in the sidebar) and what each is for.
type PageTitle = { title: string; icon: string; subtitle: string };
const TITLES = {
  home: { title: "Home", icon: "fa-solid fa-house", subtitle: "Live games, what's next and the players you follow" },
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
  return <HomeFeed me={me} />;
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

const scheduledTime = (m: CricketMatch) => (m.scheduledAt ? new Date(m.scheduledAt).getTime() : Infinity);
const playedAt = (m: CricketMatch) => new Date(m.scheduledAt ?? m.createdAt).getTime();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

// When an upcoming match starts: "Today, 5:30 pm", "Tomorrow, 9:00 am",
// "In 3 days", else "Sat, 2 Nov".
function startsText(m: CricketMatch) {
  if (!m.scheduledAt) return "Date not set";
  const at = new Date(m.scheduledAt);
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", hour12: true, minute: "2-digit" });
  const days = Math.round((startOfDay(at) - startOfDay(new Date())) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days > 1 && days < 7) return `In ${days} days`;
  return at.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// Top of the home page: who I am, and my career in four numbers.
function HomeHero({ me }: { me: CricketMe }) {
  const player = me.player!;
  const stats = playerStats(me.matches).get(player.id);
  const role = roleOf(player.role);
  const numbers = [
    { label: "Matches", value: stats?.matches ?? 0 },
    { label: "Runs", value: stats?.runs ?? 0 },
    { label: "Wickets", value: stats?.wickets ?? 0 },
    { label: "Player of match", value: stats?.playerOfMatch ?? 0 },
  ];
  return (
    <section className="cricket-home-hero" data-tour="hero">
      <div className="cricket-home-hero-top">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          className="cricket-player-avatar cricket-home-hero-avatar"
        />
        <div className="cricket-home-hero-name">
          <small>{greeting()},</small>
          <h1>{player.name}</h1>
          {role && (
            <span className="cricket-home-hero-role">
              <i className={`fa-solid ${role.icon}`} aria-hidden="true"></i> {role.label}
            </span>
          )}
        </div>
        <Link to="/me" className="cricket-home-hero-link" aria-label="My stats">
          <span>My stats</span> <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </Link>
      </div>
      <div className="cricket-home-hero-stats">
        {numbers.map((n) => (
          <div key={n.label}>
            <strong>{n.value}</strong>
            <small>{n.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

// Each home section's own colour (tinted panel and icon badge), so they're
// easy to tell apart at a glance.
type SectionTone = "live" | "next" | "last" | "tournaments" | "following";

function HomeSection({
  title,
  icon,
  tone,
  badge,
  link,
  tour,
  children,
}: {
  title: string;
  icon: string;
  tone: SectionTone;
  badge?: ReactNode;
  link?: { to: string; label: string };
  // What the tips point at (TipsTour).
  tour?: string;
  children: ReactNode;
}) {
  return (
    <section className={`cricket-home-section is-${tone}`} data-tour={tour}>
      <div className="cricket-home-head">
        <h2 className="cricket-section-title cricket-home-heading">
          <span className="cricket-home-icon" aria-hidden="true">
            <i className={icon}></i>
          </span>
          {title}
          {badge}
        </h2>
        {link && (
          <Link to={link.to} className="admin-link">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// A row of cards to swipe through sideways. With more than one, each card is
// a little narrower than the row so the next one peeks in on the right.
function HomeRail({ children }: { children: ReactNode[] }) {
  return <div className={`cricket-home-rail ${children.length > 1 ? "is-peek" : ""}`.trim()}>{children}</div>;
}

const HOME_TIPS: TipStep[] = [
  {
    target: "hero",
    title: "Your cricket at a glance",
    text: "Your matches, runs, wickets and Player of the Match awards. Tap My stats for the full numbers.",
  },
  {
    target: "create",
    title: "Start a match or tournament",
    text: "Tap + to set up a quick match or a whole tournament. You organise it, and you (or the scorers you pick) score it live.",
  },
  {
    target: "nav",
    title: "Get around",
    text: "Your matches, tournaments, teams and stats are all here — including the ones you follow or organise.",
  },
  {
    target: "following",
    title: "Follow players",
    text: "Matches of the players you follow show up here. Tap Manage to find players — follow tournaments and teams from their ⚙ menu.",
  },
  {
    target: "account",
    title: "Your account",
    text: "Edit your profile, photo and playing role, share CricDesk with friends, or sign out. The moon button switches dark mode.",
  },
];

// Home page: me, what's live, what's next, my last result, my running
// tournaments, then every match of the players I follow. My own games are
// tagged and tinted so they stand apart from followed ones.
function HomeFeed({ me }: { me: CricketMe }) {
  const tips = useTips("home", HOME_TIPS);
  const { data: tournaments } = useCricketTournaments();
  const { followedIds, footnote } = useFollowedPlayerLines();
  const tournamentNames = new Map(
    [...(tournaments ?? []), ...me.tournaments, ...me.followedTournaments].map((t) => [t.id, t.name]),
  );
  const playerId = me.player!.id;
  const mine = [...new Map([...me.matches, ...organisingMatches(me)].map((m) => [m.id, m])).values()];
  const mineIds = new Set(mine.map((m) => m.id));
  const following = followingMatches(me).filter((m) => !mineIds.has(m.id));

  // Why a match is on the page: the side I play for, what I do in it, or a follow.
  const tagOf = (m: CricketMatch): MatchTag => {
    if (!mineIds.has(m.id)) return { tone: "following", icon: "fa-solid fa-star", label: "Following" };
    const team = m.teams.find((t) => t.playerIds.includes(playerId));
    if (team) return { tone: "mine", icon: "fa-solid fa-user", label: `You're playing · ${team.name}` };
    return me.createdMatches.some((c) => c.id === m.id)
      ? { tone: "organising", icon: "fa-solid fa-clipboard-list", label: "You're organising" }
      : { tone: "organising", icon: "fa-solid fa-pen", label: "You're scoring" };
  };
  const noteOf = (m: CricketMatch) => {
    if (!mineIds.has(m.id)) return footnote(m);
    const line = myLine(m, playerId);
    return line ? `You: ${line}` : null;
  };
  const card = (m: CricketMatch, aside?: string) => (
    <MatchCard
      key={m.id}
      match={m}
      tournamentName={m.tournamentId === null ? undefined : tournamentNames.get(m.tournamentId)}
      tag={{ ...tagOf(m), aside }}
      footnote={noteOf(m)}
    />
  );

  const live = [...mine, ...following].filter((m) => m.status === "live");
  // Up next: two scheduled matches — ones I play in first, then ones I
  // organise or score, then followed ones, soonest first within each — so
  // the fixtures I organise don't push out the ones I'm playing.
  const rank = (m: CricketMatch) =>
    m.teams.some((t) => t.playerIds.includes(playerId)) ? 0 : mineIds.has(m.id) ? 1 : 2;
  const next = [...mine, ...following]
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => rank(a) - rank(b) || scheduledTime(a) - scheduledTime(b))
    .slice(0, 2);
  const lastResult = me.matches
    .filter((m) => m.status === "completed" || m.status === "abandoned")
    .sort((a, b) => playedAt(b) - playedAt(a))[0];
  // The latest two (by start date) of my ongoing or upcoming tournaments.
  const runningTournaments = me.tournaments
    .filter((t) => ["ongoing", "upcoming"].includes(tournamentPhase(t)))
    .sort((a, b) => (b.startDate ?? b.createdAt).localeCompare(a.startDate ?? a.createdAt))
    .slice(0, 2);

  return (
    <div className="cricket-home">
      {tips.element}
      <HomeHero me={me} />

      {live.length > 0 && (
        <HomeSection
          title="Live now"
          icon="fa-solid fa-tower-broadcast"
          tone="live"
          badge={
            <span className="cricket-home-live">
              <span className="cricket-live-dot" aria-hidden="true"></span>
              {live.length}
            </span>
          }
        >
          <HomeRail>{live.map((m) => card(m))}</HomeRail>
        </HomeSection>
      )}

      {next.length > 0 && (
        <HomeSection title="Up next" icon="fa-solid fa-clock" tone="next" link={{ to: "/my-matches", label: "All matches" }}>
          <HomeRail>{next.map((m) => card(m, startsText(m)))}</HomeRail>
        </HomeSection>
      )}

      {lastResult && (
        <HomeSection title="Your last match" icon="fa-solid fa-flag-checkered" tone="last" link={{ to: "/my-matches", label: "History" }}>
          <div className="cricket-match-grid">{card(lastResult)}</div>
        </HomeSection>
      )}

      {runningTournaments.length > 0 && (
        <HomeSection title="Your tournaments" icon="fa-solid fa-medal" tone="tournaments" link={{ to: "/my-tournaments", label: "See all" }}>
          <HomeRail>
            {runningTournaments.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                matchCount={me.matches.filter((m) => m.tournamentId === t.id).length}
                footnote={<TeamFootnote teamName={t.teams.find((team) => team.playerIds.includes(playerId))?.name ?? null} />}
              />
            ))}
          </HomeRail>
        </HomeSection>
      )}

      <HomeSection title="Players you follow" icon="fa-solid fa-users" tone="following" link={{ to: "/following", label: "Manage" }} tour="following">
        {followedIds.length === 0 ? (
          <div className="admin-empty-state">
            Follow players to see their matches here. <Link to="/following">Find players to follow</Link>.
          </div>
        ) : (
          <MatchesBoard matches={me.followedPlayerMatches} tournamentNames={tournamentNames} footnote={footnote} />
        )}
      </HomeSection>
    </div>
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
            panel
            matches={me.matches}
            tournamentNames={tournamentNames}
            footnote={(match) => {
              const line = myLine(match, playerId);
              return line ? `You: ${line}` : null;
            }}
          />
        </>
      ) : show === "organising" ? (
        <MatchesBoard key="organising" panel matches={organisingMatches(me)} tournamentNames={tournamentNames} />
      ) : me.followedTournaments.length === 0 && followedIds.length === 0 ? (
        nothingFollowed("tournaments, teams or players")
      ) : (
        <MatchesBoard key="following" panel matches={following} tournamentNames={tournamentNames} footnote={footnote} />
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
  tournamentName: string | null;
  // A team made outside any tournament (CricketSavedTeam).
  saved?: boolean;
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

// Every team I've played for or am on, once each by teamKeyOf: tournament
// teams (their rosters, plus sides I played tournament matches for), then
// friendly sides. A one-off side picked from a tournament team counts as
// that team.
function myTeams(me: CricketMe, playerId: number, tournamentsById: Map<number, CricketTournament>): MyTeam[] {
  const teams = new Map<string, MyTeam>();
  // Off the roster (e.g. a substitute), the newest match's side gives the
  // name, role and squad size.
  const tournamentTeam = (tournamentId: number, index: number, side?: CricketMatch["teams"][number]): MyTeam => {
    const tournament = tournamentsById.get(tournamentId);
    const team = tournament?.teams[index];
    const source = team?.playerIds.includes(playerId) || !side ? team : side;
    return {
      key: `t:${tournamentId}:${index}`,
      name: team?.name ?? side?.name ?? "Team",
      tournamentName: tournament?.name ?? "Tournament",
      role: source ? roleIn(source, playerId) : "Player",
      playerCount: source?.playerIds.length ?? 0,
      matches: [],
      link: `/tournaments/${tournamentId}/teams/${index}`,
    };
  };
  // Teams I made or play for outside any tournament, even before a match.
  for (const team of me.savedTeams) {
    teams.set(team.teamKey, {
      key: team.teamKey,
      name: team.name,
      tournamentName: null,
      saved: true,
      role: team.playerIds.includes(playerId) ? roleIn(team, playerId) : "Organiser",
      playerCount: team.playerIds.length,
      matches: [],
      link: `/teams/saved/${team.id}`,
    });
  }
  for (const tournament of me.tournaments) {
    tournament.teams.forEach((team, index) => {
      if (team.playerIds.includes(playerId)) {
        teams.set(`t:${tournament.id}:${index}`, tournamentTeam(tournament.id, index));
      }
    });
  }
  const when = (m: CricketMatch) => m.scheduledAt ?? m.createdAt;
  for (const match of [...me.matches].sort((a, b) => when(b).localeCompare(when(a)))) {
    const slot = match.teams.findIndex((team) => team.playerIds.includes(playerId));
    if (slot === -1) continue;
    const side = match.teams[slot];
    const key = teamKeyOf(match, slot);
    let team = teams.get(key);
    if (!team) {
      const fromTournament = /^t:(\d+):(\d+)$/.exec(key);
      team = fromTournament
        ? tournamentTeam(Number(fromTournament[1]), Number(fromTournament[2]), side)
        : {
            key,
            name: side.name,
            tournamentName: null,
            // The newest match comes first, so it sets the role and squad size.
            role: roleIn(side, playerId),
            playerCount: side.playerIds.length,
            matches: [],
            link: `/teams/friendly/${encodeURIComponent(side.name.trim())}`,
          };
      teams.set(key, team);
    }
    team.matches.push(match);
  }
  const all = [...teams.values()];
  return [...all.filter((t) => t.tournamentName !== null), ...all.filter((t) => t.tournamentName === null)];
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
          <small className="text-muted">{team.tournamentName ?? (team.saved ? "Your team" : "Friendly matches")}</small>
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
  const [creating, setCreating] = useState(false);
  const { me, fallback } = useMyCricket(TITLES.teams);
  const { data: tournaments } = useCricketTournaments();
  if (!me) return fallback;
  const playerId = me.player!.id;
  // Tournaments I played a match in without being on its roster may only be in the full list.
  const tournamentsById = new Map(
    [...(tournaments ?? []), ...me.followedTournaments, ...organisingTournaments(me), ...me.tournaments].map((t) => [t.id, t]),
  );
  const teams = myTeams(me, playerId, tournamentsById);
  const visible = teams.filter((team) => filter === "all" || (filter === "tournament") === (team.tournamentName !== null));
  return (
    <ListCard
      {...TITLES.teams}
      plain
      action={
        <Button variant="primary" onClick={() => setCreating(true)}>
          <i className="fa-solid fa-plus" aria-hidden="true"></i> Create Team
        </Button>
      }
    >
      {creating && (
        <BottomSheet title="New Team" icon="fa-solid fa-people-group" onClose={() => setCreating(false)}>
          <CreateSavedTeamForm onSaved={() => setCreating(false)} />
        </BottomSheet>
      )}
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
        <div className="admin-empty-state">
          {teams.length === 0 ? "You're not on a team yet — create one with Create Team." : "No teams here."}
        </div>
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
