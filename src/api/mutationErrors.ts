import { isAxiosError } from "axios";
import { toast } from "sonner";

// The API's error envelope is { error: { message, code } } (see the server's
// errorHandler) — prefer its message, e.g. "This record is still in use by
// other records and can't be deleted", over a generic one.
export function messageFor(error: unknown): string {
  if (isAxiosError(error)) {
    const apiMessage = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (apiMessage) return apiMessage;
    if (!error.response) return "Couldn't reach the server — check your connection and try again.";
  }
  return "Something went wrong — please try again.";
}

// Shown for every failed create/update/delete (wired up once in main.tsx via
// the QueryClient's MutationCache), so no admin screen fails silently.
export function showMutationError(error: unknown) {
  // 401s already redirect to the login page (see api/client.ts).
  if (isAxiosError(error) && error.response?.status === 401) return;
  toast.error(messageFor(error), { duration: 5000 });
}
