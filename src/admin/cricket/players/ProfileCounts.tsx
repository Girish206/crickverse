import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useFollowCounts, useFollowLists } from "../../../api/hooks/cricket/useCricketFollows";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketFollow, CricketMatch, CricketPlayer, CricketTournament } from "../../../api/types";
import { Loader } from "../../components/Loader";
import { BottomSheet } from "../BottomSheet";
import { formatMatchDate, teamInitials, teamScore } from "../matches/matchUtils";
import { roleOf } from "../playerRoles";
import { TeamMark } from "../teams/TeamMark";
import { TournamentLogo } from "../tournaments/TournamentLogo";
import { seasonLabelOf, seasonOf, seriesOf, seriesPath } from "../tournaments/TournamentCard";
import { PlayerAvatar } from "./PlayerAvatar";
import { useOpenPlayerProfile } from "./PlayerProfileSheet";
import "../me/me.css";

type CountKey = "tournaments" | "friendlies" | "followers" | "following";

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

// The sheet's title, whatever the count.
const TITLES: Record<CountKey, string> = {
  tournaments: "Tournaments",
  friendlies: "Friendlies",
  followers: "Followers",
  following: "Following",
};

const ICONS: Record<CountKey, string> = {
  tournaments: "fa-solid fa-trophy",
  friendlies: "fa-solid fa-handshake",
  followers: "fa-solid fa-users",
  following: "fa-solid fa-star",
};

// The profile hero's footer: tournaments, friendlies, followers and
// following. Tapping one opens a sheet from the bottom (like the settings
// menu) listing them, each a link to its page (or, for a player, their
// profile sheet).
export function ProfileCounts({
  player,
  tournaments,
  friendlies,
}: {
  player: CricketPlayer;
  tournaments: CricketTournament[];
  friendlies: CricketMatch[];
}) {
  const target = { kind: "player", targetId: player.id, teamIndex: null } as const;
  const { data: counts } = useFollowCounts(target);
  const [open, setOpen] = useState<CountKey | null>(null);
  // Seasons of one tournament count once.
  const tournamentCount = new Set(tournaments.map((t) => seriesOf(t).key)).size;
  const items: { key: CountKey; label: string; value: number | string }[] = [
    { key: "tournaments", label: plural(tournamentCount, "Tournament", "Tournaments"), value: tournamentCount },
    { key: "friendlies", label: plural(friendlies.length, "Friendly", "Friendlies"), value: friendlies.length },
    { key: "followers", label: plural(counts?.followers ?? 0, "Follower", "Followers"), value: counts?.followers ?? "–" },
    { key: "following", label: "Following", value: counts ? (counts.following ?? 0) : "–" },
  ];
  const close = () => setOpen(null);
  const current = items.find((item) => item.key === open);

  return (
    <>
      <div className="cv-hero-counts">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open === item.key}
            className={open === item.key ? "is-open" : undefined}
            onClick={() => setOpen(item.key)}
          >
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </button>
        ))}
      </div>
      {open && current && (
        <BottomSheet title={TITLES[open]} count={current.value} icon={ICONS[open]} onClose={close}>
          {open === "tournaments" && <TournamentRows tournaments={tournaments} onPick={close} />}
          {open === "friendlies" && <FriendlyRows matches={friendlies} onPick={close} />}
          {open === "followers" && <FollowerRows playerId={player.id} onPick={close} />}
          {open === "following" && <FollowingRows playerId={player.id} onPick={close} />}
        </BottomSheet>
      )}
    </>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="cv-sheet-empty">{children}</p>;

// One row: a badge, a title and a line under it, then a chevron.
function Row({ badge, title, sub }: { badge: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      {badge}
      <span className="cv-sheet-row-text">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </span>
      <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
    </>
  );
}

