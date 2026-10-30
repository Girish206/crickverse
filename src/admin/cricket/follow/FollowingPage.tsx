import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import { useFollowCounts, useFollowLists, useMyFollows } from "../../../api/hooks/cricket/useCricketFollows";
import type { CricketFollowKind, CricketPlayer, CricketTournament } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { ListCard } from "../../components/ListCard";
import { CricketKpis } from "../CricketKpis";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";
import { TournamentLogo } from "../tournaments/TournamentLogo";
import { FollowButton } from "./FollowButton";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";
import { TeamMark } from "../teams/TeamMark";
import { useSwipeTabs, type SwipeRef } from "../../useSwipeTabs";
import { SwipePanels } from "../../SwipePanels";

// What they follow, by kind, then who follows them. Finding new things to
// follow is the global search's job.
type Tab = CricketFollowKind | "followers";

const TABS: { value: Tab; label: string }[] = [
  { value: "tournament", label: "Tournaments" },
  { value: "team", label: "Teams" },
  { value: "player", label: "Players" },
  { value: "followers", label: "Followers" },
];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function Tabs<T extends string>({
  label,
  options,
  value,
  onChange,
  swipeRef,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  swipeRef?: SwipeRef;
}) {
  return (
    <div ref={swipeRef} className="admin-segmented cricket-tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// A tournament or team card: opens it when the player may see it (they play
// in it or follow it), otherwise says to follow it first.
function FollowCard({ to, logo, title, detail, follow }: {
  to: string | null;
  logo: ReactNode;
  title: string;
  detail: string;
  follow: ReactNode;
}) {
  const body = (
    <>
      {logo}
      <span className="cricket-team-card-text">
        <strong>{title}</strong>
        <small>{to ? detail : `${detail} · Follow to open`}</small>
      </span>
      {follow}
    </>
  );
  return to ? (
    <Link to={to} className="cricket-team-card">
      {body}
    </Link>
  ) : (
    <div className="cricket-team-card">{body}</div>
  );
}

const FOLLOWING_TITLE = {
  title: "Following",
  icon: "fa-solid fa-heart",
  subtitle: "Keep up with the players, teams and tournaments you care about",
};

// The players, teams and tournaments the signed-in player follows, and the
// players who follow them.
export function FollowingPage() {
  const { admin } = useAdminAuth();
  const { data: mine, isLoading } = useMyFollows();
  const { data: players } = useCricketPlayers();
  const { data: tournaments } = useCricketTournaments();
  const [tab, setTab] = useState<Tab>("tournament");
  const [search, setSearch] = useState("");
  const swipe = useSwipeTabs(TABS.map((t) => t.value), tab, setTab);
  const myId = mine?.playerId ?? null;
  const me = { kind: "player", targetId: myId ?? 0, teamIndex: null } as const;
  const { data: counts } = useFollowCounts(me, myId !== null);
  const { data: lists } = useFollowLists(me, myId !== null);

  if (isLoading || !mine) {
    return (
      <ListCard {...FOLLOWING_TITLE}>
        <Loader />
      </ListCard>
    );
  }
  if (myId === null) {
    return (
      <ListCard {...FOLLOWING_TITLE}>
        <div className="admin-empty-state">
          Your account isn't linked to a player yet, so you can't follow anyone. Check the mobile number in My Profile.
        </div>
      </ListCard>
    );
  }

  const follows = mine.follows;
  const followsKind = (k: CricketFollowKind) => follows.filter((f) => f.kind === k);
  const isFollowed = (k: CricketFollowKind, targetId: number, teamIndex: number | null = null) =>
    follows.some((f) => f.kind === k && f.targetId === targetId && f.teamIndex === teamIndex);
  // Same rule as the API: organisers see everything; players their own
  // tournaments and ones they follow (or follow a team in).
  const canOpen = (t: CricketTournament) =>
    Boolean(admin?.isSuperAdmin) ||
    t.playerIds.includes(myId) ||
    (t.organiserIds ?? []).includes(myId) ||
    follows.some((f) => f.kind !== "player" && f.targetId === t.id);

  const term = search.trim().toLowerCase();
  const matches = (...texts: string[]) => !term || texts.some((text) => text.toLowerCase().includes(term));
  const tournamentItems = (tournaments ?? []).filter(
    (t) => isFollowed("tournament", t.id) && matches(t.name, t.city ?? ""),
  );
  const teamItems = (tournaments ?? [])
    .flatMap((tournament) => tournament.teams.map((team, index) => ({ tournament, team, index })))
    .filter(({ tournament, team, index }) => isFollowed("team", tournament.id, index) && matches(team.name, tournament.name));
  const playerItems = (players ?? []).filter((p) => p.id !== myId && isFollowed("player", p.id) && matches(p.name));
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));
  const followerItems = (lists?.followers ?? []).flatMap((f) => {
    const p = playerById.get(f.followerId);
    return p && matches(p.name) ? [p] : [];
  });

  // Names repeat, so each player also shows a team they're in (the
  // tournament's newest first).
  const teamOfPlayer = new Map<number, string>();
  for (const tournament of [...(tournaments ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    for (const team of tournament.teams) {
      for (const id of team.playerIds) {
        if (!teamOfPlayer.has(id)) teamOfPlayer.set(id, `${team.name} · ${tournament.name}`);
      }
    }
  }

  const playerGrid = (items: CricketPlayer[]) => (
    <div className="cricket-player-grid">
      {items.map((player) => {
        const role = roleOf(player.role);
        return (
          <div className="cricket-player-row" key={player.id}>
            <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="cricket-player-avatar" />
            <div className="cricket-player-info">
              <strong>
                <PlayerLink playerId={player.id}>{player.name}</PlayerLink>
              </strong>
              <small>{role ? role.label : "Role not set"}</small>
              {teamOfPlayer.get(player.id) && <small>{teamOfPlayer.get(player.id)}</small>}
            </div>
            <FollowButton target={{ kind: "player", targetId: player.id, teamIndex: null }} />
          </div>
        );
      })}
    </div>
  );

  // One list per tab, so a swipe brings the next one in beside it.
  const listFor = (kind: Tab) => {
    const empty =
      kind === "followers"
        ? "No one follows you yet."
        : `You don't follow any ${TABS.find((t) => t.value === kind)!.label.toLowerCase()} yet — search for them from the top bar.`;

    let list: ReactNode;
    if (kind === "tournament") {
      list = tournamentItems.length ? (
        <div className="cricket-team-cards">
          {tournamentItems.map((t) => (
            <FollowCard
              key={t.id}
              to={canOpen(t) ? `/tournaments/${t.id}` : null}
              logo={<TournamentLogo tournament={t} />}
              title={t.name}
              detail={[t.city, plural(t.teams.length, "team")].filter(Boolean).join(" · ")}
              follow={<FollowButton target={{ kind: "tournament", targetId: t.id, teamIndex: null }} />}
            />
          ))}
        </div>
      ) : null;
    } else if (kind === "team") {
      list = teamItems.length ? (
        <div className="cricket-team-cards">
          {teamItems.map(({ tournament, team, index }) => (
            <FollowCard
              key={`${tournament.id}-${index}`}
              to={canOpen(tournament) ? `/tournaments/${tournament.id}/teams/${index}` : null}
              logo={
                <TeamMark className="cricket-team-card-logo" name={team.name} logoUrl={team.logoUrl} />
              }
              title={team.name}
              detail={`${tournament.name} · ${plural(team.playerIds.length, "player")}`}
              follow={<FollowButton target={{ kind: "team", targetId: tournament.id, teamIndex: index }} />}
            />
          ))}
        </div>
      ) : null;
    } else if (kind === "player") {
      list = playerItems.length ? playerGrid(playerItems) : null;
    } else {
      list = !lists ? <Loader /> : followerItems.length ? playerGrid(followerItems) : null;
    }
    return list ?? <div className="admin-empty-state">{term ? "Nothing matches your search." : empty}</div>;
  };

  return (
    <ListCard {...FOLLOWING_TITLE}>
      <CricketKpis
        items={[
          { label: "Tournaments", value: followsKind("tournament").length, icon: "fa-trophy", tone: "total" },
          { label: "Teams", value: followsKind("team").length, icon: "fa-people-group", tone: "active" },
          { label: "Players", value: followsKind("player").length, icon: "fa-user-group", tone: "login" },
          { label: "Followers", value: counts?.followers ?? "–", icon: "fa-heart", tone: "guest" },
        ]}
      />
      <div className="cricket-follow-toolbar">
        <Tabs label="Show" options={TABS} value={tab} onChange={setTab} swipeRef={swipe} />
        <input
          type="search"
          className="form-control shadow-none"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <SwipePanels swipe={swipe} values={TABS.map((t) => t.value)} current={tab}>
        {listFor}
      </SwipePanels>
    </ListCard>
  );
}
