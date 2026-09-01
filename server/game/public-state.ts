/**
 * Transformación y sanitización del estado público de la sala.
 *
 * Actúa como una barrera de seguridad crucial:
 * - Evita la filtración de la palabra secreta a clientes (incluso inspeccionando el tráfico de red) antes de `GAME_OVER`.
 * - Oculta las pistas de los jugadores durante la fase de redacción (`HINT_PHASE`) para evitar que se copien, exponiéndolas a partir de `SHOWCASE`.
 * - Excluye tokens privados y roles confidenciales del broadcast público.
 */
import type { Room, PublicRoomState } from "../types.ts";
import { PHASE_SECONDS } from "../config.ts";

/**
 * Genera una versión sanitizada y segura del estado de la sala (`PublicRoomState`) apta para ser enviada por broadcast.
 *
 * Reglas de visibilidad:
 * 1. **Pistas (`hint`)**: Se mantienen ocultas (null) durante `LOBBY`, `ROLE_REVEAL` y `HINT_PHASE`. Se hacen públicas únicamente a partir de `SHOWCASE` y fases subsiguientes.
 * 2. **Palabra secreta (`secretWord`)**: Se mantiene oculta (null) durante toda la partida y solo se expone públicamente cuando la partida culmina en `GAME_OVER`.
 * 3. **Categoría (`category`)**: Siempre visible para dar contexto a todos los jugadores.
 * 4. **Tokens y roles individuales**: No se incluyen en esta estructura (viajan por socket privado).
 *
 * @param room Estado interno de la sala en memoria.
 * @returns Objeto con el estado público sanitizado.
 */
export function getSanitizedRoomState(room: Room): PublicRoomState {
  const hintsVisible =
    room.status === "SHOWCASE" ||
    room.status === "VOTING" ||
    room.status === "EJECTION" ||
    room.status === "GUESS_PHASE" ||
    room.status === "GAME_OVER";

  return {
    roomCode: room.roomCode,
    status: room.status,
    hostId: room.hostId,
    round: room.round,
    maxRounds: room.maxRounds,
    category: room.secretWord ? room.secretWord.category : null,
    secretWord:
      room.status === "GAME_OVER" ? (room.secretWord?.word ?? null) : null,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isHost: p.isHost,
      isBot: p.isBot || false,
      connected: p.connected !== false,
      eliminated: p.eliminated === true,
      hasSubmittedHint: !!p.hint,
      hint: hintsVisible ? p.hint : null,
      hasVoted: !!p.vote,
      score: p.score,
    })),
    timer: room.timer,
    phaseSeconds: { ...PHASE_SECONDS },
    ejectedPlayer: room.ejectedPlayer,
    winner: room.winner,
    impostorGuessedCorrectly: room.impostorGuessedCorrectly,
    voteCounts: room.voteCounts,
  };
}

