/**
 * Manejadores de eventos de Socket.IO (Controlador de comunicación en tiempo real).
 *
 * Gestiona todas las interacciones entrantes de clientes (Host y Jugadores):
 * - `create_room`: Creación de nuevas salas por la pantalla del Host.
 * - `add_bots`: Adición de jugadores bot controlados por la máquina para pruebas.
 * - `join_room`: Conexión y reconexión de jugadores móviles mediante token persistente.
 * - `start_game`: Inicio de la partida y asignación inicial de roles.
 * - `submit_hint`: Envío y sanitización de pistas de texto.
 * - `submit_vote`: Registro de votos durante el debate.
 * - `submit_impostor_guess`: Adivinanza de la palabra en la última oportunidad del impostor.
 * - `force_next_phase`: Salto manual de fase accionado por el Host.
 * - `reset_game`: Reinicio de la partida al lobby conservando los jugadores y puntos.
 * - `disconnect`: Manejo de desconexiones y ventana de gracia para reconexión.
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
  forceNextPhase,
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

/**
 * Registra todos los manejadores de eventos en el servidor de Socket.IO.
 * Se invoca una única vez al arrancar el servidor.
 */
export function registerSocketHandlers(): void {
  io.on("connection", (socket) => {
    logger.info(`[socket] conectado: ${socket.id}`);

    /**
     * Evento: 'create_room'
     * Emisor: Pantalla del Host / Proyector.
     * Acción: Genera una nueva sala con código de 4 dígitos, la registra en memoria y
     *         devuelve la IP local y candidatos de red para configurar el código QR.
     */
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

    /**
     * Evento: 'add_bots'
     * Emisor: Host.
     * Acción: Agrega `count` bots a la sala en estado LOBBY para poder probar el juego.
     */
    socket.on("add_bots", (data?: Partial<AddBotsPayload>) => {
      const room = roomOfSocket(socket);
      if (!room || room.hostId !== socket.id || room.status !== "LOBBY") return;

      // Validación con Zod (si no se especifica, por defecto agrega 3 bots)
      const parsed = addBotsSchema.safeParse(data);
      const count = parsed.success ? parsed.data.count : 3;

      createBotPlayers(count, room);
    });

    /**
     * Evento: 'join_room'
     * Emisor: Jugador móvil.
     * Acción: Une al jugador a una sala existente o restaura su sesión si presenta un `token` válido.
     */
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

      // Reutilizar jugador existente si ya está en la sala con el mismo nombre
      const existingByName = room.players.find((p) => p.name === name && !p.isBot);
      if (existingByName) {
        if (existingByName.disconnectTimer) {
          clearTimeout(existingByName.disconnectTimer);
          existingByName.disconnectTimer = null;
        }
        existingByName.id = socket.id;
        existingByName.connected = true;
        socket.join(roomCode);
        roomBySocket.set(socket.id, roomCode);

        // Reasignar referencias que apuntaban al id viejo.
        if (room.impostorId === existingByName.id) room.impostorId = socket.id;

        io.to(roomCode).emit("room_updated", getSanitizedRoomState(room));
        socket.emit("joined_successfully", {
          playerId: socket.id,
          playerToken: existingByName.token,
          roomState: getSanitizedRoomState(room),
        });
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

    /**
     * Evento: 'start_game'
     * Emisor: Host.
     * Acción: Inicia una nueva partida eligiendo una palabra secreta al azar y designando
     *         al Impostor (el cual se mantendrá fijo durante las rondas de esta partida).
     */
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

    /**
     * Evento: 'submit_hint'
     * Emisor: Jugador activo (Tripulante o Impostor).
     * Acción: Almacena la pista del jugador (recortada a un máximo de 50 caracteres).
     *         Si todos los jugadores vivos enviaron su pista, avanza inmediatamente a SHOWCASE.
     */
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

    /**
     * Evento: 'submit_vote'
     * Emisor: Jugador activo.
     * Acción: Registra el voto del jugador por un sospechoso o por omitir ('SKIP').
     *         Si todos los jugadores vivos votaron, avanza inmediatamente al escrutinio (EJECTION).
     */
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

    /**
     * Evento: 'submit_impostor_guess'
     * Emisor: Impostor expulsado durante GUESS_PHASE.
     * Acción: Procesa la opción seleccionada por el impostor. Si coincide con la palabra secreta,
     *         el impostor roba la victoria (+150 pts); si no, ganan los tripulantes (+50 pts c/u).
     */
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

    /**
     * Evento: 'force_next_phase'
     * Emisor: Host.
     * Acción: Salta la fase actual y avanza a la siguiente sin esperar al temporizador.
     */
    socket.on("force_next_phase", () => {
      const room = roomOfSocket(socket);
      if (!room || room.hostId !== socket.id) return;

      // Solo tiene efecto durante una partida en curso; el host salta la
      // fase sin esperar el timer (LOBBY y GAME_OVER se ignoran en phases).
      clearRoomTimer(room);
      forceNextPhase(room);
    });

    /**
     * Evento: 'reset_game'
     * Emisor: Host.
     * Acción: Regresa la sala al estado LOBBY conservando los jugadores y sus puntuaciones acumuladas.
     */
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

    /**
     * Evento: 'disconnect'
     * Emisor: Desconexión del socket (cierre de pestaña, corte de Wi-Fi, etc.).
     * Acción:
     * - Si se desconecta el Host: la sala se cierra y se notifica a los jugadores.
     * - Si se desconecta un jugador: se marca `connected: false` y se inicia un temporizador
     *   de gracia de 45s (`DISCONNECT_GRACE_MS`) antes de eliminarlo definitivamente de la sala.
     */
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

