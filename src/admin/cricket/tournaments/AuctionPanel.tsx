import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuctionStep, usePlaceBid, usePutUpPlayer, useSetUpAuction } from "../../../api/hooks/cricket/useCricketTournaments";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketAuction, CricketTournament } from "../../../api/types";
import { confirmAction } from "../../components/confirmDelete";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { roleOf } from "../playerRoles";
import { TeamMark } from "../teams/TeamMark";
import "./auction.css";
import { SearchField } from "../SearchField";

// The Auction tab: the organiser runs a player auction for the teams in the
// room (put a player up, tap the team that bids, Sold); everyone else
// watches it live (the page checks every few seconds while it runs). Sold
// players join their team's roster straight away.

const fmt = (n: number) => n.toLocaleString();

function standing(auction: CricketAuction, teamIndex: number) {
  const bought = auction.sold.filter((sale) => sale.teamIndex === teamIndex);
  const spent = bought.reduce((sum, sale) => sum + sale.price, 0);
  return { spent, bought: bought.length, left: auction.purse - spent };
}

function SetupForm({ tournament, onDone }: { tournament: CricketTournament; onDone?: () => void }) {
  const setUp = useSetUpAuction();
  const was = tournament.auction;
  const [purse, setPurse] = useState(String(was?.purse ?? 1000));
  const [basePrice, setBasePrice] = useState(String(was?.basePrice ?? 50));
  const [increment, setIncrement] = useState(String(was?.increment ?? 10));
  const [maxPlayers, setMaxPlayers] = useState(was?.maxPlayers ? String(was.maxPlayers) : "");
  const valid = Number(purse) > 0 && Number(increment) > 0 && Number(basePrice) >= 0 && Number(basePrice) <= Number(purse);

  function start() {
    setUp.mutate(
      {
        id: tournament.id,
        purse: Number(purse),
        basePrice: Number(basePrice),
        increment: Number(increment),
        maxPlayers: maxPlayers.trim() ? Number(maxPlayers) : null,
      },
      { onSuccess: () => onDone?.() },
    );
  }

  const field = (label: string, value: string, set: (v: string) => void, hint: string, placeholder?: string) => (
    <label className="cricket-auction-field">
      <span>{label}</span>
      <input type="number" inputMode="numeric" min={0} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
      <small>{hint}</small>
    </label>
  );

  return (
    <div className="cricket-auction-setup">
      <div className="cricket-auction-fields">
        {field("Purse per team", purse, setPurse, "Points or ₹ — each team's budget")}
        {field("Base price", basePrice, setBasePrice, "Where every player's bidding starts")}
        {field("Bid step", increment, setIncrement, "How much each new bid adds")}
        {field("Most players a team buys", maxPlayers, setMaxPlayers, "Leave empty for no limit", "No limit")}
      </div>
      <button type="button" className="cricket-auction-primary" disabled={!valid || setUp.isPending} onClick={start}>
        <i className="fa-solid fa-gavel" aria-hidden="true"></i> {was ? "Save and carry on" : "Start the auction"}
      </button>
    </div>
  );
}

