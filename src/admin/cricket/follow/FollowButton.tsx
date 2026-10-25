import { sameTarget, useMyFollows, useSetFollow } from "../../../api/hooks/cricket/useCricketFollows";
import type { CricketFollowTarget } from "../../../api/types";
import type { SettingsMenuItem } from "../SettingsMenu";

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

// The same, as an item in a page's settings menu (a tournament or team page).
export function useFollowMenuItem(target: CricketFollowTarget): SettingsMenuItem | null {
  const { hidden, following, toggle, pending } = useFollowState(target);
  if (hidden) return null;
  return {
    icon: `${following ? "fa-solid" : "fa-regular"} fa-heart`,
    label: following ? "Unfollow" : "Follow",
    description: following ? "You'll stop seeing its matches on your home" : "See its matches on your home",
    disabled: pending,
    onClick: toggle,
  };
}
