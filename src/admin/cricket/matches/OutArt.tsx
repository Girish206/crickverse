import type { ReactNode } from "react";

// Line drawings for the wicket sheet's out types and the scoring pad's
// buttons (LiveScorer): white
// figures, stumps and ball on a 48 × 48 grid, drawn in the tile's text
// colour. Built from the same few pieces so they read as one set.

const Ground = () => <line x1={5} y1={43} x2={43} y2={43} />;

// Three stumps standing on the ground from `top`, bails on top unless
// they're flying off.
function Stumps({ x, top = 31, flying = false }: { x: number; top?: number; flying?: boolean }) {
  return (
    <g>
      <line x1={x} y1={top} x2={x} y2={43} />
      <line x1={x + 3.2} y1={top} x2={x + 3.2} y2={43} />
      <line x1={x + 6.4} y1={top} x2={x + 6.4} y2={43} />
      {flying ? (
        <>
          <line x1={x - 2} y1={top - 6} x2={x + 1.5} y2={top - 8} />
          <line x1={x + 5} y1={top - 9} x2={x + 8.5} y2={top - 7} />
        </>
      ) : (
        <line x1={x - 0.8} y1={top - 1.6} x2={x + 7.2} y2={top - 1.6} />
      )}
    </g>
  );
}

const Head = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r={3.2} />;
const Ball = ({ x, y }: { x: number; y: number }) => <circle className="cricket-out-art-ball" cx={x} cy={y} r={2} />;
// A bat: a thick blade from the handle end.
const Bat = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <line className="cricket-out-art-bat" x1={x1} y1={y1} x2={x2} y2={y2} />
);

// A batter in their stance, bat grounded in front.
function Batter({ x, bat = true }: { x: number; bat?: boolean }) {
  return (
    <g>
      <Head x={x} y={11} />
      <line x1={x} y1={14.5} x2={x + 1} y2={27} />
      <line x1={x + 1} y1={27} x2={x - 3} y2={43} />
      <line x1={x + 1} y1={27} x2={x + 5} y2={43} />
      <line x1={x} y1={18} x2={x - 5} y2={24} />
      {bat && <Bat x1={x - 5} y1={24} x2={x - 8} y2={38} />}
    </g>
  );
}

// A batter walking off to the right, bat under the arm.
function Walking({ x }: { x: number }) {
  return (
    <g>
      <Head x={x} y={11} />
      <line x1={x} y1={14.5} x2={x - 1} y2={27} />
      <line x1={x - 1} y1={27} x2={x - 6} y2={43} />
      <line x1={x - 1} y1={27} x2={x + 5} y2={42} />
      <line x1={x} y1={18} x2={x + 5} y2={24} />
      <Bat x1={x - 2} y1={19} x2={x - 9} y2={28} />
    </g>
  );
}

// The umpire (hat brim on), arms given as the signal; legs together
// unless one is lifted.
function Umpire({ arms, legs }: { arms: ReactNode; legs?: ReactNode }) {
  return (
    <g>
      <Head x={24} y={9} />
      <line x1={19.5} y1={6.2} x2={28.5} y2={6.2} />
      <line x1={24} y1={12.5} x2={24} y2={28} />
      {legs ?? (
        <>
          <line x1={24} y1={28} x2={20} y2={43} />
          <line x1={24} y1={28} x2={28} y2={43} />
        </>
      )}
      {arms}
    </g>
  );
}
// An arm hanging at the umpire's side.
const ArmDown = () => <line x1={24} y1={16} x2={19} y2={28} />;

