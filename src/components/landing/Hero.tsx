import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ArrowDown, Ghost, Users } from 'lucide-react';

const PLAYER_DOTS = [
  { initial: 'A', color: '#a3e635' },
  { initial: 'B', color: '#38bdf8' },
  { initial: 'C', color: '#fb923c' },
  { initial: 'D', color: '#ec4899' },
  { initial: 'E', color: '#fbbf24' },
];

const HINT_CHIPS = ['Iterativo', 'Reuniones diarias', 'Sprints de 2 semanas'];

export const Hero: React.FC = () => {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-hero-marquee]', {
        opacity: 0,
        y: -18,
        duration: 0.8,
        ease: 'power3.out',
      });
      gsap.from('[data-hero-crt]', {
        opacity: 0,
        y: 32,
        scale: 0.985,
        duration: 1,
        ease: 'power3.out',
        delay: 0.15,
      });
      gsap.from('[data-hero-deck]', {
        opacity: 0,
        y: 20,
        duration: 0.7,
        ease: 'power3.out',
        delay: 0.4,
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={scope} className="relative px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Marquee del gabinete */}
        <div data-hero-marquee className="flex items-end justify-between gap-6 border-b-2 border-accent pb-4">
          <h1 className="font-display text-5xl font-bold uppercase leading-[0.9] tracking-tight text-white sm:text-7xl lg:text-8xl">
            Code
            <br />
            <span className="text-accent">Impostor</span>
            <br />
            <span className="text-3xl tracking-[0.2em] sm:text-4xl lg:text-5xl">Arcade</span>
          </h1>
          <div className="hidden flex-none flex-col items-end gap-1 pb-1 text-right sm:flex">
            <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted">
              Juegos para la clase
            </span>
            <span className="text-xs text-muted/70">est. 2026</span>
          </div>
        </div>

        {/* Pantalla CRT con el juego simulado */}
        <div data-hero-crt className="mt-8">
          <div className="rounded-[28px] border-[10px] border-black bg-black p-2 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:rounded-[36px] sm:border-[14px] sm:p-3">
            <div className="crt-screen relative overflow-hidden rounded-2xl bg-surface sm:rounded-3xl">
              {/* Scanlines de la pantalla */}
              <div className="crt-scanlines absolute inset-0 z-20" aria-hidden="true" />

              {/* Contenido de la pantalla */}
              <div className="relative z-10 flex min-h-[320px] flex-col gap-5 p-5 sm:min-h-[420px] sm:gap-7 sm:p-8">
                {/* Barra superior: sala + estado */}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                      Sala
                    </span>
                    <span className="font-display text-3xl font-bold text-white sm:text-4xl">
                      #4821
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    En sala · 8
                  </span>
                </div>

                {/* Jugadores en pantalla */}
                <div className="flex items-center gap-3 sm:gap-4">
                  {PLAYER_DOTS.map((p) => (
                    <span
                      key={p.initial}
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-surface text-sm font-bold text-surface sm:h-14 sm:w-14 sm:text-base"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.initial}
                    </span>
                  ))}
                  <span className="text-sm font-bold text-muted">+2</span>
                </div>

                {/* Muro de pistas */}
                <div className="flex flex-1 flex-col gap-2.5 sm:gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                    Pistas
                  </span>
                  <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
                    {HINT_CHIPS.map((hint) => (
                      <div
                        key={hint}
                        className="rounded-lg border border-line bg-raised px-4 py-3 text-sm font-semibold text-white"
                      >
                        {hint}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Votos */}
                <div className="flex items-center justify-between border-t border-line pt-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                    Votación
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/15 text-sm font-bold text-red-400">✕</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-sm font-bold text-emerald-400">✓</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/15 text-sm font-bold text-red-400">✕</span>
                    <span className="ml-1 text-xs font-bold text-muted">2 a 1</span>
                  </div>
                </div>
              </div>

              {/* Reflejo sutil del cristal */}
              <div
                className="pointer-events-none absolute inset-0 z-30 bg-linear-to-br from-white/[0.06] via-transparent to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Panel de control */}
        <div data-hero-deck className="mt-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-accent/40 bg-accent/10 text-accent">
              <Ghost size={24} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-tight text-white">
                Deducción social para la clase
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <Users size={14} />
                3-12 jugadores · se juega con el celular
              </p>
            </div>
          </div>

          <a href="#juegos" className="btn-cta w-auto px-8" data-cuelume-press="pulse" data-cuelume-release>
            Ver juegos
            <ArrowDown size={16} />
          </a>
        </div>
      </div>
    </section>
  );
};
