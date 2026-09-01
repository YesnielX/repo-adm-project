/**
 * Registro y gestión de salas en memoria.
 *
 * Mantiene el almacén principal de salas activas (`rooms`), la tabla de mapeo
 * rápido `socket.id` -> `roomCode` (`roomBySocket`), y funciones utilitarias
 * para generación de códigos aleatorios únicos y limpieza de temporizadores.
 */
import type { Room } from "../types.ts";
import type { Socket } from "socket.io";

/** Almacén central de salas activas indexadas por su código de 4 dígitos */
const rooms = new Map<string, Room>();

/** Índice bidireccional que asocia el ID de conexión del socket con el código de sala */
const roomBySocket = new Map<string, string>();

/**
 * Genera un código de sala numérico aleatorio de 4 dígitos (1000 - 9999).
 * Garantiza que no colisione con ninguna sala activa en memoria.
 *
 * @returns Código de sala único de 4 dígitos como string.
 */
function generateRoomCode(): string {
  let code: string;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(code));
  return code;
}

/**
 * Obtiene la sala asociada a un socket específico mediante el índice `roomBySocket`.
 *
 * @param socket Instancia del socket del cliente.
 * @returns La sala encontrada o undefined si el socket no pertenece a ninguna sala.
 */
function roomOfSocket(socket: Socket): Room | undefined {
  const code = roomBySocket.get(socket.id);
  return code ? rooms.get(code) : undefined;
}

/**
 * Detiene y limpia el temporizador de fase activo de una sala para evitar fugas de memoria o ejecuciones duplicadas.
 *
 * @param room Objeto de la sala a la que se le cancelará el intervalo.
 */
function clearRoomTimer(room: Room): void {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = null;
}

export { rooms, roomBySocket, generateRoomCode, roomOfSocket, clearRoomTimer };

