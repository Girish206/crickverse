import { Outlet, useLocation, useNavigation } from "react-router-dom";
import Layout from "./Layout";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { PlayerProfileProvider } from "../../cricket/players/PlayerProfileSheet";
import "../../components/Loader.css";

// The menu's own screens get the navbar and sidebar; every other screen
// (a tournament, team, match or match setup) brings its own header with a
// back button instead.
const MAIN_SCREENS = ["/", "/me", "/my-matches", "/my-tournaments", "/my-teams", "/following", "/dashboard", "/tournaments", "/matches", "/players", "/leaderboard", "/database"];

const LayoutWrapper = () => {
    const { admin } = useAdminAuth();
    const path = useLocation().pathname;
    // A screen's code is fetched on first visit; show progress meanwhile.
    const navigating = useNavigation().state === "loading";

    const getActiveItem = () => {
        if (path.startsWith("/my-matches")) return "cricket-my-matches";
        if (path.startsWith("/my-tournaments")) return "cricket-my-tournaments";
        if (path.startsWith("/my-teams")) return "cricket-my-teams";
        if (path.startsWith("/following")) return "cricket-following";
        if (path.startsWith("/players")) return "cricket-players";
        if (path.startsWith("/leaderboard")) return "cricket-leaderboard";
        if (path.startsWith("/dashboard")) return "cricket-dashboard";
        if (path.startsWith("/database")) return "cricket-database";
        // A player opening one of their tournaments/matches stays under "My …".
        if (path.startsWith("/tournaments")) return admin?.isSuperAdmin ? "cricket-tournaments" : "cricket-my-tournaments";
        if (path.startsWith("/matches")) return admin?.isSuperAdmin ? "cricket-matches" : "cricket-my-matches";
        if (path.startsWith("/me")) return "cricket-me";
        return admin?.isSuperAdmin ? "cricket-dashboard" : "cricket-home";
    };

    const isMainScreen = MAIN_SCREENS.includes(path.replace(/\/+$/, "") || "/");

    return (
        <Layout activeItem={getActiveItem()} activeSubItem="" isMainScreen={isMainScreen}>
            {navigating && <div className="cv-route-progress" role="progressbar" aria-label="Loading page" />}
            {/* .cricket-module scopes the cricket pages' compact phone layout. */}
            <div className="cricket-module">
                <PlayerProfileProvider>
                    <Outlet />
                </PlayerProfileProvider>
            </div>
        </Layout>
    );
};

export default LayoutWrapper;
