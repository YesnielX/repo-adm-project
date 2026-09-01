/**
 * Máquina de estados y gestión de fases del juego CodeImpostor.
 *
 * Controla el ciclo completo de una partida:
 * 1. `ROLE_REVEAL`: Asignación y revelación privada de roles y palabra.
 * 2. `HINT_PHASE`: Redacción y envío de pistas por jugadores y bots.
 * 3. `SHOWCASE`: Presentación pública de pistas para debate en el aula.
 * 4. `VOTING`: Emisión de votos individuales contra el sospechoso.
 * 5. `EJECTION`: Conteo de votos y expulsión (animación del proyector).
 * 6. `GUESS_PHASE`: Última oportunidad del impostor descubierto de adivinar la palabra.
 * 7. `GAME_OVER`: Pantalla final de victoria y podio de puntuaciones.
 */
import { io } from "../core/io.ts";
import { getRandomWord, WORD_BANK } from "../data/words.ts";
import { clearRoomTimer, rooms } from "./rooms.ts";
import { getSanitizedRoomState } from "./public-state.ts";
import { PHASE_SECONDS, MAX_ROUNDS } from "../config.ts";
import { scheduleBotHints, scheduleBotVotes, scheduleBotGuess } from "./bots.ts";
import type { Room } from "../types.ts";

/**
 * Emite de forma privada a cada socket humano activo el rol que le corresponde.
 * - Los Tripulantes reciben su rol, la categoría y la palabra secreta.
 * - El Impostor recibe su rol y la categoría, con `word: null`.
 * - Los bots y espectadores eliminados son omitidos.
 *
 * @param room Sala en la que se distribuirán los roles.
 */
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

/**
 * Inicia la fase `ROLE_REVEAL` (6 segundos).
 *
 * Envía los roles privados a los jugadores, notifica a la pantalla del proyector,
 * e inicia el temporizador descendente que al expirar iniciará `HINT_PHASE`.
 *
 * @param room Sala de juego en curso.
 */
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

/**
 * Otorga +10 puntos de bonificación de supervivencia a cada Tripulante vivo.
 *
 * @param room Sala evaluada.
 */
function awardRoundBonus(room: Room): void {
  for (const p of room.players) {
    if (p.role === "CREWMATE" && !p.eliminated) p.score += 10;
  }
}

/**
 * Avanza a la siguiente ronda de juego si no se ha alcanzado el límite máximo.
 *
 * Lógica:
 * - Otorga puntos por ronda a los tripulantes vivos.
 * - Incrementa el contador de ronda.
 * - Si supera `MAX_ROUNDS` (5 rondas), el Impostor gana la partida por supervivencia (+100 pts) y pasa a `GAME_OVER`.
 * - En caso contrario, selecciona una nueva palabra secreta, limpia pistas/votos anteriores y vuelve a `ROLE_REVEAL`.
 *
 * @param room Sala de juego.
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

/**
 * Inicia la fase de redacción de pistas `HINT_PHASE` (30 segundos).
 *
 * - Configura el temporizador y programa las respuestas de los bots.
 * - Verifica periódicamente si todos los jugadores activos han enviado su pista
 *   para avanzar inmediatamente sin hacer esperar al grupo.
 *
 * @param room Sala de juego.
 */
