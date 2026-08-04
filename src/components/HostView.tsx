import React, { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import gsap from 'gsap';
import {
  QrCode,
  Wifi,
  Play,
  Bot,
  Clock,
  Vote,
  Trophy,
  RotateCcw,
  ShieldAlert,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { useGameSocket } from '../context/SocketContext';
import { AvatarIcon } from './AvatarIcon';

export const HostView: React.FC = () => {
  const { roomState, localIp, startGame, addBots, resetGame } = useGameSocket();
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stageRef.current) {
      gsap.fromTo(
        stageRef.current,
        { opacity: 0, scale: 0.95, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.2)' }
      );
    }

    if (roomState?.status === 'GAME_OVER') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [roomState?.status]);

  if (!roomState) return null;

  const joinUrl = localIp
    ? `http://${localIp}:5173/?room=${roomState.roomCode}`
    : `${window.location.protocol}//${window.location.host}/?room=${roomState.roomCode}`;

  return (
    <div className="host-container" ref={stageRef}>
      <header className="host-header">
        <div className="brand">
          <ShieldAlert className="logo-icon-svg text-purple" size={36} />
          <h1>CODE IMPOSTOR</h1>
        </div>
        <div className="room-badge">
          <span>PROYECTOR HOST</span>
          <h2>#{roomState.roomCode}</h2>
        </div>
      </header>

      {/* LOBBY */}
      {roomState.status === 'LOBBY' && (
        <div className="host-lobby-grid">
          <div className="qr-card">
            <div className="qr-header-title">
              <QrCode size={20} className="text-cyan" />
              <h3>¡ESCANEA CON TU MÓVIL!</h3>
            </div>
            <div className="qr-wrapper">
              <QRCodeSVG value={joinUrl} size={190} level="H" includeMargin />
            </div>
            <p className="ip-link">{joinUrl}</p>
            <span className="wifi-badge">
              <Wifi size={14} /> Wi-Fi Local
            </span>
          </div>

          <div className="players-panel">
            <div className="panel-header">
              <h3>JUGADORES CONECTADOS ({roomState.players.length})</h3>

              <div className="lobby-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addBots}
                  title="Agregar 3 bots para probar en solitario"
                >
                  <Bot size={18} /> +3 Bots de Prueba
                </button>

                <button
                  type="button"
                  className="btn-primary start-btn"
                  disabled={roomState.players.length < 3}
                  onClick={startGame}
                >
                  <Play size={18} />
                  {roomState.players.length < 3
                    ? 'Esperando al menos 3 jugadores...'
                    : '¡INICIAR PARTIDA!'}
                </button>
              </div>
            </div>

            <div className="players-grid">
              {roomState.players.length === 0 ? (
                <div className="empty-players">
                  <span className="pulse-dot"></span> Escaneen el código QR para unirse a la sala...
                </div>
              ) : (
                roomState.players.map((p) => (
                  <div key={p.id} className={`player-card ${!p.connected ? 'offline' : ''}`} style={{ borderColor: p.color }}>
                    <div className="player-avatar" style={{ backgroundColor: p.color }}>
                      <AvatarIcon avatarId={p.avatar} size={28} isBot={p.isBot} />
                    </div>
                    <span className="player-name">{p.name}</span>
                    {p.isBot && <span className="bot-tag">BOT</span>}
                    {!p.connected && <span className="offline-tag">OFFLINE</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* REVELACIÓN DE ROLES */}
      {roomState.status === 'ROLE_REVEAL' && (
        <div className="host-stage">
          <div className="stage-banner">
            <Sparkles size={48} className="text-cyan animate-spin-slow" />
            <h2>ASIGNANDO ROLES SECRETOS...</h2>
            <p>Mira la pantalla de tu teléfono móvil para conocer tu rol.</p>
            <div className="category-pill">Categoría: <strong>{roomState.category}</strong></div>
          </div>
        </div>
      )}

      {/* FASE DE PISTAS */}
      {roomState.status === 'HINT_PHASE' && (
        <div className="host-stage">
          <div className="timer-ring">
            <Clock size={24} />
            <span className="timer-num">{roomState.timer}s</span>
            <span>ESCRIBIENDO PISTAS...</span>
          </div>

          <h2>ESCRIBIENDO PISTAS EN EL MÓVIL</h2>
          <p className="subtitle">Categoría: <strong>{roomState.category}</strong></p>

          <div className="players-status-grid">
            {roomState.players.map((p) => (
              <div key={p.id} className={`status-card ${p.hasSubmittedHint ? 'done' : 'pending'} ${!p.connected ? 'offline' : ''}`}>
                <span className="status-avatar">
                  <AvatarIcon avatarId={p.avatar} size={20} isBot={p.isBot} />
                </span>
                <span className="status-name">{p.name}</span>
                <span className="status-badge">
                  {!p.connected ? (
                    'OFFLINE'
                  ) : p.hasSubmittedHint ? (
                    <>
                      <CheckCircle2 size={14} className="text-green" /> Pista lista
                    </>
                  ) : (
                    'Escribiendo...'
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPOSICIÓN DE PISTAS Y DEBATE */}
      {roomState.status === 'SHOWCASE' && (
        <div className="host-stage">
          <div className="stage-top">
            <MessageSquare size={32} className="text-cyan" />
            <h2>PISTAS PUBLICADAS — ¡HORA DE DEBATIR!</h2>
            <div className="timer-badge">
              <Clock size={16} /> {roomState.timer}s
            </div>
          </div>
          <p className="subtitle">¿Quién dio una pista sospechosa? ¿Quién no conoce la palabra secreta?</p>

          <div className="hints-grid">
            {roomState.players.map((p) => (
              <div key={p.id} className="hint-card">
                <div className="hint-author">
                  <span className="author-avatar">
                    <AvatarIcon avatarId={p.avatar} size={22} isBot={p.isBot} />
                  </span>
                  <span className="author-name">{p.name}</span>
                </div>
                <div className="hint-bubble">
                  "{p.hint || 'Sin pista'}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VOTACIÓN */}
      {roomState.status === 'VOTING' && (
        <div className="host-stage">
          <div className="timer-ring danger">
            <Vote size={24} />
            <span className="timer-num">{roomState.timer}s</span>
            <span>VOTACIÓN EN CURSO</span>
          </div>

          <h2>¿QUIÉN ES EL IMPOSTOR?</h2>
          <p className="subtitle">Voten en la pantalla de su celular ahora mismo...</p>

          <div className="voting-progress-grid">
            {roomState.players.map((p) => (
              <div key={p.id} className={`vote-status-card ${p.hasVoted ? 'voted' : ''} ${!p.connected ? 'offline' : ''}`}>
                <span><AvatarIcon avatarId={p.avatar} size={18} isBot={p.isBot} /></span>
                <span>{p.name}</span>
                <span className="voted-icon">
                  {!p.connected ? 'OFFLINE' : p.hasVoted ? <CheckCircle2 size={16} className="text-green" /> : <Clock size={14} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPULSIÓN DE JUGADOR */}
      {roomState.status === 'EJECTION' && (
        <div className="host-stage ejection-screen">
          <AlertTriangle size={56} className="text-red animate-bounce" />
          <h2>RESULTADO DE LA VOTACIÓN</h2>
          {roomState.ejectedPlayer ? (
            <div className="ejected-card">
              <div className="ejected-avatar">
                <AvatarIcon avatarId={roomState.ejectedPlayer.avatar} size={64} className="text-red" />
              </div>
              <h3>{roomState.ejectedPlayer.name} ha sido expulsado/a de la nave</h3>
              <div className={`role-reveal-badge ${roomState.ejectedPlayer.role}`}>
                {roomState.ejectedPlayer.role === 'IMPOSTOR'
                  ? '¡ERA EL IMPOSTOR!'
                  : 'NO era el impostor (Era Tripulante)'}
              </div>
            </div>
          ) : (
            <div className="ejected-card tie">
              <h3>Hubo un empate en los votos. Nadie fue expulsado.</h3>
            </div>
          )}
        </div>
      )}

      {/* FASE DE ADIVINACIÓN DEL IMPOSTOR */}
      {roomState.status === 'GUESS_PHASE' && (
        <div className="host-stage">
          <div className="timer-ring warning">
            <Clock size={24} />
            <span className="timer-num">{roomState.timer}s</span>
            <span>ÚLTIMA OPORTUNIDAD</span>
          </div>
          <h2>EL IMPOSTOR FUE DESCUBIERTO... ¡PERO INTENTA ROBAR LA VICTORIA!</h2>
          <p className="subtitle">
            El impostor tiene 15 segundos para adivinar la palabra secreta entre 4 opciones en su celular.
          </p>
        </div>
      )}

      {/* PANTALLA FINAL / GANADORES */}
      {roomState.status === 'GAME_OVER' && (
        <div className="host-stage game-over-screen">
          {roomState.winner === 'IMPOSTOR' ? (
            <div className="winner-box impostor">
              <ShieldAlert size={48} />
              <h1>¡VICTORIA DEL IMPOSTOR!</h1>
              <p>
                {roomState.impostorGuessedCorrectly
                  ? '¡El impostor fue expulsado pero adivinó la palabra secreta!'
                  : '¡El impostor logró pasar desapercibido y engañar a la clase!'}
              </p>
            </div>
          ) : (
            <div className="winner-box crewmates">
              <Trophy size={48} />
              <h1>¡VICTORIA DE LOS TRIPULANTES!</h1>
              <p>¡Descubrieron al impostor y protegieron la palabra secreta!</p>
            </div>
          )}

          <div className="secret-word-reveal">
            La palabra secreta era: <strong>"{roomState.secretWord}"</strong>
          </div>

          <div className="leaderboard">
            <h3>TABLA DE PUNTUACIÓN</h3>
            <div className="leaderboard-grid">
              {roomState.players
                .sort((a, b) => b.score - a.score)
                .map((p, idx) => (
                  <div key={p.id} className="leaderboard-row">
                    <span className="rank">#{idx + 1}</span>
                    <span className="avatar">
                      {idx === 0 ? <Crown size={18} className="text-yellow" /> : <AvatarIcon avatarId={p.avatar} size={18} isBot={p.isBot} />}
                    </span>
                    <span className="name">{p.name}</span>
                    <span className="score">{p.score} pts</span>
                  </div>
                ))}
            </div>
          </div>

          <button type="button" className="btn-primary reset-btn" onClick={resetGame}>
            <RotateCcw size={18} /> JUGAR OTRA PARTIDA
          </button>
        </div>
      )}
    </div>
  );
};
