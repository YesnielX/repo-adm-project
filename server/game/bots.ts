/**
 * Gestión y comportamiento de bots de práctica para pruebas del juego.
 *
 * Provee:
 * - Creación dinámica de bots con nombres y colores únicos garantizados.
 * - Emulación de envío de pistas con retrasos aleatorios (humano-simulado).
 * - Emulación de votación entre jugadores activos.
 * - Adivinanza automática cuando el impostor seleccionado es un bot.
 */
import { randomUUID } from "crypto";
import { io } from "../core/io.ts";
import { getBotHint } from "../data/words.ts";
import { clearRoomTimer } from "./rooms.ts";
import { getSanitizedRoomState } from "./public-state.ts";
import { THEMED_BOT_NAMES, BOT_COLORS } from "../config.ts";
import {
  startShowcasePhase,
  processVotingResults,
  finishGuess,
} from "./phases.ts";
import type { Room } from "../types.ts";

/**
 * Crea e inyecta `count` jugadores bot en una sala de juego.
 *
 * Asigna nombres temáticos iniciales (ej. Bot Turing, Bot Ada, Bot Grace) y luego
 * continúa con numeración secuencial (Bot 4, Bot 5, etc.) asegurando que ningún
 * nombre colisione con jugadores ya existentes en la sala.
 *
 * @param count Cantidad de bots a agregar.
 * @param room Sala de juego destino.
 */
export function createBotPlayers(count: number, room: Room): void {
  const used = new Set(room.players.map((p) => p.name));
  const names: string[] = [];
  
  // Asignación de nombres temáticos prioritarios
  for (const themed of THEMED_BOT_NAMES) {
    if (names.length >= count) break;
    if (!used.has(themed)) {
      names.push(themed);
      used.add(themed);
    }
  }
  
  // Asignación de nombres numerados para la cantidad restante
  let n = room.players.length + 1;
  while (names.length < count) {
    const candidate = `Bot ${n}`;
    if (!used.has(candidate)) {
      names.push(candidate);
      used.add(candidate);
    }
    n++;
  }

  // Registro de cada bot en el arreglo de jugadores de la sala
  names.forEach((name, idx) => {
    room.players.push({
      id: `bot-${Date.now()}-${idx}`,
      token: randomUUID(),
      name,
      avatar: "Bot",
      color: BOT_COLORS[idx % BOT_COLORS.length],
      isHost: false,
      isBot: true,
      connected: true,
      eliminated: false,
      role: null,
      hint: null,
      vote: null,
      score: 0,
      disconnectTimer: null,
    });
  });

  // Notifica la actualización del lobby a todos los clientes
  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));
}

/**
 * Programa el envío de pistas por parte de los bots activos durante `HINT_PHASE`.
 *
 * Aplica un retardo aleatorio (1.5s a 4s) para simular la escritura humana.
 * Si todos los jugadores (bots y humanos) completan su pista antes de que el
 * temporizador expire, avanza automáticamente a la fase de debate (`SHOWCASE`).
 *
 * @param room Sala en la que se programarán las pistas.
 */
export function scheduleBotHints(room: Room): void {
  const word = room.secretWord?.word ?? "";
  for (const bot of room.players.filter((p) => p.isBot && !p.eliminated)) {
    const delay = Math.floor(1500 + Math.random() * 2500);
    setTimeout(() => {
      // Guardas: verificar que la fase no haya cambiado y que el bot no haya enviado pista
      if (room.status !== "HINT_PHASE" || bot.hint) return;
      
      bot.hint = getBotHint(word, bot.role === "IMPOSTOR");
      io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

      // Comprobar si todos los jugadores activos ya enviaron su pista
      const everyoneSubmitted = room.players
        .filter((p) => !p.eliminated)
        .every((p) => p.hint !== null);
      if (everyoneSubmitted) {
        clearRoomTimer(room);
        startShowcasePhase(room);
      }
    }, delay);
  }
}

/**
 * Programa los votos automáticos de los bots activos durante la fase `VOTING`.
 *
 * Cada bot elige aleatoriamente a otro jugador vivo como sospechoso con un retardo (2s a 5s).
 * Si todos los jugadores completan su voto, procesa inmediatamente los resultados.
 *
 * @param room Sala en la que se programarán los votos.
 */
export function scheduleBotVotes(room: Room): void {
  for (const bot of room.players.filter((p) => p.isBot && !p.eliminated)) {
    const delay = Math.floor(2000 + Math.random() * 3000);
    setTimeout(() => {
      // Guardas: verificar que la fase continúe siendo VOTING y no haya votado antes
      if (room.status !== "VOTING" || bot.vote) return;
      
      const possibleTargets = room.players.filter(
        (p) => !p.eliminated && p.id !== bot.id,
      );
      const randomTarget =
        possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
      bot.vote = randomTarget ? randomTarget.id : "SKIP";
      io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

      // Comprobar si todos los jugadores activos ya emitieron su voto
      const everyoneVoted = room.players
        .filter((p) => !p.eliminated)
        .every((p) => p.vote !== null);
      if (everyoneVoted) {
        clearRoomTimer(room);
        processVotingResults(room);
      }
    }, delay);
  }
}

/**
 * Programa la decisión de adivinanza del bot si este es el impostor expulsado (`GUESS_PHASE`).
 *
 * El bot elige aleatoriamente una de las 4 opciones de palabras tras una pausa de 2.5s
 * y finaliza la partida determinando si acertó o falló.
 *
 * @param room Sala de juego en curso.
 * @param wordOptions Arreglo de 4 opciones de palabras (la correcta y 3 distractores).
 */
export function scheduleBotGuess(room: Room, wordOptions: string[]): void {
  const secretWord = room.secretWord;
  const impostorPlayer = room.players.find((p) => p.id === room.impostorId);
  if (!secretWord || !impostorPlayer || !impostorPlayer.isBot) return;
  
  setTimeout(() => {
    const guess = wordOptions[Math.floor(Math.random() * wordOptions.length)];
    finishGuess(room, guess === secretWord.word);
  }, 2500);
}

