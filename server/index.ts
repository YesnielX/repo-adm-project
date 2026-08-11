/**
 * Servidor de CodeImpostor: salas en memoria sincronizadas con Socket.io.
 * El host proyecta y nunca juega; los móviles entran con el QR o el código.
 * Se corre con `npm run server` (Node 24 ejecuta TS nativo, así que aquí solo
 * hay sintaxis borrable).
 */

import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import cors from "cors";
import os from "os";
import { randomUUID } from "crypto";
import { getRandomWord, getBotHint, WORD_BANK } from "./words.ts";
import type {
  Player,
  Room,
  PublicRoomState,
  JoinRoomPayload,
  SubmitHintPayload,
  SubmitVotePayload,
  SubmitImpostorGuessPayload,
  AddBotsPayload,
} from "./types.ts";

const PORT = 3001;
const MAX_ROUNDS = 5;

// Nombres temáticos para los primeros bots; después se numeran.
const THEMED_BOT_NAMES = ["Bot Turing", "Bot Ada", "Bot Grace"];
const BOT_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#22c55e",
];

// Segundos de cada fase; los usa el anillo de progreso del cliente.
const PHASE_SECONDS = {
  ROLE_REVEAL: 6,
  HINT: 30,
  SHOWCASE: 35,
  VOTING: 20,
  EJECTION: 8,
  GUESS: 15,
} as const;

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = new Map<string, Room>();
// socket.id -> roomCode; se limpia al desconectar.
const roomBySocket = new Map<string, string>();

/** Primera dirección IPv4 no interna, para generar el QR del host. */
function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  const iface = interfaces["Wi-Fi"];
  if (iface) {
    for (const alias of iface) {
      if (alias.family === "IPv4" && !alias.internal) return alias.address;
    }
  }

  return "localhost";
}

const LOCAL_IP = getLocalIpAddress();

function generateRoomCode(): string {
  let code: string;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(code));
  return code;
}

function roomOfSocket(socket: Socket): Room | undefined {
  const code = roomBySocket.get(socket.id);
  return code ? rooms.get(code) : undefined;
}

function clearRoomTimer(room: Room): void {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = null;
}

/**
 * Estado público de la sala. Los secretos del juego nunca salen por aquí:
 * la palabra solo se revela en GAME_OVER, las pistas desde SHOWCASE, y el
 * rol/token viajan únicamente por eventos privados dirigidos por socket.id.
 */
function getSanitizedRoomState(room: Room): PublicRoomState {
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

/* Funciones de fase */

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

  const finishGuess = (guessedCorrectly: boolean): void => {
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
  };

  // Impostor bot: adivina solo tras un breve retraso.
  if (impostorPlayer && impostorPlayer.isBot) {
    setTimeout(() => {
      const guess = wordOptions[Math.floor(Math.random() * wordOptions.length)];
      finishGuess(guess === secretWord.word);
    }, 2500);
  }

  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(room.roomCode).emit("timer_tick", room.timer);
    if (room.timer <= 0) {
      clearRoomTimer(room);
      finishGuess(false);
    }
  }, 1000);
}

/* Handlers de socket */

