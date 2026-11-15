import { useRef, useState } from "react";
import { toast } from "sonner";
import type { CricketMatch, CricketReaction } from "../../../api/types";
import { useFanAction, useMatchViewers } from "../../../api/hooks/cricket/useMatchViewers";
import "./analysis.css";

const REACTIONS: { key: CricketReaction; emoji: string; label: string }[] = [
  { key: "clap", emoji: "👏", label: "Clap" },
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "wow", emoji: "😮", label: "Wow" },
  { key: "heart", emoji: "❤️", label: "Love" },
  { key: "sad", emoji: "😢", label: "Sad" },
];

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

// Fans' corner on a match: pick who wins (and see what everyone picked),
// and send reactions, which everyone watching sees counted. Picks close
// when the match is over; the tallies stay.
export function FanZone({ match, isPublic = false }: { match: CricketMatch; isPublic?: boolean }) {
  const open = match.status === "scheduled" || match.status === "live";
  const { data } = useMatchViewers(match.id, { live: match.status === "live", isPublic });
  const send = useFanAction(match.id, isPublic);
  // Taps since the last answer, shown at once; and the emojis floating up.
  const [pending, setPending] = useState<Partial<Record<CricketReaction, number>>>({});
  const [floats, setFloats] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const floatId = useRef(0);
  const fans = data?.fans;
  if (!fans) return null;
  const total = fans.votes[0] + fans.votes[1];
  const share = (side: number) => (total ? Math.round((fans.votes[side] * 100) / total) : 50);
  const reactionsTotal = REACTIONS.reduce((s, r) => s + fans.reactions[r.key], 0);
  if (!open && total === 0 && reactionsTotal === 0) return null;

  function vote(side: 0 | 1) {
    send({ vote: fans!.myVote === side ? null : side }).catch(() => toast.error("Couldn't save your pick — try again"));
  }

  function react(key: CricketReaction, emoji: string) {
    const id = ++floatId.current;
    // Spread across the row, so a burst of taps doesn't stack up.
    setFloats((f) => [...f.slice(-12), { id, emoji, x: 10 + ((id * 37) % 80) }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1600);
    setPending((p) => ({ ...p, [key]: (p[key] ?? 0) + 1 }));
    send({ react: key })
      .catch(() => undefined)
      .finally(() => setPending((p) => ({ ...p, [key]: Math.max(0, (p[key] ?? 1) - 1) })));
  }

  return (
    <section className="cricket-fans" aria-label="Fans">
      <div className="cricket-fans-poll">
        <h3>
          <i className="fa-solid fa-square-poll-horizontal" aria-hidden="true"></i> {open ? "Who wins?" : "Fans picked"}
          {total > 0 && <small>{compact(total)} vote{total === 1 ? "" : "s"}</small>}
        </h3>
        <div className="cricket-fans-sides">
          {([0, 1] as const).map((side) => (
            <button
              key={side}
              type="button"
              className={`cricket-fans-side ${fans.myVote === side ? "is-mine" : ""}`.trim()}
              disabled={!open}
              aria-pressed={fans.myVote === side}
              onClick={() => vote(side)}
            >
              <span className="cricket-fans-fill" style={{ width: `${fans.myVote !== null || !open ? share(side) : 0}%` }}></span>
              <span className="cricket-fans-name">
                {fans.myVote === side && <i className="fa-solid fa-circle-check" aria-hidden="true"></i>} {match.teams[side].name}
              </span>
              {(fans.myVote !== null || !open) && <strong>{share(side)}%</strong>}
            </button>
          ))}
        </div>
      </div>
      <div className="cricket-fans-react">
        {floats.map((f) => (
          <span key={f.id} className="cricket-fans-float" style={{ left: `${f.x}%` }} aria-hidden="true">
            {f.emoji}
          </span>
        ))}
        {REACTIONS.map((r) => (
          <button
            key={r.key}
            type="button"
            className="cricket-fans-emoji"
            disabled={!open}
            aria-label={`${r.label}: ${fans.reactions[r.key]}`}
            onClick={() => react(r.key, r.emoji)}
          >
            <span aria-hidden="true">{r.emoji}</span>
            <small>{compact(fans.reactions[r.key] + (pending[r.key] ?? 0))}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
