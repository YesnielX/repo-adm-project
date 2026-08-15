import React from 'react';
import { HubHeader } from './HubHeader';
import { Hero } from './Hero';
import { GameGrid } from './GameGrid';
import { Footer } from './Footer';

interface HubProps {
  onSelectGame: () => void;
}

export const Hub: React.FC<HubProps> = ({ onSelectGame }) => (
  <div className="flex min-h-screen flex-col">
    <HubHeader />
    <main className="flex-1">
      <Hero />
      <GameGrid onPlayAvailable={onSelectGame} />
    </main>
    <Footer />
  </div>
);
