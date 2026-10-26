import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type { ApiEnvelope } from "../../types";

// Match notifications (Web Push) for this browser: the server knows the
// account's subscriptions and holds the key; the service worker (public/sw.js)
// shows what's pushed.

interface PushStatus {
  // The account has notifications on somewhere (any device).
  subscribed: boolean;
  // The server's VAPID key; null = notifications aren't set up there.
  publicKey: string | null;
}

// Why the switch can't work here, in words for the profile page; null = it can.
export type PushBlocker = "unsupported" | "no-worker" | "no-key" | "denied" | null;

export const PUSH_BLOCKER_TEXT: Record<Exclude<PushBlocker, null>, string> = {
  unsupported:
    "This browser can't show notifications. On an iPhone, add CricDesk to your Home Screen and open it from there.",
  "no-worker": "Notifications work in the installed app / on the live site.",
  "no-key": "Notifications aren't set up on the server yet.",
  denied:
    "Notifications are blocked for CricDesk. Allow them in your browser's site settings (the icon beside the address) or your phone's app settings, then try again.",
};

// A reason turning them on failed, worded for people (shown as is).
export class PushSetupError extends Error {}

const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// The key comes as URL-safe base64; pushManager wants the raw bytes.
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// The worker main.tsx registers (production builds only). Not there = dev,
// or a browser that refused it. main.tsx registers it once the page has
// loaded, so on a first visit it may still be on its way: a production
// build waits a few seconds for it before giving up.
async function workerRegistration() {
  if (!pushSupported()) return null;
  const now = await navigator.serviceWorker.getRegistration();
  if (now || !import.meta.env.PROD) return now ?? null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
  ]);
}

export function useCricketPush() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["cricket-push"],
    queryFn: async () => (await apiClient.get<ApiEnvelope<PushStatus>>("/admin/cricket/push")).data.data,
  });

  // This browser's own subscription (the switch shows this device, not the account).
  const [worker, setWorker] = useState<"checking" | "ok" | "none">("checking");
  const [subscribedHere, setSubscribedHere] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    pushSupported() ? Notification.permission : null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const registration = await workerRegistration().catch(() => null);
      if (cancelled) return;
      setWorker(registration ? "ok" : "none");
      const subscription = await registration?.pushManager.getSubscription().catch(() => null);
      if (!cancelled) setSubscribedHere(Boolean(subscription));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const blocker: PushBlocker = !pushSupported()
    ? "unsupported"
    : worker === "none"
      ? "no-worker"
      : status.data && !status.data.publicKey
        ? "no-key"
        : permission === "denied"
          ? "denied"
          : null;

  const enable = useMutation({
    meta: { skipGlobalError: true },
    mutationFn: async () => {
      if (!pushSupported()) throw new PushSetupError(PUSH_BLOCKER_TEXT.unsupported);
      // Couldn't ask the server (offline): the caller's generic message.
      if (!status.data) throw new Error("Push status not loaded");
      const publicKey = status.data.publicKey;
      if (!publicKey) throw new PushSetupError(PUSH_BLOCKER_TEXT["no-key"]);
      if (!(await workerRegistration())) throw new PushSetupError(PUSH_BLOCKER_TEXT["no-worker"]);
      const answer = await Notification.requestPermission();
      setPermission(answer);
      if (answer !== "granted") {
        throw new PushSetupError(answer === "denied" ? PUSH_BLOCKER_TEXT.denied : "Allow notifications when asked to turn them on.");
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      // The server also sends a test notification.
      await apiClient.post("/admin/cricket/push", subscription.toJSON());
    },
    onSuccess: () => {
      setSubscribedHere(true);
      queryClient.invalidateQueries({ queryKey: ["cricket-push"] });
    },
  });

  const disable = useMutation({
    meta: { skipGlobalError: true },
    mutationFn: async () => {
      const registration = await workerRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      const { endpoint } = subscription;
      // Stop the browser first: even if the server can't be reached, this
      // device stops getting them (the server drops dead endpoints itself).
      await subscription.unsubscribe();
      await apiClient.delete("/admin/cricket/push", { data: { endpoint } });
    },
    onSettled: () => {
      setSubscribedHere(false);
      queryClient.invalidateQueries({ queryKey: ["cricket-push"] });
    },
  });

  return {
    // On for this browser.
    on: subscribedHere,
    // On for the account on another device only.
    onElsewhere: !subscribedHere && Boolean(status.data?.subscribed),
    blocker,
    ready: worker !== "checking" && !status.isLoading,
    busy: enable.isPending || disable.isPending,
    enable,
    disable,
  };
}
