import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  isStaleScore,
  useAbandonCricketMatch,
  useCricketInterruption,
  useAddCricketBall,
  useEndCricketInnings,
  useEditCricketBall,
  useSetCricketCurrentPlayers,
  useMarkCricketBowling,
  useUndoCricketBall,
  type CricketBallInput,
} from "../../../api/hooks/cricket/useCricketMatches";
import { canQueueBowler, clearQueue, enqueue, nudgeBallQueue, popQueue, whyNotQueued } from "../../../api/hooks/cricket/ballQueue";
import { BowlerArt } from "./BowlingNow";
import {
  ballsPerOverOf,
  type CricketExtraType,
  type CricketInnings,
  type CricketMatch,
} from "../../../api/types";
import { Button } from "../../components/Button";
import { confirmAction } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { OutArt } from "./OutArt";
import { PlayerPicker, type PickItem } from "./PlayerPicker";
import { ScoreHead, type ScoreHeadData } from "./ScoreHead";
import { usePlayerPhotos, withoutRoleMark } from "./matchUtils";
import { isBurstPlaying, useBurstPlaying } from "./burstPlaying";
import { shotZoneAt } from "./ShotMap";
import { ManageSquadSheet } from "./scorer/ManageSquadSheet";
import { CorrectBallSheet } from "./scorer/CorrectBallSheet";
import { EndChaseSheet } from "./scorer/EndChaseSheet";
import { InningsBreakCard } from "./scorer/InningsBreakCard";
import { PenaltySheet } from "./scorer/PenaltySheet";
import { ShortRunSheet } from "./scorer/ShortRunSheet";
import { RainSheet } from "./scorer/RainSheet";
import { WicketSheet } from "./scorer/WicketSheet";
import { ExtrasSheet } from "./scorer/ExtrasSheet";
import { PitchSheet } from "./scorer/PitchSheet";
import { buzz, setScorerPref, useScorerPrefs } from "./scorerPrefs";
import { t } from "../i18n";
import { MoreRunsSheet } from "./scorer/MoreRunsSheet";
import { ShotSheet } from "./scorer/ShotSheet";
import { OversPopover } from "./scorer/OversPopover";
import { ScorerSettingsSheet } from "./scorer/ScorerSettingsSheet";
import { outKind, outEndOf, type WicketDraft } from "./scorer/wicket";
import "./scorer/scorer.css";
import {
  useCricketPlayers,
  useUpdateCricketPlayerStyle,
} from "../../../api/hooks/cricket/useCricketPlayers";
import {
  BATTING_STYLES,
  BOWLING_STYLES,
  battingStyleOf,
  bowlingStyleOf,
  roleOf,
} from "../playerRoles";
import {
  ballChipClass,
  ballLabel,
  ballTotal,
  battingCard,
  bowlingCard,
  cantBat,
  chaseInfo,
  inningsSummary,
  isFour,
  isFreeHitNext,
  isLegal,
  isSix,
  isWicket,
  oversOf,
  oversText,
  projectedScore,
  rate,
  type NameOf,
} from "../stats";

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
  // Balls scored offline, still to send (the match page sends them; `match`
  // already shows them). `blocked`: the first can't be shown until it's
  // sent (a wicket that didn't get through), so the pad waits.
  queue: { waiting: number; blocked: boolean; sending: boolean; paused: boolean };
}

