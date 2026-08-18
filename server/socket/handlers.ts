/**
 * Handlers de Socket.IO: toda la lógica de eventos cliente -> servidor
 * (create_room, add_bots, join_room, start_game, submit_hint, submit_vote,
 * submit_impostor_guess, reset_game y disconnect).
 */
import { randomUUID } from "crypto";
import { io } from "../core/io.ts";
import { logger } from "../core/logger.ts";
import { getRandomWord } from "../data/words.ts";
import { LOCAL_IP, getLocalIpCandidates } from "../core/ip.ts";
import { getSanitizedRoomState } from "../game/public-state.ts";
import {
  rooms,
  roomBySocket,
  roomOfSocket,
  generateRoomCode,
  clearRoomTimer,
} from "../game/rooms.ts";
import { createBotPlayers } from "../game/bots.ts";
import {
  beginRoleReveal,
  startShowcasePhase,
  processVotingResults,
} from "../game/phases.ts";
import { MAX_ROUNDS, DISCONNECT_GRACE_MS } from "../config.ts";
import {
  joinRoomSchema,
  addBotsSchema,
  submitHintSchema,
  submitVoteSchema,
  submitImpostorGuessSchema,
} from "../../shared/schemas.ts";
import type {
  AddBotsPayload,
  JoinRoomPayload,
  SubmitHintPayload,
  SubmitVotePayload,
  SubmitImpostorGuessPayload,
} from "../../shared/schemas.ts";
import type { Player, Room } from "../types.ts";

/** Registra todos los handlers de socket en la instancia compartida de io. */
export function registerSocketHandlers(): void {
  io.on("connection", (socket) => {
    logger.info(`[socket] conectado: ${socket.id}`);

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
        ipCandidates: getLocalIpCandidates(),
        roomState: getSanitizedRoomState(room),
      });

      logger.info(`[room] #${roomCode} creada por host ${socket.id}`);
    });

    // Bots de práctica: agrega `count` bots con nombres únicos en la sala.
    socket.on("add_bots", (data?: Partial<AddBotsPayload>) => {
      const room = roomOfSocket(socket);
      if (!room || room.hostId !== socket.id || room.status !== "LOBBY") return;

      // Sin `count` válido se agregan 3 bots por defecto.
      const parsed = addBotsSchema.safeParse(data);
      const count = parsed.success ? parsed.data.count : 3;

      createBotPlayers(count, room);
    });

    socket.on("join_room", (data?: Partial<JoinRoomPayload>) => {
      const parsed = joinRoomSchema.safeParse(data);
      if (!parsed.success) return;
      const { roomCode, name, avatar, color, token } = parsed.data;

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
      const parsed = submitHintSchema.safeParse(data);
      if (!parsed.success) return;

      const room = roomOfSocket(socket);
      if (!room || room.status !== "HINT_PHASE") return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player || player.eliminated || player.hint) return;

      player.hint = parsed.data.hint.trim().substring(0, 50);
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
      const parsed = submitVoteSchema.safeParse(data);
      if (!parsed.success) return;

      const room = roomOfSocket(socket);
      if (!room || room.status !== "VOTING") return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player || player.eliminated || player.vote) return;

      // El objetivo debe ser "SKIP" o un jugador vivo (el esquema ya asegura
      // que targetId sea un string no vacío).
      const validTarget =
        parsed.data.targetId === "SKIP" ||
        room.players.some(
          (p) => p.id === parsed.data.targetId && !p.eliminated,
        );
      if (!validTarget) {
        socket.emit("error_message", "Voto inválido");
        return;
      }

      player.vote = parsed.data.targetId;
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
        const parsed = submitImpostorGuessSchema.safeParse(data);
        if (!parsed.success) return;

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

        const guessedCorrectly = parsed.data.guessedWord === secretWord.word;
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
      logger.info(`[socket] desconectado: ${socket.id}`);

      const room = roomOfSocket(socket);
      roomBySocket.delete(socket.id);
      if (!room) return;

      // Si el host se va, la sala muere con él.
      if (room.hostId === socket.id) {
        clearRoomTimer(room);
        io.to(room.roomCode).emit(
          "error_message",
          "El Host ha cerrado la sala.",
        );
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
      }, DISCONNECT_GRACE_MS);
    });
  });
}