const ART: Record<string, ReactNode> = {
  // The scoring pad's buttons: the umpire's signals, and a batter running.
  wide: (
    <>
      <Ground />
      <Umpire
        arms={
          <>
            <line x1={24} y1={16} x2={7} y2={16} />
            <line x1={24} y1={16} x2={41} y2={16} />
          </>
        }
      />
    </>
  ),
  "no-ball": (
    <>
      <Ground />
      <Umpire
        arms={
          <>
            <ArmDown />
            <line x1={24} y1={16} x2={41} y2={16} />
          </>
        }
      />
    </>
  ),
  bye: (
    <>
      <Ground />
      <Umpire
        arms={
          <>
            <ArmDown />
            <line x1={24} y1={16} x2={27} y2={2} />
            <line x1={25} y1={2.5} x2={29} y2={3.5} />
          </>
        }
      />
    </>
  ),
  "leg-bye": (
    <>
      <Ground />
      <Umpire
        arms={
          <>
            <ArmDown />
            <line x1={24} y1={16} x2={32} y2={29} />
          </>
        }
        legs={
          <>
            <line x1={24} y1={28} x2={21} y2={43} />
            <line x1={24} y1={28} x2={33} y2={31} />
            <line x1={33} y1={31} x2={31} y2={40} />
          </>
        }
      />
    </>
  ),
  out: (
    <>
      <Ground />
      <Umpire
        arms={
          <>
            <ArmDown />
            <line x1={24} y1={16} x2={32} y2={13} />
            <line x1={32} y1={13} x2={32} y2={2} />
          </>
        }
      />
    </>
  ),
  runs: (
    <>
      <Ground />
      <Head x={20} y={10} />
      <line x1={21} y1={13.5} x2={25} y2={26} />
      <line x1={25} y1={26} x2={14} y2={36} />
      <line x1={14} y1={36} x2={12} y2={43} />
      <line x1={25} y1={26} x2={33} y2={35} />
      <line x1={33} y1={35} x2={38} y2={43} />
      <line x1={22} y1={17} x2={30} y2={20} />
      <Bat x1={30} y1={20} x2={42} y2={14} />
    </>
  ),

  // The wicket sheet's out types.
  // Ball through the gate, bails flying.
  bowled: (
    <>
      <Ground />
      <Batter x={16} />
      <Stumps x={30} flying />
      <Ball x={33} y={36} />
    </>
  ),
  // A fielder diving full length, ball in hand.
  caught: (
    <>
      <Ground />
      <Head x={9} y={27} />
      <line x1={12} y1={29} x2={30} y2={34} />
      <line x1={30} y1={34} x2={40} y2={41} />
      <line x1={30} y1={34} x2={42} y2={34} />
      <line x1={11} y1={26} x2={6} y2={18} />
      <Ball x={6} y={15} />
    </>
  ),
  // The keeper crouched behind the stumps, gloves up with the ball.
  "caught-behind": (
    <>
      <Ground />
      <Stumps x={8} />
      <Head x={30} y={19} />
      <line x1={30} y1={22.5} x2={31} y2={32} />
      <line x1={31} y1={32} x2={26} y2={36} />
      <line x1={26} y1={36} x2={27} y2={43} />
      <line x1={31} y1={32} x2={36} y2={36} />
      <line x1={36} y1={36} x2={35} y2={43} />
      <line x1={30} y1={25} x2={22} y2={23} />
      <rect className="cricket-out-art-fill" x={18} y={20} width={5} height={5} rx={1.5} />
      <Ball x={20.5} y={17} />
    </>
  ),
  // The bowler reaching up for the return catch.
  "caught-and-bowled": (
    <>
      <Ground />
      <Head x={24} y={15} />
      <line x1={24} y1={18.5} x2={24} y2={30} />
      <line x1={24} y1={30} x2={19} y2={43} />
      <line x1={24} y1={30} x2={30} y2={43} />
      <line x1={24} y1={21} x2={18} y2={10} />
      <line x1={24} y1={21} x2={30} y2={10} />
      <Ball x={24} y={6} />
      <path d="M38 30 Q36 14 28 8" strokeDasharray="2 2.5" />
    </>
  ),
  // A batter stretching for the crease; the throw hits the stumps first.
  "run-out": (
    <>
      <Ground />
      <Head x={12} y={17} />
      <line x1={14} y1={20} x2={22} y2={30} />
      <line x1={22} y1={30} x2={16} y2={43} />
      <line x1={22} y1={30} x2={30} y2={41} />
      <line x1={16} y1={22} x2={27} y2={25} />
      <Bat x1={27} y1={25} x2={33} y2={38} />
      <Stumps x={36} flying />
      <Ball x={42} y={22} />
    </>
  ),
  // Ball on the pad, stumps behind.
  lbw: (
    <>
      <Ground />
      <Batter x={18} />
      <rect className="cricket-out-art-fill" x={11.5} y={33} width={4} height={9} rx={1.5} />
      <Ball x={9} y={36} />
      <Stumps x={32} />
    </>
  ),
  // The batter out of the crease; the keeper takes the bails off.
  stumped: (
    <>
      <Ground />
      <line x1={18} y1={39} x2={18} y2={43} strokeDasharray="1.5 1.5" />
      <Batter x={9} />
      <Stumps x={25} flying />
      <Head x={39} y={21} />
      <line x1={39} y1={24.5} x2={38} y2={33} />
      <line x1={38} y1={33} x2={34} y2={43} />
      <line x1={38} y1={33} x2={42} y2={43} />
      <line x1={38} y1={27} x2={31} y2={29} />
    </>
  ),
  // A batter leaving the field, a red cross over them.
  "retired-hurt": (
    <>
      <Ground />
      <Walking x={20} />
      <rect className="cricket-out-art-cross" x={33} y={6} width={9} height={9} rx={2} />
      <line className="cricket-out-art-cross-mark" x1={37.5} y1={8} x2={37.5} y2={13} />
      <line className="cricket-out-art-cross-mark" x1={35} y1={10.5} x2={40} y2={10.5} />
    </>
  ),
  // The bowler breaking the bails at their end; the non-striker backing up.
  mankad: (
    <>
      <Ground />
      <Stumps x={21} flying />
      <Head x={11} y={13} />
      <line x1={11} y1={16.5} x2={12} y2={28} />
      <line x1={12} y1={28} x2={8} y2={43} />
      <line x1={12} y1={28} x2={16} y2={43} />
      <line x1={11} y1={19} x2={19} y2={27} />
      <Ball x={20} y={28} />
      <Head x={38} y={13} />
      <line x1={38} y1={16.5} x2={37} y2={28} />
      <line x1={37} y1={28} x2={33} y2={43} />
      <line x1={37} y1={28} x2={42} y2={42} />
      <Bat x1={36} y1={20} x2={31} y2={33} />
    </>
  ),
  // The bat swung back into the batter's own stumps.
  "hit-wicket": (
    <>
      <Ground />
      <Head x={18} y={11} />
      <line x1={18} y1={14.5} x2={19} y2={27} />
      <line x1={19} y1={27} x2={15} y2={43} />
      <line x1={19} y1={27} x2={23} y2={43} />
      <line x1={18} y1={18} x2={25} y2={20} />
      <Bat x1={25} y1={20} x2={31} y2={30} />
      <Stumps x={31} flying />
    </>
  ),
  // An empty crease: stumps and a red cross, no batter.
  "absent-hurt": (
    <>
      <Ground />
      <Stumps x={21} />
      <line x1={9} y1={39} x2={39} y2={39} strokeDasharray="2 2" />
      <rect className="cricket-out-art-cross" x={19.5} y={8} width={9} height={9} rx={2} />
      <line className="cricket-out-art-cross-mark" x1={24} y1={10} x2={24} y2={15} />
      <line className="cricket-out-art-cross-mark" x1={21.5} y1={12.5} x2={26.5} y2={12.5} />
    </>
  ),
  // Walking off, turned back the way they came.
  "retired-out": (
    <>
      <Ground />
      <Walking x={18} />
      <path d="M32 12 h8 a4 4 0 0 1 0 8 h-6" />
      <path d="M36 17 l-2.5 3 l2.5 3" />
    </>
  ),
  // The ball played, then struck again.
  "hit-ball-twice": (
    <>
      <Ground />
      <Batter x={30} />
      <Ball x={14} y={30} />
      <Ball x={9} y={20} />
      <path d="M22 36 Q14 38 13 33" strokeDasharray="2 2" />
      <path d="M12 27 Q8 26 9 23" strokeDasharray="2 2" />
    </>
  ),
  // A batter with a hand out, blocking the ball.
  "obstructing-field": (
    <>
      <Ground />
      <Head x={26} y={11} />
      <line x1={26} y1={14.5} x2={27} y2={27} />
      <line x1={27} y1={27} x2={23} y2={43} />
      <line x1={27} y1={27} x2={31} y2={43} />
      <line x1={26} y1={18} x2={16} y2={17} />
      <line x1={14} y1={13} x2={14} y2={21} />
      <Bat x1={27} y1={19} x2={34} y2={30} />
      <Ball x={8} y={17} />
    </>
  ),
  // Stumps waiting, the clock run out.
  "timed-out": (
    <>
      <Ground />
      <Stumps x={8} />
      <circle cx={31} cy={22} r={9} />
      <line x1={31} y1={22} x2={31} y2={16} />
      <line x1={31} y1={22} x2={35} y2={24} />
      <line x1={31} y1={11} x2={31} y2={9} />
    </>
  ),
  // Walking off through the gate, not out.
  retired: (
    <>
      <Ground />
      <Walking x={16} />
      <rect x={30} y={13} width={11} height={30} rx={1} />
      <line x1={33} y1={28} x2={33} y2={30} />
    </>
  ),
};

export function OutArt({ type, className }: { type: string; className?: string }) {
  return (
    <svg className={`cricket-out-art ${className ?? ""}`.trim()} viewBox="0 0 48 48" aria-hidden="true">
      {ART[type]}
    </svg>
  );
}
