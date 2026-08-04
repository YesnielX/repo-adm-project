import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Tv, Smartphone, ShieldAlert, Wifi, Bot, Zap } from 'lucide-react';
import { SocketProvider, useGameSocket } from './context/SocketContext';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';

const MainApp: React.FC = () => {
  const { roomState, createRoom } = useGameSocket();
  const [mode, setMode] = useState<'SELECT' | 'HOST' | 'PLAYER'>('SELECT');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, scale: 0.92, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.4)' }
      );
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const hostParam = urlParams.get('host');

    if (hostParam === 'true') {
      setMode('HOST');
      createRoom();
    } else if (roomParam) {
      setMode('PLAYER');
    }
  }, []);

  const handleStartHost = () => {
    setMode('HOST');
    createRoom();
  };

  const handleStartPlayer = () => {
    setMode('PLAYER');
  };

  return (
    <div className="app-container">
      {mode === 'SELECT' && !roomState && (
        <div className="landing-screen">
          <div className="landing-card" ref={cardRef}>
            <div className="landing-logo-wrapper">
              <div className="logo-glow-ring">
                <ShieldAlert className="landing-logo text-purple" size={54} />
              </div>
            </div>

            <h1 className="landing-title">CODE IMPOSTOR</h1>
            <p className="landing-subtitle">
              Juego Multijugador en Tiempo Real de Deducción Social para la Clase de Administración de Proyectos
            </p>

            <div className="feature-pills">
              <span className="pill"><Wifi size={13} /> Wi-Fi Local (Sin Internet)</span>
              <span className="pill"><Bot size={13} /> Bots Simulados</span>
              <span className="pill"><Zap size={13} /> 100% Real-time</span>
            </div>

            <div className="mode-options">
              <button type="button" className="mode-btn host-btn" onClick={handleStartHost}>
                <div className="btn-icon-wrapper host-icon">
                  <Tv size={26} className="text-cyan" />
                </div>
                <div className="btn-text">
                  <strong>MODO PROYECTOR (HOST)</strong>
                  <small>Para proyectar en la pantalla principal de la clase</small>
                </div>
              </button>

              <button type="button" className="mode-btn player-btn" onClick={handleStartPlayer}>
                <div className="btn-icon-wrapper player-icon">
                  <Smartphone size={26} className="text-purple" />
                </div>
                <div className="btn-text">
                  <strong>MODO JUGADOR (MÓVIL)</strong>
                  <small>Para unirte a una partida desde tu smartphone</small>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'HOST' && <HostView />}
      {mode === 'PLAYER' && <PlayerView />}
    </div>
  );
};

export default function App() {
  return (
    <SocketProvider>
      <MainApp />
    </SocketProvider>
  );
}
