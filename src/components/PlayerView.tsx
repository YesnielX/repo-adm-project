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
  Sparkles,
  X,
  HelpCircle,
  Trophy,
  RotateCcw,
  Camera,
  QrCode
} from 'lucide-react';
import { useGameSocket } from '../context/SocketContext';
import { AVATAR_OPTIONS, AvatarIcon } from './AvatarIcon';
import { QRScannerModal } from './QRScannerModal';

const COLORS = ['#aa3bff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const PROFILE_STORAGE_KEY = 'codeimpostor_player_profile';
const SESSION_STORAGE_KEY = 'codeimpostor_player_session';

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

  // Cargar perfil guardado previamente en localStorage para máxima usabilidad
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
  const [hasVotedLocal, setHasVotedLocal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [joining, setJoining] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const autoRejoinAttemptedRef = useRef(false);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, [roomState?.status]);

  // True si la URL apunta a una sala y existe una sesión guardada para esa misma sala
  const roomParam = new URLSearchParams(window.location.search).get('room');
  const hasMatchingSession = !!roomParam && !!savedProfile?.name && getSavedSession()?.roomCode === roomParam;
  const isAutoRejoining = !roomState && hasMatchingSession && !errorMessage;

  // Auto-rejoin: si la URL apunta a una sala y hay sesión guardada para esa sala,
  // se re-une automáticamente con el perfil guardado y el token de la sesión.
  useEffect(() => {
    if (!socket || autoRejoinAttemptedRef.current) return;

    const session = getSavedSession();
    if (!session || session.roomCode !== roomCode) return;
    if (!savedProfile?.name) return;

    autoRejoinAttemptedRef.current = true;
    joinRoom(roomCode, savedProfile.name, savedProfile.avatar, savedProfile.color, session.token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomCode, savedProfile]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joining) return; // Guard de in-flight: evita doble join_room con doble clic
    if (!name.trim() || !roomCode.trim()) return;

    // Guardar perfil en localStorage para futuras partidas
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

  // Reset del guard una vez el join resuelve (éxito o error)
  useEffect(() => {
    if (roomState || errorMessage) {
      setJoining(false);
    }
  }, [roomState, errorMessage]);

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
  };

  const handleVote = (targetId: string) => {
    setHasVotedLocal(true);
    if (navigator.vibrate) navigator.vibrate(50);
    submitVote(targetId);
  };

  const handleClearExpiredRoom = () => {
    setRoomCode('');
    clearError();
    resetToLanding();
  };

  // Si no se ha unido a una sala
  if (!roomState) {
    if (isAutoRejoining) {
      return (
        <div className="player-mobile-container" ref={containerRef}>
          <div className="player-header">
            <ShieldAlert size={40} className="text-purple" />
            <h2>CODE IMPOSTOR</h2>
            <p>Unirse a la partida</p>
          </div>
          <div className="mobile-card reconnecting-card">
            <Sparkles size={32} className="text-cyan animate-pulse" />
            <h3>Reconectando a la partida...</h3>
            <p>Recuperando tu rol, pistas y progreso.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="player-mobile-container" ref={containerRef}>
        <div className="player-header">
          <ShieldAlert size={40} className="text-purple" />
          <h2>CODE IMPOSTOR</h2>
          <p>Unirse a la partida</p>
        </div>

        {errorMessage && (
          <div className="error-alert-banner">
            <div className="alert-content">
              <AlertTriangle size={20} className="text-red" />
              <div>
                <strong>La sala no existe o ha caducado</strong>
                <p>Comprueba el código con el Host de la partida.</p>
              </div>
            </div>
            <div className="alert-actions">
              <button type="button" className="btn-alert-clear" onClick={handleClearExpiredRoom}>
                <RotateCcw size={14} /> Cambiar código
              </button>
              <button type="button" className="btn-alert-close" onClick={clearError}>
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

        <form onSubmit={handleJoin} className="mobile-form">
          <div className="form-group">
            <div className="label-with-action">
              <label>Código de Sala (4 dígitos)</label>
              <button
                type="button"
                className="btn-scan-trigger"
                onClick={() => setShowScanner(true)}
              >
                <Camera size={15} /> Escanear QR
              </button>
            </div>

            <div className="input-with-scan">
              <input
                type="text"
                maxLength={4}
                placeholder="Ej. 1234"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-scan-icon-btn"
                onClick={() => setShowScanner(true)}
                title="Escanear con cámara"
              >
                <QrCode size={20} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Tu Nombre / Apodo</label>
            <input
              type="text"
              maxLength={15}
              placeholder="Ingresa tu apodo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Elige tu Avatar Visual</label>
            <div className="avatar-picker-grid">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  className={`avatar-icon-btn ${selectedAvatar === av.id ? 'active' : ''}`}
                  onClick={() => setSelectedAvatar(av.id)}
                  title={av.label}
                >
                  <av.icon size={22} />
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Elige tu Color</label>
            <div className="color-picker">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-btn ${selectedColor === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setSelectedColor(c)}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={joining}>
            <Smartphone size={18} /> ENTRAR A LA SALA
          </button>
        </form>
      </div>
    );
  }

  const me = roomState.players.find((p) => p.id === myPlayerId);

  return (
    <div className="player-mobile-container" ref={containerRef}>
      <header className="mobile-player-bar">
        <div className="player-identity">
          <span className="avatar-badge" style={{ backgroundColor: me?.color || '#aa3bff' }}>
            <AvatarIcon avatarId={me?.avatar || 'terminal'} size={20} isBot={me?.isBot} />
          </span>
          <span className="player-name-text">{me?.name}</span>
        </div>
        <div className="room-mini-badge">Sala #{roomState.roomCode}</div>
      </header>

      {/* 1. LOBBY ESPERA */}
      {roomState.status === 'LOBBY' && (
        <div className="mobile-card">
          <Clock size={36} className="text-cyan animate-pulse" />
          <h2>¡Estás dentro de la sala!</h2>
          <p>Mira la pantalla del proyector. Esperando a que el Host inicie la partida...</p>
          <div className="players-count-pill">
            👥 {roomState.players.length} Jugadores conectados
          </div>
        </div>
      )}

      {/* 2. REVELACIÓN DE ROL */}
      {roomState.status === 'ROLE_REVEAL' && myRoleInfo && (
        <div className={`mobile-card role-card ${myRoleInfo.role.toLowerCase()}`}>
          {myRoleInfo.role === 'CREWMATE' ? (
            <>
              <Sparkles size={40} className="text-green" />
              <span className="role-title crewmate">ERES TRIPULANTE</span>
              <p className="category-text">Categoría: <strong>{myRoleInfo.category}</strong></p>
              <div className="secret-word-box">
                <span>Tu Palabra Secreta:</span>
                <h3>{myRoleInfo.word}</h3>
              </div>
              <p className="hint-advice">
                💡 En la siguiente fase, escribe una pista sutil. ¡No se la pongas tan fácil al impostor!
              </p>
            </>
          ) : (
            <>
              <ShieldAlert size={40} className="text-red" />
              <span className="role-title impostor">ERES EL IMPOSTOR</span>
              <p className="category-text">Categoría: <strong>{myRoleInfo.category}</strong></p>
              <div className="secret-word-box impostor-box">
                <span>NO CONOCES LA PALABRA SECRETA</span>
              </div>
              <p className="hint-advice">
                🕵️ Lee el tema de la categoría, escribe una pista ambigua y disimula para no ser descubierto.
              </p>
            </>
          )}
        </div>
      )}

      {/* 3. FASE DE PISTAS */}
      {roomState.status === 'HINT_PHASE' && (
        <div className="mobile-card">
          <h3>Escribe tu Pista</h3>
          <p className="timer-sub"><Clock size={14} /> Tiempo restante: {roomState.timer}s</p>

          {me?.hasSubmittedHint ? (
            <div className="submitted-msg">
              <CheckCircle2 size={32} className="text-green" />
              <p>¡Pista enviada! Mira la pantalla del proyector.</p>
            </div>
          ) : (
            <form onSubmit={handleHintSubmit} className="hint-form">
              <input
                type="text"
                maxLength={40}
                placeholder="Escribe 1 o 2 palabras clave..."
                value={hintInput}
                onChange={(e) => setHintInput(e.target.value)}
                required
                autoFocus
              />
              <button type="submit" className="btn-primary btn-full">
                <Send size={18} /> ENVIAR PISTA
              </button>
            </form>
          )}
        </div>
      )}

      {/* 4. SHOWCASE DEBATE */}
      {roomState.status === 'SHOWCASE' && (
        <div className="mobile-card">
          <HelpCircle size={36} className="text-cyan" />
          <h2>Debate en curso</h2>
          <p>Mira las pistas proyectadas en la pantalla del proyector y habla con tus compañeros para identificar al Impostor.</p>
          <div className="timer-pill"><Clock size={14} /> {roomState.timer}s restantes</div>
        </div>
      )}

      {/* 5. VOTACIÓN */}
      {roomState.status === 'VOTING' && (
        <div className="mobile-card">
          <h3><Vote size={24} /> Vota al Sospechoso</h3>
          <p className="timer-sub"><Clock size={14} /> Tiempo restante: {roomState.timer}s</p>

          {me?.hasVoted || hasVotedLocal ? (
            <div className="submitted-msg">
              <CheckCircle2 size={32} className="text-green" />
              <p>Voto registrado. Esperando a los demás...</p>
            </div>
          ) : (
            <div className="vote-buttons-list">
              {roomState.players
                .filter((p) => p.id !== myPlayerId)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`vote-btn ${!p.connected ? 'offline' : ''}`}
                    onClick={() => handleVote(p.id)}
                    disabled={!p.connected}
                  >
                    <AvatarIcon avatarId={p.avatar} size={20} isBot={p.isBot} />
                    <span className="name">{p.name}</span>
                    {!p.connected && <span className="offline-mini-tag">OFFLINE</span>}
                  </button>
                ))}

              <button
                type="button"
                className="vote-btn skip-btn"
                onClick={() => handleVote('SKIP')}
              >
                Saltar Voto / Nadie
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. EXPULSIÓN */}
      {roomState.status === 'EJECTION' && (
        <div className="mobile-card">
          <AlertTriangle size={36} className="text-red" />
          <h2>Conteo de Votos</h2>
          <p>Mira la pantalla del proyector para ver quién fue expulsado...</p>
        </div>
      )}

      {/* 7. GUESS PHASE */}
      {roomState.status === 'GUESS_PHASE' && (
        <div className="mobile-card">
          {myRoleInfo?.role === 'IMPOSTOR' ? (
            <div className="guess-box">
              <h2>¡TE DESCUBRIERON!</h2>
              <p>Última oportunidad: Adivina la palabra secreta correcta para robar la victoria:</p>
              <div className="guess-options-list">
                {impostorOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="guess-btn"
                    onClick={() => submitImpostorGuess(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="wait-guess-box">
              <h2>El Impostor intenta adivinar...</h2>
              <p>El impostor fue descubierto pero está eligiendo entre las opciones de la pantalla.</p>
            </div>
          )}
        </div>
      )}

      {/* 8. GAME OVER */}
      {roomState.status === 'GAME_OVER' && (
        <div className="mobile-card">
          <Trophy size={40} className="text-yellow" />
          <h2>FIN DE LA PARTIDA</h2>
          {roomState.winner === 'IMPOSTOR' ? (
            <p className="text-impostor">¡Ganó el Impostor!</p>
          ) : (
            <p className="text-crewmate">¡Ganaron los Tripulantes!</p>
          )}
          <p>Mira la pantalla principal para ver las puntuaciones finales.</p>
        </div>
      )}
    </div>
  );
};
