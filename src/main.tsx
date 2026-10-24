import "./styles/brand.css";
import "./styles/crickverse.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { showMutationError } from "./api/mutationErrors";
import { AppToaster } from "./admin/components/AppToaster";
import SplashScreen from "./admin/components/SplashScreen";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    // A mutation that renders its own error UI opts out via
    // meta: { skipGlobalError: true }.
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.meta?.skipGlobalError) void showMutationError(error);
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <RouterProvider router={router} />
        <AppToaster />
        <SplashScreen />
      </AdminAuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
