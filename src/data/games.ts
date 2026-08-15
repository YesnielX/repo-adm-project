import { Bomb, Crown, Ghost, Heart, Paintbrush, Swords } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type GameStatus = 'available' | 'soon';

export interface Game {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  status: GameStatus;
}

export const games: Game[] = [
  {
    id: 'code-impostor',
    name: 'CodeImpostor',
    tagline: 'Deducción social',
    description: 'Todos reciben una palabra secreta menos uno. Escriban pistas, voten y descubran al impostor.',
    icon: Ghost,
    accent: '#a3e635',
    status: 'available',
  },
  {
    id: 'tug-of-war',
    name: 'Tira y Afloja',
    tagline: 'Tirar de la cuerda',
    description: 'Dos equipos tiran de la cuerda con taps rápidos. El equipo que más taps sume gana la ronda.',
    icon: Swords,
    accent: '#38bdf8',
    status: 'soon',
  },
  {
    id: 'hot-potato',
    name: 'Papa Caliente',
    tagline: 'Preguntas contrarreloj',
    description: 'La papa explota al azar. Responde la pregunta o pásala rápido para seguir en juego.',
    icon: Bomb,
    accent: '#fb923c',
    status: 'soon',
  },
  {
    id: 'draw-dash',
    name: 'DrawDash',
    tagline: 'Pictionary en vivo',
    description: 'Un jugador dibuja y el resto adivina en tiempo real. Gana quien acierte primero.',
    icon: Paintbrush,
    accent: '#ec4899',
    status: 'soon',
  },
  {
    id: 'battle-royale',
    name: 'Trivia Royale',
    tagline: 'Trivia de eliminación',
    description: 'Las plataformas caen y las preguntas eliminan. Solo un equipo queda en pie.',
    icon: Crown,
    accent: '#fbbf24',
    status: 'soon',
  },
  {
    id: 'swipe-right',
    name: 'SwipeRight',
    tagline: 'Mito o realidad',
    description: 'Desliza y decide si la afirmación es mito o realidad. Gana quien mejor conozca el tema.',
    icon: Heart,
    accent: '#10b981',
    status: 'soon',
  },
];

export const hexToRgba = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
