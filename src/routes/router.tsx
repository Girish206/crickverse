import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute, RequireSuperAdmin } from "../admin/ProtectedRoute";
import { AdminLoginPage } from "../admin/AdminLoginPage";

const page = <T,>(load: () => Promise<T>, pick: (module: T) => ComponentType) => async () => ({
  Component: pick(await load()),
});

// Players see their own stats, matches and tournaments, and manage (and
// score) the ones they create; super admins also manage the player list and
// everything else.
export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: <AdminLoginPage /> },
      // Sign-up is a step of the sign-in screen now; old links still land there.
      { path: "/register", element: <Navigate to="/login" replace /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        lazy: page(() => import("../admin/dms/layout/LayoutWrapper"), (m) => m.default),
        children: [
          { index: true, lazy: page(() => import("../admin/cricket/me/CricketMePages"), (m) => m.CricketHome) },
          { path: "me", lazy: page(() => import("../admin/cricket/me/CricketMePages"), (m) => m.MyCricketStats) },
          { path: "my-matches", lazy: page(() => import("../admin/cricket/me/CricketMePages"), (m) => m.MyCricketMatches) },
          {
            path: "my-tournaments",
            lazy: page(() => import("../admin/cricket/me/CricketMePages"), (m) => m.MyCricketTournaments),
          },
          { path: "my-teams", lazy: page(() => import("../admin/cricket/me/CricketMePages"), (m) => m.MyCricketTeams) },
          { path: "following", lazy: page(() => import("../admin/cricket/follow/FollowingPage"), (m) => m.FollowingPage) },
          { path: "profile", lazy: page(() => import("../admin/cricket/me/MyProfilePage"), (m) => m.MyProfilePage) },
          // Players can open the tournaments and matches they play in or
          // follow (the pages go read-only for them).
          {
            path: "tournaments/:id",
            lazy: page(() => import("../admin/cricket/tournaments/CricketTournamentPage"), (m) => m.CricketTournamentPage),
          },
          // The organiser builds balanced teams from matched sets here.
          {
            path: "tournaments/:id/create-teams",
            lazy: page(() => import("../admin/cricket/tournaments/CricketAutoTeamsPage"), (m) => m.CricketAutoTeamsPage),
          },
          // The organiser picks the format (league, groups, playoffs, series).
          {
            path: "tournaments/:id/format",
            lazy: page(() => import("../admin/cricket/format/CricketFormatPage"), (m) => m.CricketFormatPage),
          },
          {
            path: "tournaments/:id/teams/:team",
            lazy: page(() => import("../admin/cricket/tournaments/CricketTeamPage"), (m) => m.CricketTeamPage),
          },
          {
            path: "teams/friendly/:name",
            lazy: page(() => import("../admin/cricket/teams/FriendlyTeamPage"), (m) => m.FriendlyTeamPage),
          },
          {
            path: "matches/:id",
            lazy: page(() => import("../admin/cricket/matches/CricketMatchPage"), (m) => m.CricketMatchPage),
          },
          // Whoever organises the match sets it up (the API checks who).
          {
            path: "matches/:id/setup",
            lazy: page(() => import("../admin/cricket/matches/MatchSetup"), (m) => m.CricketMatchSetupPage),
          },
          {
            element: <RequireSuperAdmin />,
            children: [
              {
                path: "dashboard",
                lazy: page(() => import("../admin/cricket/dashboard/CricketDashboard"), (m) => m.CricketDashboard),
              },
              {
                path: "players",
                lazy: page(() => import("../admin/cricket/players/CricketPlayersList"), (m) => m.CricketPlayersList),
              },
              {
                path: "tournaments",
                lazy: page(() => import("../admin/cricket/tournaments/CricketTournamentsList"), (m) => m.CricketTournamentsList),
              },
              {
                path: "matches",
                lazy: page(() => import("../admin/cricket/matches/CricketMatchesList"), (m) => m.CricketMatchesList),
              },
              {
                path: "leaderboard",
                lazy: page(() => import("../admin/cricket/leaderboard/CricketLeaderboard"), (m) => m.CricketLeaderboardPage),
              },
            ],
          },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
