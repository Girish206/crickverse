import type { CricketTournament } from "../../../api/types";
import { BallTypeBadge } from "../CricketChoices";
import { CATEGORIES, labelOf, MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Banner, logo and the tournament's details at the top of its page. Shows
// nothing extra for older tournaments that have no details.
export function TournamentBanner({ tournament: t }: { tournament: CricketTournament }) {
  const place = [t.ground, t.city].filter(Boolean).join(", ");
  const dates = t.startDate ? `${shortDate(t.startDate)}${t.endDate ? ` – ${shortDate(t.endDate)}` : ""}` : null;
  const facts = [
    dates && { icon: "fa-regular fa-calendar", text: dates },
    place && { icon: "fa-solid fa-location-dot", text: place },
    labelOf(CATEGORIES, t.category) && { icon: "fa-solid fa-tag", text: labelOf(CATEGORIES, t.category) },
    labelOf(MATCH_TYPES, t.matchType) && {
      icon: "fa-solid fa-trophy",
      text: `${labelOf(MATCH_TYPES, t.matchType)}${t.overs ? ` · ${t.overs} ov` : ""}`,
    },
    labelOf(PITCH_TYPES, t.pitchType) && { icon: "fa-solid fa-road", text: `${labelOf(PITCH_TYPES, t.pitchType)} pitch` },
  ].filter((fact): fact is { icon: string; text: string } => Boolean(fact));

  if (!t.bannerUrl && !t.logoUrl && facts.length === 0 && !t.ballType && !t.organiserName) return null;

  return (
    <div className="cricket-tour-banner">
      <div
        className={`cricket-tour-banner-image ${t.bannerUrl ? "" : "is-empty"}`}
        style={t.bannerUrl ? { backgroundImage: `url(${t.bannerUrl})` } : undefined}
      ></div>
      <div className="cricket-tour-banner-body">
        <span
          className="cricket-tour-logo"
          style={t.logoUrl ? { backgroundImage: `url(${t.logoUrl})` } : undefined}
          aria-hidden="true"
        >
          {!t.logoUrl && t.name.charAt(0).toUpperCase()}
        </span>
        <div className="cricket-tour-facts">
          {facts.map((fact) => (
            <span key={fact.text}>
              <i className={fact.icon} aria-hidden="true"></i> {fact.text}
            </span>
          ))}
          {t.ballType && <BallTypeBadge value={t.ballType} />}
          {t.organiserName && (
            <span>
              <i className="fa-solid fa-user-tie" aria-hidden="true"></i> {t.organiserName}
              {t.organiserMobile && (
                <>
                  {" · "}
                  <a href={`tel:${t.organiserMobile}`}>{t.organiserMobile}</a>
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
