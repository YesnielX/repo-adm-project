/**
 * Estado público sanitizado de una sala: lo único que ve el cliente en los
 * broadcasts. Los secretos del juego nunca salen por aquí.
 */
import type { Room, PublicRoomState } from "../types.ts";

/**
 * Estado público de la sala. Los secretos del juego nunca salen por aquí:
 * la palabra solo se revela en GAME_OVER, las pistas desde SHOWCASE, y el
 * rol/token viajan únicamente por eventos privados dirigidos por socket.id.
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
    ejectedPlayer: room.ejectedPlayer,
    winner: room.winner,
    impostorGuessedCorrectly: room.impostorGuessedCorrectly,
    voteCounts: room.voteCounts,
  };
}
