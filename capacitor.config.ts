import type { CapacitorConfig } from "@capacitor/cli";

// The Android app: the website's own build (dist/) carried inside an app.
// What differs in the app is switched in src/app-shell/platform.ts.
const config: CapacitorConfig = {
  appId: "in.runmitra.app",
  appName: "RunMitra",
  webDir: "dist",
  // The splash's colour, so opening the app never flashes white.
  backgroundColor: "#0f1012",
  plugins: {
    SystemBars: {
      // The app keeps every page between the status bar and the navigation
      // buttons itself (MainActivity.java), so no screen draws under them
      // and env(safe-area-inset-*) is 0.
      insetsHandling: "disable",
      // Light icons, for the dark splash; nativeShell then follows the
      // page's theme-color.
      style: "DARK",
    },
  },
};

export default config;
