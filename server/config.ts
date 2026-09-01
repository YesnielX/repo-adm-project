/**
 * Constantes y configuración global del servidor de CodeImpostor.
 *
 * Define el puerto de escucha, límites de rondas, nombres y paleta de colores
 * para bots, la duración en segundos de cada fase de juego y tiempos de gracia.
 */

/** Puerto de red en el que escuchará el servidor HTTP/Socket.IO */
export const PORT = Number(process.env.PORT ?? 3001);

/** Número máximo de rondas permitidas por partida antes de declarar victoria del impostor */
export const MAX_ROUNDS = 5;

/** Nombres temáticos inspirados en pioneros de la computación para los primeros bots creados */
export const THEMED_BOT_NAMES = ["Bot Turing", "Bot Ada", "Bot Grace"];

/** Paleta de colores HEX asignados de forma rotativa a los jugadores bot */
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

/**
 * Duración en segundos de cada fase del juego.
 *
 * Estas claves coinciden exactamente con los estados de `GameStatus` y son
 * sincronizadas hacia los clientes para controlar los temporizadores visuales y anillos de progreso.
 */
export const PHASE_SECONDS = {
  /** Fase inicial donde se asigna y revela el rol a cada jugador de forma privada */
  ROLE_REVEAL: 6,
  /** Fase de redacción donde los tripulantes y el impostor envían su pista de texto */
  HINT_PHASE: 30,
  /** Fase de debate donde se muestran públicamente todas las pistas */
  SHOWCASE: 35,
  /** Fase donde los jugadores activos emiten su voto o eligen saltar (SKIP) */
  VOTING: 20,
  /** Animación de resultados y expulsión del jugador más votado */
  EJECTION: 8,
  /** Última oportunidad del impostor expulsado para adivinar la palabra secreta */
  GUESS_PHASE: 15,
} as const;

/**
 * Tiempo de gracia para reconexión (en milisegundos).
 * Si un jugador se desconecta (ej. recarga de página o fallo de red), se le otorgan 45 segundos
 * para reconectarse usando su `token` persistente antes de ser removido definitivamente de la sala.
 */
export const DISCONNECT_GRACE_MS = 45000;

