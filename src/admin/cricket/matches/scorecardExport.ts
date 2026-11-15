import { toast } from "sonner";
import { ballsPerOverOf, type CricketMatch } from "../../../api/types";
import { isNativeApp } from "../../../app-shell/platform";
import { partnershipsOf } from "../analytics";
import {
  battingCard,
  bowlingCard,
  dismissalText,
  fallOfWickets,
  inningsSummary,
  oversText,
  rate,
  strikeRate,
  type NameOf,
} from "../stats";

// The full scorecard to keep: a printable page (the browser's "Save as PDF")
// and a CSV for spreadsheets. In the app, whose web view can't print or
// download, both go to the phone's share sheet (Save to device, Drive,
// WhatsApp...) instead.

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fileBase = (match: CricketMatch) =>
  `${match.teams[0].name}-vs-${match.teams[1].name}`.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();

const dateLine = (match: CricketMatch) =>
  match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

export function scorecardHtml(match: CricketMatch, nameOf: NameOf, title: string) {
  const perOver = ballsPerOverOf(match);
  const innings = match.innings
    .map((inn, index) => {
      const summary = inningsSummary(inn, perOver);
      const batting = battingCard(inn);
      const batted = new Set(batting.map((r) => r.playerId));
      const dnb = match.teams[inn.battingTeam].playerIds.filter((id) => !batted.has(id));
      const e = summary.extras;
      const label = index >= 2 && match.matchType !== "test" ? " (Super over)" : "";
      return `
      <section>
        <h2>${esc(match.teams[inn.battingTeam].name)}${label} <span>${summary.runs}/${summary.wickets} (${summary.overs} ov)</span></h2>
        <table>
          <thead><tr><th>Batter</th><th></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
          <tbody>
          ${batting
            .map(
              (r) => `<tr><td>${esc(nameOf(r.playerId))}</td><td class="how">${esc(r.outBall ? dismissalText(r.outBall, nameOf) : "not out")}</td>
              <td><b>${r.runs}</b></td><td>${r.balls}</td><td>${r.fours}</td><td>${r.sixes}</td><td>${strikeRate(r.runs, r.balls)}</td></tr>`,
            )
            .join("")}
          <tr class="sub"><td>Extras</td><td class="how">b ${e.byes}, lb ${e.legByes}, w ${e.wides}, nb ${e.noBalls}${e.penalty ? `, pen ${e.penalty}` : ""}</td><td><b>${e.total}</b></td><td colspan="4"></td></tr>
          <tr class="sub"><td>Total</td><td class="how">${summary.wickets} wkts, ${summary.overs} ov (RR ${rate(summary.runs, summary.legalBalls, perOver)})</td><td><b>${summary.runs}</b></td><td colspan="4"></td></tr>
          </tbody>
        </table>
        ${dnb.length ? `<p><b>Did not bat:</b> ${dnb.map((id) => esc(nameOf(id))).join(", ")}</p>` : ""}
        ${(() => {
          const fow = fallOfWickets(inn, perOver);
          return fow.length
            ? `<p><b>Fall of wickets:</b> ${fow.map((f) => `${f.score}-${f.wicket} (${esc(nameOf(f.playerId))}, ${f.overs})`).join(", ")}</p>`
            : "";
        })()}
        <table>
          <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>0s</th><th>Wd</th><th>NB</th></tr></thead>
          <tbody>
          ${bowlingCard(inn, perOver)
            .map(
              (r) => `<tr><td>${esc(nameOf(r.playerId))}</td><td>${oversText(r.legalBalls, perOver)}</td><td>${r.maidens}</td><td>${r.runs}</td>
              <td><b>${r.wickets}</b></td><td>${rate(r.runs, r.legalBalls, perOver)}</td><td>${r.dots}</td><td>${r.wides}</td><td>${r.noBalls}</td></tr>`,
            )
            .join("")}
          </tbody>
        </table>
        ${(() => {
          const stands = partnershipsOf(inn).filter((s) => s.runs > 0);
          return stands.length
            ? `<p><b>Partnerships:</b> ${stands
                .map((s) => `${s.wicket}w ${s.runs}${s.unbroken ? "*" : ""} (${s.balls}) ${esc(nameOf(s.batters[0]))} & ${esc(nameOf(s.batters[1]))}`)
                .join("; ")}</p>`
            : "";
        })()}
      </section>`;
    })
    .join("");
  const meta = [dateLine(match), [match.venue, match.city].filter(Boolean).join(", "), `${match.overs} overs`].filter(Boolean).join(" · ");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
  body{font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:24px;background:#fff}
  h1{font-size:20px;margin:0 0 2px} .meta{color:#555;margin:0 0 6px} .result{font-weight:700;margin:0 0 16px}
  section{margin:0 0 22px;break-inside:avoid-page}
  h2{font-size:15px;margin:0 0 6px;padding:6px 8px;background:#f0f2f5;border-radius:4px;display:flex;justify-content:space-between}
  table{width:100%;border-collapse:collapse;margin:0 0 8px} th,td{padding:4px 6px;border-bottom:1px solid #e3e6ea;text-align:right}
  th:first-child,td:first-child,td.how{text-align:left} td.how{color:#555} th{font-size:11px;color:#555;text-transform:uppercase}
  tr.sub td{background:#fafbfc} p{margin:4px 0} footer{color:#888;font-size:11px;margin-top:24px}
  @media print{body{margin:10mm}}
</style></head><body>
<h1>${esc(match.teams[0].name)} vs ${esc(match.teams[1].name)}</h1>
<p class="meta">${esc(meta)}</p>
${match.resultText ? `<p class="result">${esc(match.resultText)}</p>` : ""}
${innings}
<footer>Scored on RunMitra</footer>
</body></html>`;
}

// One row per batter and per bowler, each innings, for a spreadsheet.
export function scorecardCsv(match: CricketMatch, nameOf: NameOf) {
  const perOver = ballsPerOverOf(match);
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: unknown[][] = [["Innings", "Team", "Role", "Player", "Dismissal", "Runs", "Balls", "4s", "6s", "SR", "Overs", "Maidens", "Conceded", "Wickets", "Econ", "Dots", "Wides", "No balls"]];
  match.innings.forEach((inn, i) => {
    const team = match.teams[inn.battingTeam].name;
    const fielding = match.teams[1 - inn.battingTeam].name;
    for (const r of battingCard(inn)) {
      rows.push([i + 1, team, "Batting", nameOf(r.playerId), r.outBall ? dismissalText(r.outBall, nameOf) : "not out", r.runs, r.balls, r.fours, r.sixes, strikeRate(r.runs, r.balls)]);
    }
    for (const r of bowlingCard(inn, perOver)) {
      rows.push([i + 1, fielding, "Bowling", nameOf(r.playerId), "", "", "", "", "", "", oversText(r.legalBalls, perOver), r.maidens, r.runs, r.wickets, rate(r.runs, r.legalBalls, perOver), r.dots, r.wides, r.noBalls]);
    }
    const s = inningsSummary(inn, perOver);
    rows.push([i + 1, team, "Total", "", `${s.wickets} wkts, ${s.overs} ov`, s.runs, "", "", "", "", "", "", "", "", "", "", s.extras.wides, s.extras.noBalls]);
  });
  // A byte-order mark so Excel reads names in Indian scripts right.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

async function shareFile(file: File, title: string) {
  try {
    await navigator.share({ files: [file], title });
  } catch (err) {
    if ((err as Error).name !== "AbortError") toast.error("Couldn't share the file");
  }
}

function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportScorecardPdf(match: CricketMatch, nameOf: NameOf) {
  const title = `${match.teams[0].name} vs ${match.teams[1].name} — Scorecard`;
  const html = scorecardHtml(match, nameOf, title);
  if (isNativeApp) {
    return shareFile(new File([html], `${fileBase(match)}-scorecard.html`, { type: "text/html" }), title);
  }
  // Printed from a hidden frame, so the page itself isn't what prints.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
  toast("Choose “Save as PDF” as the printer to keep a PDF");
}

export async function exportScorecardCsv(match: CricketMatch, nameOf: NameOf) {
  const file = new File([scorecardCsv(match, nameOf)], `${fileBase(match)}-scorecard.csv`, { type: "text/csv" });
  if (isNativeApp) return shareFile(file, "Scorecard (CSV)");
  saveFile(file);
}
