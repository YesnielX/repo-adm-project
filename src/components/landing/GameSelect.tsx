import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ArrowLeft, Ghost, Smartphone, Tv } from 'lucide-react';

interface GameSelectProps {
  onBack: () => void;
  onHost: () => void;
  onPlayer: () => void;
}

export const GameSelect: React.FC<GameSelectProps> = ({ onBack, onHost, onPlayer }) => {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-select-el]', {
        opacity: 0,
        y: 26,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.1,
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={scope}
      className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col px-6 py-6 lg:px-8"
    >
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-4 py-2 text-sm font-bold text-muted transition-colors hover:border-white/25 hover:text-white"
          data-cuelume-press
          data-cuelume-release
        >
          <ArrowLeft size={16} />
          Volver
        </button>
        <span className="hidden text-xs text-muted sm:block">Red local del aula</span>
      </header>

      <main className="flex flex-1 flex-col justify-center py-12">
        <div data-select-el className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
            <Ghost size={24} />
          </span>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Elige cómo vas a jugar
          </h1>
        </div>

        <p data-select-el className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
          Una pantalla proyecta el juego y el resto participa desde el celular.
          Solo necesitan estar en la misma red.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={onHost}
            data-select-el
            className="group flex flex-col gap-4 rounded-xl border border-line bg-panel p-6 text-left transition-colors hover:border-accent/50 hover:bg-accent/5"
            data-cuelume-press="pulse"
            data-cuelume-release
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
              <Tv size={24} />
            </span>
            <span>
              <span className="block text-lg font-bold text-white">Soy el proyector</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">
                Muestra el tablero y el QR en la pantalla grande de la clase.
              </span>
            </span>
            <span className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-bold tracking-wide text-surface transition-colors group-hover:bg-accent-strong">
              Crear partida
            </span>
          </button>

          <button
            type="button"
            onClick={onPlayer}
            data-select-el
            className="group flex flex-col gap-4 rounded-xl border border-line bg-panel p-6 text-left transition-colors hover:border-accent/50 hover:bg-accent/5"
            data-cuelume-press="pulse"
            data-cuelume-release
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-raised text-muted">
              <Smartphone size={24} />
            </span>
            <span>
              <span className="block text-lg font-bold text-white">Soy un jugador</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">
                Entra desde tu teléfono escaneando el QR que muestra el proyector.
              </span>
            </span>
            <span className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-accent/50 bg-accent/10 py-3 text-sm font-bold tracking-wide text-accent transition-colors group-hover:bg-accent/20">
              Unirme a una partida
            </span>
          </button>
        </div>
      </main>
    </div>
  );
};
