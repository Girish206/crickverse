import { toast } from "sonner";
import { messageFor } from "../../../api/mutationErrors";
import {
  useMyQr,
  useResetTeamInviteCode,
  useTeamInviteCode,
  type InviteTeam,
} from "../../../api/hooks/cricket/useCricketTeamInvites";
import type { CricketPlayer } from "../../../api/types";
import { confirmAction } from "../../components/confirmDelete";
import { Loader } from "../../components/Loader";
import { BottomSheet } from "../BottomSheet";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { QrCode } from "./QrCode";
import { playerQrUrl, teamJoinUrl } from "./qrLinks";
import "./qr.css";

// "My QR code": a player shows it to an organiser or captain, who scans it
// to add them to a team or make them a scorer — no number to read out. The
// code changes every few minutes, so a screenshot of it soon stops working.
export function PlayerQrSheet({ player, onClose }: { player: CricketPlayer; onClose: () => void }) {
  const { data: qr, error } = useMyQr();
  return (
    <BottomSheet title="My QR Code" icon="fa-solid fa-qrcode" onClose={onClose}>
      <div className="cricket-qr-card">
        <div className="cricket-qr-who">
          <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="cricket-roster-avatar" />
          <strong>{player.name}</strong>
        </div>
        {qr ? (
          <QrCode value={playerQrUrl(qr.playerId, qr.token)} label={`QR code for ${player.name}`} />
        ) : error ? (
          <p className="admin-empty-state">{messageFor(error)}</p>
        ) : (
          <Loader />
        )}
        <p className="admin-hint">
          Show this to whoever runs the team or match. They scan it under Add players or Scorers to add you. It
          changes every few minutes, so show it in person — a screenshot stops working.
        </p>
      </div>
    </BottomSheet>
  );
}

// "Sun 2 Nov, 5:30 pm"
const expiryText = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// A team's QR code and join link for its managers — one code for players
// joining, organisers adding the team to a tournament and match creators
// picking it as a side — and a fresh link when the old one went too far. Each link
// works for a week; opening this after that makes a new one.
export function TeamInviteSheet({ team, name, onClose }: { team: InviteTeam; name: string; onClose: () => void }) {
  const { data: invite, isLoading, error } = useTeamInviteCode(team);
  const reset = useResetTeamInviteCode(team);
  const code = invite?.code;
  const url = code ? teamJoinUrl(code) : "";
  const message = `Join ${name} on CricDesk — open this link and tap Join:\n${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Join ${name}`, text: `Join ${name} on CricDesk`, url });
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Couldn't share the link");
    }
  }

  async function newLink() {
    const ok = await confirmAction(
      "Make a new link?",
      "The current link and QR code stop working for joining and for adding the team anywhere. Players already in the team, and tournaments it's already in, stay. The new one works for 7 days.",
      "New link",
    );
    if (ok) reset.mutate(undefined, { onError: (err) => toast.error(messageFor(err)) });
  }

  return (
    <BottomSheet title="Team QR Code" icon="fa-solid fa-qrcode" onClose={onClose}>
      {isLoading ? (
        <Loader />
      ) : !code ? (
        <p className="admin-empty-state">{error ? messageFor(error) : "Couldn't get the link."}</p>
      ) : (
        <div className="cricket-qr-card">
          <ul className="cricket-qr-uses">
            <li>
              <i className="fa-solid fa-user-plus" aria-hidden="true"></i>
              <span>
                <strong>Players</strong> scan it or open the link, sign in and tap Join to add themselves to{" "}
                <strong>{name}</strong>.
              </span>
            </li>
            <li>
              <i className="fa-solid fa-trophy" aria-hidden="true"></i>
              <span>
                <strong>Tournament organisers</strong> scan it under Teams → Scan team QR to add {name} to their
                tournament.
              </span>
            </li>
            <li>
              <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i>
              <span>
                <strong>Match creators</strong> scan it in the team picker to play against {name}.
              </span>
            </li>
          </ul>
          <QrCode value={url} label={`QR code to join ${name}`} />
          <div className="cricket-share-preview cricket-qr-link">
            <span className="cricket-share-preview-text">
              <strong>Join link</strong>
              {invite?.expiresAt && <small>Works until {expiryText(invite.expiresAt)}</small>}
              <small>{url.replace(/^https?:\/\//, "")}</small>
            </span>
            <button type="button" className="cricket-share-preview-copy" onClick={copy} aria-label="Copy link" title="Copy link">
              <i className="fa-regular fa-copy" aria-hidden="true"></i>
            </button>
          </div>
          <div className="cricket-invite-actions">
            <a
              className="btn btn-sm btn-success"
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-brands fa-whatsapp me-1" aria-hidden="true"></i> WhatsApp
            </a>
            {typeof navigator.share === "function" && (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={share}>
                <i className="fa-solid fa-share-nodes me-1" aria-hidden="true"></i> Share
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={reset.isPending} onClick={newLink}>
              <i className="fa-solid fa-rotate me-1" aria-hidden="true"></i> New link
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
