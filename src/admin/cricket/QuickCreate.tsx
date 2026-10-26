import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "./BottomSheet";
import { CricketMatchForm } from "./matches/CricketMatchForm";
import { CricketTournamentForm } from "./tournaments/CricketTournamentForm";
import { QrScannerSheet } from "./qr/QrScannerSheet";
import { CreateSavedTeamForm } from "./teams/SavedTeamPage";
import "./cricket.css";

type Step = "choose" | "match" | "tournament" | "team" | "scan" | null;

const CHOICES = [
  {
    step: "match",
    icon: "fa-baseball-bat-ball",
    label: "Add / Start Match",
    note: "A one-off match, or one in a tournament",
  },
  {
    step: "tournament",
    icon: "fa-trophy",
    label: "Add / Start Tournament",
    note: "Players, teams and a fixture list",
  },
  {
    step: "team",
    icon: "fa-people-group",
    label: "Create Team",
    note: "Your own team and players, to pick for matches",
  },
  {
    step: "scan",
    icon: "fa-qrcode",
    label: "Scan QR Code",
    note: "Join a team from its code, or open a player's profile",
  },
] as const;

// The navbar's "+": pick a match, a tournament or a team, then fill in its
// form. Each opens what it made once saved. Or scan a team's or player's QR
// code, which opens its page.
export function QuickCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(null);
  const close = () => setStep(null);

  return (
    <>
      <button
        type="button"
        className="navbar-theme-btn"
        onClick={() => setStep("choose")}
        title="Create a match, tournament or team"
        aria-label="Create a match, tournament or team"
        data-tour="create"
      >
        <i className="fa-solid fa-plus" aria-hidden="true"></i>
      </button>

      {step === "choose" && (
        <BottomSheet title="Create" icon="fa-solid fa-plus" onClose={close}>
          <ul className="cricket-picker-list">
            {CHOICES.map((choice) => (
              <li key={choice.step}>
                <button type="button" className="cricket-picker-item" onClick={() => setStep(choice.step)}>
                  <span className="cricket-picker-avatar cricket-stage-icon">
                    <i className={`fa-solid ${choice.icon}`} aria-hidden="true"></i>
                  </span>
                  <span className="cricket-picker-text">
                    <strong>{choice.label}</strong>
                    <small>{choice.note}</small>
                  </span>
                  <i className="fa-solid fa-chevron-right cricket-app-row-chevron" aria-hidden="true"></i>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
      {step === "match" && (
        <BottomSheet title="New Match" icon="fa-solid fa-baseball-bat-ball" onClose={close} wide fullScreen>
          <CricketMatchForm onSaved={close} />
        </BottomSheet>
      )}
      {step === "tournament" && (
        <BottomSheet title="New Tournament" onClose={close} wide>
          <CricketTournamentForm onSaved={close} />
        </BottomSheet>
      )}
      {step === "scan" && (
        <QrScannerSheet
          title="Scan QR Code"
          hint="Point the camera at a team's invite code or a player's QR code"
          accept={["team", "player"]}
          onScan={(target) => {
            close();
            navigate(target.kind === "team" ? `/join/${target.code}` : `/p/${target.playerId}`);
          }}
          onClose={close}
        />
      )}
      {step === "team" && (
        <BottomSheet title="New Team" icon="fa-solid fa-people-group" onClose={close}>
          <CreateSavedTeamForm onSaved={close} />
        </BottomSheet>
      )}
    </>
  );
}
