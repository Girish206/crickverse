import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ballsPerOverOf, type CricketBall, type CricketMatch } from "../../../api/types";
import { milestonesOf, type Milestone } from "../analytics";
import { CALLS, LANGS, t, type Lang } from "../i18n";
import { inningsSummary, isFour, isLegal, isSix, isWicket, type NameOf } from "../stats";
import { getScorerPrefs } from "./scorerPrefs";
import "./analysis.css";

// What goes with each new ball, beside the big four / six / out burst
// (BallBurst): a banner for a milestone it brought up — a fifty or hundred,
// three or five wickets, a hat-trick (or one on), the side's hundreds — and,
// when "Read balls aloud" is on, the ball called out in the chosen language.
// Like BallBurst, only for a ball just added, not on load or after an undo.

const BANNER_MS = 4200;

function bannerText(m: Milestone, nameOf: NameOf) {
  switch (m.kind) {
    case "fifty":
      return { icon: "fa-solid fa-star", title: `Fifty for ${nameOf(m.playerId)}`, line: `${m.runs} off ${m.balls} balls` };
    case "hundred":
      return { icon: "fa-solid fa-crown", title: `Hundred for ${nameOf(m.playerId)}!`, line: `${m.runs} off ${m.balls} balls` };
    case "three-wickets":
      return { icon: "fa-solid fa-fire", title: `${nameOf(m.playerId)} has three`, line: "Three wickets in the match" };
    case "five-wickets":
      return { icon: "fa-solid fa-fire-flame-curved", title: `Five-for: ${nameOf(m.playerId)}!`, line: "Five wickets" };
    case "hat-trick":
      return { icon: "fa-solid fa-hat-wizard", title: `HAT-TRICK!`, line: `${nameOf(m.playerId)}: three in three` };
    case "on-a-hat-trick":
      return { icon: "fa-solid fa-hat-wizard", title: "On a hat-trick", line: `${nameOf(m.playerId)}'s next ball is a hat-trick ball` };
    case "team":
      return { icon: "fa-solid fa-flag", title: `${m.runs} up`, line: "for the batting side" };
  }
}

// The words for one ball.
function ballCall(ball: CricketBall, lang: Lang, nameOf: NameOf) {
  const call = CALLS[lang];
  if (isWicket(ball)) return call.out(nameOf(ball.dismissedId));
  if (ball.extraType === "penalty") return `${t("penalty", lang)} ${call.runs(ball.extras)}`;
  if (ball.extraType === "wide" || ball.extraType === "no-ball") {
    const extra = ball.runs + ball.extras - 1;
    return `${t(ball.extraType, lang)}${extra > 0 ? `, ${call.runs(extra)}` : ""}`;
  }
  if (ball.extraType === "bye" || ball.extraType === "leg-bye") return `${call.runs(ball.extras)} ${t(ball.extraType, lang)}`;
  if (isSix(ball)) return call.six;
  if (isFour(ball)) return call.four;
  return ball.runs === 0 ? call.dot : call.runs(ball.runs);
}

function milestoneCall(m: Milestone, lang: Lang, nameOf: NameOf) {
  const call = CALLS[lang];
  switch (m.kind) {
    case "fifty":
      return call.fifty(nameOf(m.playerId));
    case "hundred":
      return call.hundred(nameOf(m.playerId));
    case "five-wickets":
      return call.fiveFor(nameOf(m.playerId));
    case "hat-trick":
      return call.hatTrick(nameOf(m.playerId));
    case "on-a-hat-trick":
      return call.onHatTrick(nameOf(m.playerId));
    default:
      return null;
  }
}

// Says it in the language's voice if the phone has one, else in English (a
// Kannada sentence read by an English voice is gibberish).
function speak(text: string, englishText: string, lang: Lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const code = LANGS.find((l) => l.value === lang)!.speech;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(code.slice(0, 2)));
  const utterance = new SpeechSynthesisUtterance(voice || lang === "en" ? text : englishText);
  utterance.lang = voice ? voice.lang : "en-IN";
  if (voice) utterance.voice = voice;
  utterance.rate = 1.05;
  // A new ball cuts off the last one's call rather than queueing behind it.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function BallCalls({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const innings = match.innings.findLast((inn) => inn.balls.length > 0);
  const count = match.innings.reduce((n, inn) => n + inn.balls.length, 0);
  const seen = useRef(count);
  const [banner, setBanner] = useState<{ key: string; items: Milestone[] } | null>(null);

  useLayoutEffect(() => {
    const added = count > seen.current;
    seen.current = count;
    const ball = innings?.balls.at(-1);
    if (!added || !innings || !ball) return;
    const found = milestonesOf(innings);
    if (found.length > 0) setBanner({ key: `${match.innings.length}-${count}`, items: found });

    const { voice, lang } = getScorerPrefs();
    if (!voice) return;
    const perOver = ballsPerOverOf(match);
    const summary = inningsSummary(innings, perOver);
    const overDone = isLegal(ball) && summary.legalBalls % perOver === 0;
    // The score after a wicket, a boundary or the over's last ball.
    const withScore = isWicket(ball) || isFour(ball) || isSix(ball) || overDone;
    const parts = (l: Lang) =>
      [ballCall(ball, l, nameOf), ...found.map((m) => milestoneCall(m, l, nameOf)), withScore ? CALLS[l].score(summary.runs, summary.wickets) : null]
        .filter(Boolean)
        .join(". ");
    speak(parts(lang), parts("en"), lang);
  }, [count, innings, match, nameOf]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  if (!banner) return null;
  return createPortal(
    <div key={banner.key} className="cricket-milestone" role="status" aria-live="polite">
      {banner.items.map((m, i) => {
        const text = bannerText(m, nameOf);
        return (
          <div key={i} className={`cricket-milestone-card is-${m.kind}`}>
            <i className={text.icon} aria-hidden="true"></i>
            <span>
              <strong>{text.title}</strong>
              <small>{text.line}</small>
            </span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
