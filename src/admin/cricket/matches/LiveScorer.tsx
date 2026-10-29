import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  isStaleScore,
  useAbandonCricketMatch,
  useAddCricketBall,
  useEndCricketInnings,
  usePendingBall,
  useSetCricketCurrentPlayers,
  useUndoCricketBall,
  type CricketBallInput,
} from "../../../api/hooks/cricket/useCricketMatches";
import {
  ballsPerOverOf,
  type CricketExtraType,
  type CricketInnings,
  type CricketMatch,
  type CricketWicketType,
} from "../../../api/types";
import { Button } from "../../components/Button";
import { confirmAction } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { avatarColorFor } from "../avatarColor";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { TeamMark } from "../teams/TeamMark";
import { OutArt } from "./OutArt";
import { PlayerPicker, type PickItem } from "./PlayerPicker";
import { usePlayerPhotos } from "./matchUtils";
import { ShotGround, shotZoneAt } from "./ShotMap";
import { AddPlayerSheet } from "./scorer/AddPlayerSheet";
import { CorrectBallSheet } from "./scorer/CorrectBallSheet";
import { EndChaseSheet } from "./scorer/EndChaseSheet";
import { PenaltySheet } from "./scorer/PenaltySheet";
import { RunChoice } from "./scorer/RunChoice";
import "./scorer/scorer.css";
import {
  useCricketPlayers,
  useUpdateCricketPlayer,
} from "../../../api/hooks/cricket/useCricketPlayers";
import {
  BATTING_STYLES,
  BOWLING_STYLES,
  battingStyleOf,
  bowlingStyleOf,
} from "../playerRoles";
import {
  ballChipClass,
  ballLabel,
  battingCard,
  bowlingCard,
  cantBat,
  chaseInfo,
  inningsSummary,
  isFreeHitNext,
  isLegal,
  isWicket,
  oversOf,
  oversText,
  rate,
  type NameOf,
} from "../stats";

const EXTRA_LABELS: Record<CricketExtraType, string> = {
  wide: "Wide",
  "no-ball": "No ball",
  bye: "Bye",
  "leg-bye": "Leg bye",
  penalty: "Penalty runs",
};

const EXTRA_ICONS: Record<CricketExtraType, string> = {
  wide: "fa-arrows-left-right",
  "no-ball": "fa-ban",
  bye: "fa-person-running",
  "leg-bye": "fa-shoe-prints",
  penalty: "fa-gavel",
};

// The wicket sheet's out types. Caught & bowled and a Mankad are tiles of
// their own but stored as a catch (the bowler the fielder) and a run-out
// between deliveries.
type OutKey = CricketWicketType | "caught-and-bowled" | "mankad";

interface OutKind {
  key: OutKey;
  label: string;
  stored: CricketWicketType;
  // Who's out: the striker, the non-striker, either one at the crease, or
  // the next batter before they come in.
  who: "striker" | "non-striker" | "either" | "incoming";
  // What records it: the tile; picking the batter; or Record, after the
  // fielder (or, for a run-out, everything; for a hit wicket, the delivery)
  // is picked.
  step: "instant" | "batter" | "fielder" | "run-out" | "delivery";
  // No ball is bowled: always, or as the scorer says (retired hurt).
  noDelivery?: "always" | "choice";
  // Can come off a wide (and, unless stumped, a no ball).
  offExtras?: boolean;
  // The wicket-keeper is the fielder, unless the scorer changes it.
  keeper?: boolean;
  // Asks where the ball went afterwards.
  shot?: boolean;
  // Runs completed before it count (a run-out, an obstruction), so it's
  // asked for and recorded with Record rather than on the batter's tap.
  runs?: boolean;
  // Under "Show more".
  more?: boolean;
}

const OUT_KINDS: OutKind[] = [
  { key: "bowled", label: "Bowled", stored: "bowled", who: "striker", step: "instant" },
  { key: "caught", label: "Caught", stored: "caught", who: "striker", step: "fielder", shot: true },
  { key: "caught-behind", label: "Caught behind", stored: "caught-behind", who: "striker", step: "fielder", keeper: true },
  { key: "caught-and-bowled", label: "Caught & bowled", stored: "caught", who: "striker", step: "instant", shot: true },
  { key: "run-out", label: "Run out", stored: "run-out", who: "either", step: "run-out", offExtras: true, shot: true, runs: true },
  { key: "lbw", label: "LBW", stored: "lbw", who: "striker", step: "instant" },
  { key: "stumped", label: "Stumped", stored: "stumped", who: "striker", step: "fielder", offExtras: true, keeper: true },
  { key: "retired-hurt", label: "Retired hurt", stored: "retired-hurt", who: "either", step: "batter", noDelivery: "choice", offExtras: true },
  { key: "mankad", label: "Run out (Mankad)", stored: "run-out", who: "non-striker", step: "instant", noDelivery: "always", more: true },
  { key: "hit-wicket", label: "Hit wicket", stored: "hit-wicket", who: "striker", step: "delivery", offExtras: true, more: true },
  { key: "absent-hurt", label: "Absent hurt", stored: "absent-hurt", who: "incoming", step: "batter", noDelivery: "always", more: true },
  { key: "retired-out", label: "Retired out", stored: "retired-out", who: "either", step: "batter", noDelivery: "always", more: true },
  { key: "hit-ball-twice", label: "Hit the ball twice", stored: "hit-ball-twice", who: "striker", step: "instant", more: true },
  { key: "obstructing-field", label: "Obstructing the field", stored: "obstructing-field", who: "either", step: "batter", offExtras: true, runs: true, more: true },
  { key: "timed-out", label: "Timed out", stored: "timed-out", who: "incoming", step: "batter", noDelivery: "always", more: true },
  { key: "retired", label: "Retired", stored: "retired", who: "either", step: "batter", noDelivery: "always", more: true },
];
const outKind = (key: OutKey) => OUT_KINDS.find((kind) => kind.key === key)!;

// On a free hit only these get a batter out (as the server rules); anything
// between deliveries (a Mankad, timed out...) still can.
const FREE_HIT_OUTS: CricketWicketType[] = ["run-out", "obstructing-field", "hit-ball-twice", "retired-hurt", "retired", "retired-out"];
const allowedOnFreeHit = (kind: OutKind) => FREE_HIT_OUTS.includes(kind.stored) || kind.noDelivery === "always";

// What a wicket came off. Byes and leg-byes only for a run-out (the runs
// completed are then extras, not the batter's).
const DELIVERIES = [
  { value: "normal", label: "Legal ball", icon: "fa-circle-check" },
  { value: "wide", label: "Wide", icon: "fa-arrows-left-right" },
  { value: "no-ball", label: "No ball", icon: "fa-ban" },
  { value: "bye", label: "Bye", icon: "fa-person-running" },
  { value: "leg-bye", label: "Leg bye", icon: "fa-shoe-prints" },
] as const;
type Delivery = (typeof DELIVERIES)[number]["value"];

// Overs a bowler has had a part in (as the server counts them against a
// bowler's limit).
function oversBowled(innings: CricketInnings, bowlerId: number, perOver: number) {
  const overs = new Set<number>();
  let legal = 0;
  for (const ball of innings.balls) {
    if (ball.noDelivery) continue;
    if (ball.bowlerId === bowlerId) overs.add(Math.floor(legal / perOver));
    if (isLegal(ball)) legal++;
  }
  return overs.size;
}


const blankBall: CricketBallInput = {
  runs: 0,
  extraType: null,
  extras: 0,
  wicketType: null,
  dismissedId: null,
  fielderId: null,
};

// Fours, sixes, catches and run-outs always ask where the ball went; this
// is whether 1s, 2s and 3s do too (remembered on this device; off by
// default).
const SHOT_MAP_KEY = "crickverse_shotMap";
function readShotMap() {
  try {
    return localStorage.getItem(SHOT_MAP_KEY) === "on";
  } catch {
    return false;
  }
}

interface LiveScorerProps {
  match: CricketMatch;
  nameOf: NameOf;
  // The top bar's settings sheet (opened from the match page): the scorer's
  // own options — players, shot map, ending — around the match's.
  settingsOpen: boolean;
  onCloseSettings: () => void;
  matchSettings: ReactNode;
  // Opens the match page's "Enter result" sheet (rain, a forfeit...); when
  // given, ending the chase offers it.
  onEnterResult?: () => void;
}

