import type { CricketMatch, CricketPlayer, CricketTeam } from "../../../api/types";
import { monogram } from "../../../utils/format";
import { avatarColorFor } from "../avatarColor";
import type { StatGroup } from "../StatTiles";
import { oversText, rate, strikeRate, teamStats, type TeamStats } from "../stats";
import { CARD_CONTENT_TOP, INNER, loadPictures, startBrandedCard, type StartCard } from "../tournaments/brandedCard";
import { canvasBlob } from "../tournaments/shareCard";
import { fixturesText, type FixtureDay } from "../tournaments/ShareFixturesSheet";
import { drawSquadTiles, squadOrder, squadText, type SquadEntry } from "../tournaments/ShareSquadSheet";
import {
  count,
  drawFactRows,
  drawFixtureDays,
  drawLeaderboards,
  drawResults,
  drawStatGroups,
  latestResults,
  leaderboards,
  wasScored,
} from "../tournaments/tournamentTabCards";

// What each tab of a team's page shares: its own picture, title and message.

export type TeamShareTab = "info" | "players" | "matches" | "leaderboard" | "stats";

export const TEAM_SHARE_HEADINGS: Record<TeamShareTab, string> = {
  info: "Share team",
  players: "Share squad",
  matches: "Share matches",
  leaderboard: "Share leaderboard",
  stats: "Share stats",
};

export interface TeamCardData {
  team: CricketTeam;
  // The tournament it plays in, if any.
  tournamentName?: string;
  record: { played: number; won: number; lost: number; tied: number };
  // Extra rows on the Info picture, after the record.
  facts: [string, string][];
  fixtures: FixtureDay[];
  // Its matches, as listed on the Matches tab.
  matches: CricketMatch[];
  // The matches its stats read, with `side` as its teamIndex in them.
  statMatches: CricketMatch[];
  side: number;
  playerById: Map<number, CricketPlayer>;
}

// Team totals as tile groups: the Stats tab and its picture.
export function teamStatGroups(t: TeamStats): StatGroup[] {
  return [
    {
      title: "Overview",
      icon: "fa-chart-simple",
      tiles: [
        ["Matches", t.matches],
        ["Won", t.won],
        ["Lost", t.lost],
        ["Win %", t.won + t.lost ? `${Math.round((t.won * 100) / (t.won + t.lost))}%` : "–"],
      ],
    },
    {
      title: "Batting",
      icon: "fa-baseball-bat-ball",
      tiles: [
        ["Runs", t.runs],
        ["Run rate", rate(t.runs, t.ballsFaced)],
        ["Overs faced", oversText(t.ballsFaced)],
        ["Wickets lost", t.wicketsLost],
        ["Fours", t.fours],
        ["Sixes", t.sixes],
        ["Dot balls", t.dotsFaced],
        ["Dot %", t.ballsFaced ? `${Math.round((t.dotsFaced * 100) / t.ballsFaced)}%` : "–"],
        ["Boundary runs", t.fours * 4 + t.sixes * 6],
        ["Extras received", t.extrasReceived],
        ["Highest total", t.highest ?? "–"],
        ["Lowest total", t.lowest ?? "–"],
        ["Strike rate", strikeRate(t.runs, t.ballsFaced)],
        ["Avg per innings", t.innings ? Math.round(t.runs / t.innings) : "–"],
      ],
    },
    {
      title: "Bowling",
      icon: "fa-baseball",
      tiles: [
        ["Wickets", t.wickets],
        ["Economy", rate(t.runsConceded, t.ballsBowled)],
        ["Overs bowled", oversText(t.ballsBowled)],
        ["Runs conceded", t.runsConceded],
        ["Dot balls", t.dotsBowled],
        ["Maidens", t.maidens],
        ["Wides", t.wides],
        ["No-balls", t.noBalls],
        ["Fours conceded", t.foursConceded],
        ["Sixes conceded", t.sixesConceded],
      ],
    },
    {
      title: "Fielding",
      icon: "fa-hands",
      tiles: [
        ["Catches", t.catches],
        ["Run-outs", t.runOuts],
        ["Stumpings", t.stumpings],
      ],
    },
  ];
}

