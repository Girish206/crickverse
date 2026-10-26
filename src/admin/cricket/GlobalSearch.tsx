import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useCricketMe, useCricketPlayers } from "../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournaments } from "../../api/hooks/cricket/useCricketTournaments";
import { useMyFollows } from "../../api/hooks/cricket/useCricketFollows";
import type { CricketTournament } from "../../api/types";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { Loader } from "../components/Loader";
import { BottomSheet } from "./BottomSheet";
import { canManageTournament } from "./canManage";
import { FollowButton } from "./follow/FollowButton";
import { roleOf } from "./playerRoles";
import { PlayerAvatar } from "./players/PlayerAvatar";
import { useOpenPlayerProfile } from "./players/PlayerProfileSheet";
import { TeamBadge } from "./teams/TeamLogoField";
import { TournamentLogo } from "./tournaments/TournamentLogo";
import "../admin.css";
import "./cricket.css";

type Kind = "all" | "tournament" | "team" | "player";

const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tournament", label: "Tournaments" },
  { value: "team", label: "Teams" },
  { value: "player", label: "Players" },
];

// "All" shows a few of each kind; a kind's own tab shows more.
const PREVIEW = 4;
const LIMIT = 50;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// The navbar's search: tournaments, teams and players by name. Also opens
// on "/" or Ctrl/Cmd+K anywhere outside a text field.
export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="navbar-search-btn"
        onClick={() => setOpen(true)}
        title="Search tournaments, teams and players"
        aria-label="Search tournaments, teams and players"
        data-tour="search"
      >
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <span className="navbar-search-label">Search</span>
      </button>
      {open && (
        <BottomSheet title="Search" icon="fa-solid fa-magnifying-glass" onClose={() => setOpen(false)} wide fullScreen>
          <SearchResults onDone={() => setOpen(false)} />
        </BottomSheet>
      )}
    </>
  );
}

// A result row: opens what it names when the viewer may see it, otherwise
// says to follow it first.
function ResultRow({
  logo,
  title,
  detail,
  onOpen,
  follow,
}: {
  logo: ReactNode;
  title: string;
  detail: string;
  onOpen: (() => void) | null;
  follow?: ReactNode;
}) {
  const text = (
    <span className="cricket-picker-text">
      <strong>{title}</strong>
      <small>{onOpen ? detail : `${detail} · Follow to open`}</small>
    </span>
  );
  return (
    <li className="cricket-search-row">
      {onOpen ? (
        <button type="button" className="cricket-picker-item" onClick={onOpen}>
          {logo}
          {text}
          <i className="fa-solid fa-chevron-right cricket-app-row-chevron" aria-hidden="true"></i>
        </button>
      ) : (
        <div className="cricket-picker-item is-locked">
          {logo}
          {text}
          {follow}
        </div>
      )}
    </li>
  );
}

function Section({
  title,
  icon,
  count,
  preview,
  onMore,
  children,
}: {
  title: string;
  icon: string;
  count: number;
  preview: boolean;
  onMore: () => void;
  children: ReactNode;
}) {
  if (!count) return null;
  return (
    <section className="cricket-search-section">
      <h3>
        <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        {title}
        <span>{count}</span>
      </h3>
      <ul className="cricket-picker-list">{children}</ul>
      {preview && count > PREVIEW && (
        <button type="button" className="cricket-search-more" onClick={onMore}>
          See all {count} <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      )}
    </section>
  );
}