// The player's tournaments, newest first. One with seasons is a single row
// (to all its seasons, with how many they played) and the seasons they
// played under it, each by its season name.
function TournamentRows({ tournaments, onPick }: { tournaments: CricketTournament[]; onPick: () => void }) {
  // Every tournament the viewer can see, so seasons are numbered right
  // even when the player missed some.
  const { data: all } = useCricketTournaments();
  if (tournaments.length === 0) return <Empty>No tournaments yet.</Empty>;
  const known = [...new Map([...(all ?? []), ...tournaments].map((t) => [t.id, t])).values()];
  const when = (t: CricketTournament) => t.startDate ?? t.createdAt;
  const groups = new Map<string, CricketTournament[]>();
  for (const t of [...tournaments].sort((a, b) => when(b).localeCompare(when(a)))) {
    const key = seriesOf(t).key;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const place = (t: CricketTournament) =>
    [t.city, t.startDate && new Date(t.startDate).getFullYear()].filter(Boolean).join(" · ") || null;
  return (
    <ul className="cv-sheet-list">
      {[...groups.values()].map((played) => {
        const latest = played[0];
        const asSeason = seasonOf(latest, known);
        if (!asSeason) {
          return (
            <li key={latest.id}>
              <Link to={`/tournaments/${latest.id}`} className="cv-sheet-row" onClick={onPick}>
                <Row badge={<TournamentLogo tournament={latest} className="cv-sheet-badge" />} title={latest.name} sub={place(latest)} />
              </Link>
            </li>
          );
        }
        return (
          <li key={`series-${asSeason.tournament}`}>
            <Link to={seriesPath(asSeason.tournament)} className="cv-sheet-row" onClick={onPick}>
              <Row
                badge={<TournamentLogo tournament={latest} className="cv-sheet-badge" />}
                title={asSeason.tournament}
                sub={`${played.length} ${plural(played.length, "season", "seasons")} played`}
              />
            </Link>
            <ul className="cv-sheet-list is-seasons">
              {played.map((t) => (
                <li key={t.id}>
                  <Link to={`/tournaments/${t.id}`} className="cv-sheet-row" onClick={onPick}>
                    <Row badge={null} title={seasonLabelOf(t, known)} sub={place(t)} />
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

// Under a friendly's teams: a live one's score in red with a pulsing dot,
// a finished one's date and result, else when it starts.
function friendlyLine(m: CricketMatch): ReactNode {
  const day = (value: string | null) => formatMatchDate(value).split(",").slice(0, 2).join(",");
  if (m.status === "live") {
    const batting = m.innings.at(-1)?.battingTeam;
    const score = batting === undefined ? null : teamScore(m, batting);
    return (
      <span className="cv-sheet-live">
        <span className="cricket-live-dot" aria-hidden="true"></span>
        Live
        {score && batting !== undefined && (
          <>
            {" · "}
            {m.teams[batting]?.name} {score.runs} ({score.overs})
          </>
        )}
      </span>
    );
  }
  if (m.status === "scheduled") return formatMatchDate(m.scheduledAt);
  return m.resultText ? `${day(m.scheduledAt)} · ${m.resultText}` : day(m.scheduledAt);
}

function FriendlyRows({ matches, onPick }: { matches: CricketMatch[]; onPick: () => void }) {
  if (matches.length === 0) return <Empty>No friendly matches yet.</Empty>;
  const when = (m: CricketMatch) => m.scheduledAt ?? m.createdAt;
  // Live ones first, then the newest.
  const order = (m: CricketMatch) => (m.status === "live" ? 0 : 1);
  return (
    <ul className="cv-sheet-list">
      {[...matches]
        .sort((a, b) => order(a) - order(b) || when(b).localeCompare(when(a)))
        .map((m) => (
          <li key={m.id} className={m.status === "live" ? "is-live" : undefined}>
            <Link to={`/matches/${m.id}`} className="cv-sheet-row" onClick={onPick}>
              <Row
                badge={
                  <span className="cv-sheet-pair" aria-hidden="true">
                    {m.teams.slice(0, 2).map((team, i) => (
                      <TeamMark
                        key={i}
                        className="cv-sheet-badge"
                        name={team.name}
                        logoUrl={team.logoUrl}
                        text={teamInitials(team.name)}
                      />
                    ))}
                  </span>
                }
                title={`${m.teams[0]?.name ?? "Team"} vs ${m.teams[1]?.name ?? "Team"}`}
                sub={friendlyLine(m)}
              />
            </Link>
          </li>
        ))}
    </ul>
  );
}

// A player's row: opens their profile sheet.
function PlayerRow({ player, onPick }: { player: CricketPlayer; onPick: () => void }) {
  const openProfile = useOpenPlayerProfile();
  return (
    <button
      type="button"
      className="cv-sheet-row"
      onClick={() => {
        onPick();
        openProfile?.(player.id);
      }}
    >
      <Row
        badge={<PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="cv-sheet-badge" viewable={false} />}
        title={player.name}
        sub={roleOf(player.role)?.label ?? "Player"}
      />
    </button>
  );
}

function FollowerRows({ playerId, onPick }: { playerId: number; onPick: () => void }) {
  const { data: lists, isLoading } = useFollowLists({ kind: "player", targetId: playerId, teamIndex: null });
  const { data: players } = useCricketPlayers();
  if (isLoading) return <Loader />;
  const byId = new Map((players ?? []).map((p) => [p.id, p]));
  const followers = (lists?.followers ?? []).flatMap((f) => byId.get(f.followerId) ?? []);
  if (followers.length === 0) return <Empty>No followers yet.</Empty>;
  return (
    <ul className="cv-sheet-list">
      {followers.map((p) => (
        <li key={p.id}>
          <PlayerRow player={p} onPick={onPick} />
        </li>
      ))}
    </ul>
  );
}

function FollowingRows({ playerId, onPick }: { playerId: number; onPick: () => void }) {
  const { data: lists, isLoading } = useFollowLists({ kind: "player", targetId: playerId, teamIndex: null });
  const { data: players } = useCricketPlayers();
  const { data: tournaments } = useCricketTournaments();
  if (isLoading) return <Loader />;
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));
  const tournamentById = new Map((tournaments ?? []).map((t) => [t.id, t]));
  // What they follow, as rows; anything since deleted is left out.
  const row = (f: CricketFollow): ReactNode => {
    if (f.kind === "player") {
      const p = playerById.get(f.targetId);
      return p ? <PlayerRow player={p} onPick={onPick} /> : null;
    }
    const t = tournamentById.get(f.targetId);
    if (!t) return null;
    if (f.kind === "team") {
      const team = f.teamIndex === null ? undefined : t.teams[f.teamIndex];
      if (!team) return null;
      return (
        <Link to={`/tournaments/${t.id}/teams/${f.teamIndex}`} className="cv-sheet-row" onClick={onPick}>
          <Row
            badge={<TeamMark className="cv-sheet-badge" name={team.name} logoUrl={team.logoUrl} />}
            title={team.name}
            sub={`Team · ${t.name}`}
          />
        </Link>
      );
    }
    return (
      <Link to={`/tournaments/${t.id}`} className="cv-sheet-row" onClick={onPick}>
        <Row badge={<TournamentLogo tournament={t} className="cv-sheet-badge" />} title={t.name} sub="Tournament" />
      </Link>
    );
  };
  const rows = (lists?.following ?? []).map((f) => [f.id, row(f)] as const).filter(([, node]) => node);
  if (rows.length === 0) return <Empty>Not following anyone yet.</Empty>;
  return (
    <ul className="cv-sheet-list">
      {rows.map(([id, node]) => (
        <li key={id}>{node}</li>
      ))}
    </ul>
  );
}
