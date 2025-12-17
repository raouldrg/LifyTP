import axios from "axios";
import { io } from "socket.io-client";

const API_URL = "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

export const socket = io(API_URL);

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

  const { data } = await api.post("/uploads/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
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
