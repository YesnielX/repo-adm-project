/**
 * Máquina de fases del juego: revelar roles, pistas, showcase, votación,
 * expulsión y la adivinanza final del impostor. Cada fase maneja su timer
 * y delega las acciones automáticas de los bots a bots.ts.
 */
import { io } from "../core/io.ts";
import { getRandomWord, WORD_BANK } from "../data/words.ts";
import { clearRoomTimer, rooms } from "./rooms.ts";
import { getSanitizedRoomState } from "./public-state.ts";
import { PHASE_SECONDS, MAX_ROUNDS } from "../config.ts";
import { scheduleBotHints, scheduleBotVotes, scheduleBotGuess } from "./bots.ts";
import type { Room } from "../types.ts";

function emitRoles(room: Room): void {
  const secretWord = room.secretWord;
  if (!secretWord) return;
  for (const p of room.players) {
    if (p.isBot || p.eliminated) continue;
    io.to(p.id).emit("your_role", {
      role: p.role,
      category: secretWord.category,
      word: p.role === "CREWMATE" ? secretWord.word : null,
    });
  }
}

function beginRoleReveal(room: Room): void {
  room.status = "ROLE_REVEAL";
  room.timer = PHASE_SECONDS.ROLE_REVEAL;

  emitRoles(room);
  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(room.roomCode).emit("timer_tick", room.timer);
    if (room.timer <= 0) {
      clearRoomTimer(room);
      startHintPhase(room);
    }
  }, 1000);
}

/** +10 por ronda para cada crewmate que sigue vivo. */
function awardRoundBonus(room: Room): void {
  for (const p of room.players) {
    if (p.role === "CREWMATE" && !p.eliminated) p.score += 10;
  }
}

/**
 * Siguiente ronda: palabra nueva, pistas/votos en cero y roles de nuevo.
 * Pasadas las 5 rondas, el impostor gana por supervivencia.
 */
function startNextRound(room: Room): void {
  awardRoundBonus(room);
  room.round += 1;

  if (room.round > MAX_ROUNDS) {
    room.winner = "IMPOSTOR";
    room.impostorGuessedCorrectly = false;
    room.status = "GAME_OVER";
    const impostor = room.players.find((p) => p.id === room.impostorId);
    if (impostor) impostor.score += 100;
    io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));
    return;
  }

  room.secretWord = getRandomWord();
  room.guessOptions = null;
  room.voteCounts = null;
  for (const p of room.players) {
    p.hint = null;
    p.vote = null;
  }

  beginRoleReveal(room);
}

function startHintPhase(room: Room): void {
  room.status = "HINT_PHASE";
  room.timer = PHASE_SECONDS.HINT;
  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

  // Los bots escriben su pista con un retraso aleatorio (los eliminados no).
  scheduleBotHints(room);

  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(room.roomCode).emit("timer_tick", room.timer);

    const everyoneSubmitted = room.players
      .filter((p) => !p.eliminated)
      .every((p) => p.hint !== null);
    if (room.timer <= 0 || everyoneSubmitted) {
      clearRoomTimer(room);
      startShowcasePhase(room);
    }
  }, 1000);
}

function startShowcasePhase(room: Room): void {
  room.status = "SHOWCASE";
  room.timer = PHASE_SECONDS.SHOWCASE;
  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(room.roomCode).emit("timer_tick", room.timer);
    if (room.timer <= 0) {
      clearRoomTimer(room);
      startVotingPhase(room);
    }
  }, 1000);
}

function startVotingPhase(room: Room): void {
  room.status = "VOTING";
  room.timer = PHASE_SECONDS.VOTING;
  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

  // Los bots votan a un objetivo aleatorio entre los jugadores vivos.
  scheduleBotVotes(room);

  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(room.roomCode).emit("timer_tick", room.timer);

    const everyoneVoted = room.players
      .filter((p) => !p.eliminated)
      .every((p) => p.vote !== null);
    if (room.timer <= 0 || everyoneVoted) {
      clearRoomTimer(room);
      processVotingResults(room);
    }
  }, 1000);
}

/**
 * Tras la animación de expulsión:
 * - Impostor expulsado -> adivinanza (puede robar la victoria).
 * - Tripulante expulsado -> espectador; con ≤1 tripulante vivo gana el
 *   impostor, si no pasa a la siguiente ronda.
 * - Empate -> nadie sale, siguiente ronda.
 */
