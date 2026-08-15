import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { games } from '../../data/games';
import { GameCard } from './GameCard';

gsap.registerPlugin(ScrollTrigger);

interface GameGridProps {
  onPlayAvailable: () => void;
}

export const GameGrid: React.FC<GameGridProps> = ({ onPlayAvailable }) => {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-game-card]', {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: {
          trigger: scope.current,
          start: 'top 78%',
          toggleActions: 'play none none reverse',
        },
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={scope} id="juegos" className="relative px-6 pb-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Elige tu juego
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Un arcade de juegos por equipos para el aula. CodeImpostor ya está
            listo; el resto llega en próximas actualizaciones.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onPlay={onPlayAvailable} />
          ))}
        </div>
      </div>
    </section>
  );
};