export function LiveScorer({ match, nameOf, settingsOpen, onCloseSettings, matchSettings, onEnterResult }: LiveScorerProps) {
  const innings = match.innings[match.innings.length - 1];
  const battingXi = match.teams[innings.battingTeam].playerIds;
  const bowlingXi = match.teams[1 - innings.battingTeam].playerIds;
  const perOver = ballsPerOverOf(match);
  const summary = inningsSummary(innings, perOver);
  const chase = innings === match.innings[1] ? chaseInfo(match) : null;

  const setPlayers = useSetCricketCurrentPlayers();
  const { data: allPlayers } = useCricketPlayers();
  const updatePlayer = useUpdateCricketPlayer();
  const [promptStyle, setPromptStyle] = useState<{
    playerId: number;
    name: string;
    type: "batting" | "bowling";
  } | null>(null);

  const checkPromptStyle = (slot: Slot, id: number) => {
    const player = allPlayers?.find((p) => p.id === id);
    if (!player) return;
    if ((slot === "strikerId" || slot === "nonStrikerId") && !player.battingStyle) {
      setPromptStyle({ playerId: id, name: player.name, type: "batting" });
    } else if (slot === "bowlerId" && !player.bowlingStyle) {
      setPromptStyle({ playerId: id, name: player.name, type: "bowling" });
    }
  };
  const addBall = useAddCricketBall();
  const undoBall = useUndoCricketBall();
  const endInnings = useEndCricketInnings();
  const abandon = useAbandonCricketMatch();
  const busy = setPlayers.isPending || addBall.isPending || undoBall.isPending || endInnings.isPending || abandon.isPending;

  // Sends a ball. If another phone got there first the match refreshes
  // itself, so say so gently rather than as an error.
  const sendBall = (vars: Parameters<typeof addBall.mutate>[0]) =>
    addBall.mutate(vars, {
      onError: (error) => {
        if (isStaleScore(error)) toast("Score updated from another device");
      },
    });

  const ballsScrollRef = useRef<HTMLDivElement>(null);

  const [offlineOrFailed, setOfflineOrFailed] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setOfflineOrFailed(false);
    const handleOffline = () => setOfflineOrFailed(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // A ball kept on this device while offline: it goes again once the
  // connection's back (or on Retry); the pad waits for it meanwhile.
  const pendingBall = usePendingBall(match, (pending) => sendBall({ id: match.id, ...pending.ball, pending }), busy);
  const hasSendFailure = Boolean(pendingBall && (offlineOrFailed || addBall.isError));

  const [picks, setPicks] = useState<{ strikerId: number | null; nonStrikerId: number | null; bowlerId: number | null }>({
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
  });
  const [smallShotsOn, setSmallShotsOn] = useState(readShotMap);
  // A ball waiting for its spot on the shot map, and the spot tapped so far.
  const [pendingShot, setPendingShot] = useState<Partial<CricketBallInput> | null>(null);
  const [shotSpot, setShotSpot] = useState<{ x: number; y: number } | null>(null);
  const [extraModal, setExtraModal] = useState<CricketExtraType | null>(null);
  const [extraRuns, setExtraRuns] = useState(0);
  // A no ball's runs: off the bat (null), or byes / leg-byes.
  const [noBallByes, setNoBallByes] = useState<"bye" | "leg-bye" | null>(null);
  const [noBallFreeHit, setNoBallFreeHit] = useState<boolean>(true);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  // Correcting a ball: the one tapped, or null to choose from the list.
  const [correcting, setCorrecting] = useState<{ ballIndex: number | null } | null>(null);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [endChaseOpen, setEndChaseOpen] = useState(false);
  const [wicketModal, setWicketModal] = useState(false);
  // The "5, 7…" sheet: runs beyond the pad's (overthrows, all-run fives).
  const [moreRuns, setMoreRuns] = useState<number | null>(null);
  // A 4 or 6 the batters ran (it didn't reach the rope).
  const [allRun, setAllRun] = useState(false);
  type WicketDraft = {
    // Null until a tile is tapped.
    key: OutKey | null;
    dismissedId: number | null;
    fielderId: number | null;
    // A run-out's second fielder, when two were involved; none on a direct hit.
    secondFielderId: number | null;
    directHit: boolean;
    runs: number;
    delivery: Delivery;
    // A run-out: the end where the wicket was broken; null = the out
    // batter's own end.
    outEnd: "striker" | "non-striker" | null;
    // Retired hurt: whether it happened on a ball that counts.
    countBall: boolean;
  };
  const blankWicket: WicketDraft = {
    key: null,
    dismissedId: null,
    fielderId: null,
    secondFielderId: null,
    directHit: false,
    runs: 0,
    delivery: "normal",
    outEnd: null,
    countBall: false,
  };
  // The wicket sheet's "Show more" (the rarer out types).
  const [moreOuts, setMoreOuts] = useState(false);
  // Choosing the incoming batter for a timed out / absent hurt.
  const [pickingIncoming, setPickingIncoming] = useState(false);
  // The fielding side's list, opened from one of the wicket sheet's fielder
  // cards (a run-out can name a second fielder).
  const [pickingFielder, setPickingFielder] = useState<"fielderId" | "secondFielderId" | null>(null);
  const photoOf = usePlayerPhotos();
  const [wicket, setWicket] = useState<WicketDraft>(blankWicket);
  const kind = wicket.key ? outKind(wicket.key) : null;

  const out = new Set(innings.balls.filter(cantBat).map((ball) => ball.dismissedId));
  const atCrease = [innings.strikerId, innings.nonStrikerId];
  const availableBatters = battingXi.filter((id) => !out.has(id) && !atCrease.includes(id));
  // Last man stands: once only one batter can still bat, they bat on alone
  // (no non-striker, and they always face).
  const lastMan = Boolean(match.lastManStands) && battingXi.filter((id) => !out.has(id)).length === 1;
  const facing = innings.strikerId ?? (lastMan ? innings.nonStrikerId : null);
  const legal = innings.balls.filter(isLegal);
  const overJustEnded = legal.length > 0 && legal.length % perOver === 0;
  // No bowling two overs in a row (The Hundred's sets may run on).
  const consecutiveOk = match.matchType === "hundred";
  const lastBowler = overJustEnded && !consecutiveOk ? legal[legal.length - 1].bowlerId : null;
  // A crease is empty: the next batter is due, so they can be timed out or
  // be absent hurt (and no other wicket can fall).
  const incomingDue = lastMan ? facing === null : innings.strikerId === null || innings.nonStrikerId === null;
  const needsPlayers = incomingDue || innings.bowlerId === null;
  // Retired batters can come back in; show how they left and what they'd scored.
  const retiredAs = new Map<number | null, string>();
  for (const ball of innings.balls) {
    if (ball.wicketType === "retired-hurt") retiredAs.set(ball.dismissedId, "Retired hurt");
    if (ball.wicketType === "retired") retiredAs.set(ball.dismissedId, "Retired");
  }
  const freeHit = isFreeHitNext(match, innings);

  const batting = battingCard(innings);
  const bowling = bowlingCard(innings, perOver);
  // A bowler with their overs used up can't bowl again.
  const overLimit = match.bowlerOverLimit || null;
  const atLimit = (id: number) => overLimit !== null && oversBowled(innings, id, perOver) >= overLimit;

  type Slot = "strikerId" | "nonStrikerId" | "bowlerId";
  const [pickerFor, setPickerFor] = useState<Slot | null>(null);
  const batterItems = (exclude: number | null): PickItem[] =>
    availableBatters
      .filter((id) => id !== exclude)
      .map((id) => {
        const row = batting.find((r) => r.playerId === id);
        // Retired (hurt or not), or swapped out with Change: back in with their score.
        const tag = retiredAs.get(id);
        if (tag) return { id, tag, note: `${row?.runs ?? 0} (${row?.balls ?? 0}) so far` };
        return row ? { id, note: `${row.runs} (${row.balls}) so far` } : { id, note: "Yet to bat" };
      });
  const bowlerItems: PickItem[] = bowlingXi.map((id) => {
    const row = bowling.find((r) => r.playerId === id);
    const figures = row ? `${oversText(row.legalBalls, perOver)}-${row.maidens}-${row.runs}-${row.wickets}` : "Yet to bowl";
    const done = atLimit(id);
    return {
      id,
      note: overLimit !== null ? `${figures} · ${oversBowled(innings, id, perOver)}/${overLimit} overs` : figures,
      disabled: id === lastBowler || done,
      tag: done ? "Overs used up" : id === lastBowler ? "Bowled last over" : undefined,
    };
  });
  // Replacing a player already in (a wrong pick, or a bowler who can't
  // finish the over): any batter yet to bat, or another bowler — not the
  // one who bowled the previous over.
  const [changing, setChanging] = useState<Slot | null>(null);
  const previousOverBowler =
    legal.length >= perOver && !overJustEnded && !consecutiveOk
      ? legal[Math.floor(legal.length / perOver) * perOver - 1].bowlerId
      : null;
  const changeBowlerItems: PickItem[] = bowlerItems
    .filter((item) => item.id !== innings.bowlerId)
    .map((item) =>
      atLimit(item.id)
        ? item
        : item.id === previousOverBowler
          ? { ...item, disabled: true, tag: "Bowled last over" }
          : { ...item, disabled: false, tag: undefined },
    );
  function change(slot: Slot, id: number) {
    setChanging(null);
    setPlayers.mutate({ id: match.id, [slot]: id });
    checkPromptStyle(slot, id);
  }
  // Batting on alone, only the one batter is needed.
  const emptySlots: Slot[] = (["strikerId", "nonStrikerId", "bowlerId"] as const).filter((slot) =>
    slot === "bowlerId" || !lastMan ? innings[slot] === null : slot === "strikerId" && facing === null,
  );

  // After a pick, move straight on to the next empty slot; the last one
  // saves them all — no confirm step.
  function pick(slot: Slot, id: number) {
    const next = { ...picks, [slot]: id };
    setPicks(next);
    const nextSlot = emptySlots.find((s) => s !== slot && next[s] === null) ?? null;
    setPickerFor(nextSlot);
    if (!nextSlot) savePlayers(next);
    checkPromptStyle(slot, id);
  }
  const thisOver = oversOf(innings, perOver).at(-1);
  const overEndPending = overJustEnded && innings.bowlerId === null;
  // The pickers show the score as it stands once the innings is under way:
  // between overs, and for the next batter after a wicket.
  const showSheetScore = innings.balls.length > 0 && (overEndPending || pickerFor !== "bowlerId");

  // When an over finishes, the picker for the next bowler (or, after a
  // wicket off the last ball, the next batter first) opens by itself. Keyed
  // by innings + ball count so it opens once per over.
  const overKey = `${match.innings.length}-${legal.length}`;
  const [overPromptSeen, setOverPromptSeen] = useState<string | null>(null);
  useEffect(() => {
    if (!overEndPending || overPromptSeen === overKey || pickerFor !== null || busy) return;
    setOverPromptSeen(overKey);
    setPickerFor(emptySlots[0] ?? null);
  }, [overEndPending, overPromptSeen, overKey, pickerFor, busy, emptySlots]);
  // Likewise mid-over: once a batter is out (or retires), the list for the
  // next one opens by itself — once per ball, so closing it leaves it shut.
  const batterKey = `${match.innings.length}-${innings.balls.length}`;
  const [batterPromptSeen, setBatterPromptSeen] = useState<string | null>(null);
  useEffect(() => {
    if (overEndPending || !incomingDue || innings.balls.length === 0 || availableBatters.length === 0) return;
    if (batterPromptSeen === batterKey || pickerFor !== null || busy) return;
    setBatterPromptSeen(batterKey);
    setPickerFor(innings.strikerId === null ? "strikerId" : "nonStrikerId");
  }, [overEndPending, incomingDue, innings.balls.length, innings.strikerId, availableBatters.length, batterPromptSeen, batterKey, pickerFor, busy]);
  // Closed without a pick, the strip keeps showing the finished over (all
  // its balls); once the next bowler is in, it starts empty for the new one.
  const showOver = !overJustEnded || (overEndPending && overPromptSeen === overKey) ? thisOver : undefined;
  const [showAllPrevOvers, setShowAllPrevOvers] = useState(false);

  useEffect(() => {
    if (ballsScrollRef.current) {
      const el = ballsScrollRef.current;
      if (el.scrollWidth > el.clientWidth + 4) {
        el.scrollTo({
          left: el.scrollWidth,
          behavior: "smooth",
        });
      } else {
        el.scrollTo({ left: 0, behavior: "smooth" });
      }
    }
  }, [showOver?.balls.length]);

  // The pad stays live between overs — tapping it brings the prompt back.
  const padDisabled = busy || (hasSendFailure && !navigator.onLine) || (needsPlayers && !overEndPending);
  const scoreOr = (action: () => void) => () => (overEndPending ? setOverPromptSeen(null) : action());

  // Saves the picks for the empty slots (called once the last one is chosen).
  function savePlayers(chosen: typeof picks) {
    const input: { strikerId?: number; nonStrikerId?: number; bowlerId?: number } = {};
    if (innings.strikerId === null && chosen.strikerId !== null) input.strikerId = chosen.strikerId;
    if (innings.nonStrikerId === null && chosen.nonStrikerId !== null) input.nonStrikerId = chosen.nonStrikerId;
    if (innings.bowlerId === null && chosen.bowlerId !== null) input.bowlerId = chosen.bowlerId;
    setPlayers.mutate(
      { id: match.id, ...input },
      { onSettled: () => setPicks({ strikerId: null, nonStrikerId: null, bowlerId: null }) },
    );
  }

  // Undo is offered right where the next player is chosen too — e.g. to
  // take back the last ball of an over before picking the new bowler.
  const canUndo = innings.balls.length + (match.innings.length - 1) > 0;
  function undo() {
    setPickerFor(null);
    setOverPromptSeen(null);
    // A wicket recorded again on the same ball asks for the batter again.
    setBatterPromptSeen(null);
    setPicks({ strikerId: null, nonStrikerId: null, bowlerId: null });
    undoBall.mutate(match.id);
  }

  const record = (ball: Partial<CricketBallInput>) => sendBall({ id: match.id, ...blankBall, ...ball });
  function askWhere(ball: Partial<CricketBallInput>) {
    setShotSpot(null);
    setPendingShot(ball);
  }
  // Fours and sixes first ask where the shot went; 1s, 2s and 3s only with
  // that switched on.
  const recordShot = (ball: Partial<CricketBallInput>) => {
    const runs = ball.runs ?? 0;
    return runs >= 4 || (runs > 0 && smallShotsOn) ? askWhere(ball) : record(ball);
  };

  function toggleSmallShots() {
    const next = !smallShotsOn;
    setSmallShotsOn(next);
    try {
      localStorage.setItem(SHOT_MAP_KEY, next ? "on" : "off");
    } catch {
      // Not saved; it still applies until the page reloads.
    }
  }

  // Records the waiting ball, with the spot tapped (if any).
  function saveShot(spot: { x: number; y: number } | null) {
    if (!pendingShot) return;
    record(spot ? { ...pendingShot, shotX: spot.x, shotY: spot.y, shotZone: shotZoneAt(spot.x, spot.y) } : pendingShot);
    setPendingShot(null);
    setShotSpot(null);
  }
  // A tap on the ground records the ball: the line to the spot shows for a
  // moment first. Further taps meanwhile are ignored.
  function tapShot(x: number, y: number) {
    if (shotSpot) return;
    const spot = { x, y };
    setShotSpot(spot);
    setTimeout(() => saveShot(spot), 450);
  }
  const shotWord = !pendingShot
    ? ""
    : pendingShot.wicketType
      ? "wicket"
      : pendingShot.runs === 4
        ? "four"
        : pendingShot.runs === 6
          ? "six"
          : `${pendingShot.runs} run${pendingShot.runs === 1 ? "" : "s"}`;

  function submitExtra() {
    if (!extraModal) return;
    if (extraModal === "wide") record({ extraType: "wide", extras: 1 + extraRuns });
    // Byes or leg-byes off a no ball are extras on top of its penalty.
    if (extraModal === "no-ball" && noBallByes && extraRuns > 0) {
      record({ extraType: "no-ball", runs: 0, extras: 1 + extraRuns, byeType: noBallByes, freeHit: noBallFreeHit });
    } else if (extraModal === "no-ball") {
      recordShot({ extraType: "no-ball", extras: 1, runs: noBallByes ? 0 : extraRuns, freeHit: noBallFreeHit });
    }
    if (extraModal === "bye" || extraModal === "leg-bye") record({ extraType: extraModal, extras: Math.max(extraRuns, 1) });
    setExtraModal(null);
  }

  // Opens the wicket sheet; from the "next batter" panel, on the rarer out
  // types (timed out / absent hurt are among them).
  function openWicket(showMore = false) {
    setWicket({ ...blankWicket, dismissedId: facing });
    setMoreOuts(showMore);
    setWicketModal(true);
  }

  // Taps a tile: the ones needing nothing more record there and then; the
  // others fill in what they already know (the keeper as fielder).
  function chooseOut(next: OutKind) {
    const keeperId = match.teams[1 - innings.battingTeam].keeperId ?? null;
    const draft: WicketDraft = {
      ...wicket,
      key: next.key,
      dismissedId: next.who === "striker" ? facing : next.who === "non-striker" && !lastMan ? innings.nonStrikerId : null,
      fielderId: next.keeper && keeperId !== null && bowlingXi.includes(keeperId) ? keeperId : next.step === "fielder" ? null : wicket.fielderId,
      // Neither stumped nor hit wicket off a no ball; byes only for a run-out.
      delivery:
        ((next.key === "stumped" || next.key === "hit-wicket") && wicket.delivery === "no-ball") ||
        (next.key !== "run-out" && (wicket.delivery === "bye" || wicket.delivery === "leg-bye"))
          ? "normal"
          : wicket.delivery,
      outEnd: null,
    };
    if (next.step === "instant") submitWicket(draft);
    else setWicket(draft);
  }

  // A wicket sheet card for a fielder: "Choose fielder" until one is picked,
  // then their photo and name. Tapping it opens the fielding side's list.
  function fielderSlot(slot: "fielderId" | "secondFielderId", label: string | null) {
    const playerId = wicket[slot];
    return (
      <button
        type="button"
        className={`cricket-slot cricket-fielder-slot ${playerId !== null ? "is-chosen" : ""}`.trim()}
        disabled={busy}
        onClick={() => setPickingFielder(slot)}
      >
        {playerId !== null ? (
          <PlayerAvatar name={nameOf(playerId)} photoUrl={photoOf(playerId)} className="cricket-fielder-avatar" />
        ) : (
          <span className="cricket-slot-icon">
            <i className="fa-solid fa-user-plus" aria-hidden="true"></i>
          </span>
        )}
        <span className="cricket-slot-text">
          <small>
            {playerId === null
              ? `${label ? `${label} · ` : ""}Optional`
              : `${label ?? "Fielder"}${playerId === innings.bowlerId ? " · Bowler" : ""}`}
          </small>
          <strong>{playerId === null ? `Choose ${label?.toLowerCase() ?? "fielder"}` : nameOf(playerId)}</strong>
        </span>
        <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
    );
  }

  // Records the wicket as drafted, or as just picked (passed in, so a tap
  // can record before the draft in state has caught up).
  function submitWicket(draft: WicketDraft = wicket) {
    if (!draft.key || busy) return;
    const out = outKind(draft.key);
    const noDelivery = out.noDelivery === "always" || (out.noDelivery === "choice" && !draft.countBall);
    const delivery = out.offExtras && !noDelivery ? draft.delivery : "normal";
    const completed = out.runs ? draft.runs : 0;
    // Run out off a bye / leg-bye: the runs completed are extras (none
    // completed is just a run-out off a legal ball).
    const byes = delivery === "bye" || delivery === "leg-bye";
    const fielderId =
      out.key === "caught-and-bowled" || out.key === "mankad"
        ? innings.bowlerId
        : out.step === "fielder" || out.step === "run-out"
          ? draft.fielderId
          : null;
    // A catch or a run-out also asks where the ball went.
    (out.shot && !noDelivery ? askWhere : record)({
      wicketType: out.stored,
      dismissedId: draft.dismissedId,
      fielderId,
      secondFielderId: out.key === "run-out" && !draft.directHit && draft.fielderId !== null ? draft.secondFielderId : null,
      noDelivery,
      runs: noDelivery || delivery === "wide" || byes ? 0 : completed,
      extraType: noDelivery || delivery === "normal" || (byes && completed === 0) ? null : delivery,
      extras: noDelivery ? 0 : delivery === "wide" ? 1 + completed : delivery === "no-ball" ? 1 : byes ? completed : 0,
      // Batting on alone there's no other end to send anyone to.
      outEnd: out.stored === "run-out" && !lastMan ? outEndOf(draft) : null,
    });
    setWicketModal(false);
  }

  // Where a run-out happened: as chosen, or the out batter's own end.
  const outEndOf = (draft: WicketDraft) =>
    draft.outEnd ?? (draft.dismissedId !== null && draft.dismissedId === innings.nonStrikerId ? "non-striker" : "striker");

  async function handleEndInnings() {
    const last = match.innings.length === 2;
    // Ending the chase: on the scores, or with a result entered by hand.
    if (last && onEnterResult) return setEndChaseOpen(true);
    if (
      await confirmAction(
        last ? "End the match?" : "End this innings?",
        last ? "The second innings closes and the result is worked out from the scores." : "The other side bats next.",
        last ? "End match" : "End innings",
      )
    ) {
      endInnings.mutate(match.id);
    }
  }

  async function handleAbandon() {
    if (await confirmAction("Abandon this match?", "It's recorded as a no result.", "Abandon")) abandon.mutate(match.id);
  }

  const bowlerRow = bowling.find((row) => row.playerId === innings.bowlerId);

  // Between the innings, until the chase's openers and bowler are in, the
  // scorer gives way to a screen of its own: the first innings' total, the
  // target, and the pickers.
  const inningsBreak = chase !== null && innings.balls.length === 0 && needsPlayers;
  const firstInnings = inningsSummary(match.innings[0], perOver);

  // On phones the dock is fixed to the bottom of the screen; the page keeps
  // that much room free below the card (--cv-dock-h) so nothing hides behind it.
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--cv-dock-h", `${dock.offsetHeight}px`));
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--cv-dock-h");
    };
  }, [inningsBreak]);

  return (
    <div className="cricket-scorer">
      {inningsBreak && chase && (
        <section className="cricket-break">
          <span className="cricket-break-eyebrow">
            <i className="fa-solid fa-mug-hot" aria-hidden="true"></i> Innings break
          </span>
          <p className="cricket-break-first">
            {match.teams[match.innings[0].battingTeam].name}{" "}
            <strong>
              {firstInnings.runs}/{firstInnings.wickets}
            </strong>{" "}
            <small>({firstInnings.overs} ov)</small>
          </p>
          <div className="cricket-break-target">
            <small>Target</small>
            <strong>{chase.target}</strong>
          </div>
          <p className="cricket-break-need">
            {match.teams[innings.battingTeam].name} need <strong>{chase.target}</strong> run{chase.target === 1 ? "" : "s"} from{" "}
            <strong>{chase.ballsLeft}</strong> balls
          </p>
          <span className="cricket-break-rate">Required rate {chase.requiredRate}</span>
        </section>
      )}
      {!inningsBreak && (
      <div className="cricket-scorer-head">
        <div className="cricket-scorer-head-main">
          <TeamMark
            className="cricket-scorer-team-logo"
            name={match.teams[innings.battingTeam].name}
            logoUrl={match.teams[innings.battingTeam].logoUrl}
            color={avatarColorFor(match.teams[innings.battingTeam].name)}
          />
          <div className="cricket-scorer-head-info">
            <div className="cricket-scorer-team-row">
              <span className="cricket-scorer-team">{match.teams[innings.battingTeam].name}</span>
              <span className="cricket-scorer-innings-tag">
                {match.innings.length === 2 ? "2nd Inn" : "1st Inn"}
              </span>
            </div>
            <div className="cricket-scorer-score-row">
              <strong className="cricket-scorer-score">
                {summary.runs}/{summary.wickets}
              </strong>
              <span className="cricket-scorer-overs">
                ({summary.overs} / {match.overs} ov)
              </span>
            </div>
          </div>
        </div>
        <div className="cricket-scorer-rates">
          <span className="cricket-rate-pill">
            <small>CRR</small>
            <strong>{rate(summary.runs, summary.legalBalls, perOver)}</strong>
          </span>
          {chase && (
            <>
              <span className="cricket-rate-pill is-target">
                <small>Target</small>
                <strong>{chase.target}</strong>
              </span>
              <span className="cricket-rate-pill">
                <small>RRR</small>
                <strong>{chase.requiredRate}</strong>
              </span>
            </>
          )}
        </div>
      </div>
      )}
      {chase && !inningsBreak && (
        <div className="cricket-chase-line">
          <i className="fa-solid fa-bullseye" aria-hidden="true"></i>
          <span>
            Need <strong>{Math.max(chase.need, 0)}</strong> run{chase.need === 1 ? "" : "s"} from{" "}
            <strong>{chase.ballsLeft}</strong> ball{chase.ballsLeft === 1 ? "" : "s"}
          </span>
        </div>
      )}
      {needsPlayers ? (
        <section className="cricket-panel cricket-pickers">
          <h2 className="cricket-section-title">
            {innings.balls.length === 0
              ? inningsBreak
                ? `${match.teams[innings.battingTeam].name} — openers and opening bowler`
                : "Openers and opening bowler"
              : innings.bowlerId === null && !incomingDue
                ? `End of over ${oversText(legal.length, perOver)} — choose the next bowler`
                : "Next batter in"}
          </h2>
          <div className="cricket-slots">
            {emptySlots.map((slot) => {
              const chosen = picks[slot];
              const label = slot === "strikerId" ? "Striker" : slot === "nonStrikerId" ? "Non-striker" : "Bowler";
              const icon = slot === "bowlerId" ? "fa-baseball" : slot === "strikerId" ? "fa-baseball-bat-ball" : "fa-user";
              return (
                <button
                  key={slot}
                  type="button"
                  className={`cricket-slot ${chosen !== null ? "is-chosen" : ""}`}
                  onClick={() => setPickerFor(slot)}
                >
                  <span className="cricket-slot-icon">
                    <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                  </span>
                  <span className="cricket-slot-text">
                    <small>{label}</small>
                    <strong>{chosen !== null ? nameOf(chosen) : `Choose ${label.toLowerCase()}`}</strong>
                  </span>
                  <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
              );
            })}
          </div>
          {innings.strikerId === null && innings.nonStrikerId !== null && availableBatters.length === 0 && (
            <p className="admin-hint">No batters left — end the innings.</p>
          )}
          {incomingDue && availableBatters.length > 0 && innings.balls.length > 0 && (
            <button type="button" className="cricket-undo-link" onClick={() => openWicket(true)} disabled={busy}>
              <i className="fa-solid fa-stopwatch" aria-hidden="true"></i> Timed out or absent hurt?
            </button>
          )}
          {canUndo && (
            <button type="button" className="cricket-undo-link" onClick={undo} disabled={busy}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo last ball
            </button>
          )}
        </section>
      ) : null}

      {!inningsBreak && (
      <>
      <div className="cricket-crease-card">
        {/* Batters section */}
        <div className="cricket-crease-section">
          <div className="cricket-crease-section-header">
            <span className="cricket-crease-section-tag">
              <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i>
              <span>Batting</span>
            </span>
            <button
              type="button"
              className="cricket-crease-swap-btn"
              hidden={lastMan}
              disabled={busy || innings.strikerId === null || innings.nonStrikerId === null}
              onClick={() =>
                setPlayers.mutate({ id: match.id, strikerId: innings.nonStrikerId, nonStrikerId: innings.strikerId })
              }
              title="Swap strike"
              aria-label="Swap strike"
            >
              <i className="fa-solid fa-arrow-right-arrow-left" aria-hidden="true"></i>
              <span>Swap strike</span>
            </button>
          </div>

          <div className="cricket-crease-players">
            {(["strikerId", "nonStrikerId"] as const).filter((slot) => !lastMan || slot === "strikerId").map((slot, i) => {
              const playerId = slot === "strikerId" ? facing : innings[slot];
              const row = batting.find((r) => r.playerId === playerId);
              const isStriker = i === 0;
              const sr = row && row.balls > 0 ? ((row.runs / row.balls) * 100).toFixed(1) : "0.0";
              return (
                <button
                  key={slot}
                  type="button"
                  className={`cricket-crease-player-row ${isStriker ? "is-striker" : ""}`}
                  disabled={playerId === null || busy}
                  onClick={() => setChanging(slot)}
                  title={playerId === null ? undefined : `Change ${isStriker ? "striker" : "non-striker"}`}
                >
                  <span className="cricket-crease-avatar-wrap">
                    {playerId !== null ? (
                      <PlayerAvatar name={nameOf(playerId)} photoUrl={photoOf(playerId)} className="cricket-crease-avatar" />
                    ) : (
                      <span className="cricket-crease-avatar is-empty">
                        <i className="fa-solid fa-user" aria-hidden="true"></i>
                      </span>
                    )}
                    {isStriker && playerId !== null && (
                      <span className="cricket-crease-strike-dot" aria-hidden="true" title="On strike">
                        <i className="fa-solid fa-baseball-bat-ball"></i>
                      </span>
                    )}
                  </span>
                  <span className="cricket-crease-who">
                    <span className="cricket-crease-name-line">
                      <span className="cricket-crease-name">
                        {playerId === null ? "—" : nameOf(playerId)}
                        {isStriker && playerId !== null && <span className="cricket-crease-star">*</span>}
                      </span>
                      {isStriker && playerId !== null && (
                        <span className="cricket-strike-badge">STRIKE</span>
                      )}
                      {playerId !== null && (() => {
                        const p = allPlayers?.find((item) => item.id === playerId);
                        const s = battingStyleOf(p?.battingStyle);
                        return s ? (
                          <span
                            className="cricket-player-style-tag"
                            title={`${s.label} (Tap to change)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPromptStyle({ playerId, name: nameOf(playerId), type: "batting" });
                            }}
                          >
                            {s.short}
                          </span>
                        ) : null;
                      })()}
                    </span>
                    <span className="cricket-crease-meta-line">
                      <span>{row ? `${row.fours}×4 · ${row.sixes}×6` : "0×4 · 0×6"}</span>
                      <span className="cricket-crease-dot-sep">·</span>
                      <span className="cricket-crease-sr">SR {sr}</span>
                    </span>
                  </span>
                  <span className="cricket-crease-figs-col">
                    <strong className="cricket-crease-runs">{row?.runs ?? 0}</strong>
                    <span className="cricket-crease-balls">({row?.balls ?? 0}b)</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="cricket-crease-divider" />

        {/* Bowler section */}
        <div className="cricket-crease-section">
          <div className="cricket-crease-section-header">
            <span className="cricket-crease-section-tag is-bowler-tag">
              <i className="fa-solid fa-baseball" aria-hidden="true"></i>
              <span>Bowling</span>
            </span>
            {bowlerRow && bowlerRow.legalBalls > 0 && (
              <span className="cricket-crease-econ-badge">
                Econ {rate(bowlerRow.runs, bowlerRow.legalBalls, perOver)}
              </span>
            )}
          </div>

          <button
            type="button"
            className="cricket-crease-player-row is-bowler-row"
            disabled={innings.bowlerId === null || busy}
            onClick={() => setChanging("bowlerId")}
            title={innings.bowlerId === null ? undefined : "Change bowler"}
          >
            <span className="cricket-crease-avatar-wrap">
              {innings.bowlerId !== null ? (
                <PlayerAvatar name={nameOf(innings.bowlerId)} photoUrl={photoOf(innings.bowlerId)} className="cricket-crease-avatar" />
              ) : (
                <span className="cricket-crease-avatar is-empty">
                  <i className="fa-solid fa-baseball" aria-hidden="true"></i>
                </span>
              )}
              <span className="cricket-crease-strike-dot is-ball" aria-hidden="true">
                <i className="fa-solid fa-baseball"></i>
              </span>
            </span>
            <span className="cricket-crease-who">
              <span className="cricket-crease-name-line">
                <span className="cricket-crease-name">
                  {innings.bowlerId === null ? "—" : nameOf(innings.bowlerId)}
                </span>
                {innings.bowlerId !== null && (() => {
                  const p = allPlayers?.find((item) => item.id === innings.bowlerId);
                  const s = bowlingStyleOf(p?.bowlingStyle);
                  return s ? (
                    <span
                      className="cricket-player-style-tag"
                      title={`${s.label} (Tap to change)`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPromptStyle({ playerId: innings.bowlerId!, name: nameOf(innings.bowlerId!), type: "bowling" });
                      }}
                    >
                      {s.short}
                    </span>
                  ) : null;
                })()}
              </span>
              <span className="cricket-crease-meta-line">
                <span>{bowlerRow ? `Dots: ${bowlerRow.dots}` : "Tap to change"}</span>
                {bowlerRow && (bowlerRow.wides > 0 || bowlerRow.noBalls > 0) && (
                  <>
                    <span className="cricket-crease-dot-sep">·</span>
                    <span>Extras: {bowlerRow.wides + bowlerRow.noBalls}</span>
                  </>
                )}
              </span>
            </span>
            <span className="cricket-crease-bowler-figs-col">
              <strong className="cricket-crease-bowler-figs">
                {bowlerRow ? `${oversText(bowlerRow.legalBalls, perOver)}-${bowlerRow.maidens}-${bowlerRow.runs}-${bowlerRow.wickets}` : "0-0-0-0"}
              </strong>
              <small className="cricket-crease-bowler-sub">O - M - R - W</small>
            </span>
          </button>
        </div>
      </div>

      {/* Previous Overs History */}
      {(() => {
        const allOvers = oversOf(innings, perOver);
        const prevOvers = allOvers.filter((o) => o !== showOver).reverse();
        if (prevOvers.length === 0) return null;

        let cumR = 0;
        let cumW = 0;
        const overScores = new Map<number, { score: string }>();
        for (const ov of allOvers) {
          cumR += ov.runs;
          cumW += ov.balls.filter(isWicket).length;
          overScores.set(ov.number, { score: `${cumR}/${cumW}` });
        }

        const displayedOvers = showAllPrevOvers ? prevOvers : prevOvers.slice(0, 2);

        return (
          <div className="cricket-prev-overs-card">
            <div className="cricket-prev-overs-header">
              <span className="cricket-prev-overs-title">
                <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
                <span>Previous Overs</span>
              </span>
              {prevOvers.length > 2 && (
                <button
                  type="button"
                  className="cricket-prev-overs-toggle-btn"
                  onClick={() => setShowAllPrevOvers((prev) => !prev)}
                >
                  {showAllPrevOvers ? "Show recent" : `All (${prevOvers.length})`}
                  <i className={`fa-solid fa-chevron-${showAllPrevOvers ? "up" : "down"}`} aria-hidden="true"></i>
                </button>
              )}
            </div>

            <div className="cricket-prev-overs-list">
              {displayedOvers.map((over) => {
                const overWkts = over.balls.filter(isWicket).length;
                const scoreAtEnd = overScores.get(over.number)?.score;
                return (
                  <div key={over.number} className="cricket-prev-over-item">
                    <div className="cricket-prev-over-meta">
                      <div className="cricket-prev-over-left">
                        <span className="cricket-prev-over-badge">Over {over.number + 1}</span>
                        <span className="cricket-prev-over-bowler">{nameOf(over.bowlerId)}</span>
                      </div>
                      <div className="cricket-prev-over-right">
                        <span className="cricket-prev-over-runs">
                          <strong>{over.runs}</strong> {over.runs === 1 ? "run" : "runs"}
                          {overWkts > 0 && <span className="cricket-prev-over-wkts"> · {overWkts} {overWkts === 1 ? "wkt" : "wkts"}</span>}
                        </span>
                        {scoreAtEnd && <span className="cricket-prev-over-score">({scoreAtEnd})</span>}
                      </div>
                    </div>
                    <div className="cricket-prev-over-balls">
                      {over.balls.map((ball, bi) => {
                        const originalIndex = innings.balls.indexOf(ball);
                        return (
                          <button
                            key={bi}
                            type="button"
                            className={`${ballChipClass(ball)} cricket-chip-btn`}
                            disabled={busy || ball.extraType === "penalty"}
                            onClick={() => setCorrecting({ ballIndex: originalIndex })}
                            title="Tap to correct this ball"
                          >
                            {ballLabel(ball)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Fixed to the bottom of the screen on phones. */}
      <div className="cricket-scorer-dock" ref={dockRef}>
      <div className="cricket-this-over">
        <span className="cricket-this-over-label">{overEndPending ? "Last over" : "This over"}</span>
        <div className="cricket-this-over-balls-wrap">
          <div className="cricket-this-over-balls" ref={ballsScrollRef}>
          {showOver?.balls.map((ball, i) => (
            // Tap a ball to correct it.
            <button
              key={i}
              type="button"
              className={`${ballChipClass(ball)} cricket-chip-btn`}
              disabled={busy || ball.extraType === "penalty"}
              onClick={() => setCorrecting({ ballIndex: innings.balls.indexOf(ball) })}
              title="Correct this ball"
            >
              {ballLabel(ball)}
            </button>
          ))}
          {Array.from({
            length:
              (showOver?.balls.length ?? 0) >= perOver
                ? ((showOver?.balls.filter(isLegal).length ?? 0) < perOver ? 1 : 0)
                : Math.max(0, perOver - (showOver?.balls.length ?? 0)),
          }).map((_, idx) => (
            <span key={`rem-${idx}`} className="cricket-ball-slot-empty" aria-hidden="true"></span>
          ))}
          </div>
        </div>
        <span className="cricket-this-over-runs">
          {showOver?.runs ?? 0} {(showOver?.runs ?? 0) === 1 ? "run" : "runs"}
        </span>
      </div>

      {hasSendFailure && (
        <div className="cricket-pending-ball" role="status">
          <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
          <span>Failed to send ball score — check connection or tap Retry</span>
          <div className="d-flex gap-2 align-items-center ms-auto">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => sendBall({ id: match.id, ...pendingBall!.ball, pending: pendingBall! })}
            >
              Retry
            </Button>
            <button
              type="button"
              className="btn btn-sm btn-link text-white text-decoration-none p-1"
              title="Dismiss"
              onClick={() => {
                try {
                  localStorage.removeItem(`cricdesk_pending_ball_${match.id}`);
                } catch {
                  // ignore
                }
                addBall.reset();
              }}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      )}

      {freeHit && !needsPlayers && (
        <div className="cricket-free-hit" role="status">
          <i className="fa-solid fa-bolt" aria-hidden="true"></i> Free hit <small>only a run-out gets the batter out</small>
        </div>
      )}

      {/* Main pad: 3 columns with 3 rows on the left; 4 buttons in the last column on the right.
          Left:
            Row 1: 0, 1, 2
            Row 2: 3, 4, 6
            Row 3: Wide, Bye, Leg bye
          Right (last column):
            1: Undo
            2: 5, 6...
            3: No ball
            4: Out (corner button at bottom right) */}
      <div className="cricket-pad-container">
        <div className="cricket-pad-main">
          {[
            [0, 1, 2],
            [3, 4, 6],
            ["wide", "bye", "leg-bye"],
          ]
            .flat()
            .map((key) => {
              if (typeof key === "number") {
                const isBoundary = key === 4 || key === 6;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`cricket-pad-btn is-run ${isBoundary ? `is-boundary is-${key === 4 ? "four" : "six"}` : key === 0 ? "is-dot" : ""}`}
                    disabled={padDisabled}
                    onClick={scoreOr(() => recordShot(isBoundary ? { runs: key, boundary: true } : { runs: key }))}
                  >
                    <span className="cricket-pad-num">{key}</span>
                    {(isBoundary || key === 0) && (
                      <small className="cricket-pad-word">{key === 4 ? "Four" : key === 6 ? "Six" : "Dot"}</small>
                    )}
                  </button>
                );
              }
              const type = key as CricketExtraType;
              return (
                <button
                  key={type}
                  type="button"
                  className="cricket-pad-btn is-extra"
                  disabled={padDisabled}
                  onClick={scoreOr(() => {
                    setExtraRuns(type === "bye" || type === "leg-bye" ? 1 : 0);
                    setNoBallByes(null);
                    setNoBallFreeHit(match.freeHit !== false);
                    setExtraModal(type);
                  })}
                >
                  <OutArt type={type} className="cricket-pad-art" />
                  <span>{EXTRA_LABELS[type]}</span>
                </button>
              );
            })}
        </div>

        <div className="cricket-pad-side">
          <button
            type="button"
            className="cricket-pad-btn is-extra is-undo"
            disabled={busy || !canUndo}
            onClick={undo}
            title="Undo last ball"
          >
            <i className="fa-solid fa-rotate-left cricket-pad-art" aria-hidden="true"></i>
            <span>Undo</span>
          </button>
          <button
            type="button"
            className="cricket-pad-btn is-extra"
            disabled={padDisabled}
            onClick={scoreOr(() => {
              setAllRun(false);
              setMoreRuns(5);
            })}
          >
            <OutArt type="runs" className="cricket-pad-art" />
            <span>5, 6…</span>
          </button>
          <button
            type="button"
            className="cricket-pad-btn is-extra"
            disabled={padDisabled}
            onClick={scoreOr(() => {
              setExtraRuns(0);
              setNoBallByes(null);
              setNoBallFreeHit(match.freeHit !== false);
              setExtraModal("no-ball");
            })}
          >
            <OutArt type="no-ball" className="cricket-pad-art" />
            <span>No ball</span>
          </button>
          <button
            type="button"
            className="cricket-pad-btn is-wicket"
            disabled={padDisabled}
            onClick={scoreOr(openWicket)}
          >
            <OutArt type="out" className="cricket-pad-art" />
            <span>Out</span>
          </button>
        </div>
      </div>
      </div>
      </>
      )}

      {pickerFor && (
        <PlayerPicker
          key={pickerFor}
          title={pickerFor === "bowlerId" ? "Choose bowler" : pickerFor === "strikerId" ? "Choose striker" : "Choose non-striker"}
          icon={`fa-solid ${pickerFor === "bowlerId" ? "fa-baseball" : "fa-baseball-bat-ball"}`}
          items={
            pickerFor === "bowlerId"
              ? bowlerItems
              : batterItems(pickerFor === "strikerId" ? picks.nonStrikerId : picks.strikerId)
          }
          hint={
            pickerFor === "bowlerId" && overEndPending && thisOver ? (
              <>
                <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> Over {thisOver.number + 1} complete ·{" "}
                {nameOf(thisOver.bowlerId)} · {thisOver.runs} run{thisOver.runs === 1 ? "" : "s"} · {match.teams[innings.battingTeam].name}{" "}
                <strong>
                  {summary.runs}/{summary.wickets}
                </strong>
              </>
            ) : undefined
          }
          nameOf={nameOf}
          selectedId={picks[pickerFor]}
          onPick={(id) => pick(pickerFor, id)}
          onClose={() => setPickerFor(null)}
          footer={
            showSheetScore || canUndo ? (
              <>
                {/* Between overs or after a wicket, the score as it stands, below the list. */}
                {showSheetScore && (
                  <div className="cricket-sheet-score">
                    <div className="cricket-sheet-score-row">
                      <span>
                        {match.teams[innings.battingTeam].name}{" "}
                        <strong>
                          {summary.runs}/{summary.wickets}
                        </strong>{" "}
                        <small>({summary.overs}/{match.overs})</small>
                      </span>
                      <small>
                        {chase
                          ? `Need ${Math.max(chase.need, 0)} from ${chase.ballsLeft}`
                          : `CRR ${rate(summary.runs, summary.legalBalls, perOver)}`}
                      </small>
                    </div>
                    <div className="cricket-sheet-score-row">
                      <small>
                        {[innings.strikerId, innings.nonStrikerId]
                          .filter((id): id is number => id !== null)
                          .map((id) => {
                            const row = batting.find((r) => r.playerId === id);
                            return `${nameOf(id)} ${row?.runs ?? 0}(${row?.balls ?? 0})`;
                          })
                          .join(" · ")}
                      </small>
                      {thisOver && (
                        <span className="cricket-this-over">
                          {thisOver.balls.map((ball, i) => (
                            <span key={i} className={ballChipClass(ball)}>
                              {ballLabel(ball)}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {canUndo && (
                  <button type="button" className="cricket-sheet-undo" onClick={undo} disabled={busy}>
                    <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo last ball
                  </button>
                )}
              </>
            ) : undefined
          }
        />
      )}

      {settingsOpen && (
        <BottomSheet title="Match settings" icon="fa-solid fa-sliders" onClose={onCloseSettings}>
          <h3 className="cricket-sheet-label">Players</h3>
          <div className="cricket-settings-list">
            {(
              [
                ["strikerId", "Change striker", "fa-baseball-bat-ball"],
                ["nonStrikerId", "Change non-striker", "fa-user"],
                ["bowlerId", "Change bowler", "fa-baseball"],
              ] as const
            ).map(([slot, label, icon]) => (
              <button
                key={slot}
                type="button"
                className="cricket-settings-item"
                disabled={busy || innings[slot] === null}
                onClick={() => {
                  onCloseSettings();
                  setChanging(slot);
                }}
              >
                <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                <span>
                  {label}
                  <small>{innings[slot] === null ? "Not picked yet" : nameOf(innings[slot])}</small>
                </span>
                <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            ))}
            <button
              type="button"
              className="cricket-settings-item"
              disabled={busy || innings.strikerId === null || innings.nonStrikerId === null}
              onClick={() => {
                onCloseSettings();
                setPlayers.mutate({ id: match.id, strikerId: innings.nonStrikerId, nonStrikerId: innings.strikerId });
              }}
            >
              <i className="fa-solid fa-arrow-right-arrow-left fa-rotate-90" aria-hidden="true"></i>
              <span>
                Swap strike
                <small>{nameOf(innings.nonStrikerId)} faces the next ball</small>
              </span>
            </button>
          </div>

          <h3 className="cricket-sheet-label">Scoring</h3>
          <div className="cricket-settings-list">
            <button
              type="button"
              className="cricket-settings-item"
              disabled={busy || innings.balls.length === 0}
              onClick={() => {
                onCloseSettings();
                setCorrecting({ ballIndex: null });
              }}
            >
              <i className="fa-solid fa-pen" aria-hidden="true"></i>
              <span>
                Correct a ball
                <small>Fix a fielder, the runs, how a batter was out or who bowled</small>
              </span>
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              className="cricket-settings-item"
              disabled={busy}
              onClick={() => {
                onCloseSettings();
                setAddingPlayer(true);
              }}
            >
              <i className="fa-solid fa-user-plus" aria-hidden="true"></i>
              <span>
                Add a player
                <small>A late arrival, or a substitute for someone yet to bat or bowl</small>
              </span>
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              className="cricket-settings-item"
              role="switch"
              aria-checked={smallShotsOn}
              onClick={toggleSmallShots}
            >
              <i className="fa-solid fa-bullseye" aria-hidden="true"></i>
              <span>
                Shot map for 1s, 2s and 3s
                <small>Fours, sixes, catches and run-outs always ask where the ball went</small>
              </span>
              <span className={`cricket-shot-toggle-knob ${smallShotsOn ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
            </button>
            <button
              type="button"
              className="cricket-settings-item"
              disabled={busy || pendingBall !== null || needsPlayers}
              onClick={() => {
                onCloseSettings();
                setPenaltyOpen(true);
              }}
            >
              <i className="fa-solid fa-gavel text-warning" aria-hidden="true"></i>
              <span>
                Penalty runs
                <small>Award 5 penalty runs to batting or fielding side</small>
              </span>
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          {matchSettings}

          <h3 className="cricket-sheet-label">End play</h3>
          <div className="cricket-settings-list">
            <button
              type="button"
              className="cricket-settings-item"
              disabled={busy}
              onClick={() => {
                onCloseSettings();
                void handleEndInnings();
              }}
            >
              <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i>
              <span>
                {match.innings.length === 2 ? "End match" : "End innings"}
                <small>
                  {match.innings.length === 2 ? "Close the chase and work out the result" : "The other side bats next"}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="cricket-settings-item is-danger"
              disabled={busy}
              onClick={() => {
                onCloseSettings();
                void handleAbandon();
              }}
            >
              <i className="fa-solid fa-cloud-rain" aria-hidden="true"></i>
              <span>
                Abandon match
                <small>Recorded as a no result</small>
              </span>
            </button>
          </div>
        </BottomSheet>
      )}

      {penaltyOpen && (
        <PenaltySheet
          battingTeam={match.teams[innings.battingTeam].name}
          busy={busy}
          onClose={() => setPenaltyOpen(false)}
          onRecord={(extras) => {
            record({ extraType: "penalty", extras, runs: 0, noDelivery: true, wicketType: null });
            setPenaltyOpen(false);
          }}
        />
      )}

      {correcting && (
        <CorrectBallSheet match={match} nameOf={nameOf} perOver={perOver} ballIndex={correcting.ballIndex} onClose={() => setCorrecting(null)} />
      )}

      {addingPlayer && <AddPlayerSheet match={match} nameOf={nameOf} onClose={() => setAddingPlayer(false)} />}

      {promptStyle && (
        <BottomSheet
          title={`Set ${promptStyle.type === "batting" ? "Batting Style" : "Bowling Style"}`}
          icon={promptStyle.type === "batting" ? "fa-solid fa-baseball-bat-ball" : "fa-solid fa-baseball"}
          onClose={() => setPromptStyle(null)}
        >
          <div className="cricket-sheet-context mb-2">
            <span className="fw-bold">{promptStyle.name}</span>
            <small className="d-block text-muted">
              {promptStyle.type === "batting"
                ? "Select batting hand (saved to player profile):"
                : "Select bowling arm & style (saved to player profile):"}
            </small>
          </div>
          <div className="d-flex flex-column gap-2 mb-3">
            {promptStyle.type === "batting"
              ? BATTING_STYLES.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    className="btn btn-outline-secondary text-start py-2 px-3 d-flex justify-content-between align-items-center"
                    onClick={async () => {
                      const p = allPlayers?.find((item) => item.id === promptStyle.playerId);
                      if (p) {
                        await updatePlayer.mutateAsync({
                          id: promptStyle.playerId,
                          name: p.name,
                          role: p.role,
                          mobile: p.mobile ?? "",
                          battingStyle: style.value,
                        });
                      }
                      setPromptStyle(null);
                    }}
                  >
                    <span className="fw-semibold">{style.label}</span>
                    <span className="badge bg-secondary-subtle text-secondary">{style.short}</span>
                  </button>
                ))
              : BOWLING_STYLES.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    className="btn btn-outline-secondary text-start py-2 px-3 d-flex justify-content-between align-items-center"
                    onClick={async () => {
                      const p = allPlayers?.find((item) => item.id === promptStyle.playerId);
                      if (p) {
                        await updatePlayer.mutateAsync({
                          id: promptStyle.playerId,
                          name: p.name,
                          role: p.role,
                          mobile: p.mobile ?? "",
                          bowlingStyle: style.value,
                        });
                      }
                      setPromptStyle(null);
                    }}
                  >
                    <span className="fw-semibold">{style.label}</span>
                    <span className="badge bg-secondary-subtle text-secondary">{style.short}</span>
                  </button>
                ))}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-link text-muted w-100"
            onClick={() => setPromptStyle(null)}
          >
            Skip for now
          </button>
        </BottomSheet>
      )}

      {endChaseOpen && onEnterResult && (
        <EndChaseSheet
          busy={busy}
          onClose={() => setEndChaseOpen(false)}
          onEndInnings={() => {
            setEndChaseOpen(false);
            endInnings.mutate(match.id);
          }}
          onEnterResult={() => {
            setEndChaseOpen(false);
            onEnterResult();
          }}
        />
      )}

      {changing && innings[changing] !== null && (
        <PlayerPicker
          key={`change-${changing}`}
          title={changing === "bowlerId" ? "Change bowler" : changing === "strikerId" ? "Change striker" : "Change non-striker"}
          hint={
            changing === "bowlerId" ? (
              <>
                <i className="fa-solid fa-baseball" aria-hidden="true"></i> Who finishes the over for{" "}
                <strong>{nameOf(innings.bowlerId)}</strong>? Their figures so far stay with them.
              </>
            ) : (
              <>
                <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> Who comes in for{" "}
                <strong>{nameOf(innings[changing])}</strong>? They aren't out — they keep their score and can bat
                again later.
              </>
            )
          }
          icon={`fa-solid ${changing === "bowlerId" ? "fa-baseball" : "fa-baseball-bat-ball"}`}
          items={changing === "bowlerId" ? changeBowlerItems : batterItems(null)}
          nameOf={nameOf}
          selectedId={null}
          onPick={(id) => change(changing, id)}
          onClose={() => setChanging(null)}
        />
      )}

      {pendingShot && (
        <BottomSheet
          title={
            pendingShot.wicketType === "caught"
              ? "Where was the catch taken?"
              : pendingShot.wicketType
                ? "Where was the ball fielded?"
                : `Where did the ${shotWord} go?`
          }
          icon="fa-solid fa-bullseye"
          // Once a spot is tapped the ball is on its way in; it can't be dropped.
          onClose={() => !shotSpot && setPendingShot(null)}
          footer={
            <button type="button" className="cricket-sheet-undo" disabled={busy || Boolean(shotSpot)} onClick={() => saveShot(null)}>
              Skip — record the {shotWord} without a spot
            </button>
          }
        >
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> {nameOf(innings.strikerId)} ·{" "}
            {shotSpot ? (
              <strong>
                <i className="fa-solid fa-check" aria-hidden="true"></i> {shotZoneAt(shotSpot.x, shotSpot.y)}
              </strong>
            ) : (
              "tap where the ball went to record it"
            )}
          </p>
          <ShotGround marker={shotSpot} onPick={tapShot} label="Tap where the ball went" />
          {!pendingShot.wicketType && (
            <div className="d-flex justify-content-center mt-2">
              <button type="button" className="cricket-shot-toggle" role="switch" aria-checked={smallShotsOn} onClick={toggleSmallShots}>
                <span className={`cricket-shot-toggle-knob ${smallShotsOn ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
                Ask for 1s, 2s and 3s too
              </button>
            </div>
          )}
        </BottomSheet>
      )}

      {extraModal && (
        <BottomSheet
          title={EXTRA_LABELS[extraModal]}
          icon={`fa-solid ${EXTRA_ICONS[extraModal]}`}
          onClose={() => setExtraModal(null)}
          footer={
            <button type="button" className="cricket-sheet-submit" onClick={submitExtra} disabled={busy}>
              <i className="fa-solid fa-check" aria-hidden="true"></i> Record {EXTRA_LABELS[extraModal].toLowerCase()}
              {extraModal === "wide" || extraModal === "no-ball" ? ` + ${extraRuns}` : ` ${Math.max(extraRuns, 1)}`}
            </button>
          }
        >
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball" aria-hidden="true"></i> {nameOf(innings.bowlerId)} to {nameOf(innings.strikerId)}
          </p>
          {extraModal === "no-ball" && (
            <>
              <label className="cricket-sheet-label">The runs were</label>
              <div className="cricket-chip-choice" role="radiogroup" aria-label="The runs were">
                {(
                  [
                    [null, "Off the bat"],
                    ["bye", "Byes"],
                    ["leg-bye", "Leg byes"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={noBallByes === value}
                    className={noBallByes === value ? "active" : ""}
                    onClick={() => setNoBallByes(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          <label className="cricket-sheet-label">
            {extraModal === "no-ball"
              ? noBallByes
                ? `${noBallByes === "bye" ? "Byes" : "Leg byes"} run (1-run penalty added)`
                : "Runs off the bat (1-run penalty added)"
              : extraModal === "wide"
                ? "Runs run as well (1-run penalty added)"
                : "Runs run"}
          </label>
          <RunChoice
            value={extraRuns}
            onChange={setExtraRuns}
            min={extraModal === "bye" || extraModal === "leg-bye" ? 1 : 0}
          />
          {extraModal === "no-ball" && (
            <div className="cricket-freehit-choice mt-3 pt-2 border-top">
              <label className="cricket-sheet-label mb-1">Free hit on next ball?</label>
              <div className="cricket-chip-choice" role="radiogroup" aria-label="Free hit on next ball">
                <button
                  type="button"
                  role="radio"
                  aria-checked={noBallFreeHit}
                  className={noBallFreeHit ? "active" : ""}
                  onClick={() => setNoBallFreeHit(true)}
                >
                  <i className="fa-solid fa-bolt text-warning me-1" aria-hidden="true"></i> Yes (Free hit)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!noBallFreeHit}
                  className={!noBallFreeHit ? "active" : ""}
                  onClick={() => setNoBallFreeHit(false)}
                >
                  <i className="fa-solid fa-ban me-1" aria-hidden="true"></i> No free hit
                </button>
              </div>
            </div>
          )}
        </BottomSheet>
      )}

      {moreRuns !== null && (
        <BottomSheet
          title="Runs"
          icon="fa-solid fa-person-running"
          onClose={() => setMoreRuns(null)}
          footer={
            <button
              type="button"
              className="cricket-sheet-submit"
              onClick={() => {
                // A 4 or 6 the batters ran: not a boundary.
                recordShot(allRun && (moreRuns === 4 || moreRuns === 6) ? { runs: moreRuns, boundary: false } : { runs: moreRuns });
                setMoreRuns(null);
              }}
              disabled={busy}
            >
              <i className="fa-solid fa-check" aria-hidden="true"></i> Record {moreRuns} run{moreRuns === 1 ? "" : "s"}
            </button>
          }
        >
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball" aria-hidden="true"></i> {nameOf(innings.bowlerId)} to {nameOf(innings.strikerId)}
          </p>
          <label className="cricket-sheet-label">Runs off the bat</label>
          {/* The server takes up to 7 off one ball. */}
          <RunChoice value={moreRuns} onChange={setMoreRuns} min={4} max={7} />
          {(moreRuns === 4 || moreRuns === 6) && (
            <div className="d-flex mt-2">
              <button type="button" className="cricket-shot-toggle" role="switch" aria-checked={allRun} onClick={() => setAllRun((v) => !v)}>
                <span className={`cricket-shot-toggle-knob ${allRun ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
                All run — didn't reach the boundary
              </button>
            </div>
          )}
        </BottomSheet>
      )}

      {wicketModal && pickingFielder && (
        <PlayerPicker
          title={pickingFielder === "secondFielderId" ? "Fielder 2" : kind?.keeper ? "Wicket-keeper" : kind?.key === "caught" ? "Caught by" : "Fielder"}
          icon="fa-solid fa-hand"
          items={bowlingXi
            .filter((id) => id !== (pickingFielder === "fielderId" ? wicket.secondFielderId : wicket.fielderId))
            .map((id) => ({ id, tag: id === innings.bowlerId ? "Bowler" : undefined }))}
          nameOf={nameOf}
          selectedId={wicket[pickingFielder]}
          onPick={(id) => {
            setWicket((w) => ({ ...w, [pickingFielder]: id }));
            setPickingFielder(null);
          }}
          onClose={() => setPickingFielder(null)}
        />
      )}

      {wicketModal && pickingIncoming && (
        <PlayerPicker
          title={kind?.key === "timed-out" ? "Who was timed out?" : "Who can't bat?"}
          icon="fa-solid fa-user-clock"
          items={batterItems(null)}
          nameOf={nameOf}
          selectedId={wicket.dismissedId}
          onPick={(id) => {
            setWicket((w) => ({ ...w, dismissedId: id }));
            setPickingIncoming(false);
          }}
          onClose={() => setPickingIncoming(false)}
        />
      )}

      {wicketModal && (
        <BottomSheet
          title="Wicket"
          icon="fa-solid fa-hand-point-up"
          onClose={() => setWicketModal(false)}
          footer={
            kind && (kind.step === "fielder" || kind.step === "run-out" || kind.step === "delivery" || kind.runs || kind.who === "incoming") ? (
              <button
                type="button"
                className="cricket-sheet-submit is-danger"
                onClick={() => submitWicket()}
                disabled={busy || wicket.dismissedId === null}
              >
                <i className="fa-solid fa-check" aria-hidden="true"></i> Record {kind.label.toLowerCase()}
              </button>
            ) : undefined
          }
        >
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball" aria-hidden="true"></i>{" "}
            {incomingDue ? "The next batter is due" : `${nameOf(innings.bowlerId)} to ${nameOf(innings.strikerId)}`}
          </p>
          {freeHit && !incomingDue && (
            <p className="cricket-sheet-note">
              <i className="fa-solid fa-bolt" aria-hidden="true"></i> Free hit — only a run-out, obstructing the field, hitting the ball
              twice or a retirement
            </p>
          )}
          <label className="cricket-sheet-label">{wicket.key ? "Out type" : "Select out type"}</label>
          {/* Once one is chosen only it shows; tapping it again brings the
              rest back. */}
          <div className={`cricket-out-grid ${wicket.key ? "is-chosen" : ""}`.trim()} role="radiogroup" aria-label="How out">
            {OUT_KINDS.filter((k) => (wicket.key ? k.key === wicket.key : moreOuts || !k.more)).map((k) => {
              // Timed out / absent hurt only while the next batter is due,
              // and nothing else then.
              const freeHitBlocked = freeHit && !incomingDue && !allowedOnFreeHit(k);
              const unavailable = (k.who === "incoming") !== incomingDue || freeHitBlocked;
              return (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked={wicket.key === k.key}
                  className={`cricket-out-tile ${wicket.key === k.key ? "active" : ""}`.trim()}
                  disabled={busy || unavailable}
                  title={
                    freeHitBlocked
                      ? "Not out on a free hit"
                      : unavailable
                        ? incomingDue
                          ? "Pick the next batter first"
                          : "Only when the next batter is due"
                        : undefined
                  }
                  onClick={() => (wicket.key === k.key ? setWicket((w) => ({ ...w, key: null })) : chooseOut(k))}
                >
                  <span className="cricket-out-icon">
                    <OutArt type={k.key} />
                  </span>
                  <span className="cricket-out-label">{k.label}</span>
                  {wicket.key === k.key && (
                    <span className="cricket-out-change">
                      <i className="fa-solid fa-rotate" aria-hidden="true"></i> Change
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {!wicket.key && (
            <div className="d-flex justify-content-center">
              <button type="button" className="cricket-out-more" onClick={() => setMoreOuts((v) => !v)}>
                {moreOuts ? "Show less" : "Show more"}
              </button>
            </div>
          )}

          {kind?.noDelivery === "choice" && (
            <div className="d-flex justify-content-center mt-2">
              <button
                type="button"
                className="cricket-shot-toggle"
                role="switch"
                aria-checked={wicket.countBall}
                onClick={() => setWicket((w) => ({ ...w, countBall: !w.countBall }))}
              >
                <span className={`cricket-shot-toggle-knob ${wicket.countBall ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
                Count the ball
              </button>
            </div>
          )}

          {kind?.offExtras && (kind.noDelivery !== "choice" || wicket.countBall) && (
            <>
              <label className="cricket-sheet-label">Delivery</label>
              <div className="cricket-chip-choice">
                {/* Neither stumped nor hit wicket is out off a no ball; byes and
                    leg byes only for a run-out. */}
                {DELIVERIES.filter(
                  (d) =>
                    (d.value !== "no-ball" || (kind.key !== "stumped" && kind.key !== "hit-wicket")) &&
                    ((d.value !== "bye" && d.value !== "leg-bye") || kind.key === "run-out"),
                ).map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={wicket.delivery === d.value ? "active" : ""}
                    onClick={() => setWicket((w) => ({ ...w, delivery: d.value }))}
                  >
                    <i className={`fa-solid ${d.icon}`} aria-hidden="true"></i> {d.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {kind?.who === "either" && (
            <>
              <label className="cricket-sheet-label">Which batter</label>
              <div className="cricket-batter-pick" role="radiogroup" aria-label="Which batter">
                {(lastMan ? [facing] : [innings.strikerId, innings.nonStrikerId]).map((playerId, i) => (
                  <button
                    key={playerId}
                    type="button"
                    role="radio"
                    aria-checked={wicket.dismissedId === playerId}
                    className={`cricket-batter-pick-card ${wicket.dismissedId === playerId ? "active" : ""}`.trim()}
                    disabled={busy || playerId === null}
                    onClick={() => {
                      const next = { ...wicket, dismissedId: playerId, outEnd: null };
                      // Picking the batter records it, unless there's more to
                      // pick (a run-out's fielders, an obstruction's runs).
                      if (kind.step === "batter" && !kind.runs) submitWicket(next);
                      else setWicket(next);
                    }}
                  >
                    <PlayerAvatar name={nameOf(playerId)} photoUrl={playerId === null ? null : photoOf(playerId)} className="cricket-fielder-avatar" />
                    <span className="cricket-slot-text">
                      <small>{i === 0 ? "Striker" : "Non-striker"}</small>
                      <strong>{nameOf(playerId)}</strong>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {kind?.who === "incoming" && (
            <>
              <label className="cricket-sheet-label">{kind.key === "timed-out" ? "Timed out" : "Can't bat"}</label>
              <button
                type="button"
                className={`cricket-slot cricket-fielder-slot ${wicket.dismissedId !== null ? "is-chosen" : ""}`.trim()}
                disabled={busy}
                onClick={() => setPickingIncoming(true)}
              >
                {wicket.dismissedId !== null ? (
                  <PlayerAvatar name={nameOf(wicket.dismissedId)} photoUrl={photoOf(wicket.dismissedId)} className="cricket-fielder-avatar" />
                ) : (
                  <span className="cricket-slot-icon">
                    <i className="fa-solid fa-user-clock" aria-hidden="true"></i>
                  </span>
                )}
                <span className="cricket-slot-text">
                  <small>Next batter</small>
                  <strong>{wicket.dismissedId === null ? "Choose the batter" : nameOf(wicket.dismissedId)}</strong>
                </span>
                <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            </>
          )}

          {(kind?.step === "fielder" || kind?.step === "run-out") && (
            <>
              {/* A run-out: the thrower and the one at the stumps, or one
                  fielder alone for a direct hit (switched at the row's end). */}
              <div className="cricket-sheet-label-row">
                <label className="cricket-sheet-label">
                  {kind.key === "caught" ? "Caught by" : kind.keeper ? "Wicket-keeper" : "Fielders"}
                </label>
                {kind.step === "run-out" && (
                  <button
                    type="button"
                    className="cricket-shot-toggle"
                    role="switch"
                    aria-checked={wicket.directHit}
                    onClick={() => setWicket((w) => ({ ...w, directHit: !w.directHit }))}
                  >
                    <span className={`cricket-shot-toggle-knob ${wicket.directHit ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
                    Direct hit
                  </button>
                )}
              </div>
              <div className="cricket-fielder-slots">
                {fielderSlot("fielderId", kind.step !== "run-out" ? null : wicket.directHit ? "Fielder" : "Fielder 1")}
                {kind.step === "run-out" && !wicket.directHit && fielderSlot("secondFielderId", "Fielder 2")}
              </div>
            </>
          )}

          {kind?.runs && (
            <>
              <label className="cricket-sheet-label">
                Runs completed before the {kind.step === "run-out" ? "run-out" : "obstruction"}
              </label>
              <RunChoice value={wicket.runs} max={5} onChange={(runs) => setWicket((w) => ({ ...w, runs }))} />
            </>
          )}

          {kind?.key === "run-out" && !lastMan && wicket.dismissedId !== null && (
            <>
              {/* The survivor goes to the other end. */}
              <label className="cricket-sheet-label">Where was the wicket broken</label>
              <div className="cricket-chip-choice" role="radiogroup" aria-label="Run-out end">
                {(
                  [
                    ["striker", "Striker's end"],
                    ["non-striker", "Non-striker's end"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={outEndOf(wicket) === value}
                    className={outEndOf(wicket) === value ? "active" : ""}
                    onClick={() => setWicket((w) => ({ ...w, outEnd: value }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
