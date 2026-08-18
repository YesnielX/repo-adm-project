/**
 * Pruebas de la máquina de fases (server/game/phases.ts) con timers falsos.
 *
 * Verifica las transiciones entre fases y los caminos de victoria. El Server
 * de socket.io no necesita estar escuchando: io.to(...).emit() sobre una sala
 * vacía es un no-op. Como el intervalo de expulsión aborta si la sala no está
 * en el registro, cada prueba inserta su sala en el Map `rooms` y afterEach lo
 * limpia.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE_SECONDS, MAX_ROUNDS } from "../config.ts";
import { rooms } from "./rooms.ts";
import { io } from "../core/io.ts";
import type { Player, Room } from "../types.ts";
import type { YourRolePayload } from "../../shared/schemas.ts";
import {
  beginRoleReveal,
  startHintPhase,
  startShowcasePhase,
  startVotingPhase,
  processVotingResults,
  startGuessPhase,
  finishGuess,
  awardRoundBonus,
  startNextRound,
  emitRoles,
} from "./phases.ts";

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

/** Sala mínima con 2 CREWMATE + 1 IMPOSTOR y la palabra secreta. */
function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    roomCode: "1234",
    hostId: "host",
    status: "ROLE_REVEAL",
    players: [
      makePlayer({ id: "crew1", name: "Ana" }),
      makePlayer({ id: "crew2", name: "Bruno" }),
      makePlayer({ id: "imp", name: "Caro", role: "IMPOSTOR" }),
    ],
    secretWord: { category: "Metodologías Ágiles", word: "Scrum" },
    impostorId: "imp",
    guessOptions: null,
    timer: 0,
    timerInterval: null,
    ejectedPlayer: null,
    winner: null,
    impostorGuessedCorrectly: null,
    voteCounts: null,
    round: 1,
    maxRounds: MAX_ROUNDS,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  rooms.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("fase de pistas -> showcase", () => {
  it("startHintPhase fija HINT_PHASE con el timer completo y pasa a SHOWCASE", () => {
    const room = makeRoom();
    rooms.set(room.roomCode, room);

    startHintPhase(room);

    expect(room.status).toBe("HINT_PHASE");
    expect(room.timer).toBe(PHASE_SECONDS.HINT);

    // Ningún bot y humanos con hint null: el timer debe agotarse por completo.
    vi.advanceTimersByTime(PHASE_SECONDS.HINT * 1000);
    expect(room.status).toBe("SHOWCASE");
  });

  it("startShowcasePhase pasa a VOTING al agotarse el timer", () => {
    const room = makeRoom();
    rooms.set(room.roomCode, room);

    startShowcasePhase(room);

    expect(room.status).toBe("SHOWCASE");
    expect(room.timer).toBe(PHASE_SECONDS.SHOWCASE);

    vi.advanceTimersByTime(PHASE_SECONDS.SHOWCASE * 1000);
    expect(room.status).toBe("VOTING");
  });
});

describe("fase de votación -> expulsión", () => {
  it("startVotingPhase pasa a EJECTION cuando todos votan antes del timer", () => {
    const room = makeRoom();
    rooms.set(room.roomCode, room);

    startVotingPhase(room);
    expect(room.status).toBe("VOTING");

    // Todos los humanos votan (nadie eliminado); sin bots no hay votos extra.
    for (const p of room.players) {
      p.vote = "SKIP";
    }

    vi.advanceTimersByTime(1000);
    expect(room.status).toBe("EJECTION");
  });

  it("processVotingResults expulsa al impostor (2 votos) y pasa a GUESS_PHASE", () => {
    const room = makeRoom();
    rooms.set(room.roomCode, room);

    room.players[0].vote = "imp";
    room.players[1].vote = "imp";
    room.players[2].vote = "SKIP";

    processVotingResults(room);

    expect(room.status).toBe("EJECTION");
    expect(room.ejectedPlayer?.id).toBe("imp");
    expect(room.ejectedPlayer?.role).toBe("IMPOSTOR");

    // La escena de votos dura EJECTION segundos; al llegar a cero y ser el
    // impostor el expulsado, arranca la última oportunidad.
    vi.advanceTimersByTime(PHASE_SECONDS.EJECTION * 1000);
    expect(room.status).toBe("GUESS_PHASE");
  });
});

