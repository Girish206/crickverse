import { useState } from "react";
import { toast } from "sonner";
import { messageFor } from "../../../api/mutationErrors";
import { usePlayerInvite, useResetPlayerLogin, type PlayerInviteCode } from "../../../api/hooks/cricket/useCricketPlayers";
import { confirmAction } from "../../components/confirmDelete";

// The message that goes with an invite code: where to sign up, and the code
// that proves the number is theirs.
function inviteText(invite: PlayerInviteCode) {
  return (
    `Hi ${invite.name}! You're on RunMitra — see your runs, wickets and matches.\n` +
    `Sign in at ${window.location.origin}/login with your mobile number and enter this invite code: ${invite.code}`
  );
}

// The code once fetched: big enough to read out, with Copy and WhatsApp.
// `mobile` (organisers see it) opens the chat with the player directly.
function InviteCode({ invite, mobile }: { invite: PlayerInviteCode; mobile?: string | null }) {
  const text = inviteText(invite);
  const to = mobile && mobile.length === 10 ? `91${mobile}` : "";
  return (
    <div className="cricket-invite-code">
      <span className="cricket-invite-digits" aria-label={`Invite code ${invite.code.split("").join(" ")}`}>
        {invite.code}
      </span>
      <div className="cricket-invite-actions">
        <a
          className="btn btn-sm btn-success"
          href={`https://wa.me/${to}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fa-brands fa-whatsapp me-1" aria-hidden="true"></i> Send on WhatsApp
        </a>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() =>
            navigator.clipboard
              ?.writeText(text)
              .then(() => toast.success("Invite copied"))
              .catch(() => toast.error("Couldn't copy — long-press the code instead"))
          }
        >
          <i className="fa-regular fa-copy me-1" aria-hidden="true"></i> Copy
        </button>
      </div>
    </div>
  );
}

// "Invite to RunMitra": whoever added a player (an organiser or captain)
// gets the code the player needs to claim their account, and sends it.
export function PlayerInvite({ playerId, mobile }: { playerId: number; mobile?: string | null }) {
  const invite = usePlayerInvite();
  const [error, setError] = useState<string | null>(null);
  if (invite.data) return <InviteCode invite={invite.data} mobile={mobile} />;
  return (
    <div className="cricket-invite">
      <button
        type="button"
        className="btn btn-outline-custom-primary cricket-invite-btn"
        disabled={invite.isPending}
        onClick={() => invite.mutate(playerId, { onError: (err) => setError(messageFor(err)) })}
      >
        <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
        {invite.isPending ? "Getting code..." : "Invite to RunMitra"}
      </button>
      {error && <small className="cricket-invite-note">{error}</small>}
    </div>
  );
}

// A player who forgot their password (organisers only): clears it, signs
// them out everywhere, and gives a fresh invite code to send.
export function ResetPlayerLogin({ playerId, name, mobile }: { playerId: number; name: string; mobile?: string | null }) {
  const reset = useResetPlayerLogin();
  if (reset.data) return <InviteCode invite={reset.data} mobile={mobile} />;
  return (
    <button
      type="button"
      className="btn btn-link text-danger p-0"
      disabled={reset.isPending}
      onClick={async () => {
        const ok = await confirmAction(
          "Reset this login?",
          `${name}'s password stops working on every device. You'll get an invite code to send them, so they can set a new one.`,
          "Reset login",
        );
        if (ok) reset.mutate(playerId, { onError: (err) => toast.error(messageFor(err)) });
      }}
    >
      Forgot password? Reset login
    </button>
  );
}