function processVotingResults(room: Room): void {
  room.status = "EJECTION";

  const voteCounts: Record<string, number> = {};
  for (const p of room.players) {
    if (!p.eliminated && p.vote && p.vote !== "SKIP") {
      voteCounts[p.vote] = (voteCounts[p.vote] ?? 0) + 1;
    }
  }

  let maxVotes = 0;
  let ejectedId: string | null = null;
  let isTie = false;
  for (const [playerId, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      ejectedId = playerId;
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  }

  const ejectedPlayer = isTie
    ? null
    : room.players.find((p) => p.id === ejectedId);
  room.ejectedPlayer =
    ejectedPlayer && ejectedPlayer.role
      ? {
          id: ejectedPlayer.id,
          name: ejectedPlayer.name,
          avatar: ejectedPlayer.avatar,
          role: ejectedPlayer.role,
        }
      : null;

  room.voteCounts = voteCounts;
  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

  // La escena de votos dura unos segundos con cuenta regresiva; al llegar a
  // cero se resuelve quién sale (o si hubo empate).
  room.timer = PHASE_SECONDS.EJECTION;
  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(room.roomCode).emit("timer_tick", room.timer);

    if (room.timer > 0) return;
    clearRoomTimer(room);
    if (!rooms.has(room.roomCode)) return;

    if (room.ejectedPlayer && room.ejectedPlayer.id === room.impostorId) {
      startGuessPhase(room);
      return;
    }

    if (room.ejectedPlayer) {
      const expelled = room.players.find(
        (p) => p.id === room.ejectedPlayer!.id,
      );
      if (expelled) {
        expelled.eliminated = true;
        expelled.hint = null;
        expelled.vote = null;
      }

      const aliveCrewmates = room.players.filter(
        (p) => p.role === "CREWMATE" && !p.eliminated,
      ).length;
      if (aliveCrewmates <= 1) {
        room.winner = "IMPOSTOR";
        room.impostorGuessedCorrectly = false;
        room.status = "GAME_OVER";
        const impostor = room.players.find((p) => p.id === room.impostorId);
        if (impostor) impostor.score += 100;
        io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));
      } else {
        startNextRound(room);
      }
      return;
    }

    // Empate
    startNextRound(room);
  }, 1000);
}

/** Última oportunidad del impostor: adivinar la palabra entre 4 opciones. */
function startGuessPhase(room: Room): void {
  const secretWord = room.secretWord;
  if (!secretWord) return;

  // Bonus de supervivencia de la ronda en la que fue descubierto.
  awardRoundBonus(room);
  room.status = "GUESS_PHASE";
  room.timer = PHASE_SECONDS.GUESS;

  const wrongOptions = WORD_BANK[secretWord.category]
    .filter((w) => w !== secretWord.word)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);
  const wordOptions = [secretWord.word, ...wrongOptions].sort(
    () => 0.5 - Math.random(),
  );

  // Se guardan para poder re-emitirlas si el impostor se reconecta.
  room.guessOptions = wordOptions;

  const impostorPlayer = room.players.find((p) => p.id === room.impostorId);
  if (impostorPlayer && !impostorPlayer.isBot) {
    io.to(room.impostorId!).emit("guess_word_options", {
      options: wordOptions,
    });
  }

  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

  // Impostor bot: adivina solo tras un breve retraso.
  scheduleBotGuess(room, wordOptions);

  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(room.roomCode).emit("timer_tick", room.timer);
    if (room.timer <= 0) {
      clearRoomTimer(room);
      finishGuess(room, false);
    }
  }, 1000);
}

/** Resuelve la adivinanza del impostor y termina la partida. */
function finishGuess(room: Room, guessedCorrectly: boolean): void {
  if (room.status !== "GUESS_PHASE") return;
  room.impostorGuessedCorrectly = guessedCorrectly;
  room.winner = guessedCorrectly ? "IMPOSTOR" : "CREWMATES";
  if (guessedCorrectly) {
    const impostor = room.players.find((p) => p.id === room.impostorId);
    if (impostor) impostor.score += 150;
  } else {
    for (const p of room.players) {
      if (p.role === "CREWMATE" && !p.eliminated) p.score += 50;
    }
  }
  room.status = "GAME_OVER";
  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));
}

export {
  emitRoles,
  beginRoleReveal,
  awardRoundBonus,
  startNextRound,
  startHintPhase,
  startShowcasePhase,
  startVotingPhase,
  processVotingResults,
  startGuessPhase,
  finishGuess,
};
