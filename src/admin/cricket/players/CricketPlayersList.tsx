import { useState } from "react";
import { toast } from "sonner";
import { useCricketPlayers, useDeleteCricketPlayer } from "../../../api/hooks/cricket/useCricketPlayers";
import { ListCard } from "../../components/ListCard";
import { Button } from "../../components/Button";
import { RowActions } from "../../components/RowActions";
import { confirmDelete } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { CricketPlayerForm, CricketPlayerLoginForm, CricketPlayersBulkForm } from "./CricketPlayerForm";
import { formatMobile } from "../mobile";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerLink } from "./PlayerProfileSheet";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import { CricketKpis } from "../CricketKpis";
import { CricketPlayerProfileLoader } from "./CricketPlayerProfile";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

type ModalState =
  | { mode: "new" }
  | { mode: "bulk" }
  | { mode: "edit"; id: number }
  | { mode: "view"; id: number }
  | { mode: "login"; id: number }
  | null;

export function CricketPlayersList() {
  const { data: players, isLoading } = useCricketPlayers();
  const deletePlayer = useDeleteCricketPlayer();
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState("");
  const { data: tournaments } = useCricketTournaments();
  const inSquads = new Set((tournaments ?? []).flatMap((t) => t.playerIds));
  const pickedCount = (players ?? []).filter((player) => inSquads.has(player.id)).length;

  const term = search.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const visible = (players ?? []).filter(
    (player) => player.name.toLowerCase().includes(term) || (digits.length > 2 && player.mobile?.includes(digits)),
  );
  const missingMobile = (players ?? []).filter((player) => !player.mobile).length;
  const modalPlayer = modal && "id" in modal ? players?.find((p) => p.id === modal.id) : undefined;

  async function handleDelete(id: number, name: string) {
    if (await confirmDelete("player", name)) {
      deletePlayer.mutate(id);
    }
  }

  return (
    <ListCard
      title="Players"
      icon="fa-solid fa-users"
      subtitle="Everyone on the roster, and who can sign in"
      action={
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setModal({ mode: "bulk" })}>
            <i className="fa-solid fa-list" aria-hidden="true"></i> Add List
          </Button>
          <Button variant="primary" onClick={() => setModal({ mode: "new" })}>
            + New
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <Loader />
      ) : !players?.length ? (
        <div className="admin-empty-state">No players yet — add them one by one or paste a whole list.</div>
      ) : (
        <>
          <CricketKpis
            items={[
              { label: "Players", value: players.length, icon: "fa-users", tone: "total" },
              { label: "In a tournament", value: pickedCount, icon: "fa-trophy", tone: "active" },
              { label: "Not picked yet", value: players.length - pickedCount, icon: "fa-user-clock", tone: "login" },
              {
                label: "Can sign in",
                value: players.filter((player) => player.hasLogin).length,
                icon: "fa-key",
                tone: "guest",
              },
            ]}
          />
          {missingMobile > 0 && (
            <div className="admin-banner admin-banner-error mb-3">
              {missingMobile} player{missingMobile === 1 ? " has" : "s have"} no mobile number yet — edit them to add one.
            </div>
          )}
          <div className="cricket-toolbar">
            <input
              type="search"
              className="form-control shadow-none"
              placeholder="Search by name or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="admin-filter-count">{players.length} players</span>
          </div>
          <div className="cricket-player-grid">
            {visible.map((player) => {
              const role = roleOf(player.role);
              return (
                <div className="cricket-player-row" key={player.id}>
                  <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="cricket-player-avatar" />
                  <div className="cricket-player-info">
                    <strong>
                      <PlayerLink playerId={player.id}>{player.name}</PlayerLink>
                      {player.hasLogin && (
                        <i className="fa-solid fa-key cricket-login-icon" title="Can sign in" aria-label="Can sign in"></i>
                      )}
                    </strong>
                    <small>
                      {player.mobile ? (
                        <>
                          <i className="fa-solid fa-phone" aria-hidden="true"></i> {formatMobile(player.mobile)}
                        </>
                      ) : (
                        <span className="text-danger">No mobile</span>
                      )}
                      {role && (
                        <>
                          {" · "}
                          <i className={`fa-solid ${role.icon}`} aria-hidden="true"></i> {role.label}
                        </>
                      )}
                    </small>
                  </div>
                  <RowActions
                    onView={() => setModal({ mode: "view", id: player.id })}
                    onEdit={() => setModal({ mode: "edit", id: player.id })}
                    onDelete={() => handleDelete(player.id, player.name)}
                  >
                    <button
                      type="button"
                      className={`cricket-key-btn ${player.hasLogin ? "is-on" : ""}`}
                      title="App login"
                      aria-label="App login"
                      onClick={() => setModal({ mode: "login", id: player.id })}
                    >
                      <i className="fa-solid fa-key" aria-hidden="true"></i>
                    </button>
                  </RowActions>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modal?.mode === "view" && players?.find((p) => p.id === modal.id) && (
        <BottomSheet title="Player Profile" onClose={() => setModal(null)} wide>
          <CricketPlayerProfileLoader player={players.find((p) => p.id === modal.id)!} />
        </BottomSheet>
      )}

      {modal?.mode === "login" && modalPlayer && (
        <BottomSheet title="App Login" onClose={() => setModal(null)}>
          <CricketPlayerLoginForm player={modalPlayer} onDone={() => setModal(null)} />
        </BottomSheet>
      )}

      {modal && modal.mode !== "view" && modal.mode !== "login" && (
        <BottomSheet
          title={modal.mode === "edit" ? "Edit Player" : modal.mode === "bulk" ? "Add Players List" : "New Player"}
          onClose={() => setModal(null)}
          wide={modal.mode === "bulk"}
        >
          {modal.mode === "bulk" ? (
            <CricketPlayersBulkForm
              onSaved={({ added, skipped, skippedNames }) => {
                setModal(null);
                toast.success(`Added ${added} player${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} already listed (${skippedNames.slice(0, 3).join(", ")}${skipped > 3 ? "…" : ""})` : ""}.`);
              }}
            />
          ) : (
            <CricketPlayerForm id={modal.mode === "edit" ? modal.id : undefined} onSaved={() => setModal(null)} />
          )}
        </BottomSheet>
      )}
    </ListCard>
  );
}
