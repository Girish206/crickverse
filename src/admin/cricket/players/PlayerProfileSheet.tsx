import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useCricketMe, useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { PlayerInvite } from "./PlayerInvite";
import { BottomSheet } from "../BottomSheet";
import { CricketPlayerProfileLoader } from "./CricketPlayerProfile";
import "../cricket.css";

const PlayerProfileContext = createContext<((playerId: number) => void) | null>(null);

// Lets any screen open a player's profile in a sheet (via PlayerLink).
// Mounted once around the pages in LayoutWrapper.
export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const { data: players } = useCricketPlayers();
  const player = playerId === null ? undefined : players?.find((p) => p.id === playerId);
  const close = useCallback(() => setPlayerId(null), []);
  // Organisers and captains can invite the players they added (the API
  // checks which); everyone else has no one to invite.
  const { admin } = useAdminAuth();
  const { data: me } = useCricketMe();
  const myPlayerId = me?.player?.id;
  const mayInvite =
    admin?.isSuperAdmin ||
    Boolean(me && (me.createdTournaments.length || me.createdMatches.length || me.savedTeams.length)) ||
    Boolean(
      myPlayerId !== undefined &&
        [...(me?.tournaments ?? []), ...(me?.matches ?? [])].some((t) => t.teams.some((team) => team.captainId === myPlayerId)),
    );
  return (
    <PlayerProfileContext.Provider value={setPlayerId}>
      {children}
      {player && (
        <BottomSheet title="Player Profile" onClose={close} wide>
          <CricketPlayerProfileLoader player={player} />
          {mayInvite && player.id !== myPlayerId && (
            <div className="cricket-invite-row">
              <PlayerInvite key={player.id} playerId={player.id} mobile={player.mobile} />
            </div>
          )}
        </BottomSheet>
      )}
    </PlayerProfileContext.Provider>
  );
}

// Opens a player's profile sheet (null outside the provider), e.g. for a
// scanned player QR code.
export function useOpenPlayerProfile() {
  return useContext(PlayerProfileContext);
}

// A player's name that opens their profile when tapped. Plain text outside
// the provider, or for a missing player.
export function PlayerLink({
  playerId,
  children,
  className = "",
}: {
  playerId: number | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const openProfile = useContext(PlayerProfileContext);
  if (!openProfile || playerId === null || playerId === undefined) return <>{children}</>;
  return (
    <button
      type="button"
      className={`cricket-player-link ${className}`.trim()}
      // Names sit inside tappable cards and rows; don't trigger those too.
      onClick={(e) => {
        e.stopPropagation();
        openProfile(playerId);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </button>
  );
}
