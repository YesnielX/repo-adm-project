import React from 'react';
import { Gamepad2, Terminal } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const HubHeader: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isMatrix = theme === 'matrix';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
            <Gamepad2 size={18} />
          </span>
          <span className="font-display text-lg font-bold tracking-wide text-white">ClassArcade</span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <a href="#juegos" className="transition-colors hover:text-white" data-cuelume-hover="tick">
            Juegos
          </a>
          <span className="hidden text-xs text-muted/70 sm:block">Red local del aula</span>
          <button
            type="button"
            onClick={toggleTheme}
            title={isMatrix ? 'Cambiar a tema Arcade' : 'Cambiar a tema Matrix'}
            aria-label={isMatrix ? 'Cambiar a tema Arcade' : 'Cambiar a tema Matrix'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-raised text-muted transition-colors hover:text-white"
            data-cuelume-toggle
          >
            {isMatrix ? <Gamepad2 size={18} /> : <Terminal size={18} />}
          </button>
        </nav>
      </div>
    </header>
  );
};
