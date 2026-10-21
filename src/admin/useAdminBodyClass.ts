import { useEffect } from "react";

// The public site's global style.css sets `body { padding: 24px 0 }` for its
// own card-shadow page aesthetic. That's an unscoped rule, so it also
// affects the admin section (which has its own fixed-position shell) unless
// neutralized — this adds an `admin-page` class to <body> while an admin
// route is mounted, which admin.css uses to zero that padding out.
export function useAdminBodyClass() {
  useEffect(() => {
    document.body.classList.add("admin-page");
    return () => document.body.classList.remove("admin-page");
  }, []);
}
