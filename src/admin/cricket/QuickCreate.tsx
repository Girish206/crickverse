import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { CricketMatchForm } from "./matches/CricketMatchForm";
import { CricketTournamentForm } from "./tournaments/CricketTournamentForm";
import "./cricket.css";

type Step = "choose" | "match" | "tournament" | null;

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
] as const;

// The navbar's "+": pick a match or a tournament, then fill in its form.
// Both forms open the new match / tournament once saved.
export function QuickCreate() {
  const [step, setStep] = useState<Step>(null);
  const close = () => setStep(null);

  return (
    <>
      <button
        type="button"
        className="navbar-theme-btn"
        onClick={() => setStep("choose")}
        title="Add a match or tournament"
        aria-label="Add a match or tournament"
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
    </>
  );
}