// `started`: a match has got under way — a new auction (or a restart) is
// only for before then; one already running can still be finished.
export function AuctionPanel({
  tournament,
  canManage,
  started = false,
}: {
  tournament: CricketTournament;
  canManage: boolean;
  started?: boolean;
}) {
  const auction = tournament.auction ?? null;
  const { data: players } = useCricketPlayers();
  const playerById = useMemo(() => new Map((players ?? []).map((player) => [player.id, player])), [players]);
  const nameOf = (id: number) => playerById.get(id)?.name ?? `Player #${id}`;
  const putUp = usePutUpPlayer();
  const placeBid = usePlaceBid();
  const step = useAuctionStep();
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const busy = putUp.isPending || placeBid.isPending || step.isPending;

  if (tournament.teams.length < 2) {
    return <div className="admin-empty-state">Add at least two teams first: players are auctioned to the teams.</div>;
  }

  if (!auction || editing) {
    if (!canManage) return <div className="admin-empty-state">There's no player auction for this tournament.</div>;
    if (started && auction?.status !== "open") {
      return (
        <div className="admin-empty-state">
          The tournament's matches have started, so an auction can't be {auction ? "run again" : "started"} now.
        </div>
      );
    }
    return (
      <>
        <p className="cricket-auction-intro">
          Run a player auction in the room: put a player up, tap the team that bids, and sell. Sold players join
          their team straight away. Everyone following the tournament can watch it live here.
        </p>
        <SetupForm tournament={tournament} onDone={() => setEditing(false)} />
      </>
    );
  }

  const open = auction.status === "open";
  const onTeams = new Set(tournament.teams.flatMap((team) => team.playerIds));
  const soldIds = new Set(auction.sold.map((sale) => sale.playerId));
  const waiting = tournament.playerIds.filter((id) => !onTeams.has(id) && !soldIds.has(id) && id !== auction.current?.playerId);
  const fresh = waiting.filter((id) => !auction.unsold.includes(id));
  const unsold = waiting.filter((id) => auction.unsold.includes(id));
  const term = search.trim().toLowerCase();
  const current = auction.current;
  const leader = current?.teamIndex ?? null;
  const nextBid = current ? (leader === null ? current.bid : current.bid + auction.increment) : 0;

  async function end() {
    const ok = await confirmAction("End the auction?", "Teams keep the players they bought. You can start it again later.", "Yes, end it", "fa-solid fa-flag-checkered");
    if (ok) step.mutate({ id: tournament.id, step: "end" });
  }

  async function undo() {
    const last = auction!.sold.at(-1);
    if (!last) return;
    const ok = await confirmAction(
      "Undo the last sale?",
      `${nameOf(last.playerId)} leaves ${tournament.teams[last.teamIndex]?.name} and waits to be auctioned again.`,
      "Yes, undo",
      "fa-solid fa-rotate-left",
    );
    if (ok) step.mutate({ id: tournament.id, step: "undo" });
  }

  return (
    <div className="cricket-auction">
      {/* Each team's purse and buys. */}
      <div className="cricket-auction-teams">
        {tournament.teams.map((team, index) => {
          const s = standing(auction, index);
          const full = auction.maxPlayers !== null && s.bought >= auction.maxPlayers;
          const canBid = open && current && leader !== index && nextBid <= s.left && !full;
          return (
            <div key={index} className={`cricket-auction-team${leader === index ? " is-leading" : ""}`}>
              <TeamMark className="cricket-auction-team-logo" name={team.name} logoUrl={team.logoUrl} />
              <span className="cricket-auction-team-text">
                <strong title={team.name}>{team.name}</strong>
                <small>
                  {fmt(s.left)} left · {s.bought} bought{full ? " · full" : ""}
                </small>
                <span className="cricket-auction-purse" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, (s.left / auction.purse) * 100)}%` }} />
                </span>
              </span>
              {canManage && current && open && (
                <button
                  type="button"
                  className="cricket-auction-bid"
                  disabled={!canBid || busy}
                  onClick={() => placeBid.mutate({ id: tournament.id, teamIndex: index })}
                  aria-label={`${team.name} bids ${fmt(nextBid)}`}
                >
                  {leader === index ? "Leading" : `Bid ${fmt(nextBid)}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Under the hammer. */}
      {current ? (
        <div className="cricket-auction-hammer" aria-live="polite">
          <PlayerAvatar name={nameOf(current.playerId)} photoUrl={playerById.get(current.playerId)?.photoUrl} className="cricket-auction-hammer-avatar" />
          <div className="cricket-auction-hammer-text">
            <small>Under the hammer</small>
            <strong>{nameOf(current.playerId)}</strong>
            <span>{roleOf(playerById.get(current.playerId)?.role ?? null)?.label ?? "Role not set"}</span>
          </div>
          <div className="cricket-auction-hammer-bid">
            <strong>{fmt(current.bid)}</strong>
            <small>{leader === null ? "Base price · no bids yet" : tournament.teams[leader]?.name}</small>
          </div>
          {canManage && open && (
            <div className="cricket-auction-hammer-actions">
              <button
                type="button"
                className="cricket-auction-primary"
                disabled={leader === null || busy}
                onClick={() =>
                  step.mutate(
                    { id: tournament.id, step: "sold" },
                    { onSuccess: () => toast.success(`${nameOf(current.playerId)} sold to ${tournament.teams[leader!]?.name} for ${fmt(current.bid)}`) },
                  )
                }
              >
                <i className="fa-solid fa-gavel" aria-hidden="true"></i> Sold
              </button>
              <button type="button" className="cricket-auction-secondary" disabled={busy} onClick={() => step.mutate({ id: tournament.id, step: "unsold" })}>
                Unsold
              </button>
            </div>
          )}
        </div>
      ) : open ? (
        canManage ? (
          <div className="cricket-auction-next">
            <button
              type="button"
              className="cricket-auction-primary"
              disabled={busy || waiting.length === 0}
              onClick={() => putUp.mutate({ id: tournament.id, playerId: null })}
            >
              <i className="fa-solid fa-shuffle" aria-hidden="true"></i> Next player (random)
            </button>
            <small>{waiting.length === 0 ? "Everyone has been auctioned." : "Or pick one from the list below."}</small>
          </div>
        ) : (
          <div className="admin-empty-state">Waiting for the next player…</div>
        )
      ) : (
        <div className="cricket-auction-done">
          <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> The auction is over.
        </div>
      )}

      {canManage && (
        <div className="cricket-auction-tools">
          {open && (
            <button type="button" className="cricket-auction-secondary" disabled={busy || auction.sold.length === 0} onClick={undo}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo last sale
            </button>
          )}
          {(open || !started) && (
            <button type="button" className="cricket-auction-secondary" disabled={busy || Boolean(current)} onClick={() => setEditing(true)}>
              <i className="fa-solid fa-sliders" aria-hidden="true"></i> {open ? "Purse and steps" : "Start again"}
            </button>
          )}
          {open && (
            <button type="button" className="cricket-auction-secondary" disabled={busy || Boolean(current)} onClick={end}>
              <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> End auction
            </button>
          )}
        </div>
      )}

      {/* Who's waiting, for the organiser to pick from. */}
      {canManage && open && !current && waiting.length > 0 && (
        <section className="cricket-auction-section">
          <h3>
            Waiting <small>{waiting.length}</small>
          </h3>
          {waiting.length > 8 && (
            <SearchField label="Search players" value={search} onChange={setSearch} />
          )}
          <ul className="cricket-auction-list">
            {[...fresh, ...unsold]
              .filter((id) => nameOf(id).toLowerCase().includes(term))
              .map((id) => (
                <li key={id}>
                  <button type="button" disabled={busy} onClick={() => putUp.mutate({ id: tournament.id, playerId: id })}>
                    <PlayerAvatar name={nameOf(id)} photoUrl={playerById.get(id)?.photoUrl} className="cricket-auction-list-avatar" />
                    <span>
                      <strong>{nameOf(id)}</strong>
                      <small>
                        {roleOf(playerById.get(id)?.role ?? null)?.label ?? "Role not set"}
                        {auction.unsold.includes(id) && " · unsold before"}
                      </small>
                    </span>
                    <i className="fa-solid fa-gavel" aria-hidden="true"></i>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* The sales, latest first. */}
      {auction.sold.length > 0 && (
        <section className="cricket-auction-section">
          <h3>
            Sold <small>{auction.sold.length}</small>
          </h3>
          <ul className="cricket-auction-sold">
            {[...auction.sold].reverse().map((sale) => (
              <li key={sale.playerId}>
                <span>
                  <strong>{nameOf(sale.playerId)}</strong>
                  <small>{tournament.teams[sale.teamIndex]?.name}</small>
                </span>
                <b>{fmt(sale.price)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!open && unsold.length > 0 && (
        <p className="admin-hint">
          Not sold: {unsold.map(nameOf).join(", ")}.
        </p>
      )}
    </div>
  );
}