export function LiveScorer({ match, nameOf, settingsOpen, onCloseSettings, matchSettings, onEnterResult, queue }: LiveScorerProps) {
  const innings = match.innings[match.innings.length - 1];
  const battingXi = match.teams[innings.battingTeam].playerIds;
  const bowlingXi = match.teams[1 - innings.battingTeam].playerIds;
  const perOver = ballsPerOverOf(match);
  const summary = inningsSummary(innings, perOver);
  const chase = innings === match.innings[1] ? chaseInfo(match) : null;

  const setPlayers = useSetCricketCurrentPlayers();
  const markBowling = useMarkCricketBowling();
  const editBall = useEditCricketBall();
  const { data: allPlayers } = useCricketPlayers();
  const updatePlayerStyle = useUpdateCricketPlayerStyle();
  const [promptStyleQueue, setPromptStyleQueue] = useState<
    {
      playerId: number;
      name: string;
      type: "batting" | "bowling";
    }[]
  >([]);

  const checkPromptStyle = (slot: Slot, id: number) => {
    const player = allPlayers?.find((p) => p.id === id);
    if (!player) return;
    if ((slot === "strikerId" || slot === "nonStrikerId") && !player.battingStyle) {
      setPromptStyleQueue((prev) =>
        prev.some((item) => item.playerId === id && item.type === "batting")
          ? prev
          : [...prev, { playerId: id, name: player.name, type: "batting" }],
      );
    } else if (slot === "bowlerId" && !player.bowlingStyle) {
      setPromptStyleQueue((prev) =>
        prev.some((item) => item.playerId === id && item.type === "bowling")
          ? prev
          : [...prev, { playerId: id, name: player.name, type: "bowling" }],
      );
    }
  };
  const openStylePrompt = (playerId: number, name: string, type: "batting" | "bowling") => {
    setPromptStyleQueue([{ playerId, name, type }]);
  };
  const dismissPromptStyle = () => {
    setPromptStyleQueue((prev) => prev.slice(1));
  };
  const addBall = useAddCricketBall();
  const undoBall = useUndoCricketBall();
  const endInnings = useEndCricketInnings();
  const abandon = useAbandonCricketMatch();
  const interruption = useCricketInterruption();
  const busy = setPlayers.isPending || editBall.isPending || interruption.isPending || addBall.isPending || undoBall.isPending || endInnings.isPending || abandon.isPending;
  // A ball already on the scoreboard (shown before the API answers, see
  // useAddCricketBall) leaves the pad as it is while it sends — no grey
  // flash on every tap. A tap in that moment is held and sent right after.
  const shownSendRef = useRef(false);
  const sendingShown = addBall.isPending && shownSendRef.current;
  const padBusy = sendingShown
    ? setPlayers.isPending || editBall.isPending || interruption.isPending || undoBall.isPending || endInnings.isPending || abandon.isPending
    : busy;
  const heldTaps = useRef<Parameters<typeof addBall.mutate>[0][]>([]);

  const ballsScrollRef = useRef<HTMLDivElement>(null);

  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  // Offline, or balls already waiting (a new one goes behind them): scoring
  // carries on, kept on this device (see ballQueue).
  const queueing = offline || queue.waiting > 0;
  const waitingNote = queue.waiting
    ? `${queue.waiting} ${queue.waiting === 1 ? "ball" : "balls"} waiting to send`
    : "you're offline";

  // Sends a ball, or keeps it to send later. If another phone got there
  // first the match refreshes itself, so say so gently rather than as an error.
  const sendBall = ({ id, ...ball }: Parameters<typeof addBall.mutate>[0]) => {
    if (sendingShown) {
      heldTaps.current.push({ id, ...ball });
      return;
    }
    if (queueing) {
      if (queue.blocked) {
        toast.error("The last ball has to send first — check the connection or tap Retry");
        return;
      }
      const why = whyNotQueued(match, ball);
      if (why) {
        toast.error(`${why} (${waitingNote})`);
        return;
      }
      enqueue(id, { kind: "ball", ball, inningsIndex: match.innings.length - 1, expectedBalls: innings.balls.length });
      return;
    }
    shownSendRef.current = whyNotQueued(match, ball) === null;
    addBall.mutate(
      { id, ...ball },
      {
        onError: (error) => {
          if (isStaleScore(error)) toast("Score updated from another device");
        },
      },
    );
  };

  // The previous ball is in: send a tap held while it was on its way.
  useEffect(() => {
    if (addBall.isPending || heldTaps.current.length === 0) return;
    sendBall(heldTaps.current.shift()!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addBall.isPending]);

  const [picks, setPicks] = useState<{ strikerId: number | null; nonStrikerId: number | null; bowlerId: number | null }>({
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
  });
  const [smallShotsOn, setSmallShotsOn] = useState(readShotMap);
  // The pad's language, vibration and the pitch map (kept on this device).
  const prefs = useScorerPrefs();
  const lang = prefs.lang;
  // A ball waiting for where it pitched (PitchSheet).
  const [pendingPitch, setPendingPitch] = useState<Partial<CricketBallInput> | null>(null);
  // A ball waiting for its spot on the shot map (ShotSheet).
  const [pendingShot, setPendingShot] = useState<Partial<CricketBallInput> | null>(null);
  // The extras sheet open for a wide, no ball, bye or leg bye.
  const [extraModal, setExtraModal] = useState<CricketExtraType | null>(null);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [shortRunOpen, setShortRunOpen] = useState(false);
  const [rainOpen, setRainOpen] = useState(false);
  // Correcting a ball: the one tapped, or null to choose from the list.
  // `lapseOnly` is the "Drop or misfield" button: just that part of the sheet.
  const [correcting, setCorrecting] = useState<{ ballIndex: number | null; lapseOnly?: boolean } | null>(null);
  const [managingSquads, setManagingSquads] = useState(false);
  const [endChaseOpen, setEndChaseOpen] = useState(false);
  const [wicketModal, setWicketModal] = useState(false);
  // The "5, 6…" sheet: runs beyond the pad's (overthrows, all-run fives).
  const [moreRunsOpen, setMoreRunsOpen] = useState(false);
  // The wicket sheet opens on the rarer out types too (from the "next
  // batter" panel).
  const [wicketMoreOuts, setWicketMoreOuts] = useState(false);
  const photoOf = usePlayerPhotos();

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
        // Retired (hurt or not; Change retires them hurt): back in with their score.
        const tag = retiredAs.get(id);
        if (tag) return { id, tag, note: `${row?.runs ?? 0} (${row?.balls ?? 0}) so far` };
        return row ? { id, note: `${row.runs} (${row.balls}) so far` } : { id, note: "Yet to bat" };
      });
  // Most overs bowled first; then, and among those yet to bowl, A to Z.
  const ballsBowled = (id: number) => bowling.find((row) => row.playerId === id)?.legalBalls ?? 0;
  const bowlersInOrder = [...bowlingXi].sort((a, b) => ballsBowled(b) - ballsBowled(a) || nameOf(a).localeCompare(nameOf(b)));
  const bowlerItems: PickItem[] = bowlersInOrder.map((id) => {
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
  // Changing a batter who has played retires them hurt (the server records
  // it); one who hasn't been part of a ball was just a wrong pick.
  const hasPlayed = (id: number | null) => innings.balls.some((ball) => ball.batterId === id || ball.nonStrikerId === id);
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
  // Changing the bowler once the over has started asks why: a wrong pick
  // moves the over's balls so far to the right bowler; an injured bowler
  // (or one taken off) keeps their figures and someone else finishes it.
  const [askingWhy, setAskingWhy] = useState(false);
  const [wrongBowler, setWrongBowler] = useState(false);
  const currentOver = Math.floor(legal.length / perOver);
  const thisOverBalls: number[] = [];
  {
    let count = 0;
    innings.balls.forEach((ball, index) => {
      if (Math.floor(count / perOver) === currentOver && !ball.noDelivery) thisOverBalls.push(index);
      if (isLegal(ball)) count++;
    });
  }
  function startBowlerChange() {
    if (thisOverBalls.length > 0) setAskingWhy(true);
    else setChanging("bowlerId");
  }
  // Changing a batter who has played asks why too: a wrong pick moves their
  // runs and balls to the right batter; retired hurt keeps them and they
  // can bat again later.
  const [askingWhyBatter, setAskingWhyBatter] = useState<"strikerId" | "nonStrikerId" | null>(null);
  const [wrongBatter, setWrongBatter] = useState(false);
  function startBatterChange(slot: "strikerId" | "nonStrikerId") {
    if (hasPlayed(innings[slot])) setAskingWhyBatter(slot);
    else setChanging(slot);
  }
  // Who can take a wrong pick's balls: only someone not on the card yet.
  const yetToBatItems = () => batterItems(null).filter((item) => !hasPlayed(item.id) && !retiredAs.has(item.id));
  function change(slot: Slot, id: number) {
    setChanging(null);
    if (slot === "bowlerId" && wrongBowler && thisOverBalls.length > 0) {
      setWrongBowler(false);
      editBall.mutate({ id: match.id, inningsIndex: match.innings.length - 1, ballIndex: thisOverBalls[0], bowlerId: id });
    } else if (slot !== "bowlerId" && wrongBatter) {
      setWrongBatter(false);
      setPlayers.mutate({ id: match.id, [slot]: id, wrongBatter: true });
    } else {
      setPlayers.mutate({ id: match.id, [slot]: id });
    }
    checkPromptStyle(slot, id);
  }
  // Batting on alone, only the one batter is needed.
  const emptySlots: Slot[] = (["strikerId", "nonStrikerId", "bowlerId"] as const).filter((slot) =>
    slot === "bowlerId" || !lastMan ? innings[slot] === null : slot === "strikerId" && facing === null,
  );

  // After a pick, move straight on to the next empty slot; the last one
  // saves them all — no confirm step, except at the innings break, where
  // the second innings waits for its Start button.
  function pick(slot: Slot, id: number) {
    const next = { ...picks, [slot]: id };
    setPicks(next);
    const nextSlot = emptySlots.find((s) => s !== slot && next[s] === null) ?? null;
    setPickerFor(nextSlot);
    if (!nextSlot && !inningsBreak) savePlayers(next);
    checkPromptStyle(slot, id);
  }
  const thisOver = oversOf(innings, perOver).at(-1);
  const overEndPending = overJustEnded && innings.bowlerId === null;
  // The pickers show the score as it stands once the innings is under way:
  // between overs, and for the next batter after a wicket.
  const showSheetScore = innings.balls.length > 0 && (overEndPending || pickerFor !== "bowlerId");

  // When an over finishes, the picker for the next bowler (or, after a
  // wicket off the last ball, the next batter first) opens by itself. Keyed
  // by innings + ball count so it opens once per over. A four, six or wicket
  // plays out on screen first; the picker opens once it's done.
  const burstPlaying = useBurstPlaying();
  // Meanwhile the page behind it stays as it was — the scorer, not the
  // "next batter in" / "end of over" pickers — until the moment is over.
  const holdForBurst = burstPlaying && innings.balls.length > 0;
  const showPickers = needsPlayers && !holdForBurst;
  const overKey = `${match.innings.length}-${legal.length}`;
  const [overPromptSeen, setOverPromptSeen] = useState<string | null>(null);
  useEffect(() => {
    if (!overEndPending || overPromptSeen === overKey || pickerFor !== null || busy) return;
    if (burstPlaying || isBurstPlaying()) return;
    setOverPromptSeen(overKey);
    setPickerFor(emptySlots[0] ?? null);
  }, [overEndPending, overPromptSeen, overKey, pickerFor, busy, emptySlots, burstPlaying]);
  // Likewise mid-over: once a batter is out (or retires), the list for the
  // next one opens by itself — once per ball, so closing it leaves it shut.
  const batterKey = `${match.innings.length}-${innings.balls.length}`;
  const [batterPromptSeen, setBatterPromptSeen] = useState<string | null>(null);
  useEffect(() => {
    if (overEndPending || !incomingDue || innings.balls.length === 0 || availableBatters.length === 0) return;
    if (batterPromptSeen === batterKey || pickerFor !== null || busy) return;
    if (burstPlaying || isBurstPlaying()) return;
    setBatterPromptSeen(batterKey);
    setPickerFor(innings.strikerId === null ? "strikerId" : "nonStrikerId");
  }, [overEndPending, incomingDue, innings.balls.length, innings.strikerId, availableBatters.length, batterPromptSeen, batterKey, pickerFor, busy, burstPlaying]);
  // Closed without a pick, the strip keeps showing the finished over (all
  // its balls); once the next bowler is in, it starts empty for the new one.
  const showOver = !overJustEnded || holdForBurst || (overEndPending && overPromptSeen === overKey) ? thisOver : undefined;
  const [prevOversOpen, setPrevOversOpen] = useState(false);
  const [ballsOverflow, setBallsOverflow] = useState({ left: false, right: false });

  function updateBallsOverflow() {
    const el = ballsScrollRef.current;
    if (!el) return;
    const isScrollable = el.scrollWidth > el.clientWidth + 2;
    const left = isScrollable && el.scrollLeft > 2;
    const right = isScrollable && el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setBallsOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }

  useEffect(() => {
    const el = ballsScrollRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth + 4) {
      el.scrollTo({
        left: el.scrollWidth,
        behavior: "smooth",
      });
    } else {
      el.scrollTo({ left: 0, behavior: "smooth" });
    }
    updateBallsOverflow();
    const timer = setTimeout(updateBallsOverflow, 350);
    const observer = new ResizeObserver(updateBallsOverflow);
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [showOver?.balls.length]);

  // The pad stays live between overs — tapping it brings the prompt back.
  const padDisabled = padBusy || queue.blocked || (needsPlayers && !overEndPending);
  const scoreOr = (action: () => void) => () => (overEndPending ? setOverPromptSeen(null) : action());

  // Saves the picks for the empty slots (called once the last one is chosen).
  function savePlayers(chosen: typeof picks) {
    const input: { strikerId?: number; nonStrikerId?: number; bowlerId?: number } = {};
    if (innings.strikerId === null && chosen.strikerId !== null) input.strikerId = chosen.strikerId;
    if (innings.nonStrikerId === null && chosen.nonStrikerId !== null) input.nonStrikerId = chosen.nonStrikerId;
    if (innings.bowlerId === null && chosen.bowlerId !== null) input.bowlerId = chosen.bowlerId;
    // Offline, the next over's bowler can wait with the balls; batters
    // (after a wicket, which needs the connection anyway) can't.
    const onlyBowler = input.bowlerId !== undefined && input.strikerId === undefined && input.nonStrikerId === undefined;
    if (queueing && onlyBowler && canQueueBowler(match, input.bowlerId!)) {
      enqueue(match.id, { kind: "bowler", bowlerId: input.bowlerId!, inningsIndex: match.innings.length - 1, expectedBalls: innings.balls.length });
      setPicks({ strikerId: null, nonStrikerId: null, bowlerId: null });
      return;
    }
    setPlayers.mutate(
      { id: match.id, ...input },
      { onSettled: () => setPicks({ strikerId: null, nonStrikerId: null, bowlerId: null }) },
    );
  }

  // Undo is offered right where the next player is chosen too — e.g. to
  // take back the last ball of an over before picking the new bowler.
  const canUndo = innings.balls.length + (match.innings.length - 1) > 0;
  async function undo() {
    // Not sent yet: just take it off this device.
    if (queue.waiting > 0) {
      setPickerFor(null);
      setOverPromptSeen(null);
      setBatterPromptSeen(null);
      setPicks({ strikerId: null, nonStrikerId: null, bowlerId: null });
      popQueue(match.id);
      return;
    }
    // With no ball bowled in the chase there's no ball to take back: this
    // drops the second innings and reopens the first, so it asks first.
    if (
      innings.balls.length === 0 &&
      !(await confirmAction(
        "Go back to the 1st innings?",
        "The 1st innings reopens with its score as it is, and this chase's target and players are cleared.",
        "Go back",
        "fa-solid fa-rotate-left",
      ))
    ) {
      return;
    }
    setPickerFor(null);
    setOverPromptSeen(null);
    // A wicket recorded again on the same ball asks for the batter again.
    setBatterPromptSeen(null);
    setPicks({ strikerId: null, nonStrikerId: null, bowlerId: null });
    undoBall.mutate(match.id);
  }

  // With the pitch map on, a delivery first asks where it pitched (PitchSheet);
  // events between balls and penalty runs don't. `pitchLine: null` = skipped.
  const record = (ball: Partial<CricketBallInput>) => {
    if (prefs.pitchMap && !ball.noDelivery && ball.extraType !== "penalty" && ball.pitchLine === undefined) {
      setPendingPitch(ball);
      return;
    }
    sendBall({ id: match.id, ...blankBall, ...ball });
  };
  function askWhere(ball: Partial<CricketBallInput>) {
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

  // Records the waiting ball, with the spot tapped (if any) and the shot.
  function saveShot(spot: { x: number; y: number } | null, type: string | null) {
    if (!pendingShot) return;
    record({ ...pendingShot, shotType: type, ...(spot && { shotX: spot.x, shotY: spot.y, shotZone: shotZoneAt(spot.x, spot.y) }) });
    setPendingShot(null);
  }

  // Opens the wicket sheet; from the "next batter" panel, on the rarer out
  // types (timed out / absent hurt are among them).
  function openWicket(showMore = false) {
    setWicketMoreOuts(showMore);
    setWicketModal(true);
  }

  // Records the wicket as drafted in the sheet.
  function submitWicket(draft: WicketDraft) {
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
      excellentCatch: draft.excellentCatch && (out.key === "caught" || out.key === "caught-behind") && fielderId !== null,
      noDelivery,
      runs: noDelivery || delivery === "wide" || byes ? 0 : completed,
      extraType: noDelivery || delivery === "normal" || (byes && completed === 0) ? null : delivery,
      extras: noDelivery ? 0 : delivery === "wide" ? 1 + completed : delivery === "no-ball" ? 1 : byes ? completed : 0,
      // Batting on alone there's no other end to send anyone to.
      outEnd: out.stored === "run-out" && !lastMan ? outEndOf(draft, innings.nonStrikerId) : null,
    });
    setWicketModal(false);
  }

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
  const lastDelivery = innings.balls.findLastIndex((ball) => !ball.noDelivery);

  // Between the innings, until the chase's openers and bowler are in, the
  // scorer gives way to a screen of its own: the first innings' total, the
  // target, and the pickers.
  const inningsBreak = chase !== null && innings.balls.length === 0 && needsPlayers;

  // What the score card shows. TEMP: in dev, ?cardTest=1 swaps in worst-case
  // values (long name, big score, wide rates) to check the card's layout.
  const cardTest = import.meta.env.DEV && new URLSearchParams(window.location.search).has("cardTest");
  const head: ScoreHeadData = cardTest
    ? {
        team: "Chennai Super Kings Legends XI",
        inningsTag: "2nd Inn",
        score: "245/10",
        overs: "19.4",
        maxOvers: 20,
        crr: "12.47",
        chase: { target: 312, requiredRate: "186.00" },
        need: { runs: 67, balls: 2 },
      }
    : {
        team: match.teams[innings.battingTeam].name,
        logoUrl: match.teams[innings.battingTeam].logoUrl,
        inningsTag: match.innings.length === 2 ? "2nd Inn" : "1st Inn",
        score: `${summary.runs}/${summary.wickets}`,
        overs: summary.overs,
        maxOvers: match.overs,
        crr: rate(summary.runs, summary.legalBalls, perOver),
        projected: projectedScore(match),
        chase,
        need: chase && { runs: chase.need, balls: chase.ballsLeft },
      };

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
  // While the scorer or the innings break fills the screen the page can't
  // scroll (see cricket.css), so nothing would undo an offset left behind and
  // the fixed header could stay pushed up under the status bar. Back to the
  // top on arriving, and whenever the keyboard closes (its field may have
  // moved the page to stay in view).
  const pageLocked = !showPickers || inningsBreak;
  useEffect(() => {
    if (!pageLocked) return;
    window.scrollTo(0, 0);
    const viewport = window.visualViewport;
    if (!viewport) return;
    let height = viewport.height;
    const onResize = () => {
      if (viewport.height > height) window.scrollTo(0, 0);
      height = viewport.height;
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, [pageLocked]);

  // At the start of an innings the batters and the bowler are two separate
  // choices, each under its own heading; later on it's one prompt.
  const openingBatters = emptySlots.filter((slot) => slot !== "bowlerId");
  const slotGroups: { title: string; slots: Slot[]; art?: boolean }[] =
    innings.balls.length === 0 && openingBatters.length > 0 && emptySlots.includes("bowlerId")
      ? [
          { title: openingBatters.length > 1 ? "Openers" : "Opener", slots: openingBatters, art: true },
          { title: "Bowler", slots: ["bowlerId"] },
        ]
      : [
          {
            title:
              innings.balls.length === 0
                ? "Openers and opening bowler"
                : innings.bowlerId === null && !incomingDue
                  ? `End of over ${oversText(legal.length, perOver)} — choose the next bowler`
                  : "Next batter in",
            slots: emptySlots,
          },
        ];

  return (
    // .is-fit: on phones and tablets, the scorer fills the screen in two
    // halves (see cricket.css) — except while players are being picked.
    <div className={`cricket-scorer${showPickers ? "" : " is-fit"}${inningsBreak ? " is-break" : ""}`}>
      {/* Top half: score, chase and who's in. */}
      <div className="cricket-scorer-top">
      {inningsBreak && chase && <InningsBreakCard match={match} chase={chase} perOver={perOver} nameOf={nameOf} />}
      {!inningsBreak && (
      <ScoreHead data={head} />
      )}
      {showPickers ? (
        <section className="cricket-panel cricket-pickers">
          {slotGroups.map((group) => (
          <Fragment key={group.title}>
          <h2 className={`cricket-section-title${group.art ? " has-bat-art" : ""}`}>{group.title}</h2>
          <div className="cricket-slots">
            {group.slots.map((slot) => {
              const chosen = picks[slot];
              const label = slot === "strikerId" ? "Striker" : slot === "nonStrikerId" ? "Non-striker" : "Bowler";
              const icon = slot === "bowlerId" ? "fa-baseball" : slot === "strikerId" ? "fa-baseball-bat-ball" : "fa-user";
              const paired = slot !== "bowlerId" && emptySlots.includes("strikerId") && emptySlots.includes("nonStrikerId");
              return (
                <button
                  key={slot}
                  type="button"
                  className={`cricket-slot${chosen !== null ? " is-chosen" : ""}${paired ? " is-paired" : ""}${slot === "bowlerId" ? " is-bowler" : ""}`}
                  onClick={() => setPickerFor(slot)}
                >
                  {chosen !== null ? (
                    <PlayerAvatar key={chosen} name={nameOf(chosen)} photoUrl={photoOf(chosen)} className="cricket-slot-photo" viewable={false} />
                  ) : (
                    <span className="cricket-slot-icon">
                      <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                    </span>
                  )}
                  <span className="cricket-slot-text">
                    <small>{label}</small>
                    <strong>{chosen !== null ? nameOf(chosen) : `Choose ${label.toLowerCase()}`}</strong>
                  </span>
                  <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
              );
            })}
          </div>
          </Fragment>
          ))}
          {innings.strikerId === null && innings.nonStrikerId !== null && availableBatters.length === 0 && (
            <p className="admin-hint">No batters left — end the innings.</p>
          )}
          {incomingDue && availableBatters.length > 0 && innings.balls.length > 0 && (
            <button type="button" className="cricket-undo-link" onClick={() => openWicket(true)} disabled={busy}>
              <i className="fa-solid fa-stopwatch" aria-hidden="true"></i> Timed out or absent hurt?
            </button>
          )}
          {canUndo && !inningsBreak && (
            <button type="button" className="cricket-undo-link" onClick={undo} disabled={busy}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo last ball
            </button>
          )}
        </section>
      ) : null}

      {!inningsBreak && (
      <div className="cricket-crease-card">
        {/* Batters section */}
        <div className="cricket-crease-section">
          <div className="cricket-crease-section-header">
            <span className="cricket-crease-section-tag">
              <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i>
              <span>Batting</span>
            </span>
            <div className="cricket-crease-header-actions">
              {(() => {
                let lastWicketIdx = -1;
                for (let idx = innings.balls.length - 1; idx >= 0; idx--) {
                  if (isWicket(innings.balls[idx])) {
                    lastWicketIdx = idx;
                    break;
                  }
                }
                const pshipBallsList = innings.balls.slice(lastWicketIdx + 1);
                const pshipRuns = pshipBallsList.reduce((sum, b) => sum + ballTotal(b), 0);
                const pshipBalls = pshipBallsList.filter((b) => b.extraType !== "wide" && !b.noDelivery).length;
                return (
                  <span className="cricket-crease-econ-badge" title="Current partnership">
                    P&apos;ship {pshipRuns} ({pshipBalls}b)
                  </span>
                );
              })()}
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
          </div>

          <div className="cricket-crease-players">
            {(["strikerId", "nonStrikerId"] as const).filter((slot) => !lastMan || slot === "strikerId").map((slot, i) => {
              const playerId = slot === "strikerId" ? facing : innings[slot];
              const row = batting.find((r) => r.playerId === playerId);
              const isStriker = i === 0;
              const runs = row?.runs ?? 0;
              const balls = row?.balls ?? 0;
              const fours = row?.fours ?? 0;
              const sixes = row?.sixes ?? 0;
              const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : "0.0";
              const facedBalls =
                playerId !== null
                  ? innings.balls.filter((b) => b.batterId === playerId && b.extraType !== "wide" && !b.noDelivery)
                  : [];
              const dots = facedBalls.filter((b) => b.runs === 0).length;
              const batTeam = match.teams[innings.battingTeam];
              const roles: string[] = [];
              if (playerId !== null) {
                if (batTeam.captainId === playerId) roles.push("C");
                else if (batTeam.viceCaptainId === playerId) roles.push("VC");
                if (batTeam.keeperId === playerId) roles.push("WK");
              }
              return (
                <button
                  key={slot}
                  type="button"
                  className={`cricket-crease-player-row ${isStriker ? "is-striker" : ""}`}
                  disabled={playerId === null || busy}
                  onClick={() => startBatterChange(slot)}
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
                        {playerId === null ? "—" : withoutRoleMark(nameOf(playerId))}
                        {isStriker && playerId !== null && <span className="cricket-crease-star">*</span>}
                      </span>
                      {roles.length > 0 && (
                        <CreaseRoleBadges roles={roles} />
                      )}
                      {playerId !== null && (() => {
                        const p = allPlayers?.find((item) => item.id === playerId);
                        const s = battingStyleOf(p?.battingStyle);
                        return (
                          <span
                            className={`cricket-player-style-tag${s ? "" : " is-unset"}`}
                            title={s ? `${s.label} (Tap to change)` : "Set batting style"}
                            onClick={(e) => {
                              e.stopPropagation();
                              openStylePrompt(playerId, nameOf(playerId), "batting");
                            }}
                          >
                            {s ? s.short : "+ Bat"}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="cricket-crease-meta-line">
                      <span>Dots {dots}</span>
                      <span className="cricket-crease-dot-sep">·</span>
                      <span>4s {fours}</span>
                      <span className="cricket-crease-dot-sep">·</span>
                      <span>6s {sixes}</span>
                      <span className="cricket-crease-dot-sep">·</span>
                      <span className="cricket-crease-sr">SR {sr}</span>
                    </span>
                  </span>
                  <span className="cricket-crease-figs-col">
                    <strong className="cricket-crease-runs">{runs}</strong>
                    <span className="cricket-crease-balls">({balls}b)</span>
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
            <div className="cricket-crease-header-actions">
              {(() => {
                const ext = summary.extras;
                const extParts: string[] = [];
                if (ext.wides > 0) extParts.push(`${ext.wides}wd`);
                if (ext.noBalls > 0) extParts.push(`${ext.noBalls}nb`);
                if (ext.byes > 0) extParts.push(`${ext.byes}b`);
                if (ext.legByes > 0) extParts.push(`${ext.legByes}lb`);
                if (ext.penalty > 0) extParts.push(`${ext.penalty}p`);
                return (
                  <span
                    className="cricket-crease-econ-badge"
                    title={`Innings extras${extParts.length > 0 ? `: ${extParts.join(", ")}` : ""}`}
                  >
                    Extras {ext.total}
                    {extParts.length > 0 && <span className="cricket-crease-extras-detail"> ({extParts.join(", ")})</span>}
                  </span>
                );
              })()}
              <button
                type="button"
                className="cricket-prev-overs-trigger-btn"
                onClick={() => setPrevOversOpen(true)}
                title="View the bowlers and the last overs"
              >
                <i className="fa-solid fa-baseball" aria-hidden="true"></i>
                <span>Bowlers</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            className="cricket-crease-player-row is-bowler-row"
            disabled={innings.bowlerId === null || busy}
            onClick={startBowlerChange}
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
                  {innings.bowlerId === null ? "—" : withoutRoleMark(nameOf(innings.bowlerId))}
                </span>
                {innings.bowlerId !== null && (() => {
                  const bowlTeam = match.teams[1 - innings.battingTeam];
                  const roles: string[] = [];
                  if (bowlTeam.captainId === innings.bowlerId) roles.push("C");
                  else if (bowlTeam.viceCaptainId === innings.bowlerId) roles.push("VC");
                  return roles.length > 0 ? (
                    <CreaseRoleBadges roles={roles} />
                  ) : null;
                })()}
                {innings.bowlerId !== null && (() => {
                  const p = allPlayers?.find((item) => item.id === innings.bowlerId);
                  const s = bowlingStyleOf(p?.bowlingStyle);
                  return (
                    <span
                      className={`cricket-player-style-tag${s ? "" : " is-unset"}`}
                      title={s ? `${s.label} (Tap to change)` : "Set bowling style"}
                      onClick={(e) => {
                        e.stopPropagation();
                        openStylePrompt(innings.bowlerId!, nameOf(innings.bowlerId!), "bowling");
                      }}
                    >
                      {s ? s.short : "+ Style"}
                    </span>
                  );
                })()}
              </span>
              <span className="cricket-crease-meta-line">
                {innings.bowlerId !== null ? (() => {
                  const bowlerBalls = innings.balls.filter(
                    (b) => b.bowlerId === innings.bowlerId && b.extraType !== "penalty",
                  );
                  const bDots = bowlerRow?.dots ?? 0;
                  const bFours = bowlerBalls.filter(isFour).length;
                  const bSixes = bowlerBalls.filter(isSix).length;
                  const bWides = bowlerRow?.wides ?? 0;
                  const bNoBalls = bowlerRow?.noBalls ?? 0;
                  return (
                    <>
                      <span>Dots {bDots}</span>
                      <span className="cricket-crease-dot-sep">·</span>
                      <span>4s {bFours}</span>
                      <span className="cricket-crease-dot-sep">·</span>
                      <span>6s {bSixes}</span>
                      {bWides + bNoBalls > 0 && (
                        <>
                          <span className="cricket-crease-dot-sep">·</span>
                          <span>
                            {bWides}wd {bNoBalls}nb
                          </span>
                        </>
                      )}
                      {overLimit !== null && (
                        <>
                          <span className="cricket-crease-dot-sep">·</span>
                          <span>Max {overLimit} ov</span>
                        </>
                      )}
                    </>
                  );
                })() : (
                  <span>Tap to select bowler</span>
                )}
              </span>
            </span>
            <span className="cricket-crease-bowler-figs-col">
              <strong className="cricket-crease-bowler-figs">
                {bowlerRow ? `${oversText(bowlerRow.legalBalls, perOver)}-${bowlerRow.maidens}-${bowlerRow.runs}-${bowlerRow.wickets}` : "0.0-0-0-0"}
              </strong>
              <small className="cricket-crease-bowler-sub">O - M - R - W</small>
              <small className="cricket-crease-bowler-econ">
                Econ {bowlerRow && bowlerRow.legalBalls > 0 ? rate(bowlerRow.runs, bowlerRow.legalBalls, perOver) : "0.00"}
              </small>
            </span>
          </button>
        </div>
      </div>
      )}
      </div>

      {inningsBreak && (
        <div className="cricket-action-bar cricket-break-actions">
          <button type="button" className="cricket-sheet-undo" onClick={undo} disabled={busy}>
            <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Back to 1st Inn
          </button>
          <button
            type="button"
            className="cricket-sheet-submit cricket-break-start"
            onClick={() => savePlayers(picks)}
            disabled={busy || emptySlots.some((slot) => picks[slot] === null)}
          >
            <i className="fa-solid fa-play" aria-hidden="true"></i> Start 2nd Inn
          </button>
        </div>
      )}

      {!inningsBreak && (
      <>
      {/* Animated popover: the bowlers, then the last overs. */}
      {prevOversOpen && (
        <OversPopover
          innings={innings}
          perOver={perOver}
          bowling={bowling}
          overLimit={overLimit}
          oversUsed={(bowlerId) => oversBowled(innings, bowlerId, perOver)}
          currentOver={showOver}
          nameOf={nameOf}
          // A ball not sent yet can't be corrected.
          busy={busy || queueing}
          onCorrect={(ballIndex) => setCorrecting({ ballIndex })}
          onClosed={() => setPrevOversOpen(false)}
        />
      )}

      {/* Fixed to the bottom of the screen on phones. */}
      <div className="cricket-scorer-dock" ref={dockRef}>
      {/* The next ball's a free hit: said here rather than on a line of its own, so
          the pad keeps its height on a short screen. */}
      <div className={`cricket-this-over${freeHit && !showPickers ? " is-free-hit" : ""}`}>
        {freeHit && !showPickers ? (
          <span className="cricket-this-over-label" role="status" title="Only a run-out gets the batter out">
            <span>
              <i className="fa-solid fa-bolt" aria-hidden="true"></i> Free
            </span>
            <span>hit</span>
          </span>
        ) : (
          <span className="cricket-this-over-label">
            <span>{overEndPending ? "Last" : "This"}</span>
            <span>over</span>
          </span>
        )}
        <div
          className={`cricket-this-over-balls-wrap${ballsOverflow.left ? " has-left-shadow" : ""}${ballsOverflow.right ? " has-right-shadow" : ""}`}
        >
          <div className="cricket-this-over-balls" ref={ballsScrollRef} onScroll={updateBallsOverflow}>
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
        {/* The runs are only known once the play's over, so a mistake is marked
            on the ball just recorded. Kept in this strip so the pad keeps its
            height on a short screen. */}
        {lastDelivery !== -1 && (
          <button
            type="button"
            className="cricket-this-over-lapse"
            disabled={busy}
            onClick={() => setCorrecting({ ballIndex: lastDelivery, lapseOnly: true })}
            aria-label="Mark a dropped catch or misfield on the last ball"
            title="Dropped catch or misfield on the last ball"
          >
            Fielding
          </button>
        )}
        <span className="cricket-this-over-runs">
          {showOver?.runs ?? 0} {(showOver?.runs ?? 0) === 1 ? "run" : "runs"}
        </span>
      </div>

      {queue.waiting > 0 && (
        <div className="cricket-pending-ball" role="status">
          <i className={`fa-solid ${queue.sending ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} aria-hidden="true"></i>
          <span>
            {queue.sending
              ? `Sending ${waitingNote.replace(" waiting to send", "")}…`
              : queue.blocked
                ? "The last ball didn't send — check the connection or tap Retry"
                : `${waitingNote[0].toUpperCase()}${waitingNote.slice(1)} — kept on this phone${offline ? " until you're back online" : ""}`}
          </span>
          <div className="d-flex gap-2 align-items-center ms-auto">
            <Button variant="outline" disabled={queue.sending || offline} onClick={nudgeBallQueue}>
              Retry
            </Button>
            <button
              type="button"
              className="btn btn-sm btn-link text-white text-decoration-none p-1"
              title="Discard"
              aria-label="Discard the balls waiting to send"
              onClick={async () => {
                const ok = await confirmAction(
                  `Discard ${waitingNote.replace(" waiting to send", "")}?`,
                  "They haven't reached the server, so they'll be lost from the score.",
                  "Discard",
                );
                if (ok) clearQueue(match.id);
              }}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
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
      {/* "Bowling": tells the live pages the bowler is running in, until
          this ball is scored. */}
      {innings.bowlerId && innings.strikerId && !overEndPending && (
        <button
          type="button"
          className={`cricket-bowling-btn ${match.bowlingAt ? "is-on" : ""}`.trim()}
          disabled={padDisabled || markBowling.isPending || queueing}
          onClick={() => markBowling.mutate({ id: match.id })}
        >
          <BowlerArt />
          <span>{match.bowlingAt ? t("bowlingOn", lang) : t("bowlingOff", lang)}</span>
        </button>
      )}
      {/* A short buzz on any pad tap, so the scorer knows it took without looking. */}
      <div className="cricket-pad-container" onPointerDown={() => buzz()}>
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
                      <small className="cricket-pad-word">{t(key === 4 ? "four" : key === 6 ? "six" : "dot", lang)}</small>
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
                  onClick={scoreOr(() => setExtraModal(type))}
                >
                  <OutArt type={type} className="cricket-pad-art" />
                  <span>{t(type, lang)}</span>
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
            <span>{t("undo", lang)}</span>
          </button>
          <button
            type="button"
            className="cricket-pad-btn is-extra"
            disabled={padDisabled}
            onClick={scoreOr(() => setMoreRunsOpen(true))}
          >
            <OutArt type="runs" className="cricket-pad-art" />
            <span>{t("moreRuns", lang)}</span>
          </button>
          <button
            type="button"
            className="cricket-pad-btn is-extra"
            disabled={padDisabled}
            onClick={scoreOr(() => setExtraModal("no-ball"))}
          >
            <OutArt type="no-ball" className="cricket-pad-art" />
            <span>{t("no-ball", lang)}</span>
          </button>
          <button
            type="button"
            className="cricket-pad-btn is-wicket"
            disabled={padDisabled}
            onClick={scoreOr(openWicket)}
          >
            <OutArt type="out" className="cricket-pad-art" />
            <span>{t("out", lang)}</span>
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
        <ScorerSettingsSheet
          match={match}
          nameOf={nameOf}
          busy={busy}
          queueing={queueing}
          needsPlayers={needsPlayers}
          smallShotsOn={smallShotsOn}
          hapticsOn={prefs.haptics}
          pitchMapOn={prefs.pitchMap}
          onToggleHaptics={() => setScorerPref("haptics", !prefs.haptics)}
          onTogglePitchMap={() => setScorerPref("pitchMap", !prefs.pitchMap)}
          matchSettings={matchSettings}
          onClose={onCloseSettings}
          onChangePlayer={(slot) => (slot === "bowlerId" ? startBowlerChange() : startBatterChange(slot))}
          onSwapStrike={() => setPlayers.mutate({ id: match.id, strikerId: innings.nonStrikerId, nonStrikerId: innings.strikerId })}
          onCorrect={() => setCorrecting({ ballIndex: null })}
          onManageSquads={() => setManagingSquads(true)}
          onToggleSmallShots={toggleSmallShots}
          onShortRun={() => setShortRunOpen(true)}
          onPenalty={() => setPenaltyOpen(true)}
          onRain={() => setRainOpen(true)}
          onEndInnings={() => void handleEndInnings()}
          onAbandon={() => void handleAbandon()}
        />
      )}

      {rainOpen && (
        <RainSheet
          match={match}
          busy={busy}
          onClose={() => setRainOpen(false)}
          onRecord={(overs) =>
            interruption.mutate({ id: match.id, overs }, { onSuccess: () => setRainOpen(false) })
          }
        />
      )}

      {shortRunOpen && innings.strikerId !== null && (
        <ShortRunSheet
          bowler={nameOf(innings.bowlerId)}
          striker={{ id: innings.strikerId, name: nameOf(innings.strikerId), photoUrl: photoOf(innings.strikerId) }}
          nonStriker={
            innings.nonStrikerId !== null && innings.nonStrikerId !== innings.strikerId
              ? { id: innings.nonStrikerId, name: nameOf(innings.nonStrikerId), photoUrl: photoOf(innings.nonStrikerId) }
              : null
          }
          overEnds={(legal.length + 1) % perOver === 0}
          busy={busy}
          onClose={() => setShortRunOpen(false)}
          onRecord={(ball, nextStrikerId) => {
            // The strike may change after it, which needs the connection.
            if (queueing) {
              toast.error(`Short runs need a connection (${waitingNote})`);
              return;
            }
            const inningsIndex = match.innings.length - 1;
            addBall.mutate(
              { id: match.id, ...blankBall, ...ball },
              {
                // The scorer said the other batter faces next: swap them.
                onSuccess: (saved) => {
                  const now = saved.innings[inningsIndex];
                  if (!now || now.closed || now.strikerId === nextStrikerId || now.nonStrikerId !== nextStrikerId) return;
                  setPlayers.mutate({ id: saved.id, strikerId: now.nonStrikerId, nonStrikerId: now.strikerId });
                },
                onError: (error) => {
                  if (isStaleScore(error)) toast("Score updated from another device");
                },
              },
            );
            setShortRunOpen(false);
          }}
        />
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
        <CorrectBallSheet
          match={match}
          nameOf={nameOf}
          perOver={perOver}
          ballIndex={correcting.ballIndex}
          lapseOnly={correcting.lapseOnly}
          onClose={() => setCorrecting(null)}
        />
      )}

      {managingSquads && <ManageSquadSheet match={match} nameOf={nameOf} onClose={() => setManagingSquads(false)} />}

      {pickerFor === null && changing === null && promptStyleQueue[0] && (() => {
        const promptStyle = promptStyleQueue[0];
        const player = allPlayers?.find((item) => item.id === promptStyle.playerId);
        const playerRole = roleOf(player?.role ?? null);
        const currentBatting = battingStyleOf(player?.battingStyle);
        const currentBowling = bowlingStyleOf(player?.bowlingStyle);
        const currentStyle = promptStyle.type === "batting" ? currentBatting : currentBowling;
        const rightBowling = BOWLING_STYLES.filter((s) => s.arm === "right");
        const leftBowling = BOWLING_STYLES.filter((s) => s.arm === "left");

        const renderBowlingCard = (style: (typeof BOWLING_STYLES)[number]) => {
          const isSelected = player?.bowlingStyle === style.value;
          const kindClass = `is-${style.kind.toLowerCase()}`;
          return (
            <button
              key={style.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`cricket-style-card is-bowling-card ${kindClass}${isSelected ? " is-selected" : ""}`}
              onClick={() => {
                updatePlayerStyle.mutate({
                  id: promptStyle.playerId,
                  bowlingStyle: style.value,
                });
                dismissPromptStyle();
              }}
            >
              <div className="cricket-style-card-top">
                <span className={`cricket-style-card-icon ${kindClass}`}>
                  <OutArt type={style.value} className="cricket-style-art" />
                </span>
                <span className="cricket-style-card-short">
                  {isSelected && <i className="fa-solid fa-check" aria-hidden="true" />}
                  <span>{style.short}</span>
                </span>
              </div>
              <div className="cricket-style-card-body">
                <strong className="cricket-style-card-title">{style.label}</strong>
                <small className="cricket-style-card-note">{style.note}</small>
              </div>
            </button>
          );
        };

        return (
          <BottomSheet
            title={promptStyle.type === "batting" ? "Set Batting Style" : "Set Bowling Style"}
            icon={promptStyle.type === "batting" ? "fa-solid fa-baseball-bat-ball" : "fa-solid fa-baseball"}
            onClose={dismissPromptStyle}
          >
            <div className="cricket-style-sheet">
              <div className="cricket-style-player-card">
                <PlayerAvatar
                  name={promptStyle.name}
                  photoUrl={photoOf(promptStyle.playerId)}
                  className="cricket-style-player-avatar"
                />
                <div className="cricket-style-player-info">
                  <div className="cricket-style-player-top">
                    <strong className="cricket-style-player-name">{promptStyle.name}</strong>
                    {playerRole && <span className="cricket-style-role-pill">{playerRole.label}</span>}
                  </div>
                  <span className="cricket-style-player-sub">
                    {promptStyle.type === "batting"
                      ? "Choose batting hand · Saved to player profile"
                      : "Choose bowling arm & style · Saved to player profile"}
                  </span>
                </div>
                {promptStyleQueue.length > 1 ? (
                  <span className="cricket-style-step-pill" title="Remaining style prompts">
                    1 / {promptStyleQueue.length}
                  </span>
                ) : currentStyle ? (
                  <span className="cricket-style-current-pill" title={`Current: ${currentStyle.label}`}>
                    {currentStyle.short}
                  </span>
                ) : null}
              </div>

              {promptStyle.type === "batting" ? (
                <div className="cricket-style-columns is-batting" role="radiogroup" aria-label="Batting style">
                  {BATTING_STYLES.map((style, idx) => {
                    const isSelected = player?.battingStyle === style.value;
                    return (
                      <div key={style.value} className="cricket-style-col">
                        <span className="cricket-style-col-heading">
                          {idx === 0 ? "Right-Hand" : "Left-Hand"}
                        </span>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`cricket-style-card is-batting-card${isSelected ? " is-selected" : ""}`}
                          onClick={() => {
                            updatePlayerStyle.mutate({
                              id: promptStyle.playerId,
                              battingStyle: style.value,
                            });
                            dismissPromptStyle();
                          }}
                        >
                          <div className="cricket-style-card-top">
                            <span className="cricket-style-card-icon">
                              <OutArt type={style.value} className="cricket-style-art" />
                            </span>
                            <span className="cricket-style-card-short">
                              {isSelected && <i className="fa-solid fa-check" aria-hidden="true" />}
                              <span>{style.short}</span>
                            </span>
                          </div>
                          <div className="cricket-style-card-body">
                            <strong className="cricket-style-card-title">{style.label}</strong>
                            <small className="cricket-style-card-note">{style.note}</small>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="cricket-style-columns is-bowling" role="radiogroup" aria-label="Bowling style">
                  <div className="cricket-style-col">
                    <span className="cricket-style-col-heading">Right-Arm</span>
                    <div className="cricket-style-col-list">
                      {rightBowling.map(renderBowlingCard)}
                    </div>
                  </div>
                  <div className="cricket-style-col">
                    <span className="cricket-style-col-heading">Left-Arm</span>
                    <div className="cricket-style-col-list">
                      {leftBowling.map(renderBowlingCard)}
                    </div>
                  </div>
                </div>
              )}

              <div className="cricket-style-sheet-actions">
                <button
                  type="button"
                  className="cricket-style-skip-btn"
                  onClick={dismissPromptStyle}
                >
                  <span>Skip for now</span>
                </button>
                {promptStyleQueue.length > 1 && (
                  <button
                    type="button"
                    className="cricket-style-skip-all-btn"
                    onClick={() => setPromptStyleQueue([])}
                  >
                    <span>Skip all ({promptStyleQueue.length})</span>
                  </button>
                )}
              </div>
            </div>
          </BottomSheet>
        );
      })()}

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

      {askingWhy && innings.bowlerId !== null && (
        <BottomSheet title="Change bowler" icon="fa-solid fa-baseball" onClose={() => setAskingWhy(false)}>
          <p className="cricket-sheet-context">
            <strong>{nameOf(innings.bowlerId)}</strong> has bowled {thisOverBalls.length} ball
            {thisOverBalls.length === 1 ? "" : "s"} of this over. Why the change?
          </p>
          <div className="cricket-settings-list">
            {[
              {
                wrong: true,
                icon: "fa-solid fa-user-pen",
                label: "Wrong bowler picked",
                description: "Someone else has been bowling this over. Its balls so far move to them.",
              },
              {
                wrong: false,
                icon: "fa-solid fa-user-injured",
                label: "Injured or taken off",
                description: `Someone else finishes the over. ${nameOf(innings.bowlerId)} keeps the balls bowled so far.`,
              },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                className="cricket-settings-item"
                onClick={() => {
                  setAskingWhy(false);
                  setWrongBowler(option.wrong);
                  setChanging("bowlerId");
                }}
              >
                <i className={option.icon} aria-hidden="true"></i>
                <span>
                  {option.label}
                  <small>{option.description}</small>
                </span>
                <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {askingWhyBatter && innings[askingWhyBatter] !== null && (() => {
        const batterId = innings[askingWhyBatter];
        const row = batting.find((r) => r.playerId === batterId);
        const score = `${row?.runs ?? 0} (${row?.balls ?? 0})`;
        const options = [
          {
            wrong: true,
            icon: "fa-solid fa-user-pen",
            label: "Wrong batter picked",
            description: `Someone else has been batting. ${score} and every ball so far move to them.`,
            disabled: yetToBatItems().length === 0,
          },
          {
            wrong: false,
            icon: "fa-solid fa-user-injured",
            label: "Retired hurt",
            description: `${nameOf(batterId)} leaves on ${score}, not out, and can bat again later.`,
            disabled: false,
          },
        ];
        return (
          <BottomSheet title="Change batter" icon="fa-solid fa-baseball-bat-ball" onClose={() => setAskingWhyBatter(null)}>
            <p className="cricket-sheet-context">
              <strong>{nameOf(batterId)}</strong> is on {score}. Why the change?
            </p>
            <div className="cricket-settings-list">
              {options.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="cricket-settings-item"
                  disabled={option.disabled}
                  onClick={() => {
                    setAskingWhyBatter(null);
                    setWrongBatter(option.wrong);
                    setChanging(askingWhyBatter);
                  }}
                >
                  <i className={option.icon} aria-hidden="true"></i>
                  <span>
                    {option.label}
                    <small>{option.disabled ? "Everyone else has batted already." : option.description}</small>
                  </span>
                  <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
              ))}
            </div>
          </BottomSheet>
        );
      })()}

      {changing && innings[changing] !== null && (
        <PlayerPicker
          key={`change-${changing}`}
          title={
            changing === "bowlerId"
              ? wrongBowler
                ? "Who bowled this over?"
                : "Change bowler"
              : wrongBatter
                ? "Who has been batting?"
                : changing === "strikerId"
                  ? "Change striker"
                  : "Change non-striker"
          }
          hint={
            changing === "bowlerId" && wrongBowler ? (
              <>
                <i className="fa-solid fa-user-pen" aria-hidden="true"></i> The {thisOverBalls.length} ball
                {thisOverBalls.length === 1 ? "" : "s"} bowled so far this over move from{" "}
                <strong>{nameOf(innings.bowlerId)}</strong> to who you pick.
              </>
            ) : changing === "bowlerId" ? (
              <>
                <i className="fa-solid fa-baseball" aria-hidden="true"></i> Who finishes the over for{" "}
                <strong>{nameOf(innings.bowlerId)}</strong>? Their figures so far stay with them.
              </>
            ) : wrongBatter ? (
              <>
                <i className="fa-solid fa-user-pen" aria-hidden="true"></i> All of{" "}
                <strong>{nameOf(innings[changing])}</strong>'s runs and balls this innings move to who you pick. Only
                players yet to bat are shown.
              </>
            ) : (
              <>
                <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> Who comes in for{" "}
                <strong>{nameOf(innings[changing])}</strong>?{" "}
                {hasPlayed(innings[changing])
                  ? "They'll be marked retired hurt, keep their score and can bat again later."
                  : "They haven't played yet, so they're simply replaced."}
              </>
            )
          }
          icon={`fa-solid ${changing === "bowlerId" ? "fa-baseball" : "fa-baseball-bat-ball"}`}
          items={changing === "bowlerId" ? changeBowlerItems : wrongBatter ? yetToBatItems() : batterItems(null)}
          nameOf={nameOf}
          selectedId={null}
          onPick={(id) => change(changing, id)}
          onClose={() => {
            setChanging(null);
            setWrongBowler(false);
            setWrongBatter(false);
          }}
        />
      )}

      {pendingPitch && (
        <PitchSheet
          bowlerName={nameOf(innings.bowlerId)}
          leftHanded={allPlayers?.find((p) => p.id === innings.strikerId)?.battingStyle === "left-hand"}
          busy={busy}
          onPick={(spot) => {
            const ball = pendingPitch;
            setPendingPitch(null);
            record({ ...ball, pitchLine: spot?.line ?? null, pitchLength: spot?.length ?? null });
          }}
          onClose={() => setPendingPitch(null)}
        />
      )}

      {pendingShot && (
        <ShotSheet
          ball={pendingShot}
          strikerName={nameOf(innings.strikerId)}
          leftHanded={allPlayers?.find((p) => p.id === innings.strikerId)?.battingStyle === "left-hand"}
          busy={busy}
          smallShotsOn={smallShotsOn}
          onToggleSmallShots={toggleSmallShots}
          onRecord={saveShot}
          onClose={() => setPendingShot(null)}
        />
      )}

      {extraModal && (
        <ExtrasSheet
          type={extraModal}
          bowlerName={nameOf(innings.bowlerId)}
          strikerName={nameOf(innings.strikerId)}
          freeHitDefault={match.freeHit !== false}
          busy={busy}
          onRecord={record}
          onRecordShot={recordShot}
          onClose={() => setExtraModal(null)}
        />
      )}

      {moreRunsOpen && (
        <MoreRunsSheet
          bowlerName={nameOf(innings.bowlerId)}
          strikerName={nameOf(innings.strikerId)}
          busy={busy}
          onRecord={recordShot}
          onClose={() => setMoreRunsOpen(false)}
        />
      )}

      {wicketModal && (
        <WicketSheet
          match={match}
          nameOf={nameOf}
          busy={busy}
          incomingDue={incomingDue}
          freeHit={freeHit}
          lastMan={lastMan}
          facing={facing}
          incomingItems={batterItems(null)}
          showMoreOuts={wicketMoreOuts}
          onSubmit={submitWicket}
          onClose={() => setWicketModal(false)}
        />
      )}
    </div>
  );
}

const ROLE_BADGE_TITLES: Record<string, string> = { C: "Captain", VC: "Vice-captain", WK: "Wicket-keeper" };

// Round C / VC / WK badges beside a crease player's name, so they don't read
// like the batting / bowling style pills.
function CreaseRoleBadges({ roles }: { roles: string[] }) {
  return (
    <>
      {roles.map((role) => (
        <span
          key={role}
          className={`cricket-crease-role-tag is-${role.toLowerCase()}`}
          title={ROLE_BADGE_TITLES[role]}
          aria-label={ROLE_BADGE_TITLES[role]}
        >
          {role}
        </span>
      ))}
    </>
  );
}
