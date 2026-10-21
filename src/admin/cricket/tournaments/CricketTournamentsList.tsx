import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCricketTournaments, useDeleteCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketTournament } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import { Button } from "../../components/Button";
import { RowActions } from "../../components/RowActions";
import { confirmDelete } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { CricketTournamentForm } from "./CricketTournamentForm";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { CricketKpis } from "../CricketKpis";
import { formatFullDate } from "../../../utils/format";
import { TournamentLogo } from "./TournamentLogo";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

type ModalState = { mode: "new" } | { mode: "edit"; id: number } | null;

// Generated or built by hand: at least two teams, each with players.
const teamsReady = (t: CricketTournament) => t.teams.length >= 2 && t.teams.every((team) => team.playerIds.length > 0);

export function CricketTournamentsList() {
  const navigate = useNavigate();
  const { data: tournaments, isLoading } = useCricketTournaments();
  const deleteTournament = useDeleteCricketTournament();
  const [modal, setModal] = useState<ModalState>(null);
  const { data: players } = useCricketPlayers();
  const editing = modal?.mode === "edit" ? tournaments?.find((t) => t.id === modal.id) : undefined;
  const ready = (tournaments ?? []).filter(teamsReady).length;
  const pickedPlayers = new Set((tournaments ?? []).flatMap((t) => t.playerIds)).size;

  async function handleDelete(id: number, name: string) {
    if (await confirmDelete("tournament", name)) {
      deleteTournament.mutate(id);
    }
  }

  return (
    <ListCard
      title="Tournaments"
      action={
        <Button variant="primary" onClick={() => setModal({ mode: "new" })}>
          + New
        </Button>
      }
    >
      {tournaments && (
        <CricketKpis
          items={[
            { label: "Tournaments", value: tournaments.length, icon: "fa-trophy", tone: "total" },
            { label: "Teams ready", value: ready, icon: "fa-circle-check", tone: "active" },
            { label: "Setting up", value: tournaments.length - ready, icon: "fa-hourglass-half", tone: "login" },
            {
              label: `Players picked of ${players?.length ?? 0}`,
              value: pickedPlayers,
              icon: "fa-users",
              tone: "guest",
              hint: "Different players in at least one tournament's squad",
            },
          ]}
        />
      )}
      {isLoading ? (
        <Loader />
      ) : !tournaments?.length ? (
        <div className="admin-empty-state">No tournaments yet.</div>
      ) : (
        <div className="admin-card-grid">
          {tournaments.map((tournament) => {
            return (
              <div
                className="card admin-item-card cricket-tournament-card"
                key={tournament.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/tournaments/${tournament.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/tournaments/${tournament.id}`)}
              >
                <div className="admin-item-card-header">
                  <div className="cricket-tour-card-title">
                    <TournamentLogo tournament={tournament} />
                    <h3 className="admin-item-card-title">{tournament.name}</h3>
                  </div>
                  <div className="admin-item-card-actions">
                    <RowActions
                      onEdit={() => setModal({ mode: "edit", id: tournament.id })}
                      onDelete={() => handleDelete(tournament.id, tournament.name)}
                    />
                  </div>
                </div>
                <div className="cricket-chip-row">
                  <span className={`cricket-status ${teamsReady(tournament) ? "is-ready" : ""}`}>
                    {teamsReady(tournament) ? "Teams ready" : "Setting up"}
                  </span>
                  <span className="cricket-chip">
                    <i className="fa-solid fa-people-group" aria-hidden="true"></i> {tournament.teams.length} teams
                  </span>
                  <span className="cricket-chip">
                    <i className="fa-solid fa-user" aria-hidden="true"></i> {tournament.playerIds.length} players
                  </span>
                </div>
                <small className="text-muted">
                  {tournament.teams.length ? tournament.teams.map((team) => team.name).join(" vs ") : "No teams yet"} · Created{" "}
                  {formatFullDate(tournament.createdAt)}
                </small>
              </div>
            );
          })}
        </div>
      )}

      {modal && (modal.mode === "new" || editing) && (
        <BottomSheet
          title={modal.mode === "edit" ? "Edit Tournament" : "New Tournament"}
          onClose={() => setModal(null)}
          wide
        >
          <CricketTournamentForm existing={editing} onSaved={() => setModal(null)} />
        </BottomSheet>
      )}
    </ListCard>
  );
}
