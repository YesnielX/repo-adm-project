/**
 * Contratos de datos compartidos (Zod Schemas y Tipos) entre Cliente y Servidor.
 *
 * Este archivo constituye la ÚNICA fuente de verdad para los payloads transmitidos
 * en ambas direcciones a través de Socket.IO.
 *
 * - En el servidor: Valida de manera estricta y segura los datos entrantes en `server/socket/handlers.ts`.
 * - En el frontend: Provee tipado estático riguroso en `src/context/SocketContext.tsx`.
 */
import { z } from "zod";

/**
 * Esquema de validación para unirse o reconectarse a una sala.
 *
 * Valida:
 * - `roomCode`: Código no vacío (se preserva la cadena original sin mutar).
 * - `name`: Nombre visible elegido por el jugador (opcional).
 * - `avatar`: Identificador de avatar seleccionado (opcional).
 * - `color`: Código de color hexadecimal (opcional).
 * - `token`: UUID de sesión persistente para reconexiones (opcional).
 */
export const joinRoomSchema = z.object({
  roomCode: z.string().refine((s) => s.trim().length >= 1),
  name: z.string().optional(),
  avatar: z.string().optional(),
  color: z.string().optional(),
  token: z.string().optional(),
});

/**
 * Esquema de validación para el envío de una pista en `HINT_PHASE`.
 * Requiere que la pista contenga al menos 1 caracter. El servidor trunca a un máximo de 50.
 */
export const submitHintSchema = z.object({
  hint: z.string().min(1),
});

/**
 * Esquema de validación para la emisión de un voto en `VOTING`.
 * Requiere el ID del socket del jugador objetivo o la cadena 'SKIP'.
 */
export const submitVoteSchema = z.object({
  targetId: z.string().min(1),
});

/**
 * Esquema de validación para la adivinanza de palabra en `GUESS_PHASE` por el Impostor.
 */
export const submitImpostorGuessSchema = z.object({
  guessedWord: z.string().min(1),
});

/**
 * Esquema de validación para la adición de bots de prueba por parte del Host.
 * Permite entre 1 y 100 bots como valor entero.
 */
export const addBotsSchema = z.object({
  count: z.number().int().min(1).max(100),
});

/** Tipo inferido del esquema de unirse a sala */
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;

/** Tipo inferido del esquema de envío de pista */
export type SubmitHintPayload = z.infer<typeof submitHintSchema>;

/** Tipo inferido del esquema de envío de voto */
export type SubmitVotePayload = z.infer<typeof submitVoteSchema>;

/** Tipo inferido del esquema de adivinanza de impostor */
export type SubmitImpostorGuessPayload = z.infer<
  typeof submitImpostorGuessSchema
>;

/** Tipo inferido del esquema de adición de bots */
export type AddBotsPayload = z.infer<typeof addBotsSchema>;

/** Roles de jugador disponibles en el juego */
export type Role = "CREWMATE" | "IMPOSTOR";

/** Payload privado emitido por el servidor al jugador con su rol y palabra (si aplica) */
export interface YourRolePayload {
  role: Role;
  category: string;
  /** Palabra secreta asignada (solo disponible para tripulantes; null para el impostor) */
  word: string | null;
}

/** Payload privado con las opciones de palabras presentadas al impostor en su última oportunidad */
export interface GuessWordOptionsPayload {
  options: string[];
}

