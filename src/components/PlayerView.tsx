import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
  Eye,
  Home,
  Lightbulb
} from 'lucide-react';
import { useGameSocket } from '../context/SocketContext';
import type { RoomState } from '../context/SocketContext';
import { AVATAR_OPTIONS, AvatarIcon } from './AvatarIcon';
import { QRScannerModal } from './QRScannerModal';
import { play } from 'cuelume';
import { playPhaseSound } from '../audio/gameSounds';

const COLORS = ['#a3e635', '#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const PROFILE_STORAGE_KEY = 'codeimpostor_player_profile';
const SESSION_STORAGE_KEY = 'codeimpostor_player_session';

// Segundos de cada fase, para el anillo de progreso. El servidor los envía en
// roomState.phaseSeconds (fuente única de verdad); estos son solo el respaldo
// si un servidor antiguo no los incluye.
const PHASE_SECONDS: Record<string, number> = {
  ROLE_REVEAL: 6,
  HINT_PHASE: 30,
  SHOWCASE: 35,
  VOTING: 20,
  EJECTION: 8,
  GUESS_PHASE: 15
};
const phaseSecondsOf = (roomState: RoomState | null, phase: string): number =>
  roomState?.phaseSeconds?.[phase] ?? PHASE_SECONDS[phase] ?? 30;

const getSavedSession = (): { roomCode: string; token: string } | null => {
  try {
    const data = localStorage.getItem(SESSION_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

interface PlayerViewProps {
  roomParam?: string;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ roomParam = '' }) => {
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
  const navigate = useNavigate();

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
  const [roomCode, setRoomCode] = useState(roomParam);
  const [selectedAvatar, setSelectedAvatar] = useState(savedProfile?.avatar || AVATAR_OPTIONS[0].id);
  const [selectedColor, setSelectedColor] = useState(savedProfile?.color || COLORS[0]);
  const [hintInput, setHintInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const autoRejoinAttemptedRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);
  const prevRoomCodeLenRef = useRef(0);

  useEffect(() => {
    const status = roomState?.status ?? null;
    if (status && status !== prevStatusRef.current && prevStatusRef.current !== null) {
      playPhaseSound(status);
    }
    prevStatusRef.current = status;
  }, [roomState?.status]);

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
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      );
    }

    if (roomState?.status === 'GAME_OVER') {
      play('success');
    }
  }, [roomState?.status]);

  // Sonido de llegada a la pantalla de unirse (solo la primera vez al montar).
  const arrivalPlayedRef = useRef(false);
  useEffect(() => {
    if (!arrivalPlayedRef.current) {
      arrivalPlayedRef.current = true;
      play('arrival');
    }
  }, []);

  // Auto-rejoin: la URL apunta a una sala y hay sesión guardada para esa sala
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
    setJoining(false);
    resetToLanding();
    navigate({ to: '/codeimpostor/unirse', search: {} });
  };

  const handleBackToHome = () => {
    setShowExitModal(true);
  };

  const confirmExit = () => {
    setShowExitModal(false);
    setJoining(false);
    resetToLanding();
    navigate({ to: '/codeimpostor/unirse', search: {} });
  };

  const me = roomState?.players.find((p) => p.id === myPlayerId);

  // En la escena de votos, el expulsado se revela en la segunda mitad.
  const revealEjected = roomState?.status === 'EJECTION' && (roomState.timer ?? 0) <= 4;

  const timerRing = (pct: number) => (
    <span
      className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#a3e635 ${pct}%, rgba(255,255,255,0.08) 0)` }}
    >
      <span className="absolute inset-1 rounded-full bg-panel"></span>
      <span className="relative text-sm font-extrabold">{roomState?.timer}</span>
    </span>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface text-white" ref={containerRef}>
      {/* Reconexión */}
      {!roomState && isAutoRejoining && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Loader2 size={36} className="animate-spin text-accent" />
          <div>
            <h2 className="text-lg font-bold">Reconectando</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">Recuperando tu rol, pistas y progreso.</p>
          </div>
        </div>
      )}

      {/* Formulario de unión */}
      {!roomState && !isAutoRejoining && (
        <div className="flex h-full flex-col overflow-hidden px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6 md:mx-auto md:w-full md:max-w-[480px]">
          {/* Botón volver */}
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            className="group absolute left-4 top-5 flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-sm font-bold text-muted transition-colors hover:border-white/25 hover:text-white sm:left-6 sm:top-6 sm:px-4 sm:py-2.5"
            title="Volver al inicio"
            data-cuelume-press
            data-cuelume-release
          >
            <Home size={18} />
            <span className="hidden sm:inline">Volver</span>
          </button>

          <div className="mb-4 text-center sm:mb-5">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-accent sm:h-12 sm:w-12">
              <ShieldAlert size={22} className="sm:hidden" />
              <ShieldAlert size={24} className="hidden sm:block" />
            </div>
            <h1 className="font-display text-base font-extrabold tracking-[2px] sm:text-lg">CODE IMPOSTOR</h1>
            <p className="mt-0.5 text-xs text-muted">Únete a la partida desde tu móvil</p>
          </div>

          {errorMessage && (
            <div className="mb-5 flex flex-col gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-red-300 sm:mb-6">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="flex-shrink-0 sm:hidden" />
                <AlertTriangle size={20} className="hidden flex-shrink-0 sm:block" />
                <div>
                  <strong className="block text-xs font-semibold sm:text-sm">La sala no existe o ha caducado</strong>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted sm:text-[12.5px]">Comprueba el código con el Host de la partida.</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/10 sm:px-3 sm:text-[12.5px]"
                  onClick={handleClearExpiredRoom}
                  data-cuelume-press
                  data-cuelume-release
                >
                  <RotateCcw size={13} className="sm:hidden" />
                  <RotateCcw size={14} className="hidden sm:block" />
                  Cambiar código
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-white sm:h-7.5 sm:w-7.5"
                  onClick={clearError}
                  aria-label="Cerrar"
                  data-cuelume-press
                  data-cuelume-release
                >
                  <X size={15} className="sm:hidden" />
                  <X size={16} className="hidden sm:block" />
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
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-accent transition-colors hover:opacity-80"
                  onClick={() => setShowScanner(true)}
                  data-cuelume-press
                  data-cuelume-release
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
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '');
                    const prevLen = prevRoomCodeLenRef.current;
                    // Tick por dígito nuevo; chime al completar los 4.
                    if (next.length > prevLen) {
                      play('tick');
                      if (next.length === 4) play('chime');
                    }
                    prevRoomCodeLenRef.current = next.length;
                    setRoomCode(next);
                  }}
                  required
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-white/5 text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                  onClick={() => setShowScanner(true)}
                  title="Escanear con cámara"
                  data-cuelume-press
                  data-cuelume-release
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
              <div className="grid min-h-0 flex-1 content-start grid-cols-8 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-10 md:gap-2">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    className={`relative flex aspect-square items-center justify-center rounded-lg border transition ${selectedAvatar === av.id
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-line bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                      }`}
                    onClick={() => setSelectedAvatar(av.id)}
                    title={av.label}
                    data-cuelume-toggle
                  >
                    <av.icon size={14} className="sm:hidden" />
                    <av.icon size={16} className="hidden sm:block" />
                    {selectedAvatar === av.id && (
                      <span className="absolute -right-0.5 -top-0.5 text-accent sm:-right-1 sm:-top-1">
                        <CheckCircle2 size={10} className="sm:hidden" />
                        <CheckCircle2 size={11} className="hidden sm:block" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[1.5px] text-muted">Color</label>
              <div className="flex justify-center gap-2 py-0.5 sm:gap-2.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition sm:h-9 sm:w-9 ${
                      selectedColor === c
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-surface'
                        : 'border-[3px] border-white/25 hover:scale-105'
                      }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setSelectedColor(c)}
                    aria-label={`Color ${c}`}
                    data-cuelume-toggle
                  >
                    {selectedColor === c && <CheckCircle2 size={13} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:hidden" />}
                    {selectedColor === c && <CheckCircle2 size={14} className="hidden text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:block" />}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-cta text-sm sm:text-[15px]" disabled={isJoining} data-cuelume-press="pulse" data-cuelume-release>
              {isJoining ? <Loader2 size={18} className="animate-spin sm:hidden" /> : <Smartphone size={18} className="sm:hidden" />}
              {isJoining ? <Loader2 size={20} className="hidden animate-spin sm:block" /> : <Smartphone size={20} className="hidden sm:block" />}
              {isJoining ? 'ENTRANDO...' : 'ENTRAR A LA SALA'}
            </button>
            <p className="text-center text-xs text-muted">Red local</p>
          </form>
        </div>
      )}

      {/* Dentro de la partida */}
      {roomState && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Modal de confirmación de salida */}
          {showExitModal && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
              <div className="panel w-full max-w-sm p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 sm:h-12 sm:w-12">
                    <AlertTriangle size={20} className="text-red-400 sm:hidden" />
                    <AlertTriangle size={24} className="hidden text-red-400 sm:block" />
                  </div>
                  <h3 className="text-lg font-bold sm:text-xl">¿Salir de la sala?</h3>
                </div>
                <p className="mb-5 text-sm leading-relaxed text-muted sm:mb-6 sm:text-base">
                  Abandonarás la partida actual. {!me?.eliminated && roomState.status !== 'LOBBY' && roomState.status !== 'GAME_OVER' && (
                    <span className="text-white">Podrás volver a unirte con el mismo código.</span>
                  )}
                </p>
                <div className="flex gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExitModal(false)}
                    className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:px-5 sm:py-3 sm:text-base"
                    data-cuelume-press
                    data-cuelume-release
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmExit}
                    className="flex-1 rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/25 sm:px-5 sm:py-3 sm:text-base"
                    data-cuelume-press
                    data-cuelume-release
                  >
                    Salir
                  </button>
                </div>
              </div>
            </div>
          )}

          <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-surface/90 px-3 py-2.5 backdrop-blur-sm sm:gap-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={handleBackToHome}
                className="group flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line bg-raised text-muted transition-colors hover:border-white/25 hover:text-white sm:h-9 sm:w-9"
                title="Volver al inicio"
                data-cuelume-press
                data-cuelume-release
              >
                <Home size={15} className="sm:hidden" />
                <Home size={16} className="hidden sm:block" />
              </button>
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.35)] sm:h-9 sm:w-9"
                style={{ backgroundColor: me?.color || '#a3e635' }}
              >
                <AvatarIcon avatarId={me?.avatar || 'terminal'} size={16} isBot={me?.isBot} className="sm:hidden" />
                <AvatarIcon avatarId={me?.avatar || 'terminal'} size={18} isBot={me?.isBot} className="hidden sm:block" />
              </span>
              <span className="truncate text-sm font-bold sm:text-[15px]">{me?.name}</span>
            </div>
            <div className="flex flex-none items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-white/5 px-2 py-1 text-[11px] font-bold sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs">
                #{roomState.roomCode}
              </span>
              {roomState.status !== 'LOBBY' && roomState.status !== 'GAME_OVER' && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] font-bold text-amber-300 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs">
                  RONDA {roomState.round}/{roomState.maxRounds}
                </span>
              )}
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Espectador */}
            {me?.eliminated ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-16 w-16 animate-[pv-pulse_1.8s_ease-in-out_infinite] items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 text-red-400">
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
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center sm:gap-4 sm:px-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-accent/25 bg-accent/5 text-accent sm:h-16 sm:w-16">
                      <Clock size={26} className="animate-[pv-pulse_1.8s_ease-in-out_infinite] sm:hidden" />
                      <Clock size={30} className="hidden animate-[pv-pulse_1.8s_ease-in-out_infinite] sm:block" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold sm:text-xl">Esperando a la clase</h2>
                      <p className="mx-auto mt-1 max-w-[280px] text-xs leading-relaxed text-muted sm:max-w-75 sm:text-sm">
                        El proyector iniciará la partida en cuanto haya jugadores.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-3 py-1.5 text-xs font-bold sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
                      <Users size={14} className="text-accent sm:hidden" />
                      <Users size={16} className="hidden text-accent sm:block" />
                      {roomState.players.length} jugadores
                    </div>
                  </div>
                )}

                {/* Revelación de rol */}
                {roomState.status === 'ROLE_REVEAL' && myRoleInfo && (
                  <div className="flex min-h-0 flex-1 flex-col px-4 pb-5 sm:px-5 sm:pb-6 md:mx-auto md:w-full md:max-w-[480px]">
                    {myRoleInfo.role === 'CREWMATE' ? (
                      <>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-emerald-400">Tripulante</p>
                        <h2 className="mt-1 text-base font-bold text-muted sm:text-lg">Tu palabra secreta</h2>
                        <div className="mt-3 rounded-xl border border-emerald-500/40 bg-linear-to-b from-emerald-500/10 to-transparent p-5 text-center sm:p-6">
                          <p className="text-xs uppercase tracking-[2px] text-muted">{myRoleInfo.category}</p>
                          <p className="mt-2 wrap-break-word font-display text-2xl font-black tracking-tight text-emerald-400 sm:text-3xl">
                            {myRoleInfo.word}
                          </p>
                        </div>
                        <p className="mt-3 flex items-start gap-2 rounded-lg border-l-2 border-l-accent bg-raised p-3 text-xs leading-relaxed text-muted sm:text-sm">
                          <Lightbulb size={15} className="mt-0.5 flex-none text-accent" />
                          <span>Escribe una pista sutil. No se la pongas fácil al impostor.</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-red-400">Impostor</p>
                        <h2 className="mt-1 text-base font-bold text-muted sm:text-lg">No conoces la palabra</h2>
                        <div className="mt-3 rounded-xl border border-red-500/40 bg-linear-to-b from-red-500/10 to-transparent p-5 text-center sm:p-6">
                          <Ghost size={36} className="mx-auto text-red-400 sm:hidden" />
                          <Ghost size={40} className="mx-auto hidden text-red-400 sm:block" />
                          <p className="mt-2 text-xs text-muted sm:text-sm">{myRoleInfo.category}</p>
                          <p className="mt-1 text-lg font-extrabold text-red-400 sm:text-xl">¿¿¿???</p>
                        </div>
                        <p className="mt-3 flex items-start gap-2 rounded-lg border-l-2 border-l-red-500 bg-raised p-3 text-xs leading-relaxed text-muted sm:text-sm">
                          <Ghost size={15} className="mt-0.5 flex-none text-red-400" />
                          <span>Disimula: escribe una pista ambigua y evita que te voten.</span>
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Fase de pistas: el input es el protagonista */}
                {roomState.status === 'HINT_PHASE' && (
                  <div className="flex min-h-0 flex-1 flex-col px-4 pb-5 pt-3 sm:px-5 sm:pb-6 sm:pt-4 md:mx-auto md:w-full md:max-w-[520px]">
                    <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                      <h2 className="text-base font-extrabold sm:text-lg">Escribe tu pista</h2>
                      {timerRing((roomState.timer / phaseSecondsOf(roomState, 'HINT_PHASE')) * 100)}
                    </div>
                    <p className="mb-2.5 text-xs leading-relaxed text-muted sm:mb-3 sm:text-sm">
                      1 o 2 palabras clave que revelen la palabra sin delatarla.
                    </p>
                    {me?.hasSubmittedHint ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-center sm:gap-3">
                        <CheckCircle2 size={40} className="text-emerald-400 sm:hidden" />
                        <CheckCircle2 size={44} className="hidden text-emerald-400 sm:block" />
                        <h3 className="text-base font-extrabold sm:text-lg">Pista enviada</h3>
                        <p className="max-w-[260px] text-xs leading-relaxed text-muted sm:max-w-70 sm:text-sm">
                          Mira el proyector mientras todos escriben.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleHintSubmit} className="flex min-h-0 flex-1 flex-col gap-2.5 sm:gap-3" noValidate>
                        <div className="relative min-h-0 flex-1">
                          <textarea
                            className="input-base h-full resize-none text-sm leading-relaxed sm:text-base"
                            rows={4}
                            maxLength={40}
                            placeholder="Ej. ciclos, incrementos, sprints..."
                            value={hintInput}
                            onChange={(e) => setHintInput(e.target.value)}
                            required
                            autoFocus
                          />
                          <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-lg bg-raised px-1.5 py-0.5 text-[11px] font-bold text-muted sm:bottom-3 sm:right-3">
                            {hintInput.length}/40
                          </span>
                        </div>
                        <button type="submit" className="btn-cta text-sm sm:text-[15px]" disabled={!hintInput.trim()} data-cuelume-press="pulse" data-cuelume-release>
                          <Send size={16} className="sm:hidden" />
                          <Send size={18} className="hidden sm:block" />
                          ENVIAR PISTA
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
                      <span className="inline-flex flex-none items-center gap-1 rounded-full border border-line bg-raised px-2.5 py-1.5 text-xs font-bold text-muted">
                        <Clock size={13} /> {roomState.timer}s
                      </span>
                    </div>
                    <div className="grid min-h-0 flex-1 content-start grid-cols-2 gap-2 overflow-y-auto pr-0.5">
                      {roomState.players.map((p) => (
                        <div key={p.id} className="rounded-lg border border-line bg-white/5 p-2.5">
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
                      {timerRing((roomState.timer / phaseSecondsOf(roomState, 'VOTING')) * 100)}
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
                              className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${p.connected && !p.eliminated
                                  ? 'border-line bg-white/5 hover:border-accent hover:bg-accent/10'
                                  : 'border-line bg-white/5'
                                }`}
                              onClick={() => handleVote(p.id)}
                              disabled={!p.connected || p.eliminated}
                              data-cuelume-press
                              data-cuelume-release
                            >
                              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20" style={{ backgroundColor: p.color }}>
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
                          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-line p-3 text-left text-white opacity-80 transition-colors hover:bg-white/10"
                          onClick={() => handleVote('SKIP')}
                          data-cuelume-press
                          data-cuelume-release
                        >
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-line bg-white/10 text-muted">
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
                      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2.5 py-1.5 text-xs font-bold text-muted">
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
                              className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition ${revealEjected && ejected ? 'border-red-500/60 bg-red-500/15' : 'border-line bg-white/5'
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
                      <div className="mt-3 rounded-lg border border-line bg-white/5 px-4 py-2.5 text-center">
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
                            className="rounded-lg border border-line bg-white/5 p-5 text-base font-bold text-white transition-colors hover:border-accent hover:bg-accent/10"
                            onClick={() => submitImpostorGuess(opt)}
                            data-cuelume-press
                            data-cuelume-release
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                      <Clock size={36} className="animate-[pv-pulse_1.6s_ease-in-out_infinite] text-accent" />
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
                    <div className="flex h-20 w-20 animate-[pv-pop_0.45s_ease_both] items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-300">
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
