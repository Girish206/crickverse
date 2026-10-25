import { useState } from "react";
import type { CricketMatch, CricketSchedulePrefs, CricketTournament } from "../../../api/types";
import { BottomSheet } from "../BottomSheet";
import { nextPlayingDate, type SchedulePlan, type ScheduleOptions } from "./formatEngine";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKENDS = [0, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Monday first, as a week reads.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

type PlayMode = "one-day" | "every-day" | "weekends" | "weekdays" | "custom";

const PLAY_MODES: { value: PlayMode; label: string; note: string; icon: string }[] = [
  { value: "one-day", label: "All on one day", note: "A single-day tournament — every match back to back", icon: "fa-bolt" },
  { value: "every-day", label: "Every day", note: "Matches on each day", icon: "fa-calendar-day" },
  { value: "weekends", label: "Weekends only", note: "Saturdays and Sundays", icon: "fa-umbrella-beach" },
  { value: "weekdays", label: "Weekdays only", note: "Monday to Friday", icon: "fa-briefcase" },
  { value: "custom", label: "Choose days", note: "Pick the days of the week to play on", icon: "fa-calendar-check" },
];

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((day) => b.includes(day));

function modeOf(options: ScheduleOptions): PlayMode {
  if (options.oneDay) return "one-day";
  if (sameDays(options.days, ALL_DAYS)) return "every-day";
  if (sameDays(options.days, WEEKENDS)) return "weekends";
  if (sameDays(options.days, WEEKDAYS)) return "weekdays";
  return "custom";
}

const daysText = (days: number[]) =>
  sameDays(days, ALL_DAYS)
    ? "every day"
    : sameDays(days, WEEKENDS)
      ? "weekends"
      : WEEK_ORDER.filter((day) => days.includes(day))
          .map((day) => DAY_NAMES[day])
          .join(", ");

const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const localTime = (date: Date) => date.toTimeString().slice(0, 5);

// Start to start: about 8 minutes an over for both innings, plus a break,
// to the nearest 5 minutes (6 overs → 65 min, 20 overs → 175 min).
const matchMinutes = (overs: number | null) => Math.min(300, Math.max(30, Math.round(((overs ?? 20) * 8 + 15) / 5) * 5));

// What's kept with the format so later rounds are scheduled the same way.
export const prefsOf = (options: ScheduleOptions): CricketSchedulePrefs => ({
  oneDay: options.oneDay,
  days: options.days,
  perDay: options.perDay,
  time: options.time,
  minutesBetween: options.minutesBetween,
  pitches: options.pitches,
});

// Set from the tournament: its dates (all on one day when it starts and
// ends the same day; spread up to its end date, or open-ended without
// one), its ground and overs, and the format's saved choices (days, time,
// gap). With matches already scheduled (a later round), it starts after
// the last of them — later that day for a one-day tournament, else on the
// next playing day.
export function defaultSchedule(tournament: CricketTournament, matches: CricketMatch[] = [], reserveDays = 0): ScheduleOptions {
  const start = tournament.startDate?.slice(0, 10) ?? "";
  const end = tournament.endDate?.slice(0, 10) ?? "";
  const prefs = tournament.format?.schedule;
  const options: ScheduleOptions = {
    startDate: "",
    endDate: end,
    oneDay: prefs?.oneDay ?? (Boolean(start) && start === end),
    days: prefs?.days ?? ALL_DAYS,
    reserveDays,
    perDay: prefs?.perDay ?? 1,
    time: prefs?.time ?? "09:00",
    minutesBetween: prefs?.minutesBetween ?? matchMinutes(tournament.overs),
    pitches: prefs?.pitches ?? 1,
    venue: tournament.ground ?? "",
  };
  const latest = matches
    .flatMap((match) => (match.scheduledAt ? [new Date(match.scheduledAt)] : []))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (latest) {
    if (options.oneDay) {
      const next = new Date(latest);
      next.setMinutes(next.getMinutes() + options.minutesBetween);
      return { ...options, startDate: localDate(next), time: localTime(next) };
    }
    return { ...options, startDate: localDate(nextPlayingDate(latest, options.days)) };
  }
  const today = localDate(new Date());
  return { ...options, startDate: start && start > today ? start : today };
}

// When the matches are played: on one day, or from a start date to an end
// date (spread evenly) or open-ended (so many a day), on chosen days of the
// week, so many minutes apart, on one or more pitches.
export function ScheduleFields({
  value,
  onChange,
  plan,
  single = false,
  laterRounds = false,
}: {
  value: ScheduleOptions;
  onChange: (value: ScheduleOptions) => void;
  // The schedule these options make, summed up under the fields.
  plan?: SchedulePlan;
  // One match: just its date, time and ground.
  single?: boolean;
  // More rounds follow, so days can be kept free for them.
  laterRounds?: boolean;
}) {
  const set = <K extends keyof ScheduleOptions>(key: K, next: ScheduleOptions[K]) => onChange({ ...value, [key]: next });
  const [choosingMode, setChoosingMode] = useState(false);
  // "Choose days" stays open even when the picked days match a preset.
  const [custom, setCustom] = useState(() => modeOf(value) === "custom");
  const mode = custom && !value.oneDay ? "custom" : modeOf(value);
  const count = (key: "perDay" | "minutesBetween" | "pitches" | "reserveDays", raw: string, min: number, max: number) =>
    set(key, Math.min(max, Math.max(min, Number(raw) || min)));
  const oneDay = value.oneDay;
  const fitted = !oneDay && Boolean(value.endDate);

  function pickMode(next: PlayMode) {
    setCustom(next === "custom");
    const days = { "every-day": ALL_DAYS, weekends: WEEKENDS, weekdays: WEEKDAYS }[next as "every-day"];
    onChange({ ...value, oneDay: next === "one-day", days: days ?? (next === "custom" ? value.days : ALL_DAYS) });
    setChoosingMode(false);
  }

  function toggleDay(day: number) {
    const days = value.days.includes(day) ? value.days.filter((d) => d !== day) : [...value.days, day];
    if (days.length > 0) set("days", days);
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      ...(oneDay ? {} : { weekday: "short", day: "numeric", month: "short" }),
      hour: "numeric",
      hour12: true,
      minute: "2-digit",
    });

  if (single) {
    return (
      <div className="cricket-app-form">
        <div className="cricket-app-group">
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-regular fa-calendar" aria-hidden="true"></i> Date
            </span>
            <input type="date" value={value.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-regular fa-clock" aria-hidden="true"></i> Time
            </span>
            <input type="time" value={value.time} onChange={(e) => set("time", e.target.value)} />
          </label>
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-location-dot" aria-hidden="true"></i> Ground
            </span>
            <input type="text" value={value.venue} maxLength={150} placeholder="Ground" onChange={(e) => set("venue", e.target.value)} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="cricket-app-form">
      <div className="cricket-app-group">
        <button type="button" className="cricket-app-row" onClick={() => setChoosingMode(true)}>
          <span className="cricket-app-row-label">
            <i className="fa-solid fa-calendar-week" aria-hidden="true"></i> Play
          </span>
          <span className="cricket-app-row-value">{PLAY_MODES.find((m) => m.value === mode)!.label}</span>
          <i className="fa-solid fa-chevron-right cricket-app-row-chevron" aria-hidden="true"></i>
        </button>
        {mode === "custom" && (
          <div className="cricket-app-row cricket-day-row">
            <div className="cricket-chip-choice" role="group" aria-label="Days to play on">
              {WEEK_ORDER.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={value.days.includes(day)}
                  className={value.days.includes(day) ? "active" : ""}
                  onClick={() => toggleDay(day)}
                >
                  {DAY_NAMES[day]}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="cricket-app-row">
          <span className="cricket-app-row-label">
            <i className="fa-regular fa-calendar" aria-hidden="true"></i> {oneDay ? "Date" : "Start on"}
          </span>
          <input type="date" value={value.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </label>
        {!oneDay && (
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-regular fa-calendar-check" aria-hidden="true"></i> Finish by
            </span>
            <input type="date" value={value.endDate} min={value.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} />
            {value.endDate && (
              <button type="button" className="cricket-app-row-clear" aria-label="End date not fixed" onClick={() => set("endDate", "")}>
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            )}
          </label>
        )}
        {fitted && laterRounds && (
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> Days kept for later rounds
            </span>
            <input type="number" min={0} max={60} value={value.reserveDays} onChange={(e) => count("reserveDays", e.target.value, 0, 60)} />
          </label>
        )}
        {!oneDay && !fitted && (
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-layer-group" aria-hidden="true"></i> {value.pitches > 1 ? "Start times a day" : "Matches a day"}
            </span>
            <input type="number" min={1} max={12} value={value.perDay} onChange={(e) => count("perDay", e.target.value, 1, 12)} />
          </label>
        )}
        <label className="cricket-app-row">
          <span className="cricket-app-row-label">
            <i className="fa-regular fa-clock" aria-hidden="true"></i> {oneDay ? "First match at" : "Day's first match at"}
          </span>
          <input type="time" value={value.time} onChange={(e) => set("time", e.target.value)} />
        </label>
        <label className="cricket-app-row">
          <span className="cricket-app-row-label">
            <i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Minutes between starts
          </span>
          <input
            type="number"
            min={10}
            max={600}
            step={5}
            value={value.minutesBetween}
            onChange={(e) => count("minutesBetween", e.target.value, 10, 600)}
          />
        </label>
        <label className="cricket-app-row">
          <span className="cricket-app-row-label">
            <i className="fa-solid fa-table-cells-large" aria-hidden="true"></i> Matches at the same time
          </span>
          <input type="number" min={1} max={4} value={value.pitches} onChange={(e) => count("pitches", e.target.value, 1, 4)} />
        </label>
        <label className="cricket-app-row">
          <span className="cricket-app-row-label">
            <i className="fa-solid fa-location-dot" aria-hidden="true"></i> Ground
          </span>
          <input type="text" value={value.venue} maxLength={150} placeholder="Ground" onChange={(e) => set("venue", e.target.value)} />
        </label>
      </div>
      <small className="admin-hint d-block mt-2">
        {oneDay
          ? "Every match on the day, one after another."
          : fitted
            ? `Spread evenly over the ${daysText(value.days)} up to the end date${laterRounds && value.reserveDays ? `, keeping the last ${value.reserveDays} playing day${value.reserveDays === 1 ? "" : "s"} free for later rounds` : ""}.`
            : `End date not fixed — ${value.perDay} a day on ${daysText(value.days)} until every match has a date.`}
        {value.pitches > 1 && " Matches at the same time go on Pitch 1, Pitch 2… of the ground."}
      </small>
      {plan && plan.fixtures.length > 0 && (
        <div className={`admin-banner ${plan.problem ? "admin-banner-error" : ""} mt-2`}>
          {plan.problem ??
            `${plan.fixtures.length} match${plan.fixtures.length === 1 ? "" : "es"} on ${plan.matchDays} day${plan.matchDays === 1 ? "" : "s"}, up to ${plan.perDay * Math.max(1, value.pitches)} a day${plan.lastStart ? ` · last starts ${when(plan.lastStart)}` : ""}.`}
        </div>
      )}
      {choosingMode && (
        <BottomSheet title="Play" icon="fa-solid fa-calendar-week" onClose={() => setChoosingMode(false)} fullScreen>
          <ul className="cricket-picker-list">
            {PLAY_MODES.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className={`cricket-picker-item ${mode === option.value ? "is-selected" : ""}`}
                  onClick={() => pickMode(option.value)}
                >
                  <span className="cricket-picker-avatar cricket-stage-icon">
                    <i className={`fa-solid ${option.icon}`} aria-hidden="true"></i>
                  </span>
                  <span className="cricket-picker-text">
                    <strong>{option.label}</strong>
                    <small>{option.note}</small>
                  </span>
                  {mode === option.value && <i className="fa-solid fa-circle-check cricket-picker-check" aria-hidden="true"></i>}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}
