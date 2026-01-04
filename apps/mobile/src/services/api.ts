import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "../config/api";
import * as AuthStorage from "./authStorage";
import { SocketManager } from "./SocketManager";

// Store logout handler to be set by AuthProvider
let logoutHandler: (() => void) | null = null;

export const setLogoutHandler = (handler: () => void) => {
  logoutHandler = handler;
};

export const API_URL = API_BASE_URL;

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000, // 10 second timeout
});

// Interface for retry queue items
interface QueueItem {
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}

console.log("[API] Initializing with Base URL:", API_URL);

// Request Interceptor: Logging & Auth
api.interceptors.request.use((config) => {
  const fullUrl = (config.baseURL || "") + (config.url || "");
  const hasAuth = !!config.headers.Authorization;
  console.log(`[API->REQ] ${config.method?.toUpperCase()} ${config.url} baseURL=${config.baseURL} hasAuth=${hasAuth}`);
  return config;
});

// Flag to prevent multiple simultaneous refreshes
let isRefreshing = false;
// Queue of failed requests to retry after refresh
let failedQueue: QueueItem[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add response interceptor for auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // --- LOGGING ---
    const requestUrl = originalRequest?.url || "unknown";
    const baseUrl = originalRequest?.baseURL || API_URL;

    if (error.code === 'ECONNABORTED') {
      console.error(`[API<-TIMEOUT] ${requestUrl} timeout=${originalRequest.timeout}`);
    } else if (error.response) {
      console.error(`[API<-ERR] ${error.response.status} from ${baseUrl}${requestUrl}:`, error.response.data);
    } else if (error.request) {
      console.error(`[API<-NET] Network Error - No response from ${baseUrl}${requestUrl} Code=${error.code}`);
    }

    // --- REFRESH LOGIC ---
    const isAuthRoute = requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/onboarding");

    // Don't refresh if it's an auth route OR if error is specifically "Missing token" (client error)
    if (isAuthRoute || (error.response?.data as any)?.error === "Missing token") {
      return Promise.reject(error);
    }

    // --- THROTTLE NETWORK ERRORS ---
    const now = Date.now();
    // Simple global throttle for network errors (2 seconds)
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      if ((global as any).lastNetworkError && now - (global as any).lastNetworkError < 2000) {
        return Promise.reject({ ...error, isThrottled: true });
      }
      (global as any).lastNetworkError = now;
      console.warn(`[API] Network Guard: Offline or Server Unreachable (${baseUrl})`);
      // We could trigger a global "Offline" banner here if we had a store
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log(`[API] 401 detected on ${requestUrl}, attempting to refresh token...`);

      if (isRefreshing) {
        // ... (queue logic remains same)
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers["Authorization"] = "Bearer " + token;
              resolve(api(originalRequest));
            },
            reject: (err: any) => {
              reject(err);
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // 1. Get Active User ID first to know WHO we are refreshing
        const activeUserId = await AuthStorage.getActiveUserId();

        if (!activeUserId) {
          console.log("[API] No active user specified in storage. Cannot refresh.");
          throw new Error("No active user");
        }

        // 2. Get specific refresh token
        const refreshToken = await AuthStorage.getRefreshTokenForUser(activeUserId);

        if (!refreshToken) {
          console.log(`[API] No refresh token available for user ${activeUserId}. Aborting.`);
          throw new Error("No refresh token available");
        }

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = data;

        // 3. Save NEW tokens for THIS user
        // We need the user object to call saveSessionForUser... 
        // But we might not have it inside interceptor easily. 
        // However, we can update JUST the tokens if we modify AuthStorage, 
        // OR we can fetch the user session first.
        const session = await AuthStorage.restoreSessionForUser(activeUserId);
        if (session) {
          await AuthStorage.saveSessionForUser(activeUserId, accessToken, newRefreshToken, session.user);
        } else {
          // Fallback if session somehow missing but activeUserId exists? 
          // Should not happen, but safeguard:
          throw new Error("Consistency error: Active User ID has no session data");
        }

        // Update default header
        api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

        // Update socket
        SocketManager.getInstance().updateToken(accessToken);

        console.log(`[API] Token refreshed successfully for user ${activeUserId}`);
        processQueue(null, accessToken);

        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        console.error("[API] Refresh failed:", refreshError);
        processQueue(refreshError, null);

        // Trigger Logout if refresh fails
        // AuthProvider will pick this up to clear session for active user
        if (logoutHandler) logoutHandler();

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  // If it's a relative path starting with /, prepend API_URL
  if (url.startsWith("/")) return `${API_URL}${url}`;
  return url;
}

// Auth
export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  // Set token logic here or in caller
  if (data.accessToken) {
    api.defaults.headers.common["Authorization"] = `Bearer ${data.accessToken}`;
  }
  return data;
}

export async function register(email: string, password: string) {
  const { data } = await api.post("/auth/register", { email, password });
  if (data.accessToken) {
    api.defaults.headers.common["Authorization"] = `Bearer ${data.accessToken}`;
  }
  return data;
}

export async function checkUsername(username: string) {
  const { data } = await api.get(`/auth/check-username?username=${username}`);
  return data; // { available: boolean }
}

export async function setPseudo(username: string) {
  const { data } = await api.post("/auth/onboarding/pseudo", { username });
  return data;
}

export async function updateProfile(bio?: string, avatarUrl?: string) {
  const { data } = await api.post("/auth/onboarding/update", { bio, avatarUrl });
  return data;
}

export async function uploadAvatar(fileUri: string) {
  const formData = new FormData();
  // React Native FormData expects an object with uri, name, type for files
  formData.append("file", {
    uri: fileUri,
    name: "avatar.jpg",
    type: "image/jpeg",
  } as any);

  const { data } = await api.post("/upload", formData, {
    headers: {
      "Accept": "application/json",
    },
    transformRequest: (data, headers) => {
      return data;
    },
  });
  return data;
}

export async function uploadFile(fileUri: string, mimeType: string = "image/jpeg") {
  const formData = new FormData();
  const ext = mimeType.split("/")[1] || "bin";
  const filename = `upload_${Date.now()}.${ext}`;

  formData.append("file", {
    uri: fileUri,
    name: filename,
    type: mimeType,
  } as any);

  const { data } = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data; // { url: string, ... }
}

// Deprecated or Dev
export async function mockLogin(email: string) {
  const { data } = await api.post("/dev/mock-login", { email });
  if (data.accessToken) {
    api.defaults.headers.common["Authorization"] = `Bearer ${data.accessToken}`;
  }
  return data;
}

export async function getMe() {
  const { data } = await api.get("/me");
  return data.user;
}