describe("adivinanza del impostor", () => {
  it("emitRoles envía your_role con la palabra a tripulantes y null al impostor", () => {
    const room = makeRoom();
    const payloads: Array<{ id: string; payload: YourRolePayload }> = [];
    vi.spyOn(io, "to").mockImplementation(((target: string) => ({
      emit: (_event: string, payload: unknown) => {
        payloads.push({ id: target, payload: payload as YourRolePayload });
      },
    })) as unknown as typeof io.to);

    emitRoles(room);

    expect(payloads).toHaveLength(3);
    const crew = payloads.find((p) => p.id === "crew1")!;
    const impostor = payloads.find((p) => p.id === "imp")!;
    expect(crew.payload.role).toBe("CREWMATE");
    expect(crew.payload.word).toBe("Scrum");
    expect(impostor.payload.role).toBe("IMPOSTOR");
    expect(impostor.payload.word).toBeNull();
  });

  it("startGuessPhase se puede re-emitir y la partida termina por timer", () => {
    const room = makeRoom();
    rooms.set(room.roomCode, room);

    startGuessPhase(room);
    expect(room.status).toBe("GUESS_PHASE");
    expect(room.guessOptions).toHaveLength(4);
    expect(room.guessOptions).toContain("Scrum");

    // Sin respuesta humana, el timer agota y ganan los tripulantes.
    vi.advanceTimersByTime(PHASE_SECONDS.GUESS * 1000);
    expect(room.status).toBe("GAME_OVER");
    expect(room.winner).toBe("CREWMATES");
  });

  it("finishGuess con acierto -> GAME_OVER, victoria IMPOSTOR y +150", () => {
    const room = makeRoom({ status: "GUESS_PHASE" });
    rooms.set(room.roomCode, room);
    const impostor = room.players.find((p) => p.id === "imp")!;

    finishGuess(room, true);

    expect(room.status).toBe("GAME_OVER");
    expect(room.winner).toBe("IMPOSTOR");
    expect(room.impostorGuessedCorrectly).toBe(true);
    expect(impostor.score).toBe(150);
  });
});

describe("siguiente ronda y victorias por supervivencia", () => {
  it("awardRoundBonus reparte +10 a cada tripulante vivo", () => {
    const room = makeRoom();
    rooms.set(room.roomCode, room);

    awardRoundBonus(room);

    expect(room.players[0].score).toBe(10);
    expect(room.players[1].score).toBe(10);
    expect(room.players[2].score).toBe(0);
  });

  it("startNextRound al pasar la ronda MAX_ROUNDS: el impostor gana por supervivencia", () => {
    const room = makeRoom({ round: MAX_ROUNDS });
    rooms.set(room.roomCode, room);
    const impostor = room.players.find((p) => p.id === "imp")!;

    startNextRound(room);

    expect(room.round).toBe(MAX_ROUNDS + 1);
    expect(room.status).toBe("GAME_OVER");
    expect(room.winner).toBe("IMPOSTOR");
    expect(room.impostorGuessedCorrectly).toBe(false);
    expect(impostor.score).toBe(100);
  });

  it("startNextRound dentro del límite: ronda 2 con pistas/votos limpios", () => {
    const room = makeRoom({
      status: "SHOWCASE",
      players: [
        makePlayer({ id: "crew1", name: "Ana", hint: "pista", vote: "imp" }),
        makePlayer({ id: "crew2", name: "Bruno", hint: "pista", vote: "imp" }),
        makePlayer({
          id: "imp",
          name: "Caro",
          role: "IMPOSTOR",
          hint: "pista",
          vote: "crew1",
        }),
      ],
    });
    rooms.set(room.roomCode, room);

    startNextRound(room);

    expect(room.round).toBe(2);
    expect(room.status).toBe("ROLE_REVEAL");
    for (const p of room.players) {
      expect(p.hint).toBeNull();
      expect(p.vote).toBeNull();
    }
  });

  it("beginRoleReveal arranca en ROLE_REVEAL y avanza a HINT_PHASE", () => {
    const room = makeRoom();
    rooms.set(room.roomCode, room);

    beginRoleReveal(room);

    expect(room.status).toBe("ROLE_REVEAL");
    expect(room.timer).toBe(PHASE_SECONDS.ROLE_REVEAL);

    vi.advanceTimersByTime(PHASE_SECONDS.ROLE_REVEAL * 1000);
    expect(room.status).toBe("HINT_PHASE");
  });
});
