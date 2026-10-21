import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute, RequireSuperAdmin } from "../admin/ProtectedRoute";
import { AdminLoginPage } from "../admin/AdminLoginPage";

const page = <T,>(load: () => Promise<T>, pick: (module: T) => ComponentType) => async () => ({
  Component: pick(await load()),
});

// Players see their own stats, matches and tournaments; organisers (super
// admins) also manage players, tournaments, matches and scoring.
export const router = createBrowserRouter([
  { path: "/login", element: <AdminLoginPage /> },
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
          // Players can open their own tournaments and matches (the pages go
          // read-only for them).
          {
            path: "tournaments/:id",
            lazy: page(() => import("../admin/cricket/tournaments/CricketTournamentPage"), (m) => m.CricketTournamentPage),
          },
          {
            path: "matches/:id",
            lazy: page(() => import("../admin/cricket/matches/CricketMatchPage"), (m) => m.CricketMatchPage),
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
