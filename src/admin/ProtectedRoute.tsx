import { lazy, Suspense } from "react";
import { matchPath, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Loader } from "./components/Loader";

// The read-only pages a shared link opens for someone signed out. Loaded
// only then, so signed-in users never download them.
const PublicMatchPage = lazy(() => import("../public/PublicMatchPage").then((m) => ({ default: m.PublicMatchPage })));
const PublicTournamentPage = lazy(() =>
  import("../public/PublicTournamentPage").then((m) => ({ default: m.PublicTournamentPage })),
);

// Signed-out visitors go to sign in, remembering the page (a shared link)
// to come back to afterwards — except a match or tournament link, which
// opens its public view (that page offers sign-in itself when it's private).
export function ProtectedRoute() {
  const { isAuthenticated } = useAdminAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const match = matchPath("/matches/:id", location.pathname);
    const tournament = matchPath("/tournaments/:id", location.pathname);
    if (match || tournament) {
      return (
        <Suspense fallback={<Loader page />}>
          {match ? (
            <PublicMatchPage key={match.params.id} id={Number(match.params.id)} />
          ) : (
            <PublicTournamentPage key={tournament!.params.id} id={Number(tournament!.params.id)} />
          )}
        </Suspense>
      );
    }
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

// Sign-in and sign-up: someone already signed in (a remembered session)
// goes straight into the app.
export function PublicOnlyRoute() {
  const { isAuthenticated } = useAdminAuth();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

// Management pages (players, tournaments, scoring): organisers (super
// admins) only. Players land on their own stats instead.
export function RequireSuperAdmin() {
  const { admin } = useAdminAuth();
  if (!admin?.isSuperAdmin) return <Navigate to="/me" replace />;
  return <Outlet />;
}
