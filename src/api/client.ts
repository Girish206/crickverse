import axios from "axios";
import { API_BASE, noticeLatestBuild, withAbsoluteFileUrls } from "../app-shell/platform";

// Same API as Girish Creations (portfolio-server): cricket endpoints live
// under /api/admin/cricket and sign-in is the shared /api/admin/auth/login.
// (/api on the website; the API's own address in the Android app.)
//
// Every request gives up after a while, so a weak signal at the ground shows
// an error (and a ball waits to be resent) instead of spinning for ever.
// Uploads get longer; the live follow sets its own, past the server's wait.
const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: TIMEOUT_MS,
});

const ADMIN_TOKEN_KEY = "crickverse_token";

// Fired when the API turns the stored session down.
export const SESSION_ENDED = "runmitra:session-ended";

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string | null) {
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData && (config.timeout ?? 0) <= TIMEOUT_MS) {
    config.timeout = UPLOAD_TIMEOUT_MS;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    noticeLatestBuild(response.headers);
    response.data = withAbsoluteFileUrls(response.data);
    return response;
  },
  (error) => {
    noticeLatestBuild(error.response?.headers);
    // A wrong password or code on the sign-in screen isn't a lost session.
    // Otherwise the session has ended (expired, or signed out everywhere):
    // AdminAuthContext signs out in place, and the routes take it from there
    // (a shared match or tournament opens its public page; anything else goes
    // to sign in and comes back afterwards).
    const url: string = error.config?.url ?? "";
    if (error.response?.status === 401 && getAdminToken() && !/\/auth\/(login|otp\/login|password\/reset)$/.test(url)) {
      setAdminToken(null);
      window.dispatchEvent(new Event(SESSION_ENDED));
    }
    return Promise.reject(error);
  },
);
