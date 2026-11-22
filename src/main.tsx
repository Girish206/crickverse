import "./styles/brand.css";
import "./styles/crickverse.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { showMutationError } from "./api/mutationErrors";
import { AppToaster } from "./admin/components/AppToaster";
import { reloadOnceForNewBuild } from "./app-shell/chunkReload";
import { isNativeApp } from "./app-shell/platform";
import { reportUncaughtErrors } from "./app-shell/reportError";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    // A mutation that renders its own error UI opts out via
    // meta: { skipGlobalError: true }, or for some errors only via
    // meta: { skipGlobalErrorFor: (error) => boolean }.
    onError: (error, _variables, _context, mutation) => {
      const skipFor = mutation.meta?.skipGlobalErrorFor as ((error: unknown) => boolean) | undefined;
      if (!mutation.meta?.skipGlobalError && !skipFor?.(error)) void showMutationError(error);
    },
  }),
  defaultOptions: {
    queries: {
      // A 4xx (not allowed, not found, bad request) won't change on a retry;
      // a network blip or a 5xx might, so try those twice more.
      retry: (failureCount, error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      // Data fetched in the last 30s is shown as is when a page is opened
      // again. Saves invalidate what they change, and an open live match
      // polls on its own timer, so neither waits on this.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// A new deploy removed the code chunk this tab asked for: reload once to
// pick up the new build (chunkReload guards against a reload loop).
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForNewBuild()) event.preventDefault();
});

// Crashes nothing else caught go to the organisers' error list.
reportUncaughtErrors();

// The Android app: back button, share sheet and clipboard (app-shell/nativeShell),
// and new deploys without a Play Store release (app-shell/liveUpdate).
if (isNativeApp) {
  void import("./app-shell/nativeShell").then(({ installNativeShell }) => installNativeShell());
  void import("./app-shell/liveUpdate").then(({ setupLiveUpdates }) => setupLiveUpdates());
}

// The service worker makes the app installable and opens it offline. Only
// in a production build: in dev it would cache Vite's modules. Not in the
// Android app, which carries its own copy of every file and gets new deploys
// through live updates instead.
if (import.meta.env.PROD && !isNativeApp) {
  // A tab left open moves to a new deploy without waiting for a reload.
  void import("./app-shell/webUpdate").then(({ setupWebUpdates }) => setupWebUpdates());
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not supported here (e.g. a private window): the app works without it.
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <RouterProvider router={router} />
        <AppToaster />
      </AdminAuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
