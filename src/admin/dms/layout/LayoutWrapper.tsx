import { Outlet, useLocation } from "react-router-dom";
import Layout from "./Layout";
import { useAdminAuth } from "../../../context/AdminAuthContext";

const LayoutWrapper = () => {
    const { admin } = useAdminAuth();
    const path = useLocation().pathname;

    const getActiveItem = () => {
        if (path.startsWith("/my-matches")) return "cricket-my-matches";
        if (path.startsWith("/my-tournaments")) return "cricket-my-tournaments";
        if (path.startsWith("/players")) return "cricket-players";
        if (path.startsWith("/leaderboard")) return "cricket-leaderboard";
        if (path.startsWith("/dashboard")) return "cricket-dashboard";
        // A player opening one of their tournaments/matches stays under "My …".
        if (path.startsWith("/tournaments")) return admin?.isSuperAdmin ? "cricket-tournaments" : "cricket-my-tournaments";
        if (path.startsWith("/matches")) return admin?.isSuperAdmin ? "cricket-matches" : "cricket-my-matches";
        if (path.startsWith("/me")) return "cricket-me";
        return admin?.isSuperAdmin ? "cricket-dashboard" : "cricket-me";
    };

    return (
        <Layout activeItem={getActiveItem()} activeSubItem="">
            {/* .cricket-module scopes the cricket pages' compact phone layout. */}
            <div className="cricket-module">
                <Outlet />
            </div>
        </Layout>
    );
};

export default LayoutWrapper;
