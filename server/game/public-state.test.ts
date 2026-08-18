/**
 * Prueba de la frontera de seguridad de getSanitizedRoomState: la palabra
 * secreta no se filtra antes de GAME_OVER y las pistas no se filtran antes
 * de SHOWCASE. El rol y la palabra reales viajan solo por eventos privados.
 */
import { describe, expect, it } from "vitest";
import { getSanitizedRoomState } from "./public-state.ts";
import type { Player, Room, GameStatus } from "../types.ts";

/** Jugador de prueba con valores por defecto para simplificar la sala fake. */
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    token: "token-p1",
    name: "Tripulante",
    avatar: "Bot",
    color: "#3b82f6",
    isHost: false,
    isBot: false,
    connected: true,
    eliminated: false,
    role: "CREWMATE",
    hint: null,
    vote: null,
    score: 0,
    disconnectTimer: null,
    ...overrides,
  };
}

/** Sala mínima con un CREWMATE con pista, un IMPOSTOR y la palabra secreta. */
function makeRoom(status: GameStatus): Room {
  return {
    roomCode: "1234",
    hostId: "host",
    status,
    players: [
      makePlayer({
        id: "crew",
        name: "Tripulante",
        role: "CREWMATE",
        hint: "se hace un commit",
      }),
      makePlayer({
        id: "imp",
        name: "Impostor",
        role: "IMPOSTOR",
        hint: "pista falsa del impostor",
      }),
    ],
    secretWord: { category: "Desarrollo & Git", word: "commit" },
    impostorId: "imp",
    guessOptions: null,
    timer: 0,
    timerInterval: null,
    ejectedPlayer: null,
    winner: null,
    impostorGuessedCorrectly: null,
    voteCounts: null,
    round: 1,
    maxRounds: 5,
  };
}

describe("getSanitizedRoomState", () => {
  it("no filtra la palabra secreta ni las pistas durante HINT_PHASE", () => {
    const state = getSanitizedRoomState(makeRoom("HINT_PHASE"));

    expect(state.secretWord).toBeNull();
    expect(state.category).toBe("Desarrollo & Git");
    for (const player of state.players) {
      expect(player.hint).toBeNull();
    }
  });

  it("muestra las pistas en SHOWCASE pero la palabra sigue oculta", () => {
    const state = getSanitizedRoomState(makeRoom("SHOWCASE"));

    expect(state.secretWord).toBeNull();
    expect(state.players[0].hint).toBe("se hace un commit");
    expect(state.players[1].hint).toBe("pista falsa del impostor");
  });

  it("revela la palabra secreta solo en GAME_OVER", () => {
    const state = getSanitizedRoomState(makeRoom("GAME_OVER"));

    expect(state.secretWord).toBe("commit");
  });
});
