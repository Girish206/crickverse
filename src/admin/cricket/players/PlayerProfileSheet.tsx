import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
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
  return (
    <PlayerProfileContext.Provider value={setPlayerId}>
      {children}
      {player && (
        <BottomSheet title="Player Profile" onClose={close} wide>
          <CricketPlayerProfileLoader player={player} />
        </BottomSheet>
      )}
    </PlayerProfileContext.Provider>
  );
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
