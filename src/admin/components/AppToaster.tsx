import "./AppToaster.css";
import { Toaster } from "sonner";
import { useIsAdminDark } from "../useAdminTheme";

// Mounted once in main.tsx; follows the admin's light/dark choice.
export function AppToaster() {
  const isDark = useIsAdminDark();
  return <Toaster position="top-right" richColors closeButton theme={isDark ? "dark" : "light"} />;
}
