import React, { useEffect, useRef, useState } from 'react';
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
  X,
  Sparkles,
  MessageSquare,
  Home,
  AlertTriangle
} from 'lucide-react';
import { useGameSocket } from '../context/SocketContext';
import { AvatarIcon } from './AvatarIcon';

export const HostView: React.FC = () => {
  const { roomState, localIp, startGame, addBots, resetGame } = useGameSocket();
  const stageRef = useRef<HTMLDivElement>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  const handleBackToHome = () => {
    setShowExitModal(true);
  };

  const confirmExit = () => {
    window.location.href = '/';
  };

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

  const timerRingClass =
    roomState.status === 'VOTING'
      ? 'border-red-500 bg-red-500/15'
      : roomState.status === 'GUESS_PHASE'
        ? 'border-amber-400 bg-amber-400/15'
        : 'border-cyber-purple bg-purple-500/15';

  const botBtnClass =
    'inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-4 py-3 text-sm font-bold text-cyber-cyan transition hover:-translate-y-0.5 hover:bg-cyan-400/30';

  // En la escena de votos, el expulsado se revela en la segunda mitad.
  const revealEjected = roomState.status === 'EJECTION' && roomState.timer <= 4;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col p-4 sm:p-6 lg:p-8" ref={stageRef}>
      {/* Modal de confirmación de salida */}
      {showExitModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="glass-card w-full max-w-md p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <h3 className="text-xl font-bold">¿Salir de la sala?</h3>
            </div>
            <p className="mb-6 leading-relaxed text-muted">
              Se cerrará la sala y <strong className="text-white">todos los jugadores serán desconectados</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmExit}
                className="flex-1 rounded-xl border border-red-500/40 bg-red-500/15 px-5 py-3 font-bold text-red-400 transition hover:bg-red-500/25"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="mb-8 flex flex-col items-start justify-between gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <ShieldAlert className="text-cyber-purple" size={36} />
          <h1 className="text-[28px] font-black tracking-wide">CODE IMPOSTOR</h1>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={handleBackToHome}
            className="group inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyber-cyan shadow-[0_0_20px_rgba(0,242,254,0.15)] transition-all hover:-translate-x-1 hover:border-cyan-400/50 hover:bg-cyan-400/20 hover:shadow-[0_0_30px_rgba(0,242,254,0.3)] sm:px-5 sm:py-3"
            title="Volver al inicio"
          >
            <Home size={18} className="transition-transform group-hover:-translate-x-0.5" />
            <span>Volver</span>
          </button>
          <div className="text-left sm:text-right">
            <span className="block text-xs tracking-wider text-muted">PROYECTOR HOST</span>
            <div className="flex items-center justify-start gap-2.5 sm:justify-end">
              <h2 className="font-display text-[36px] leading-none text-cyber-cyan">#{roomState.roomCode}</h2>
              {roomState.status !== 'LOBBY' && roomState.status !== 'GAME_OVER' && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-xs font-bold text-amber-300">
                  RONDA {roomState.round}/{roomState.maxRounds}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* LOBBY */}
      {roomState.status === 'LOBBY' && (
        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-8">
          <div className="glass-card mx-auto flex w-full max-w-[340px] flex-col items-center gap-4 p-5 text-center sm:p-6 lg:mx-0">
            <div className="flex items-center gap-2">
              <QrCode size={20} className="text-cyber-cyan" />
              <h3 className="text-sm tracking-wide text-cyber-cyan">¡ESCANEA CON TU MÓVIL!</h3>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[0_0_25px_rgba(255,255,255,0.2)]">
              <QRCodeSVG value={joinUrl} size={190} level="H" includeMargin />
            </div>
            <p className="break-all font-display text-[13px] text-muted">{joinUrl}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-1.5 text-xs text-emerald-400">
              <Wifi size={14} /> Wi-Fi Local
            </span>
          </div>

          <div className="glass-card flex flex-col p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
              <h3 className="text-base font-bold sm:text-lg">JUGADORES CONECTADOS ({roomState.players.length})</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={botBtnClass}
                  onClick={() => addBots(3)}
                  title="Agregar 3 bots de práctica"
                >
                  <Bot size={18} /> +3
                </button>
                <button type="button" className={botBtnClass} onClick={() => addBots(20)} title="Agregar 20 bots">
                  +20
                </button>
                <button type="button" className={botBtnClass} onClick={() => addBots(30)} title="Agregar 30 bots">
                  +30
                </button>
                <button type="button" className={botBtnClass} onClick={() => addBots(50)} title="Agregar 50 bots">
                  +50
                </button>

                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-linear-to-r from-cyber-purple to-[#7c3aed] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(170,59,255,0.5)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(170,59,255,0.5)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-7 sm:py-3.5 sm:text-base"
                  disabled={roomState.players.length < 3}
                  onClick={startGame}
                >
                  <Play size={18} />
                  <span className="hidden sm:inline">{roomState.players.length < 3
                    ? 'Esperando al menos 3 jugadores...'
                    : '¡INICIAR PARTIDA!'}</span>
                  <span className="sm:hidden">{roomState.players.length < 3 ? 'Esperando...' : 'INICIAR'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:gap-4">
              {roomState.players.length === 0 ? (
                <div className="col-span-full p-12 text-center text-sm text-muted sm:p-16">
                  <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-cyber-cyan"></span>
                  Escaneen el código QR para unirse a la sala...
                </div>
              ) : (
                roomState.players.map((p) => (
                  <div
                    key={p.id}
                    className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 bg-white/5 p-3 sm:p-4 ${!p.connected ? 'opacity-45' : ''} ${p.eliminated ? 'opacity-40' : ''}`}
                    style={{ borderColor: p.color }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:h-14 sm:w-14" style={{ backgroundColor: p.color }}>
                      <AvatarIcon avatarId={p.avatar} size={24} isBot={p.isBot} />
                    </div>
                    <span className="line-clamp-2 w-full text-center text-xs font-semibold sm:text-sm">{p.name}</span>
                    {p.eliminated && (
                      <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-muted">
                        ELIMINADO
                      </span>
                    )}
                    {p.isBot && (
                      <span className="rounded-full border border-blue-500/40 bg-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-blue-400">
                        BOT
                      </span>
                    )}
                    {!p.connected && (
                      <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-red-400">
                        OFFLINE
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* REVELACIÓN DE ROLES */}
      {roomState.status === 'ROLE_REVEAL' && (
        <div className="glass-card flex flex-1 flex-col items-center justify-center gap-6 p-12 text-center">
          <Sparkles size={48} className="animate-[spin_8s_linear_infinite] text-cyber-cyan" />
          <h2 className="text-3xl font-black">ASIGNANDO ROLES SECRETOS...</h2>
          <p className="text-muted">Mira tu teléfono para conocer tu rol.</p>
          <div className="mt-3 inline-block rounded-full border border-cyan-400/30 bg-cyan-400/15 px-5 py-2 text-cyber-cyan">
            Categoría: <strong>{roomState.category}</strong>
          </div>
        </div>
      )}

      {/* FASE DE PISTAS */}
      {roomState.status === 'HINT_PHASE' && (
        <div className="glass-card flex flex-1 flex-col items-center justify-center gap-6 p-12 text-center">
          <div className={`flex items-center gap-3 rounded-[30px] border-2 px-8 py-4 ${timerRingClass}`}>
            <Clock size={24} />
            <span className="font-display text-[28px] font-bold">{roomState.timer}s</span>
            <span className="text-sm">ESCRIBIENDO PISTAS...</span>
          </div>

          <h2 className="text-3xl font-black">ESCRIBIENDO PISTAS EN EL MÓVIL</h2>
          <p className="text-muted">
            Categoría: <strong>{roomState.category}</strong>
          </p>

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {roomState.players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 ${!p.connected ? 'opacity-45' : ''} ${p.eliminated ? 'opacity-40' : ''} ${p.hasSubmittedHint ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/15 bg-white/5">
                  <AvatarIcon avatarId={p.avatar} size={20} isBot={p.isBot} />
                </span>
                <span className="font-semibold">{p.name}</span>
                <span className="ml-auto text-xs">
                  {p.eliminated ? (
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-extrabold text-muted">ELIMINADO</span>
                  ) : !p.connected ? (
                    <span className="font-extrabold text-red-400">OFFLINE</span>
                  ) : p.hasSubmittedHint ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={14} /> Pista lista
                    </span>
                  ) : (
                    <span className="text-muted">Escribiendo...</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPOSICIÓN DE PISTAS Y DEBATE: muro legible, scroll solo dentro del panel */}
      {roomState.status === 'SHOWCASE' && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MessageSquare size={26} className="text-cyber-cyan" />
              <h2 className="text-2xl font-black">Pistas publicadas</h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyber-cyan">
              <Clock size={16} /> {roomState.timer}s
            </span>
          </div>
          <p className="text-sm text-muted">¿Quién dio una pista sospechosa? ¿Quién no conoce la palabra?</p>

          <div className="grid max-h-[calc(100dvh-240px)] min-h-0 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 overflow-y-auto pr-1">
            {roomState.players.map((p) => (
              <div key={p.id} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/5">
                    <AvatarIcon avatarId={p.avatar} size={18} isBot={p.isBot} />
                  </span>
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                </div>
                <p className="mt-2.5 line-clamp-4 wrap-break-word rounded-lg border-l-[3px] border-l-cyber-purple bg-purple-500/15 p-2.5 text-[15px] font-semibold leading-snug text-white">
                  "{p.hint || 'Sin pista'}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VOTACIÓN */}
      {roomState.status === 'VOTING' && (
        <div className="glass-card flex flex-1 flex-col items-center justify-center gap-6 p-12 text-center">
          <div className={`flex items-center gap-3 rounded-[30px] border-2 px-8 py-4 ${timerRingClass}`}>
            <Vote size={24} />
            <span className="font-display text-[28px] font-bold">{roomState.timer}s</span>
            <span className="text-sm">VOTACIÓN EN CURSO</span>
          </div>

          <h2 className="text-3xl font-black">¿QUIÉN ES EL IMPOSTOR?</h2>
          <p className="text-muted">Voten desde su celular.</p>

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {roomState.players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-2xl border p-3 ${!p.connected ? 'opacity-45' : ''} ${p.eliminated ? 'opacity-40' : ''} ${p.hasVoted ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center">
                  <AvatarIcon avatarId={p.avatar} size={18} isBot={p.isBot} />
                </span>
                <span className="truncate text-sm">{p.name}</span>
                <span className="ml-auto">
                  {p.eliminated ? (
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-extrabold text-muted">ELIMINADO</span>
                  ) : !p.connected ? (
                    <span className="text-[10px] font-extrabold text-red-400">OFFLINE</span>
                  ) : p.hasVoted ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <Clock size={14} className="text-muted" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPULSIÓN: escena de votos estilo Among Us */}
      {roomState.status === 'EJECTION' && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black">Votos</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyber-cyan">
              <Clock size={16} /> {roomState.timer}s
            </span>
          </div>

          <div className="flex w-full max-w-xl flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
            {[...roomState.players]
              .sort((a, b) => (roomState.voteCounts?.[b.id] ?? 0) - (roomState.voteCounts?.[a.id] ?? 0))
              .map((p) => {
                const votes = roomState.voteCounts?.[p.id] ?? 0;
                const ejected = roomState.ejectedPlayer?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                      revealEjected && ejected ? 'border-red-500/60 bg-red-500/15' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ backgroundColor: p.color }}>
                      <AvatarIcon avatarId={p.avatar} size={16} isBot={p.isBot} />
                    </span>
                    <span className="flex-1 truncate text-left text-sm font-semibold">{p.name}</span>
                    {votes > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        {Array.from({ length: Math.min(votes, 5) }).map((_, i) => (
                          <X key={i} size={14} />
                        ))}
                        {votes > 5 && <span className="text-xs font-bold">+{votes - 5}</span>}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>

          {revealEjected &&
            (roomState.ejectedPlayer ? (
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-3">
                <span className="text-xl font-bold">{roomState.ejectedPlayer.name}</span>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-extrabold ${
                    roomState.ejectedPlayer.role === 'IMPOSTOR'
                      ? 'border-red-500/50 bg-red-500/15 text-red-400'
                      : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {roomState.ejectedPlayer.role === 'IMPOSTOR' ? '¡ERA EL IMPOSTOR!' : 'No era el impostor'}
                </span>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center">
                <p className="text-lg font-bold">Empate en los votos. Nadie fue expulsado.</p>
                <p className="mt-1 text-sm text-muted">Sigue la siguiente ronda...</p>
              </div>
            ))}
        </div>
      )}

      {/* FASE DE ADIVINACIÓN DEL IMPOSTOR */}
      {roomState.status === 'GUESS_PHASE' && (
        <div className="glass-card flex flex-1 flex-col items-center justify-center gap-6 p-12 text-center">
          <div className={`flex items-center gap-3 rounded-[30px] border-2 px-8 py-4 ${timerRingClass}`}>
            <Clock size={24} />
            <span className="font-display text-[28px] font-bold">{roomState.timer}s</span>
            <span className="text-sm">ÚLTIMA OPORTUNIDAD</span>
          </div>
          <h2 className="max-w-150 text-3xl font-black">
            EL IMPOSTOR FUE DESCUBIERTO... ¡PERO INTENTA ROBAR LA VICTORIA!
          </h2>
          <p className="text-muted">
            El impostor tiene 15 segundos para adivinar la palabra entre 4 opciones desde su celular.
          </p>
        </div>
      )}

      {/* PANTALLA FINAL / GANADORES */}
      {roomState.status === 'GAME_OVER' && (
        <div className="glass-card flex flex-1 flex-col items-center justify-center gap-6 p-12 text-center">
          {roomState.winner === 'IMPOSTOR' ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-red-500/40 bg-red-500/10 p-8">
              <ShieldAlert size={48} className="text-red-400" />
              <h1 className="text-4xl font-black">¡VICTORIA DEL IMPOSTOR!</h1>
              <p className="max-w-105 text-muted">
                {roomState.impostorGuessedCorrectly
                  ? '¡El impostor fue expulsado pero adivinó la palabra secreta!'
                  : `¡El impostor logró sobrevivir ${roomState.round ?? 1} ${(roomState.round ?? 1) === 1 ? 'ronda' : 'rondas'} y engañar a la clase!`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-8">
              <Trophy size={48} className="text-emerald-400" />
              <h1 className="text-4xl font-black">¡VICTORIA DE LOS TRIPULANTES!</h1>
              <p className="max-w-105 text-muted">¡Descubrieron al impostor y protegieron la palabra secreta!</p>
            </div>
          )}

          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-white">
            La palabra secreta era: <strong>"{roomState.secretWord}"</strong>
          </div>

          <div className="w-full max-w-140 rounded-2xl border border-white/10 bg-black/30 p-5">
            <h3 className="mb-3 text-lg font-bold">TABLA DE PUNTUACIÓN</h3>
            <div>
              {roomState.players
                .sort((a, b) => b.score - a.score)
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-3 border-b border-white/5 p-3 last:border-0">
                    <span className="w-8 text-muted">#{idx + 1}</span>
                    <span className="flex h-8 w-8 items-center justify-center">
                      {idx === 0 ? (
                        <Crown size={18} className="text-amber-300" />
                      ) : (
                        <AvatarIcon avatarId={p.avatar} size={18} isBot={p.isBot} />
                      )}
                    </span>
                    <span className="font-semibold">{p.name}</span>
                    <span className="ml-auto font-bold text-cyber-cyan">{p.score} pts</span>
                  </div>
                ))}
            </div>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cyber-purple to-cyber-cyan px-8 py-4 text-[15px] font-extrabold tracking-wide text-[#0b0d18] shadow-[0_10px_30px_rgba(170,59,255,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(170,59,255,0.45)]"
            onClick={resetGame}
          >
            <RotateCcw size={18} /> JUGAR OTRA PARTIDA
          </button>
        </div>
      )}
    </div>
  );
};