function infoRows({ team, record, facts, playerById }: TeamCardData) {
  const captain = team.captainId != null ? playerById.get(team.captainId)?.name : undefined;
  const rows: [string, string][] = captain ? [["Captain", captain]] : [];
  rows.push(["Played", String(record.played)]);
  if (record.played > 0) {
    rows.push(
      ["Won", String(record.won)],
      ["Lost", String(record.lost)],
      ["Tied / NR", String(record.tied)],
      ["Win rate", `${Math.round((record.won / record.played) * 100)}%`],
    );
  }
  return [...rows, ...facts];
}

const SQUAD_GAP = 18;
const SQUAD_ASPECT = 0.7;

async function drawSquadCard(start: StartCard, squad: SquadEntry[], detail: string) {
  const cols = squad.length <= 9 ? 3 : 4;
  const rows = Math.ceil(squad.length / cols);
  const tileW = (INNER - SQUAD_GAP * (cols - 1)) / cols;
  const tileH = tileW / SQUAD_ASPECT;
  const photos = await loadPictures(squad.map((player) => player.photoUrl));
  const { canvas, ctx } = await start(rows * tileH + (rows - 1) * SQUAD_GAP, "SQUAD", detail);
  const pictures = squad.map((player) => (player.photoUrl ? (photos.get(player.photoUrl) ?? null) : null));
  drawSquadTiles(ctx, squad, pictures, { gridTop: CARD_CONTENT_TOP, cols, tileW, tileH, gap: SQUAD_GAP });
  return canvasBlob(canvas);
}

// The tab's message, and its picture when the tab has something to show.
export function teamTabShare(tab: TeamShareTab, data: TeamCardData): { text: string; subject: string; draw?: () => Promise<Blob | null> } {
  const { team, tournamentName, fixtures, matches, statMatches, side, playerById } = data;
  const name = team.name;
  // The header's second line names the tournament, for a tournament's team.
  const start: StartCard = (contentH, pillLabel, detail) =>
    startBrandedCard(
      { title: name, logoUrl: team.logoUrl, badge: { initials: monogram(name), color: avatarColorFor(name) } },
      contentH,
      pillLabel,
      tournamentName ? `${tournamentName} · ${detail}` : detail,
    );

  switch (tab) {
    case "info": {
      const detail = `${count(team.playerIds.length, "player")} · ${count(matches.length, "match", "matches")}`;
      return {
        subject: "team",
        text: `${tournamentName ? `${name} · ${tournamentName}` : name} on RunMitra`,
        draw: () => drawFactRows(start, infoRows(data), "TEAM", detail),
      };
    }
    case "players": {
      const squad = squadOrder(team, playerById);
      return {
        subject: "squad",
        text: squad.length > 0 ? squadText(name, tournamentName, squad) : `${name} on RunMitra`,
        draw: squad.length > 0 ? () => drawSquadCard(start, squad, count(squad.length, "player")) : undefined,
      };
    }
    case "matches":
      if (fixtures.length > 0) {
        const heading = tournamentName ? `${name} fixtures, ${tournamentName}` : `${name} fixtures`;
        return { subject: "fixtures", text: fixturesText(heading, fixtures), draw: () => drawFixtureDays(start, fixtures) };
      }
      if (latestResults(matches).length > 0) return { subject: "results", text: `${name} results on RunMitra`, draw: () => drawResults(start, matches) };
      return { subject: "matches", text: `${name} on RunMitra` };
    case "leaderboard": {
      const boards = leaderboards(statMatches, team.playerIds);
      const nameOf = (playerId: number | null) => (playerId === null ? "" : (playerById.get(playerId)?.name ?? "Unknown"));
      const photoOf = (playerId: number) => playerById.get(playerId)?.photoUrl ?? null;
      return {
        subject: "leaderboard",
        text: `${name} leaderboard on RunMitra`,
        draw: wasScored(statMatches) && boards.length > 0 ? () => drawLeaderboards(start, boards, statMatches, nameOf, photoOf) : undefined,
      };
    }
    case "stats": {
      const stats = teamStats(statMatches, side);
      return {
        subject: "stats",
        text: `${name} stats on RunMitra`,
        draw: stats.matches > 0 ? () => drawStatGroups(start, teamStatGroups(stats), `${count(stats.matches, "match", "matches")} scored`) : undefined,
      };
    }
  }
}
