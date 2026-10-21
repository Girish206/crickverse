import { useState } from "react";
import { useCricketTournaments, useDeleteCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import { ListCard } from "../../components/ListCard";
import { Button } from "../../components/Button";
import { RowActions } from "../../components/RowActions";
import { confirmDelete } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { CricketTournamentForm } from "./CricketTournamentForm";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { CricketKpis } from "../CricketKpis";
import { TournamentCard, TournamentsBoard, tournamentPhase, type TournamentPhase } from "./TournamentCard";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

type ModalState = { mode: "new" } | { mode: "edit"; id: number } | null;

export function CricketTournamentsList() {
  const { data: tournaments, isLoading } = useCricketTournaments();
  const deleteTournament = useDeleteCricketTournament();
  const [modal, setModal] = useState<ModalState>(null);
  const { data: players } = useCricketPlayers();
  const editing = modal?.mode === "edit" ? tournaments?.find((t) => t.id === modal.id) : undefined;
  const phases = (tournaments ?? []).map(tournamentPhase);
  const inPhase = (phase: TournamentPhase) => phases.filter((p) => p === phase).length;
  const pickedPlayers = new Set((tournaments ?? []).flatMap((t) => t.playerIds)).size;

  async function handleDelete(id: number, name: string) {
    if (await confirmDelete("tournament", name)) {
      deleteTournament.mutate(id);
    }
  }

  return (
    <ListCard
      title="Tournaments"
      icon="fa-solid fa-trophy"
      subtitle="Leagues and cups, from the draw to the final"
      plain
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
            { label: "Ongoing", value: inPhase("ongoing"), icon: "fa-tower-broadcast", tone: "active" },
            { label: "Upcoming", value: inPhase("upcoming"), icon: "fa-clock", tone: "login" },
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
      ) : (
        <TournamentsBoard
          tournaments={tournaments ?? []}
          empty="No tournaments yet."
          renderCard={(tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              actions={
                <RowActions
                  onEdit={() => setModal({ mode: "edit", id: tournament.id })}
                  onDelete={() => handleDelete(tournament.id, tournament.name)}
                />
              }
            />
          )}
        />
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
