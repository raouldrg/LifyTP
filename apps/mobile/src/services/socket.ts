import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "../config/api";

// Use centralized API URL config
const SERVER = API_BASE_URL;

export const socket: Socket = io(SERVER, {
  transports: ["websocket"], // indispensable en React Native
  autoConnect: false,
});

export function listenRealtime(onNewMessage: (payload: any) => void) {
  socket.off("message:new");
  socket.on("message:new", onNewMessage);
}

export function stopRealtime() {
  socket.off("message:new");
}