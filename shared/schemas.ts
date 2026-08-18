/**
 * Contratos compartidos (zod) entre cliente y servidor.
 *
 * Este archivo es la ÚNICA fuente de verdad para los payloads que viajan de
 * cliente -> servidor. Tanto el servidor (validación en handlers.ts) como el
 * cliente (tipos de emisión en SocketContext.tsx) importan desde aquí para no
 * duplicar definiciones.
 */
import { z } from "zod";

export const joinRoomSchema = z.object({
  // Valida que roomCode no sea solo espacios SIN transformar el valor: se usa
  // el string original para rooms.get() (espacios alrededor no matchean sala).
  roomCode: z.string().refine((s) => s.trim().length >= 1),
  name: z.string().optional(),
  avatar: z.string().optional(),
  color: z.string().optional(),
  token: z.string().optional(),
});

export const submitHintSchema = z.object({
  // El servidor trunca la pista a 50 caracteres; no se rechazan las largas.
  hint: z.string().min(1),
});

export const submitVoteSchema = z.object({
  targetId: z.string().min(1),
});

export const submitImpostorGuessSchema = z.object({
  guessedWord: z.string().min(1),
});

export const addBotsSchema = z.object({
  count: z.number().int().min(1).max(100),
});

export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type SubmitHintPayload = z.infer<typeof submitHintSchema>;
export type SubmitVotePayload = z.infer<typeof submitVoteSchema>;
export type SubmitImpostorGuessPayload = z.infer<
  typeof submitImpostorGuessSchema
>;
export type AddBotsPayload = z.infer<typeof addBotsSchema>;

export type Role = "CREWMATE" | "IMPOSTOR";

/** Payload privado servidor -> cliente: rol y, para tripulantes, la palabra. */
export interface YourRolePayload {
  role: Role;
  category: string;
  /** Solo para tripulantes; el impostor recibe null. */
  word: string | null;
}

/** Opciones de la última oportunidad, re-emitidas al reconectar. */
export interface GuessWordOptionsPayload {
  options: string[];
}