function startHintPhase(room: Room): void {
  room.status = "HINT_PHASE";
  room.timer = PHASE_SECONDS.HINT_PHASE;
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

/**
 * Inicia la fase de debate y muestra de pistas `SHOWCASE` (35 segundos).
 *
 * En esta fase, todas las pistas redactadas se hacen públicas en la pantalla del Host
 * y en los teléfonos para que los jugadores debatan verbalmente quién es el impostor.
 *
 * @param room Sala de juego.
 */
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

/**
 * Inicia la fase de votación `VOTING` (20 segundos).
 *
 * - Habilita los botones de votación en los móviles de los jugadores vivos.
 * - Programa los votos de los bots activos.
 * - Cuando todos los jugadores emiten su voto, avanza a procesar resultados sin esperar al temporizador.
 *
 * @param room Sala de juego.
 */
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
 * Resuelve el desenlace tras la pantalla de expulsión (`EJECTION`):
 * - **Si fue expulsado el Impostor**: Pasa a `GUESS_PHASE` (última oportunidad de adivinar).
 * - **Si fue expulsado un Tripulante**: Queda como espectador (`eliminated: true`).
 *   Si quedan <= 1 tripulantes vivos, el Impostor gana inmediatamente por eliminación.
 *   Si quedan 2 o más, avanza a la siguiente ronda.
 * - **Si hubo empate**: Nadie es expulsado y se avanza a la siguiente ronda.
 *
 * @param room Sala de juego.
 */
function resolveEjection(room: Room): void {
  if (room.ejectedPlayer && room.ejectedPlayer.id === room.impostorId) {
    startGuessPhase(room);
    return;
  }

  if (room.ejectedPlayer) {
    const expelled = room.players.find((p) => p.id === room.ejectedPlayer!.id);
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

  // Empate en votos: nadie es expulsado
  startNextRound(room);
}

/**
 * Realiza el escrutinio de los votos emitidos y entra a la fase `EJECTION` (8 segundos).
 *
 * Determina quién recibió la mayor cantidad de votos (ignorando 'SKIP').
 * En caso de empate en la primera posición, ningún jugador es expulsado (`ejectedPlayer: null`).
 *
 * @param room Sala de juego.
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
    resolveEjection(room);
  }, 1000);
}

/**
 * Inicia la última oportunidad del impostor descubierto (`GUESS_PHASE`, 15 segundos).
 *
 * - Genera 4 opciones de palabras (la correcta + 3 distractores aleatorios de la misma categoría).
 * - Envía las 4 opciones de forma privada al impostor (`guess_word_options`).
 * - Si el impostor es un bot, programa su elección automática.
 * - Si el temporizador de 15s expira sin respuesta, se toma como fallo automático.
 *
 * @param room Sala de juego.
 */
function startGuessPhase(room: Room): void {
  const secretWord = room.secretWord;
  if (!secretWord) return;

  // Bonus de supervivencia de la ronda en la que fue descubierto.
  awardRoundBonus(room);
  room.status = "GUESS_PHASE";
  room.timer = PHASE_SECONDS.GUESS_PHASE;

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

/**
 * Resuelve el resultado de la adivinanza del impostor y culmina la partida en `GAME_OVER`.
 *
 * Puntuación:
 * - **Impostor acertó**: Victoria del Impostor (+150 puntos).
 * - **Impostor falló**: Victoria de los Tripulantes (+50 puntos a cada tripulante vivo).
 *
 * @param room Sala de juego.
 * @param guessedCorrectly True si el impostor seleccionó la palabra correcta; False si falló o expiró el tiempo.
 */
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

/**
 * Permite al Host forzar el salto inmediato a la siguiente fase sin esperar a que concluya el temporizador.
 * Útil para clases o presentaciones ágiles cuando todos terminaron antes de tiempo.
 *
 * @param room Sala en la que se forzará la transición.
 */
function forceNextPhase(room: Room): void {
  switch (room.status) {
    case "ROLE_REVEAL":
      startHintPhase(room);
      break;
    case "HINT_PHASE":
      startShowcasePhase(room);
      break;
    case "SHOWCASE":
      startVotingPhase(room);
      break;
    case "VOTING":
      processVotingResults(room);
      break;
    case "EJECTION":
      resolveEjection(room);
      break;
    case "GUESS_PHASE":
      finishGuess(room, false);
      break;
    default:
      // LOBBY y GAME_OVER no tienen fase siguiente que saltar.
      break;
  }
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
  forceNextPhase,
};

