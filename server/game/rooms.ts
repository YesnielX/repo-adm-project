/**
 * Registro de salas en memoria: el Map de salas activas, el índice de
 * socket.id -> roomCode y las utilidades de código y timer de sala.
 */
import type { Room } from "../types.ts";
import type { Socket } from "socket.io";

const rooms = new Map<string, Room>();
// socket.id -> roomCode; se limpia al desconectar.
const roomBySocket = new Map<string, string>();

function generateRoomCode(): string {
  let code: string;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(code));
  return code;
}

function roomOfSocket(socket: Socket): Room | undefined {
  const code = roomBySocket.get(socket.id);
  return code ? rooms.get(code) : undefined;
}

function clearRoomTimer(room: Room): void {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = null;
}

export { rooms, roomBySocket, generateRoomCode, roomOfSocket, clearRoomTimer };
