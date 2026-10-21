import type { ReactElement } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch, CricketMe } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { ListCard } from "../../components/ListCard";
import { CricketKpis } from "../CricketKpis";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { CricketPlayerProfile } from "../players/CricketPlayerProfile";
import { battingCard, bowlingCard, oversText, playerOfMatch } from "../stats";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

// /: super admins start on the dashboard, players on their stats.
export function CricketHome() {
  const { admin } = useAdminAuth();
  return <Navigate to={admin?.isSuperAdmin ? "/dashboard" : "/me"} replace />;
}

// Loads the signed-in player, or explains why there isn't one.
function useMyCricket(title: string): { me: CricketMe; fallback: null } | { me: null; fallback: ReactElement } {
  const { data: me, isLoading } = useCricketMe();
  const { admin } = useAdminAuth();
  if (isLoading || !me) {
    return { me: null, fallback: <ListCard title={title}><p>Loading...</p></ListCard> };
  }
  if (!me.player) {
    return {
      me: null,
      fallback: (
        <ListCard title={title}>
          <div className="admin-empty-state">
            <p className="mb-2">Your account isn't linked to a player yet.</p>
            <p className="admin-hint mb-0">
              {me.accountMobile
                ? `No player has your mobile number (${me.accountMobile}). `
                : "Your account has no mobile number. "}
              {admin?.isSuperAdmin
                ? "Add your mobile number to your Girish Creations account (Admin Accounts there) and to your player in Players — the same number links them."
                : "Check the mobile number in My Profile, or ask the organiser to add it to your player."}
            </p>
          </div>
        </ListCard>
      ),
    };
  }
  return { me, fallback: null };
}

export function MyCricketStats() {
  const { me, fallback } = useMyCricket("My Stats");
  if (!me) return fallback;
  return (
    <ListCard title="My Stats">
      <CricketPlayerProfile player={me.player!} matches={me.matches} tournaments={me.tournaments} />
    </ListCard>
  );
}

// My line in one match: "23 (15) · 2/18".
function myLine(match: CricketMatch, playerId: number) {
  const parts: string[] = [];
  for (const innings of match.innings) {
    const bat = battingCard(innings).find((row) => row.playerId === playerId);
    if (bat) parts.push(`${bat.runs}${bat.outBall ? "" : "*"} (${bat.balls})`);
    const bowl = bowlingCard(innings).find((row) => row.playerId === playerId);
    if (bowl) parts.push(`${bowl.wickets}/${bowl.runs} in ${oversText(bowl.legalBalls)} ov`);
  }
  return parts.join(" · ");
}

export function MyCricketMatches() {
  const { me, fallback } = useMyCricket("My Matches");
  if (!me) return fallback;
  const playerId = me.player!.id;
  const tournamentNames = new Map(me.tournaments.map((t) => [t.id, t.name]));
  const played = me.matches.filter((m) => m.status === "completed");
  const won = played.filter((m) => m.winner !== null && m.teams[m.winner].playerIds.includes(playerId)).length;
  const potm = me.matches.filter((m) => playerOfMatch(m) === playerId).length;
  return (
    <ListCard title="My Matches">
      <CricketKpis
        items={[
          { label: "Matches", value: me.matches.length, icon: "fa-calendar-days", tone: "total" },
          { label: "Won", value: won, icon: "fa-trophy", tone: "active" },
          { label: "Lost / tied", value: played.length - won, icon: "fa-scale-balanced", tone: "login" },
          { label: "Player of the match", value: potm, icon: "fa-medal", tone: "guest" },
        ]}
      />
      <MatchesBoard
        matches={me.matches}
        tournamentNames={tournamentNames}
        footnote={(match) => {
          const line = myLine(match, playerId);
          return line ? `You: ${line}` : null;
        }}
      />
    </ListCard>
  );
}

export function MyCricketTournaments() {
  const navigate = useNavigate();
  const { me, fallback } = useMyCricket("My Tournaments");
  if (!me) return fallback;
  const playerId = me.player!.id;
  return (
    <ListCard title="My Tournaments">
      {me.tournaments.length === 0 ? (
        <div className="admin-empty-state">You haven't been picked for a tournament yet.</div>
      ) : (
        <div className="admin-card-grid">
          {me.tournaments.map((tournament) => {
            const myTeam = tournament.teams.find((team) => team.playerIds.includes(playerId));
            const matches = me.matches.filter((m) => m.tournamentId === tournament.id);
            const open = () => navigate(`/tournaments/${tournament.id}`);
            return (
              <div
                key={tournament.id}
                className="card admin-item-card cricket-tournament-card"
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => e.key === "Enter" && open()}
              >
                <h3 className="admin-item-card-title">{tournament.name}</h3>
                <div className="cricket-chip-row">
                  <span className={`cricket-status ${myTeam ? "is-ready" : ""}`}>
                    {myTeam ? `My team: ${myTeam.name}` : "Teams not picked yet"}
                  </span>
                  <span className="cricket-chip">
                    <i className="fa-solid fa-calendar-days" aria-hidden="true"></i> {matches.length} matches
                  </span>
                </div>
                <small className="text-muted">{tournament.teams.map((team) => team.name).join(" vs ")}</small>
              </div>
            );
          })}
        </div>
      )}
      <p className="admin-hint mt-3 mb-0">
        Open a tournament for its teams, fixtures, points table and stats. <Link to="/me">My Stats</Link>{" "}
        has your career numbers.
      </p>
    </ListCard>
  );
}
