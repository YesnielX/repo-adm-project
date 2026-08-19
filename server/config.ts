/**
 * Constantes del servidor de CodeImpostor: puerto, límites de la partida,
 * nombres/colores de los bots y duración de cada fase.
 */

export const PORT = Number(process.env.PORT ?? 3001);
export const MAX_ROUNDS = 5;

// Nombres temáticos para los primeros bots; después se numeran.
export const THEMED_BOT_NAMES = ["Bot Turing", "Bot Ada", "Bot Grace"];
export const BOT_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#22c55e",
];

// Segundos de cada fase; los usa el anillo de progreso del cliente.
// Las claves coinciden con los nombres de status del juego (GameStatus).
export const PHASE_SECONDS = {
  ROLE_REVEAL: 6,
  HINT_PHASE: 30,
  SHOWCASE: 35,
  VOTING: 20,
  EJECTION: 8,
  GUESS_PHASE: 15,
} as const;

// Gracia de reconexión: 45s para volver con el token antes de retirarlo.
export const DISCONNECT_GRACE_MS = 45000;
