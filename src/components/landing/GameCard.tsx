import React from 'react';
import { Clock, Play } from 'lucide-react';
import type { Game } from '../../data/games';

interface GameCardProps {
  game: Game;
  onPlay: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onPlay }) => {
  const Icon = game.icon;
  const available = game.status === 'available';

  return (
    <article
      data-game-card
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-panel transition-[border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_18px_48px_rgba(0,0,0,0.55)]"
    >
      {/* Marquee del gabinete: encendido si está disponible, apagado si no */}
      <div
        className={`flex items-center justify-between gap-3 px-5 py-3.5 ${
          available ? '' : 'bg-raised'
        }`}
        style={{
          backgroundColor: available ? game.accent : undefined,
        }}
      >
        <h3
          className="font-display text-2xl font-bold uppercase leading-none tracking-wide"
          style={{
            color: available ? '#0a0b0d' : undefined,
          }}
        >
          {game.name}
        </h3>
        <span
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-md ${
            available ? 'bg-black/20 text-surface' : 'bg-white/5 text-muted/60'
          }`}
        >
          <Icon size={20} strokeWidth={2} />
        </span>
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col p-5">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] text-muted"
          style={{
            color: available ? game.accent : undefined,
          }}
        >
          {game.tagline}
        </p>

        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
          {game.description}
        </p>

        {available ? (
          <button
            type="button"
            onClick={onPlay}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg p-3 text-[15px] font-bold tracking-wide text-surface transition-[filter] duration-150 hover:brightness-110 active:brightness-95"
            style={{ backgroundColor: game.accent }}
            data-cuelume-press="pulse"
            data-cuelume-release
          >
            <Play size={16} fill="currentColor" />
            Jugar
          </button>
        ) : (
          <div className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-line bg-raised p-3 text-[15px] font-bold tracking-wide text-muted">
            <Clock size={15} />
            Próximamente
          </div>
        )}
      </div>
    </article>
  );
};
