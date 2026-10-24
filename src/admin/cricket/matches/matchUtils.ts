import { useMemo } from "react";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch, CricketMatchStage } from "../../../api/types";
import { inningsSummary } from "../stats";

// Every round a match can be played in, in tournament order. `note` and
// `icon` describe it in the stage picker.
export const STAGES: { value: CricketMatchStage; label: string; note: string; icon: string }[] = [
  { value: "league", label: "League", note: "Regular round-robin match", icon: "fa-list-ol" },
  { value: "group", label: "Group Stage", note: "Played within a group", icon: "fa-layer-group" },
  { value: "super-league", label: "Super League", note: "Super 6 / Super 8 round", icon: "fa-star" },
  { value: "round-of-16", label: "Round of 16", note: "First knockout round", icon: "fa-sitemap" },
  { value: "quarter-final", label: "Quarter-final", note: "Last eight", icon: "fa-sitemap" },
  { value: "eliminator", label: "Eliminator", note: "Loser is knocked out", icon: "fa-circle-xmark" },
  { value: "qualifier-1", label: "Qualifier 1", note: "Winner goes to the final", icon: "fa-flag-checkered" },
  { value: "qualifier-2", label: "Qualifier 2", note: "Winner takes the last final spot", icon: "fa-flag-checkered" },
  { value: "semi-final", label: "Semi-final", note: "Last four", icon: "fa-medal" },
  { value: "third-place", label: "3rd Place Play-off", note: "Between the losing semi-finalists", icon: "fa-award" },
  { value: "final", label: "Final", note: "Decides the champion", icon: "fa-trophy" },
  { value: "friendly", label: "Friendly / Practice", note: "Practice or exhibition match", icon: "fa-handshake" },
];

export const stageLabel = (stage: CricketMatchStage | null) => STAGES.find((s) => s.value === stage)?.label ?? "League";

// A match's stage. Outside a tournament there's no league, so a standalone
// match with no stage (or the old "league" default) is just a "Match".
// A format's group match names its group ("Group A"), and a series match
// its number ("Match 2").
export function matchStageLabel(match: CricketMatch) {
  if (match.tournamentId === null && (match.stage === null || match.stage === "league")) return "Match";
  const series = match.slot?.match(/^M(\d+)$/);
  if (series) return `Match ${series[1]}`;
  if (match.stage === "group" && match.group) return `Group ${match.group}`;
  return stageLabel(match.stage ?? "league");
}

export function formatMatchDate(value: string | null) {
  if (!value) return "Date not set";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// id → name lookup over the shared player list.
export function usePlayerNames() {
  const { data: players } = useCricketPlayers();
  return useMemo(() => {
    const names = new Map((players ?? []).map((player) => [player.id, player.name]));
    return (playerId: number | null) => (playerId === null ? "" : (names.get(playerId) ?? "Unknown"));
  }, [players]);
}

// id → photo URL lookup over the shared player list.
export function usePlayerPhotos() {
  const { data: players } = useCricketPlayers();
  return useMemo(() => {
    const photos = new Map((players ?? []).map((player) => [player.id, player.photoUrl]));
    return (playerId: number) => photos.get(playerId) ?? null;
  }, [players]);
}

// Which team a side is, the same rule as the server's effectiveTeamKey: a
// tournament match's sides are its tournament teams, and an older one-off
// side without a key is its name plus the match's creator, so two people's
// same-named teams stay apart.
export function teamKeyOf(match: CricketMatch, slot: number) {
  const side = match.teams[slot];
  if (match.tournamentId !== null) return `t:${match.tournamentId}:${side.teamIndex}`;
  return side.teamKey ?? `legacy:${match.createdById ?? 0}:${side.name.trim().toLowerCase()}`;
}

// Score of one side so far: "123/4 (15.2)", or nothing before they bat.
export function teamScore(match: CricketMatch, teamSlot: number) {
  const innings = match.innings.find((inn) => inn.battingTeam === teamSlot);
  if (!innings) return null;
  const summary = inningsSummary(innings);
  return { runs: `${summary.runs}/${summary.wickets}`, overs: summary.overs };
}

// Team slots in batting order, so the side that batted (or will bat) first
// is listed on top. Falls back to the toss, then to the fixture order.
export function battingOrder(match: CricketMatch): [number, number] {
  let first = match.innings[0]?.battingTeam;
  if (first === undefined && match.tossWinner !== null && match.tossDecision) {
    first = match.tossDecision === "bat" ? match.tossWinner : 1 - match.tossWinner;
  }
  return first === 1 ? [1, 0] : [0, 1];
}