function SearchResults({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const openProfile = useOpenPlayerProfile();
  const { admin } = useAdminAuth();
  const { data: me } = useCricketMe();
  const { data: mine } = useMyFollows();
  const { data: players, isLoading: loadingPlayers } = useCricketPlayers();
  const { data: tournaments, isLoading: loadingTournaments } = useCricketTournaments();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  const myId = me?.player?.id ?? null;
  const follows = mine?.follows ?? [];
  // Same rule as the API: organisers see everything; players their own
  // tournaments and ones they follow (or follow a team in).
  const canOpen = (t: CricketTournament) =>
    canManageTournament(admin, t, myId) ||
    (myId !== null && (t.playerIds.includes(myId) || t.scorerIds.includes(myId))) ||
    follows.some((f) => f.kind !== "player" && f.targetId === t.id);

  const go = (to: string) => {
    onDone();
    navigate(to);
  };

  const term = search.trim().toLowerCase();
  const hits = (...texts: (string | null | undefined)[]) => texts.some((text) => text?.toLowerCase().includes(term));
  // Names that start with the term first, then the rest A–Z.
  const byName = <T,>(nameOf: (item: T) => string) => (a: T, b: T) => {
    const [x, y] = [nameOf(a).toLowerCase(), nameOf(b).toLowerCase()];
    return Number(y.startsWith(term)) - Number(x.startsWith(term)) || x.localeCompare(y);
  };

  const tournamentItems = term
    ? (tournaments ?? []).filter((t) => hits(t.name, t.city, t.ground)).sort(byName((t) => t.name))
    : [];
  const teamItems = term
    ? [
        ...(me?.savedTeams ?? []).map((team) => ({
          key: `s-${team.id}`,
          name: team.name,
          logoUrl: team.logoUrl,
          detail: `Your team · ${plural(team.playerIds.length, "player")}`,
          to: `/teams/saved/${team.id}` as string | null,
          follow: null as ReactNode,
        })),
        ...(tournaments ?? []).flatMap((tournament) =>
          tournament.teams.map((team, index) => ({
            key: `t-${tournament.id}-${index}`,
            name: team.name,
            logoUrl: team.logoUrl,
            detail: `${tournament.name} · ${plural(team.playerIds.length, "player")}`,
            to: canOpen(tournament) ? `/tournaments/${tournament.id}/teams/${index}` : null,
            follow: <FollowButton target={{ kind: "team", targetId: tournament.id, teamIndex: index }} />,
          })),
        ),
      ]
        .filter((team) => hits(team.name))
        .sort(byName((team) => team.name))
    : [];
  const playerItems = term ? (players ?? []).filter((p) => hits(p.name)).sort(byName((p) => p.name)) : [];

  // Names repeat, so each player also shows a team they're in (the
  // tournament's newest first).
  const teamOfPlayer = new Map<number, string>();
  if (playerItems.length) {
    for (const tournament of [...(tournaments ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      for (const team of tournament.teams) {
        for (const id of team.playerIds) {
          if (!teamOfPlayer.has(id)) teamOfPlayer.set(id, `${team.name} · ${tournament.name}`);
        }
      }
    }
  }

  const preview = kind === "all";
  const cap = preview ? PREVIEW : LIMIT;
  const shows = (k: Kind) => kind === "all" || kind === k;
  const total =
    (shows("tournament") ? tournamentItems.length : 0) +
    (shows("team") ? teamItems.length : 0) +
    (shows("player") ? playerItems.length : 0);
  const loading = loadingPlayers || loadingTournaments;

  return (
    <div className="cricket-search">
      <div className="cricket-search-field">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input
          type="search"
          className="form-control shadow-none"
          placeholder="Search teams, players..."
          aria-label="Search tournaments, teams and players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          enterKeyHint="search"
        />
      </div>
      <div className="admin-segmented cricket-tabs cricket-search-kinds" role="tablist" aria-label="Show">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="tab"
            aria-selected={kind === k.value}
            className={kind === k.value ? "active" : ""}
            onClick={() => setKind(k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>

      {!term ? (
        <div className="admin-empty-state">
          <span className="cricket-search-empty-icon">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          </span>
          Find any tournament, team or player by name.
        </div>
      ) : loading ? (
        <Loader />
      ) : !total ? (
        <div className="admin-empty-state">Nothing matches “{search.trim()}”.</div>
      ) : (
        <>
          {shows("tournament") && (
            <Section
              title="Tournaments"
              icon="fa-trophy"
              count={tournamentItems.length}
              preview={preview}
              onMore={() => setKind("tournament")}
            >
              {tournamentItems.slice(0, cap).map((t) => (
                <ResultRow
                  key={t.id}
                  logo={<TournamentLogo tournament={t} className="cricket-picker-avatar" />}
                  title={t.name}
                  detail={[t.city, plural(t.teams.length, "team")].filter(Boolean).join(" · ")}
                  onOpen={canOpen(t) ? () => go(`/tournaments/${t.id}`) : null}
                  follow={<FollowButton target={{ kind: "tournament", targetId: t.id, teamIndex: null }} />}
                />
              ))}
            </Section>
          )}
          {shows("team") && (
            <Section
              title="Teams"
              icon="fa-people-group"
              count={teamItems.length}
              preview={preview}
              onMore={() => setKind("team")}
            >
              {teamItems.slice(0, cap).map((team) => (
                <ResultRow
                  key={team.key}
                  logo={<TeamBadge name={team.name} logoUrl={team.logoUrl} />}
                  title={team.name}
                  detail={team.detail}
                  onOpen={team.to ? () => go(team.to!) : null}
                  follow={team.follow}
                />
              ))}
            </Section>
          )}
          {shows("player") && (
            <Section
              title="Players"
              icon="fa-user-group"
              count={playerItems.length}
              preview={preview}
              onMore={() => setKind("player")}
            >
              {playerItems.slice(0, cap).map((player) => (
                <ResultRow
                  key={player.id}
                  logo={
                    <PlayerAvatar
                      name={player.name}
                      photoUrl={player.photoUrl}
                      className="cricket-picker-avatar"
                      viewable={false}
                    />
                  }
                  title={player.id === myId ? `${player.name} (you)` : player.name}
                  detail={[roleOf(player.role)?.label, teamOfPlayer.get(player.id)].filter(Boolean).join(" · ") || "Player"}
                  // The profile opens over the search, so closing it comes back here.
                  onOpen={() => openProfile?.(player.id)}
                />
              ))}
            </Section>
          )}
          {!preview && total > LIMIT && (
            <p className="cricket-search-note">Showing the first {LIMIT} — type more of the name to narrow it down.</p>
          )}
        </>
      )}
    </div>
  );
}
