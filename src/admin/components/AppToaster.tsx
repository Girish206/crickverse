import "./AppToaster.css";
import { Toaster } from "sonner";
import { useIsAdminDark } from "../useAdminTheme";

// Mounted once in main.tsx; follows the admin's light/dark choice. Styled
// like the app's cards in AppToaster.css (not Sonner's richColors).
export function AppToaster() {
  const isDark = useIsAdminDark();
  return <Toaster position="top-right" closeButton theme={isDark ? "dark" : "light"} />;
}