io.on("connection", (socket) => {
  console.log(`[socket] conectado: ${socket.id}`);

  socket.on("create_room", () => {
    const roomCode = generateRoomCode();
    const room: Room = {
      roomCode,
      hostId: socket.id,
      status: "LOBBY",
      players: [],
      secretWord: null,
      impostorId: null,
      guessOptions: null,
      timer: 0,
      timerInterval: null,
      ejectedPlayer: null,
      winner: null,
      impostorGuessedCorrectly: null,
      voteCounts: null,
      round: 1,
      maxRounds: MAX_ROUNDS,
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);
    roomBySocket.set(socket.id, roomCode);

    socket.emit("room_created", {
      roomCode,
      localIp: LOCAL_IP,
      roomState: getSanitizedRoomState(room),
    });

    console.log(`[room] #${roomCode} creada por host ${socket.id}`);
  });

  // Bots de práctica: agrega `count` bots con nombres únicos en la sala.
  socket.on("add_bots", (data?: Partial<AddBotsPayload>) => {
    const room = roomOfSocket(socket);
    if (!room || room.hostId !== socket.id || room.status !== "LOBBY") return;

    const count =
      typeof data?.count === "number" && data.count > 0 && data.count <= 100
        ? Math.floor(data.count)
        : 3;

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
  });

  socket.on("join_room", (data?: Partial<JoinRoomPayload>) => {
    const { roomCode, name, avatar, color, token } = data ?? {};
    if (typeof roomCode !== "string" || !roomCode.trim()) return;

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("error_message", "La sala no existe.");
      return;
    }

    // Rejoin: el token restaura la sesión del jugador (rol, pista, voto, puntos).
    if (token) {
      const existingPlayer = room.players.find((p) => p.token === token);
      if (existingPlayer) {
        if (existingPlayer.disconnectTimer) {
          clearTimeout(existingPlayer.disconnectTimer);
          existingPlayer.disconnectTimer = null;
        }

        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.connected = true;
        socket.join(roomCode);
        roomBySocket.set(socket.id, roomCode);

        // Reasignar referencias que aún apuntaban al id viejo.
        if (room.impostorId === oldId) room.impostorId = socket.id;
        if (room.ejectedPlayer && room.ejectedPlayer.id === oldId) {
          room.ejectedPlayer = { ...room.ejectedPlayer, id: socket.id };
        }

        io.to(roomCode).emit("room_updated", getSanitizedRoomState(room));

        socket.emit("joined_successfully", {
          playerId: socket.id,
          playerToken: token,
          roomState: getSanitizedRoomState(room),
        });

        // Re-emitir los eventos privados perdidos al refrescar (nunca a
        // espectadores eliminados).
        if (existingPlayer.role && !existingPlayer.eliminated) {
          socket.emit("your_role", {
            role: existingPlayer.role,
            category: room.secretWord ? room.secretWord.category : null,
            word:
              existingPlayer.role === "CREWMATE" && room.secretWord
                ? room.secretWord.word
                : null,
          });
        }
        if (
          room.status === "GUESS_PHASE" &&
          existingPlayer.id === room.impostorId &&
          room.guessOptions
        ) {
          socket.emit("guess_word_options", { options: room.guessOptions });
        }

        return;
      }
    }

    if (room.status !== "LOBBY") {
      socket.emit("error_message", "La partida ya está en curso.");
      return;
    }

    const newPlayer: Player = {
      id: socket.id,
      token: randomUUID(),
      name: name || `Jugador ${room.players.length + 1}`,
      avatar: avatar || "Bot",
      color: color || "#aa3bff",
      isHost: false,
      isBot: false,
      connected: true,
      eliminated: false,
      role: null,
      hint: null,
      vote: null,
      score: 0,
      disconnectTimer: null,
    };

    // Evitar jugadores fantasma si el socket re-emite join_room.
    room.players = room.players.filter((p) => p.id !== socket.id);
    room.players.push(newPlayer);
    socket.join(roomCode);
    roomBySocket.set(socket.id, roomCode);

    io.to(roomCode).emit("room_updated", getSanitizedRoomState(room));
    socket.emit("joined_successfully", {
      playerId: socket.id,
      playerToken: newPlayer.token,
      roomState: getSanitizedRoomState(room),
    });
  });

  socket.on("start_game", () => {
    const room = roomOfSocket(socket);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 3) {
      socket.emit("error_message", "Se necesitan al menos 3 jugadores.");
      return;
    }

    room.secretWord = getRandomWord();
    const randomIndex = Math.floor(Math.random() * room.players.length);
    room.impostorId = room.players[randomIndex].id;

    room.round = 1;
    room.maxRounds = MAX_ROUNDS;

    for (const p of room.players) {
      p.role = p.id === room.impostorId ? "IMPOSTOR" : "CREWMATE";
      p.hint = null;
      p.vote = null;
      p.eliminated = false;
    }

    room.ejectedPlayer = null;
    room.winner = null;
    room.impostorGuessedCorrectly = null;
    room.guessOptions = null;
    room.voteCounts = null;

    beginRoleReveal(room);
  });

  socket.on("submit_hint", (data?: Partial<SubmitHintPayload>) => {
    const { hint } = data ?? {};
    if (typeof hint !== "string" || !hint.trim()) return;

    const room = roomOfSocket(socket);
    if (!room || room.status !== "HINT_PHASE") return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.eliminated || player.hint) return;

    player.hint = hint.trim().substring(0, 50);
    io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

    const everyoneSubmitted = room.players
      .filter((p) => !p.eliminated)
      .every((p) => p.hint !== null);
    if (everyoneSubmitted) {
      clearRoomTimer(room);
      startShowcasePhase(room);
    }
  });

  socket.on("submit_vote", (data?: Partial<SubmitVotePayload>) => {
    const { targetId } = data ?? {};
    const room = roomOfSocket(socket);
    if (!room || room.status !== "VOTING") return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.eliminated || player.vote) return;

    const validTarget =
      typeof targetId === "string" &&
      (targetId === "SKIP" ||
        room.players.some((p) => p.id === targetId && !p.eliminated));
    if (!validTarget) {
      socket.emit("error_message", "Voto inválido");
      return;
    }

    player.vote = targetId;
    io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

    const everyoneVoted = room.players
      .filter((p) => !p.eliminated)
      .every((p) => p.vote !== null);
    if (everyoneVoted) {
      clearRoomTimer(room);
      processVotingResults(room);
    }
  });

  socket.on(
    "submit_impostor_guess",
    (data?: Partial<SubmitImpostorGuessPayload>) => {
      const { guessedWord } = data ?? {};
      if (typeof guessedWord !== "string") return;

      const room = roomOfSocket(socket);
      if (
        !room ||
        room.status !== "GUESS_PHASE" ||
        socket.id !== room.impostorId
      )
        return;

      clearRoomTimer(room);
      const secretWord = room.secretWord;
      if (!secretWord) return;

      const guessedCorrectly = guessedWord === secretWord.word;
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
    },
  );

  socket.on("reset_game", () => {
    const room = roomOfSocket(socket);
    if (!room || room.hostId !== socket.id) return;

    clearRoomTimer(room);
    room.status = "LOBBY";
    room.secretWord = null;
    room.impostorId = null;
    room.guessOptions = null;
    room.ejectedPlayer = null;
    room.winner = null;
    room.impostorGuessedCorrectly = null;
    room.voteCounts = null;
    room.round = 1;
    room.maxRounds = MAX_ROUNDS;

    for (const p of room.players) {
      p.hint = null;
      p.vote = null;
      p.role = null;
      p.eliminated = false;
    }

    io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));
  });

  socket.on("disconnect", () => {
    console.log(`[socket] desconectado: ${socket.id}`);

    const room = roomOfSocket(socket);
    roomBySocket.delete(socket.id);
    if (!room) return;

    // Si el host se va, la sala muere con él.
    if (room.hostId === socket.id) {
      clearRoomTimer(room);
      io.to(room.roomCode).emit("error_message", "El Host ha cerrado la sala.");
      rooms.delete(room.roomCode);
      return;
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.isBot) return;

    // Gracia de reconexión: 45s para volver con el token antes de retirarlo.
    player.connected = false;
    io.to(room.roomCode).emit("room_updated", getSanitizedRoomState(room));

    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = setTimeout(() => {
      const currentRoom = rooms.get(room.roomCode);
      if (!currentRoom) return;
      const stillThere = currentRoom.players.find((p) => p.id === player.id);
      if (!stillThere || stillThere.connected) return;

      currentRoom.players = currentRoom.players.filter(
        (p) => p.id !== player.id,
      );
      io.to(currentRoom.roomCode).emit(
        "room_updated",
        getSanitizedRoomState(currentRoom),
      );
    }, 45000);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor CodeImpostor escuchando en http://${LOCAL_IP}:${PORT}`);
});
