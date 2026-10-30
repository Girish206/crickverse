import { useLayoutEffect } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";

// Opening another page (a match from the home list, say) starts it at the
// top, not at however far the last page was scrolled. Only the path counts:
// a tab kept in the URL (?tab=) stays where it is, and going back leaves the
// browser to put the old page where it was.
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [pathname]); // not navigationType: only a new path scrolls

  return <Outlet />;
}
