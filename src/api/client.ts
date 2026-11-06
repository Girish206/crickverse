import axios from "axios";
import { API_BASE, withAbsoluteFileUrls } from "../app-shell/platform";

// Same API as Girish Creations (portfolio-server): cricket endpoints live
// under /api/admin/cricket and sign-in is the shared /api/admin/auth/login.
// (/api on the website; the API's own address in the Android app.)
export const apiClient = axios.create({
  baseURL: API_BASE,
});

const ADMIN_TOKEN_KEY = "crickverse_token";

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
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    response.data = withAbsoluteFileUrls(response.data);
    return response;
  },
  (error) => {
    // A wrong password on the sign-in screen isn't a lost session.
    if (error.response?.status === 401 && !error.config?.url?.endsWith("/auth/login")) {
      setAdminToken(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
