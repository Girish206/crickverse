import { sameTarget, useFollowCounts, useMyFollows, useSetFollow } from "../../../api/hooks/cricket/useCricketFollows";
import type { CricketFollowTarget } from "../../../api/types";
import { PageHeaderAction } from "../../components/PageHeader";

// Whether the signed-in player can follow the target, and does. Hidden for
// accounts without a player, and on the player's own profile.
function useFollowState(target: CricketFollowTarget) {
  const { data } = useMyFollows();
  const setFollow = useSetFollow();
  const hidden = !data?.playerId || (target.kind === "player" && target.targetId === data.playerId);
  const following = Boolean(data?.follows.some((f) => sameTarget(f, target)));
  const toggle = () => setFollow.mutate({ target, follow: !following });
  return { hidden, following, toggle, pending: setFollow.isPending };
}

// "Follow" / "Following" pill for list rows and profiles.
export function FollowButton({ target }: { target: CricketFollowTarget }) {
  const { hidden, following, toggle, pending } = useFollowState(target);
  if (hidden) return null;
  return (
    <button
      type="button"
      className={`cricket-follow-btn ${following ? "is-following" : ""}`.trim()}
      onClick={(e) => {
        // Rows open the item on click; following shouldn't.
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={pending}
      aria-pressed={following}
    >
      <i className={`fa-solid ${following ? "fa-check" : "fa-plus"}`} aria-hidden="true"></i>
      {following ? "Following" : "Follow"}
    </button>
  );
}

// The same, as a round PageHeader action (a tournament or team page).
export function FollowHeaderAction({ target }: { target: CricketFollowTarget }) {
  const { hidden, following, toggle, pending } = useFollowState(target);
  if (hidden) return null;
  return (
    <PageHeaderAction
      icon={`${following ? "fa-solid" : "fa-regular"} fa-star`}
      label={following ? "Unfollow" : "Follow"}
      active={following}
      disabled={pending}
      onClick={toggle}
    />
  );
}

// "12 followers · 3 following" for a player's profile.
export function FollowCounts({ playerId }: { playerId: number }) {
  const { data } = useFollowCounts({ kind: "player", targetId: playerId, teamIndex: null });
  if (!data) return null;
  return (
    <span className="cricket-follow-counts">
      <strong>{data.followers}</strong> follower{data.followers === 1 ? "" : "s"} · <strong>{data.following ?? 0}</strong>{" "}
      following
    </span>
  );
}
