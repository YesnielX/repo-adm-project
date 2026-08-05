import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  Clock,
  Vote,
  Send,
  AlertTriangle,
  X,
  Trophy,
  RotateCcw,
  Camera,
  QrCode,
  Loader2,
  Users,
  Ghost,
  KeyRound,
  User,
  Eye
} from 'lucide-react';
import { useGameSocket } from '../context/SocketContext';
import { AVATAR_OPTIONS, AvatarIcon } from './AvatarIcon';
import { QRScannerModal } from './QRScannerModal';

const COLORS = ['#aa3bff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const PROFILE_STORAGE_KEY = 'codeimpostor_player_profile';
const SESSION_STORAGE_KEY = 'codeimpostor_player_session';

// Segundos de cada fase, para el anillo de progreso
const PHASE_SECONDS: Record<string, number> = {
  HINT_PHASE: 30,
  SHOWCASE: 35,
  VOTING: 20
};

const getSavedSession = (): { roomCode: string; token: string } | null => {
  try {
    const data = localStorage.getItem(SESSION_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const PlayerView: React.FC = () => {
  const {
    socket,
    roomState,
    myPlayerId,
    myRoleInfo,
    impostorOptions,
    errorMessage,
    joinRoom,
    submitHint,
    submitVote,
    submitImpostorGuess,
    clearError,
    resetToLanding
  } = useGameSocket();

  // Perfil guardado en localStorage para que no haya que rellenar cada vez
  const savedProfile = React.useMemo(() => {
    try {
      const data = localStorage.getItem(PROFILE_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, []);

  const [name, setName] = useState(savedProfile?.name || '');
  const [roomCode, setRoomCode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room') || '';
  });
  const [selectedAvatar, setSelectedAvatar] = useState(savedProfile?.avatar || AVATAR_OPTIONS[0].id);
  const [selectedColor, setSelectedColor] = useState(savedProfile?.color || COLORS[0]);
  const [hintInput, setHintInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [joining, setJoining] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const autoRejoinAttemptedRef = useRef(false);

  // Reset del borrador al salir de la fase de pistas: ajustar estado durante
  // el render con guarda (patrón de React), sin setState en effects.
  const [lastStatus, setLastStatus] = useState(roomState?.status ?? null);
  if (roomState && roomState.status !== lastStatus) {
    if (lastStatus === 'HINT_PHASE') {
      setHintInput('');
    }
    setLastStatus(roomState.status);
  }

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, [roomState?.status]);

  // Auto-rejoin: URL apunta a una sala y hay sesión guardada para esa sala
  const roomParam = new URLSearchParams(window.location.search).get('room');
  const hasMatchingSession = !!roomParam && !!savedProfile?.name && getSavedSession()?.roomCode === roomParam;
  const isAutoRejoining = !roomState && hasMatchingSession && !errorMessage;

  useEffect(() => {
    if (!socket || autoRejoinAttemptedRef.current) return;

    const session = getSavedSession();
    if (!session || session.roomCode !== roomCode) return;
    if (!savedProfile?.name) return;

    autoRejoinAttemptedRef.current = true;
    joinRoom(roomCode, savedProfile.name, savedProfile.avatar, savedProfile.color, session.token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomCode, savedProfile]);

  const handleJoin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (joining) return; // Evita un doble join_room con doble clic
    if (!name.trim() || !roomCode.trim()) return;

    try {
      localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({ name: name.trim(), avatar: selectedAvatar, color: selectedColor })
      );
    } catch (err) {
      console.error(err);
    }

    setJoining(true);
    joinRoom(roomCode.trim(), name.trim(), selectedAvatar, selectedColor);
  };

  // Estado derivado: el botón deja de mostrar "entrando" cuando el join
  // resuelve (sala creada o error), sin setState en effects.
  const isJoining = joining && !roomState && !errorMessage;

  const handleScanSuccess = (scannedCode: string) => {
    setRoomCode(scannedCode);
    setShowScanner(false);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleHintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hintInput.trim()) return;
    if (navigator.vibrate) navigator.vibrate(50);
    submitHint(hintInput.trim());
    setHintInput(''); // Limpia el borrador; evita filtrarlo a la próxima partida
  };

  const handleVote = (targetId: string) => {
    if (navigator.vibrate) navigator.vibrate(50);
    submitVote(targetId);
  };

  const handleClearExpiredRoom = () => {
    setRoomCode('');
    clearError();
    resetToLanding();
  };

  const me = roomState?.players.find((p) => p.id === myPlayerId);

  // En la escena de votos, el expulsado se revela en la segunda mitad.
  const revealEjected = roomState?.status === 'EJECTION' && (roomState.timer ?? 0) <= 4;

  const timerRing = (pct: number) => (
    <span
      className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#00f2fe ${pct}%, rgba(255,255,255,0.08) 0)` }}
    >
      <span className="absolute inset-1 rounded-full bg-cyber-card"></span>
      <span className="relative text-sm font-extrabold">{roomState?.timer}</span>
    </span>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-white" ref={containerRef}>
      {/* Reconexión */}
      {!roomState && isAutoRejoining && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Loader2 size={36} className="animate-spin text-cyber-cyan" />
          <div>
            <h2 className="text-lg font-bold">Reconectando</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">Recuperando tu rol, pistas y progreso.</p>
          </div>
        </div>
      )}

      {/* Formulario de unión */}
      {!roomState && !isAutoRejoining && (
        <div className="flex h-full flex-col overflow-hidden px-5 pb-6 pt-6">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/40 bg-purple-500/10 text-cyber-purple">
              <ShieldAlert size={24} />
            </div>
            <h1 className="font-display text-lg font-extrabold tracking-[2px]">CODE IMPOSTOR</h1>
            <p className="mt-0.5 text-xs text-muted">Únete a la partida desde tu móvil</p>
          </div>

          {errorMessage && (
            <div className="mb-6 flex flex-col gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-red-300">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={20} />
                <div>
                  <strong className="block text-sm">La sala no existe o ha caducado</strong>
                  <p className="mt-0.5 text-[12.5px] text-muted">Comprueba el código con el Host de la partida.</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:border-cyber-cyan hover:bg-white/10"
                  onClick={handleClearExpiredRoom}
                >
                  <RotateCcw size={14} /> Cambiar código
                </button>
                <button
                  type="button"
                  className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-white/5 text-muted transition hover:bg-white/10 hover:text-white"
                  onClick={clearError}
                  aria-label="Cerrar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {showScanner && (
            <QRScannerModal
              onScanSuccess={handleScanSuccess}
              onClose={() => setShowScanner(false)}
            />
          )}

          <form onSubmit={handleJoin} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label className="text-xs font-bold uppercase tracking-[1.5px] text-muted" htmlFor="pv-room">
                  Código de sala
                </label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-cyber-cyan transition hover:opacity-80"
                  onClick={() => setShowScanner(true)}
                >
                  <Camera size={14} /> Escanear
                </button>
              </div>
              <div className="relative">
                <KeyRound size={18} className="pointer-events-none absolute left-3.25 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="pv-room"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  className="input-base pl-10 pr-12 text-center text-2xl font-extrabold tracking-[8px]"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-white/5 text-cyber-cyan transition hover:bg-cyan-400/15"
                  onClick={() => setShowScanner(true)}
                  title="Escanear con cámara"
                >
                  <QrCode size={20} />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[1.5px] text-muted" htmlFor="pv-name">
                Tu nombre
              </label>
              <div className="relative">
                <User size={18} className="pointer-events-none absolute left-3.25 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="pv-name"
                  type="text"
                  maxLength={15}
                  placeholder="Ingresa tu apodo"
                  className="input-base pl-10"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[1.5px] text-muted">Avatar</label>
              <div className="grid min-h-0 flex-1 content-start grid-cols-10 gap-1.5 overflow-y-auto p-0.5">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    className={`relative flex aspect-square items-center justify-center rounded-lg border transition ${selectedAvatar === av.id
                        ? 'border-cyber-cyan bg-cyan-400/10 text-white shadow-[0_0_14px_rgba(0,242,254,0.4)]'
                        : 'border-white/10 bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                      }`}
                    onClick={() => setSelectedAvatar(av.id)}
                    title={av.label}
                  >
                    <av.icon size={16} />
                    {selectedAvatar === av.id && (
                      <span className="absolute -right-1 -top-1 text-cyber-cyan drop-shadow-[0_0_4px_rgba(0,242,254,0.4)]">
                        <CheckCircle2 size={11} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[1.5px] text-muted">Color</label>
              <div className="flex justify-center gap-2.5 py-0.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition ${selectedColor === c
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-cyber-dark'
                        : 'border-[3px] border-white/25 hover:scale-105'
                      }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setSelectedColor(c)}
                    aria-label={`Color ${c}`}
                  >
                    {selectedColor === c && <CheckCircle2 size={14} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-cta" disabled={isJoining}>
              {isJoining ? <Loader2 size={20} className="animate-spin" /> : <Smartphone size={20} />}
              {isJoining ? 'ENTRANDO...' : 'ENTRAR A LA SALA'}
            </button>
            <p className="text-center text-xs text-muted">Red local · Sin instalar nada</p>
          </form>
        </div>
      )}

      {/* Dentro de la partida */}
      {roomState && (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-2.5 border-b border-white/10 bg-cyber-card/70 px-4 py-3 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/20 shadow-[0_0_12px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: me?.color || '#aa3bff' }}
              >
                <AvatarIcon avatarId={me?.avatar || 'terminal'} size={18} isBot={me?.isBot} />
              </span>
              <span className="truncate text-[15px] font-bold">{me?.name}</span>
            </div>
            <div className="flex flex-none items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold">
                #{roomState.roomCode}
              </span>
              {roomState.status !== 'LOBBY' && roomState.status !== 'GAME_OVER' && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-xs font-bold text-amber-300">
                  RONDA {roomState.round}/{roomState.maxRounds}
                </span>
              )}
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Espectador */}
            {me?.eliminated ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-16 w-16 animate-[pv-pulse_1.8s_ease-in-out_infinite] items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-400">
                  <Eye size={28} />
                </div>
                <h2 className="text-xl font-extrabold">Fuiste expulsado</h2>
                <p className="max-w-75 text-sm leading-relaxed text-muted">
                  Estás en modo espectador. Mira el proyector.
                </p>
              </div>
            ) : (
              <>
                {/* LOBBY: esperando */}
                {roomState.status === 'LOBBY' && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/5 text-cyber-cyan">
                      <Clock size={30} className="animate-[pv-pulse_1.8s_ease-in-out_infinite]" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold">Esperando a la clase</h2>
                      <p className="mx-auto mt-1 max-w-75 text-sm leading-relaxed text-muted">
                        El proyector iniciará la partida en cuanto haya jugadores.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">
                      <Users size={16} className="text-cyber-cyan" /> {roomState.players.length} jugadores
                    </div>
                  </div>
                )}

                {/* Revelación de rol */}
                {roomState.status === 'ROLE_REVEAL' && myRoleInfo && (
                  <div className="flex min-h-0 flex-1 flex-col px-5 pb-6">
                    {myRoleInfo.role === 'CREWMATE' ? (
                      <>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-emerald-400">Tripulante</p>
                        <h2 className="mt-1 text-lg font-bold text-muted">Tu palabra secreta</h2>
                        <div className="mt-3 rounded-3xl border border-emerald-500/40 bg-linear-to-b from-emerald-500/10 to-transparent p-6 text-center">
                          <p className="text-xs uppercase tracking-[2px] text-muted">{myRoleInfo.category}</p>
                          <p className="mt-2 wrap-break-word font-display text-3xl font-black tracking-tight text-emerald-400">
                            {myRoleInfo.word}
                          </p>
                        </div>
                        <p className="mt-3 rounded-xl border-l-[3px] border-l-cyber-cyan bg-white/5 p-3 text-sm leading-relaxed text-muted">
                          💡 Escribe una pista sutil. No se la pongas fácil al impostor.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-red-400">Impostor</p>
                        <h2 className="mt-1 text-lg font-bold text-muted">No conoces la palabra</h2>
                        <div className="mt-3 rounded-3xl border border-red-500/40 bg-linear-to-b from-red-500/10 to-transparent p-6 text-center">
                          <Ghost size={40} className="mx-auto text-red-400" />
                          <p className="mt-2 text-sm text-muted">{myRoleInfo.category}</p>
                          <p className="mt-1 text-xl font-extrabold text-red-400">¿¿¿???</p>
                        </div>
                        <p className="mt-3 rounded-xl border-l-[3px] border-l-red-500 bg-white/5 p-3 text-sm leading-relaxed text-muted">
                          🕵️ Disimula: escribe una pista ambigua y evita que te voten.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Fase de pistas: el input es el protagonista */}
                {roomState.status === 'HINT_PHASE' && (
                  <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-lg font-extrabold">Escribe tu pista</h2>
                      {timerRing((roomState.timer / PHASE_SECONDS.HINT_PHASE) * 100)}
                    </div>
                    <p className="mb-3 text-sm leading-relaxed text-muted">
                      1 o 2 palabras clave que revelen la palabra sin delatarla.
                    </p>
                    {me?.hasSubmittedHint ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <CheckCircle2 size={44} className="text-emerald-400" />
                        <h3 className="text-lg font-extrabold">Pista enviada</h3>
                        <p className="max-w-70 text-sm leading-relaxed text-muted">
                          Mira el proyector mientras todos escriben.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleHintSubmit} className="flex min-h-0 flex-1 flex-col gap-3" noValidate>
                        <div className="relative min-h-0 flex-1">
                          <textarea
                            className="input-base h-full resize-none leading-relaxed focus:border-cyber-purple focus:ring-purple-500/30"
                            rows={4}
                            maxLength={40}
                            placeholder="Ej. ciclos, incrementos, sprints..."
                            value={hintInput}
                            onChange={(e) => setHintInput(e.target.value)}
                            required
                            autoFocus
                          />
                          <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-cyber-card/85 px-1.5 py-0.5 text-[11px] font-bold text-muted">
                            {hintInput.length}/40
                          </span>
                        </div>
                        <button type="submit" className="btn-cta" disabled={!hintInput.trim()}>
                          <Send size={18} /> ENVIAR PISTA
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Debate: las pistas en una grilla compacta */}
                {roomState.status === 'SHOWCASE' && (
                  <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-4">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-extrabold">Debate en curso</h2>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          Lee las pistas. ¿Quién no conoce la palabra?
                        </p>
                      </div>
                      <span className="inline-flex flex-none items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-2.5 py-1.5 text-xs font-bold text-cyber-cyan">
                        <Clock size={13} /> {roomState.timer}s
                      </span>
                    </div>
                    <div className="grid min-h-0 flex-1 content-start grid-cols-2 gap-2 overflow-y-auto pr-0.5">
                      {roomState.players.map((p) => (
                        <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                          <p className="truncate text-xs font-semibold">{p.name}</p>
                          <p className="mt-1 line-clamp-3 wrap-break-word text-xs leading-snug text-white/90">
                            "{p.hint || 'Sin pista'}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Votación: la lista llena la pantalla */}
                {roomState.status === 'VOTING' && (
                  <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-4">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-extrabold">¿Quién es el impostor?</h2>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          Toca a quien creas que no conoce la palabra.
                        </p>
                      </div>
                      {timerRing((roomState.timer / PHASE_SECONDS.VOTING) * 100)}
                    </div>
                    {me?.hasVoted ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <CheckCircle2 size={44} className="text-emerald-400" />
                        <h3 className="text-lg font-extrabold">Voto registrado</h3>
                        <p className="text-sm leading-relaxed text-muted">Esperando a los demás...</p>
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
                        {roomState.players
                          .filter((p) => p.id !== myPlayerId)
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${p.connected && !p.eliminated
                                  ? 'border-white/10 bg-white/5 hover:translate-x-1 hover:border-cyber-purple hover:bg-purple-500/10'
                                  : 'border-white/10 bg-white/5'
                                }`}
                              onClick={() => handleVote(p.id)}
                              disabled={!p.connected || p.eliminated}
                            >
                              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/20" style={{ backgroundColor: p.color }}>
                                <AvatarIcon avatarId={p.avatar} size={18} isBot={p.isBot} />
                              </span>
                              <span className="flex-1 truncate text-[14.5px] font-semibold">{p.name}</span>
                              {p.eliminated ? (
                                <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-muted">
                                  ELIMINADO
                                </span>
                              ) : !p.connected ? (
                                <span className="rounded-lg border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-red-400">
                                  OFFLINE
                                </span>
                              ) : null}
                              <span className="flex text-muted"><Vote size={16} /></span>
                            </button>
                          ))}

                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 p-3 text-left text-white opacity-80 transition hover:bg-white/10"
                          onClick={() => handleVote('SKIP')}
                        >
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/20 bg-white/10 text-muted">
                            <X size={16} />
                          </span>
                          <span className="flex-1 truncate text-[14.5px] font-semibold">Saltar voto / Nadie</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Resultado de la votación: escena de votos */}
                {roomState.status === 'EJECTION' && (
                  <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-lg font-extrabold">Votos</h2>
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-2.5 py-1.5 text-xs font-bold text-cyber-cyan">
                        <Clock size={13} /> {roomState.timer}s
                      </span>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
                      {[...roomState.players]
                        .sort((a, b) => (roomState.voteCounts?.[b.id] ?? 0) - (roomState.voteCounts?.[a.id] ?? 0))
                        .map((p) => {
                          const votes = roomState.voteCounts?.[p.id] ?? 0;
                          const ejected = roomState.ejectedPlayer?.id === p.id;
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${revealEjected && ejected ? 'border-red-500/60 bg-red-500/15' : 'border-white/10 bg-white/5'
                                }`}
                            >
                              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full" style={{ backgroundColor: p.color }}>
                                <AvatarIcon avatarId={p.avatar} size={14} isBot={p.isBot} />
                              </span>
                              <span className="flex-1 truncate text-left text-sm font-semibold">{p.name}</span>
                              {votes > 0 && (
                                <span className="flex items-center gap-0.5 text-red-400">
                                  {Array.from({ length: Math.min(votes, 4) }).map((_, i) => (
                                    <X key={i} size={13} />
                                  ))}
                                  {votes > 4 && <span className="text-[11px] font-bold">+{votes - 4}</span>}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    {revealEjected && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center">
                        {roomState.ejectedPlayer ? (
                          <p className="text-sm font-bold text-white">
                            {roomState.ejectedPlayer.name} fue expulsado
                            <span className={`ml-2 text-xs font-extrabold ${roomState.ejectedPlayer.role === 'IMPOSTOR' ? 'text-red-400' : 'text-emerald-400'}`}>
                              {roomState.ejectedPlayer.role === 'IMPOSTOR' ? '· ERA EL IMPOSTOR' : '· No era el impostor'}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-white">Empate en los votos. Nadie fue expulsado.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Última oportunidad del impostor */}
                {roomState.status === 'GUESS_PHASE' && (
                  myRoleInfo?.role === 'IMPOSTOR' ? (
                    <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[2px] text-red-400">Última oportunidad</p>
                      <h2 className="mt-1 text-xl font-extrabold">Te descubrieron</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        Adivina la palabra correcta para robar la victoria:
                      </p>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        {impostorOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className="rounded-2xl border border-white/10 bg-white/5 p-5 text-base font-bold text-white transition hover:-translate-y-0.5 hover:border-cyber-cyan hover:bg-cyan-400/10 hover:shadow-[0_0_18px_rgba(0,242,254,0.4)]"
                            onClick={() => submitImpostorGuess(opt)}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                      <Clock size={36} className="animate-[pv-pulse_1.6s_ease-in-out_infinite] text-cyber-cyan" />
                      <h2 className="text-xl font-extrabold">El impostor elige...</h2>
                      <p className="max-w-75 text-sm leading-relaxed text-muted">
                        Fue descubierto y está eligiendo una palabra.
                      </p>
                    </div>
                  )
                )}

                {/* Fin de la partida */}
                {roomState.status === 'GAME_OVER' && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="flex h-20 w-20 animate-[pv-pop_0.45s_ease_both] items-center justify-center rounded-3xl border border-amber-400/40 bg-amber-400/10 text-amber-300">
                      <Trophy size={40} />
                    </div>
                    {roomState.winner === 'IMPOSTOR' ? (
                      <>
                        <h2 className="text-2xl font-black text-red-400">¡Ganó el Impostor!</h2>
                        <p className="max-w-[320px] text-sm leading-relaxed text-muted">
                          {roomState.impostorGuessedCorrectly
                            ? 'Adivinó la palabra en la última oportunidad.'
                            : 'Pasó desapercibido entre los Tripulantes.'}
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-2xl font-black text-emerald-400">¡Ganaron los Tripulantes!</h2>
                        <p className="max-w-[320px] text-sm leading-relaxed text-muted">
                          Descubrieron al impostor y protegieron la palabra secreta.
                        </p>
                      </>
                    )}
                    <p className="text-xs text-muted">Mira el proyector para ver las puntuaciones.</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
};
