import axios from "axios";

const API_URL = "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

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
