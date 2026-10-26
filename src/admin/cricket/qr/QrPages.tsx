import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCricketMe, useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useJoinTeam, useTeamInvite } from "../../../api/hooks/cricket/useCricketTeamInvites";
import { messageFor } from "../../../api/mutationErrors";
import type { CricketTeamInvite } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import { Loader } from "../../components/Loader";
import { PageHeader } from "../../components/PageHeader";
import { avatarColorFor } from "../avatarColor";
import { useOpenPlayerProfile } from "../players/PlayerProfileSheet";
import "../cricket.css";
import "./qr.css";

const teamPath = (invite: CricketTeamInvite) =>
  invite.kind === "saved"
    ? `/teams/saved/${invite.savedTeamId}?tab=players`
    : `/tournaments/${invite.tournamentId}/teams/${invite.teamIndex}?tab=players`;

// /join/<code>: a team's join link (or its scanned QR code). Signed out, it
// signs in (or up) first and comes back here; then one tap adds them.
export function JoinTeamPage() {
  const code = (useParams().code ?? "").toUpperCase();
  const navigate = useNavigate();
  const { data: invite, isLoading, error } = useTeamInvite(code);
  const { data: me } = useCricketMe();
  const { data: players } = useCricketPlayers();
  const join = useJoinTeam();

  if (isLoading) return <Loader page />;
  if (!invite) {
    return (
      <>
        <PageHeader title="Join Team" back="/" />
        <ListCard>
          <div className="cricket-join">
            <i className="fa-solid fa-link-slash fa-2x" aria-hidden="true"></i>
            <p>{error ? messageFor(error) : "This link doesn't work any more — ask the team for a new one."}</p>
          </div>
        </ListCard>
      </>
    );
  }

  const captain = invite.captainId !== null ? players?.find((p) => p.id === invite.captainId) : undefined;
  const otherTeam = invite.kind === "tournament" && !invite.joined ? invite.otherTeam : null;
  const notAPlayer = me !== undefined && me.player === null;

  function onJoin() {
    join.mutate(code, {
      onSuccess: (joined) => {
        toast.success(`You're in ${joined.name}`);
        navigate(teamPath(joined), { replace: true });
      },
      onError: (err) => toast.error(messageFor(err)),
    });
  }

  return (
    <>
      <PageHeader title="Join Team" back="/" />
      <ListCard>
        <div className="cricket-join">
          <span className="cricket-tour-logo" style={{ background: avatarColorFor(invite.name) }} aria-hidden="true">
            {invite.name.charAt(0).toUpperCase()}
          </span>
          <h1>{invite.name}</h1>
          <p>
            {invite.kind === "tournament" ? `A team in ${invite.tournamentName}` : "Team"} · {invite.playerIds.length}{" "}
            {invite.playerIds.length === 1 ? "player" : "players"}
            {captain && ` · Captain ${captain.name}`}
          </p>
          {invite.joined ? (
            <>
              <p>
                <i className="fa-solid fa-circle-check text-success me-1" aria-hidden="true"></i>
                You're in this team.
              </p>
              <Link className="cricket-sheet-submit" to={teamPath(invite)}>
                Open team <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </Link>
            </>
          ) : otherTeam ? (
            <p>
              You already play for <strong>{otherTeam}</strong> in this tournament. Ask its organiser to move you.
            </p>
          ) : notAPlayer ? (
            <p>Only players can join a team. Sign in with your mobile number to join.</p>
          ) : (
            <button type="button" className="cricket-sheet-submit" disabled={join.isPending} onClick={onJoin}>
              <i className="fa-solid fa-user-plus" aria-hidden="true"></i>
              {join.isPending ? "Joining..." : `Join ${invite.name}`}
            </button>
          )}
        </div>
      </ListCard>
    </>
  );
}

// /p/<id>: a player's QR code opened by a phone's own camera. Opens their
// profile over the home page.
export function PlayerQrPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const openProfile = useOpenPlayerProfile();
  useEffect(() => {
    navigate("/", { replace: true });
    if (Number.isInteger(id) && id > 0) openProfile?.(id);
  }, [id, navigate, openProfile]);
  return <Loader page />;
}
