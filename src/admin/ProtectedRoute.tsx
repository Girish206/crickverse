import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export function ProtectedRoute() {
  const { isAuthenticated } = useAdminAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
