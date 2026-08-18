/**
 * Bots de práctica: creación con nombres únicos y sus acciones automáticas
 * en cada fase (pistas, votos y la adivinanza del impostor bot).
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

/** Crea `count` bots con nombres únicos (temáticos libres y luego numerados). */
export function createBotPlayers(count: number, room: Room): void {
  // Nombres únicos: primero los temáticos libres, luego Bot N sin colisionar.
  const used = new Set(room.players.map((p) => p.name));
  const names: string[] = [];
  for (const themed of THEMED_BOT_NAMES) {
    if (names.length >= count) break;
    if (!used.has(themed)) {
      names.push(themed);
      used.add(themed);
    }
  }
  let n = room.players.length + 1;
  while (names.length < count) {
    const candidate = `Bot ${n}`;
    if (!used.has(candidate)) {
      names.push(candidate);
      used.add(candidate);
    }
    n++;
  }

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

  io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));
}

/** Los bots escriben su pista con un retraso aleatorio (los eliminados no). */
export function scheduleBotHints(room: Room): void {
  const word = room.secretWord?.word ?? "";
  for (const bot of room.players.filter((p) => p.isBot && !p.eliminated)) {
    const delay = Math.floor(1500 + Math.random() * 2500);
    setTimeout(() => {
      if (room.status !== "HINT_PHASE" || bot.hint) return;
      bot.hint = getBotHint(word, bot.role === "IMPOSTOR");
      io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

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

/** Los bots votan a un objetivo aleatorio entre los jugadores vivos. */
export function scheduleBotVotes(room: Room): void {
  for (const bot of room.players.filter((p) => p.isBot && !p.eliminated)) {
    const delay = Math.floor(2000 + Math.random() * 3000);
    setTimeout(() => {
      if (room.status !== "VOTING" || bot.vote) return;
      const possibleTargets = room.players.filter(
        (p) => !p.eliminated && p.id !== bot.id,
      );
      const randomTarget =
        possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
      bot.vote = randomTarget ? randomTarget.id : "SKIP";
      io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

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

/** El impostor bot adivina solo tras un breve retraso. */
export function scheduleBotGuess(room: Room, wordOptions: string[]): void {
  const secretWord = room.secretWord;
  const impostorPlayer = room.players.find((p) => p.id === room.impostorId);
  if (!secretWord || !impostorPlayer || !impostorPlayer.isBot) return;
  setTimeout(() => {
    const guess = wordOptions[Math.floor(Math.random() * wordOptions.length)];
    finishGuess(room, guess === secretWord.word);
  }, 2500);
}
