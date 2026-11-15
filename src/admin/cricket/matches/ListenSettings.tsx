import { LANGS, type Lang } from "../i18n";
import SelectInput from "../../dms/components/SelectInput";
import { setScorerPref, useScorerPrefs } from "./scorerPrefs";

// Settings sheet rows for anyone on the match: read each ball out loud, and
// the language for that (and for the scoring pad).
export function ListenSettings() {
  const { voice, lang } = useScorerPrefs();
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  return (
    <>
      <button
        type="button"
        className="cricket-settings-item"
        role="switch"
        aria-checked={voice}
        disabled={!canSpeak}
        onClick={() => {
          setScorerPref("voice", !voice);
          // Browsers only speak after a tap: say something now, so the next
          // ball's call isn't the first and silently dropped.
          if (!voice && canSpeak) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
        }}
      >
        <i className="fa-solid fa-microphone-lines" aria-hidden="true"></i>
        <span>
          Read balls aloud
          <small>{canSpeak ? "Each ball called out, with the score after wickets, boundaries and overs" : "This browser can't speak"}</small>
        </span>
        <span className={`cricket-shot-toggle-knob ${voice ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
      </button>
      <div className="cricket-settings-item is-static">
        <i className="fa-solid fa-language" aria-hidden="true"></i>
        <span>
          Language
          <small>For the spoken calls and the scoring pad</small>
        </span>
        {/* The app's own dropdown (as in the forms), not the browser's */}
        <SelectInput
          id="cricket-lang"
          className="cricket-lang-select"
          size="sm"
          floating={false}
          clearable={false}
          options={LANGS.map((l) => ({ value: l.value, label: l.label }))}
          value={lang}
          onChange={(value) => value && setScorerPref("lang", value as Lang)}
        />
      </div>
    </>
  );
}
