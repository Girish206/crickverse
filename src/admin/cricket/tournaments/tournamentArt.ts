import type { CricketTournament } from "../../../api/types";

// Stock art (public/assets/tournament) for tournaments without their own
// banner or logo. Picked from the id rather than at random each render, so
// a tournament keeps the same art every visit; logo and banner use
// different picks so they don't always pair up the same way.
const ART_COUNT = 5;

const pick = (id: number, salt: number) => ((id * 7 + salt) % ART_COUNT) + 1;

export const bannerFor = (t: Pick<CricketTournament, "id" | "bannerUrl">) =>
  t.bannerUrl ?? `/assets/tournament/banner-${pick(t.id, 0)}.svg`;

export const logoFor = (t: Pick<CricketTournament, "id" | "logoUrl">) =>
  t.logoUrl ?? `/assets/tournament/logo-${pick(t.id, 3)}.svg`;
