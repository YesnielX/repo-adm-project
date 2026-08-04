import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import { randomUUID } from 'crypto';
import { getRandomWord, WORD_BANK, getBotHint } from './words.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (!iface) continue;
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();
const PORT = 3001;
const rooms = new Map();

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function getSanitizedRoomState(room) {
  return {
    roomCode: room.roomCode,
    status: room.status,
    hostId: room.hostId,
    category: room.secretWord ? room.secretWord.category : null,
    secretWord: room.status === 'GAME_OVER' ? room.secretWord?.word : null,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isHost: p.isHost,
      isBot: p.isBot || false,
      connected: p.connected !== false,
      hasSubmittedHint: !!p.hint,
      hint: room.status === 'SHOWCASE' || room.status === 'VOTING' || room.status === 'EJECTION' || room.status === 'GUESS_PHASE' || room.status === 'GAME_OVER' ? p.hint : null,
      hasVoted: !!p.vote,
      score: p.score
    })),
    timer: room.timer,
    ejectedPlayer: room.ejectedPlayer,
    winner: room.winner,
    impostorGuessedCorrectly: room.impostorGuessedCorrectly
  };
}

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  socket.on('create_room', () => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const room = {
      roomCode,
      hostId: socket.id,
      status: 'LOBBY',
      players: [],
      secretWord: null,
      impostorId: null,
      guessOptions: null,
      timer: 0,
      timerInterval: null,
      ejectedPlayer: null,
      winner: null,
      impostorGuessedCorrectly: null
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('room_created', {
      roomCode,
      localIp: LOCAL_IP,
      roomState: getSanitizedRoomState(room)
    });

    console.log(`🏠 Sala creada #${roomCode} por Host ${socket.id}`);
  });

  // Agregar 3 Bots para pruebas en solitario
  socket.on('add_bots', () => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id || room.status !== 'LOBBY') return;

    const botProfiles = [
      { name: 'Bot Turing', avatar: 'Bot', color: '#3b82f6' },
      { name: 'Bot Ada', avatar: 'Bot', color: '#10b981' },
      { name: 'Bot Grace', avatar: 'Bot', color: '#f59e0b' }
    ];

    botProfiles.forEach((b, idx) => {
      const botId = `bot-${Date.now()}-${idx}`;
      if (!room.players.some(p => p.name === b.name)) {
        room.players.push({
          id: botId,
          name: b.name,
          avatar: b.avatar,
          color: b.color,
          isHost: false,
          isBot: true,
          role: null,
          hint: null,
          vote: null,
          score: 0
        });
      }
    });

    io.to(roomCode).emit('room_updated', getSanitizedRoomState(room));
  });

  socket.on('join_room', (data) => {
    const { roomCode, name, avatar, color, token } = data ?? {};
    if (typeof roomCode !== 'string' || !roomCode.trim()) return;
    const room = rooms.get(roomCode);
    if (!room) return socket.emit('error_message', 'La sala no existe.');

    // REJOIN: si el token coincide con un jugador existente, se recupera la sesión
    if (token) {
      const existingPlayer = room.players.find(p => p.token === token);
      if (existingPlayer) {
        if (existingPlayer.disconnectTimer) {
          clearTimeout(existingPlayer.disconnectTimer);
          existingPlayer.disconnectTimer = null;
        }

        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.connected = true;
        socket.join(roomCode);
        socket.roomCode = roomCode;

        // Refresh room references that still point to the old socket id (rejoin regression)
        if (room.impostorId === oldId) room.impostorId = socket.id;
        if (room.ejectedPlayer && room.ejectedPlayer.id === oldId) {
          room.ejectedPlayer = { ...room.ejectedPlayer, id: socket.id };
        }

        io.to(roomCode).emit('room_updated', getSanitizedRoomState(room));

        socket.emit('joined_successfully', {
          playerId: socket.id,
          playerToken: token,
          roomState: getSanitizedRoomState(room)
        });

        // Re-emitir los eventos privados que el cliente perdió al refrescar
        if (existingPlayer.role) {
          socket.emit('your_role', {
            role: existingPlayer.role,
            category: room.secretWord ? room.secretWord.category : null,
            word: existingPlayer.role === 'CREWMATE' && room.secretWord ? room.secretWord.word : null
          });
        }

        if (room.status === 'GUESS_PHASE' && existingPlayer.id === room.impostorId && room.guessOptions) {
          socket.emit('guess_word_options', { options: room.guessOptions });
        }

        return;
      }
    }

    if (room.status !== 'LOBBY') return socket.emit('error_message', 'La partida ya está en curso.');

    const newPlayer = {
      id: socket.id,
      token: randomUUID(),
      name: name || `Jugador ${room.players.length + 1}`,
      avatar: avatar || 'Bot',
      color: color || '#aa3bff',
      isHost: false,
      isBot: false,
      connected: true,
      role: null,
      hint: null,
      vote: null,
      score: 0,
      disconnectTimer: null
    };

    // Remove any stale entry for this socket before adding the new one (ghost player guard)
    room.players = room.players.filter(p => p.id !== socket.id);
    room.players.push(newPlayer);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    io.to(roomCode).emit('room_updated', getSanitizedRoomState(room));
    socket.emit('joined_successfully', {
      playerId: socket.id,
      playerToken: newPlayer.token,
      roomState: getSanitizedRoomState(room)
    });
  });

  socket.on('start_game', () => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 3) return socket.emit('error_message', 'Se necesitan al menos 3 jugadores.');

    room.secretWord = getRandomWord();
    const randomIndex = Math.floor(Math.random() * room.players.length);
    room.impostorId = room.players[randomIndex].id;

    room.players.forEach(p => {
      p.role = p.id === room.impostorId ? 'IMPOSTOR' : 'CREWMATE';
      p.hint = null;
      p.vote = null;
    });

    room.status = 'ROLE_REVEAL';
    room.ejectedPlayer = null;
    room.winner = null;
    room.impostorGuessedCorrectly = null;
    room.guessOptions = null;

    room.players.forEach(p => {
      if (!p.isBot) {
        io.to(p.id).emit('your_role', {
          role: p.role,
          category: room.secretWord.category,
          word: p.role === 'CREWMATE' ? room.secretWord.word : null
        });
      }
    });

    io.to(roomCode).emit('room_updated', getSanitizedRoomState(room));

    setTimeout(() => {
      if (!rooms.has(roomCode)) return;
      startHintPhase(room);
    }, 6000);
  });

  function startHintPhase(room) {
    room.status = 'HINT_PHASE';
    room.timer = 30;
    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

    // Automatización de respuestas para Bots
    room.players.filter(p => p.isBot).forEach(bot => {
      const delay = Math.floor(1500 + Math.random() * 2500);
      setTimeout(() => {
        if (room.status === 'HINT_PHASE' && !bot.hint) {
          bot.hint = getBotHint(room.secretWord.word, bot.role === 'IMPOSTOR');
          io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

          if (room.players.every(p => p.hint !== null)) {
            clearInterval(room.timerInterval);
            startShowcasePhase(room);
          }
        }
      }, delay);
    });

    clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      room.timer--;
      io.to(room.roomCode).emit('timer_tick', room.timer);

      if (room.timer <= 0 || room.players.every(p => p.hint !== null)) {
        clearInterval(room.timerInterval);
        startShowcasePhase(room);
      }
    }, 1000);
  }

  socket.on('submit_hint', (data) => {
    const { hint } = data ?? {};
    if (typeof hint !== 'string' || !hint.trim()) return;
    const room = rooms.get(socket.roomCode);
    if (!room || room.status !== 'HINT_PHASE') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.hint) return; // Rechazar silenciosamente el doble envío

    player.hint = hint.trim().substring(0, 50);
    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

    if (room.players.every(p => p.hint !== null)) {
      clearInterval(room.timerInterval);
      startShowcasePhase(room);
    }
  });

  function startShowcasePhase(room) {
    room.status = 'SHOWCASE';
    room.timer = 35;
    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

    clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      room.timer--;
      io.to(room.roomCode).emit('timer_tick', room.timer);

      if (room.timer <= 0) {
        clearInterval(room.timerInterval);
        startVotingPhase(room);
      }
    }, 1000);
  }

  function startVotingPhase(room) {
    room.status = 'VOTING';
    room.timer = 20;
    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

    // Automatización de Votación de Bots
    room.players.filter(p => p.isBot).forEach(bot => {
      const delay = Math.floor(2000 + Math.random() * 3000);
      setTimeout(() => {
        if (room.status === 'VOTING' && !bot.vote) {
          const possibleTargets = room.players.filter(p => p.id !== bot.id);
          const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
          bot.vote = randomTarget ? randomTarget.id : 'SKIP';
          io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

          if (room.players.every(p => p.vote !== null)) {
            clearInterval(room.timerInterval);
            processVotingResults(room);
          }
        }
      }, delay);
    });

    clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      room.timer--;
      io.to(room.roomCode).emit('timer_tick', room.timer);

      if (room.timer <= 0 || room.players.every(p => p.vote !== null)) {
        clearInterval(room.timerInterval);
        processVotingResults(room);
      }
    }, 1000);
  }

  socket.on('submit_vote', (data) => {
    const { targetId } = data ?? {};
    const room = rooms.get(socket.roomCode);
    if (!room || room.status !== 'VOTING') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.vote) return; // Rechazar silenciosamente el segundo voto

    // Validar que el objetivo sea 'SKIP' o un jugador real de la sala
    const validTarget = typeof targetId === 'string' && (targetId === 'SKIP' || room.players.some(p => p.id === targetId));
    if (!validTarget) {
      socket.emit('error_message', 'Voto inválido');
      return;
    }

    player.vote = targetId;
    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

    if (room.players.every(p => p.vote !== null)) {
      clearInterval(room.timerInterval);
      processVotingResults(room);
    }
  });

  function processVotingResults(room) {
    room.status = 'EJECTION';
    
    const voteCounts = {};
    room.players.forEach(p => {
      if (p.vote && p.vote !== 'SKIP') {
        voteCounts[p.vote] = (voteCounts[p.vote] || 0) + 1;
      }
    });

    let maxVotes = 0;
    let ejectedId = null;
    let isTie = false;

    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        ejectedId = playerId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    });

    const ejectedPlayer = isTie ? null : room.players.find(p => p.id === ejectedId);
    room.ejectedPlayer = ejectedPlayer ? {
      id: ejectedPlayer.id,
      name: ejectedPlayer.name,
      avatar: ejectedPlayer.avatar,
      role: ejectedPlayer.role
    } : null;

    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

    setTimeout(() => {
      if (!rooms.has(room.roomCode)) return;

      if (room.ejectedPlayer && room.ejectedPlayer.id === room.impostorId) {
        startGuessPhase(room);
      } else {
        room.winner = 'IMPOSTOR';
        room.status = 'GAME_OVER';
        const impostor = room.players.find(p => p.id === room.impostorId);
        if (impostor) impostor.score += 100;
        io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));
      }
    }, 6000);
  }

  function startGuessPhase(room) {
    room.status = 'GUESS_PHASE';
    room.timer = 15;

    const allCategoryWords = WORD_BANK[room.secretWord.category] || [];
    const wrongOptions = allCategoryWords
      .filter(w => w !== room.secretWord.word)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const wordOptions = [room.secretWord.word, ...wrongOptions].sort(() => 0.5 - Math.random());

    // Guardar las opciones para poder re-emitirlas en un rejoin del impostor
    room.guessOptions = wordOptions;

    const impostorPlayer = room.players.find(p => p.id === room.impostorId);

    if (impostorPlayer && !impostorPlayer.isBot) {
      io.to(room.impostorId).emit('guess_word_options', { options: wordOptions });
    }

    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));

    // Si el Impostor es un Bot, adivina automáticamente tras 2 segundos
    if (impostorPlayer && impostorPlayer.isBot) {
      setTimeout(() => {
        if (room.status === 'GUESS_PHASE') {
          const botGuess = wordOptions[Math.floor(Math.random() * wordOptions.length)];
          if (botGuess === room.secretWord.word) {
            room.winner = 'IMPOSTOR';
            room.impostorGuessedCorrectly = true;
            impostorPlayer.score += 150;
          } else {
            room.winner = 'CREWMATES';
            room.impostorGuessedCorrectly = false;
            room.players.filter(p => p.role === 'CREWMATE').forEach(p => p.score += 50);
          }
          room.status = 'GAME_OVER';
          io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));
        }
      }, 2500);
    }

    clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      room.timer--;
      io.to(room.roomCode).emit('timer_tick', room.timer);

      if (room.timer <= 0) {
        clearInterval(room.timerInterval);
        if (room.status === 'GUESS_PHASE') {
          room.winner = 'CREWMATES';
          room.impostorGuessedCorrectly = false;
          room.status = 'GAME_OVER';
          room.players.filter(p => p.role === 'CREWMATE').forEach(p => p.score += 50);
          io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));
        }
      }
    }, 1000);
  }

  socket.on('submit_impostor_guess', (data) => {
    const { guessedWord } = data ?? {};
    if (typeof guessedWord !== 'string') return;
    const room = rooms.get(socket.roomCode);
    if (!room || room.status !== 'GUESS_PHASE' || socket.id !== room.impostorId) return;

    clearInterval(room.timerInterval);

    if (guessedWord === room.secretWord.word) {
      room.winner = 'IMPOSTOR';
      room.impostorGuessedCorrectly = true;
      const impostor = room.players.find(p => p.id === room.impostorId);
      if (impostor) impostor.score += 150;
    } else {
      room.winner = 'CREWMATES';
      room.impostorGuessedCorrectly = false;
      room.players.filter(p => p.role === 'CREWMATE').forEach(p => p.score += 50);
    }

    room.status = 'GAME_OVER';
    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));
  });

  socket.on('reset_game', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;

    room.status = 'LOBBY';
    room.secretWord = null;
    room.impostorId = null;
    room.guessOptions = null;
    room.ejectedPlayer = null;
    room.winner = null;
    room.impostorGuessedCorrectly = null;

    room.players.forEach(p => {
      p.hint = null;
      p.vote = null;
      p.role = null;
    });

    io.to(room.roomCode).emit('room_updated', getSanitizedRoomState(room));
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
    const roomCode = socket.roomCode;
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      if (room.hostId === socket.id) {
        clearInterval(room.timerInterval);
        io.to(roomCode).emit('error_message', 'El Host ha cerrado la sala.');
        rooms.delete(roomCode);
        return;
      }

      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.isBot) return;

      // Gracia de reconexión: no se elimina de inmediato, se da 45s para re-unirse
      player.connected = false;
      io.to(roomCode).emit('room_updated', getSanitizedRoomState(room));

      if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
      player.disconnectTimer = setTimeout(() => {
        const currentRoom = rooms.get(roomCode);
        if (!currentRoom) return;
        const stillThere = currentRoom.players.find(p => p.id === player.id);
        if (!stillThere || stillThere.connected) return;

        currentRoom.players = currentRoom.players.filter(p => p.id !== player.id);
        io.to(roomCode).emit('room_updated', getSanitizedRoomState(currentRoom));
      }, 45000);
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 =================================================== 🚀
   Servidor de WebSockets CodeImpostor Iniciado (Con soporte para Bots)!
   
   📍 Dirección IP Local: http://${LOCAL_IP}:${PORT}
   📍 Escuchando en puerto: ${PORT}
🚀 =================================================== 🚀
  `);
});
