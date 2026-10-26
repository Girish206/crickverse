import { confirmAction } from "../../components/confirmDelete";

// Deleting a tournament keeps what's been played: its unplayed fixtures go,
// but matches already played stay on as one-off matches so nobody's stats
// are lost. Super admins (the list) and organisers (its page) both ask this.
export function confirmTournamentDelete(name: string) {
  return confirmAction(
    `Delete "${name}"?`,
    "Fixtures not played yet are deleted. Matches already played are kept as one-off matches, so players' stats stay. This can't be undone.",
    "Yes, delete it",
  );
}
