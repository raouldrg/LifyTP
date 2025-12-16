import { io, Socket } from "socket.io-client";

const SERVER = "http://localhost:3000"; // iOS simulateur OK. Sur téléphone réel: remplace par l'IP de ton ordi (ex: http://192.168.1.23:3000)

export const socket: Socket = io(SERVER, {
  transports: ["websocket"], // indispensable en React Native
});

export function listenRealtime(onNewMessage: (payload: any) => void) {
  socket.off("message:new");
  socket.on("message:new", onNewMessage);
}

export function stopRealtime() {
  socket.off("message:new");
}