import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ShieldAlert, Tv, Smartphone } from 'lucide-react';
import { SocketProvider, useGameSocket } from './context/SocketContext';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';

const MainApp: React.FC = () => {
  const { roomState, createRoom } = useGameSocket();
  const [mode, setMode] = useState<'SELECT' | 'HOST' | 'PLAYER'>('SELECT');
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (heroRef.current) {
      gsap.fromTo(
        heroRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.1 }
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
    <div className="flex min-h-screen flex-col">
      {mode === 'SELECT' && !roomState && (
        <>
          <header className="flex items-center justify-between px-6 pt-6 sm:px-10">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={22} className="text-cyber-purple" />
              <span className="font-display text-sm font-bold tracking-[3px]">CODE IMPOSTOR</span>
            </div>
            <span className="hidden text-xs text-muted sm:block">
              Se juega en la red del aula, sin internet
            </span>
          </header>

          <main className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10" ref={heroRef}>
            <h1 className="font-display text-[44px] font-black leading-[0.95] tracking-tight sm:text-6xl">
              Encuentra
              <br />
              al <span className="text-cyber-cyan">impostor</span>.
            </h1>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Todos reciben una palabra secreta menos uno. Escriban una pista,
              voten y descubran quién está mintiendo.
            </p>

            <div className="mt-10 grid gap-4 sm:max-w-xl sm:grid-cols-2">
              <button
                type="button"
                onClick={handleStartHost}
                className="flex flex-col gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-5 text-left transition hover:-translate-y-1 hover:border-cyber-cyan hover:bg-cyan-400/10 hover:shadow-[0_12px_30px_rgba(0,242,254,0.15)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyber-cyan">
                    <Tv size={22} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[2px] text-cyber-cyan/70">
                    01 · Host
                  </span>
                </div>
                <div>
                  <strong className="block text-lg text-white">Soy el proyector</strong>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    Muestra el tablero y el QR en la pantalla grande de la clase.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={handleStartPlayer}
                className="flex flex-col gap-3 rounded-2xl border border-purple-500/25 bg-purple-500/5 p-5 text-left transition hover:-translate-y-1 hover:border-cyber-purple hover:bg-purple-500/10 hover:shadow-[0_12px_30px_rgba(170,59,255,0.2)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-500/25 bg-purple-500/10 text-cyber-purple">
                    <Smartphone size={22} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[2px] text-cyber-purple/70">
                    02 · Jugador
                  </span>
                </div>
                <div>
                  <strong className="block text-lg text-white">Soy un jugador</strong>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    Entra desde tu teléfono escaneando el QR del proyector.
                  </span>
                </div>
              </button>
            </div>

            <p className="mt-8 text-xs leading-relaxed text-muted">
              Sin instalar nada · Con bots de práctica · Hasta 5 rondas
            </p>
          </main>
        </>
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
