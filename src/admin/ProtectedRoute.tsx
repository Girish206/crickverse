import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

// Signed-out visitors go to sign in, remembering the page (a shared link)
// to come back to afterwards.
export function ProtectedRoute() {
  const { isAuthenticated } = useAdminAuth();
  const location = useLocation();
  if (!isAuthenticated) {
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
