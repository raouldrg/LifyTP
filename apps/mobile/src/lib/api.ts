import axios from "axios";

const API_URL = "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

export async function mockLogin(email: string) {
  const res = await api.post("/dev/mock-login", { email });
  return res.data;
}

export async function getMe(token: string) {
  const res = await api.get("/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
