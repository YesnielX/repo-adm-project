import React from 'react';
import {
  Terminal,
  Code2,
  Cpu,
  Zap,
  Rocket,
  Shield,
  Flame,
  Globe,
  Compass,
  Eye,
  Bot,
  Gamepad2,
  Ghost,
  Skull,
  Crown,
  Star,
  Heart,
  Sun,
  Moon,
  Sparkles,
  Database,
  Server,
  Layers,
  Box,
  Package,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Bug,
  Wrench,
  Hammer,
  Key,
  Lock,
  Target,
  Anchor,
  Feather,
  Lightbulb,
  Headphones,
  Music,
  Radio,
  Tv,
  Camera,
  Crosshair,
  Magnet,
  Orbit,
  Atom,
  Fingerprint,
  Sword,
  Wand2,
  Gem,
  Smile
} from 'lucide-react';

export const AVATAR_OPTIONS = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'code', label: 'Código', icon: Code2 },
  { id: 'cpu', label: 'CPU', icon: Cpu },
  { id: 'zap', label: 'Rayo', icon: Zap },
  { id: 'rocket', label: 'Cohete', icon: Rocket },
  { id: 'shield', label: 'Escudo', icon: Shield },
  { id: 'flame', label: 'Fuego', icon: Flame },
  { id: 'globe', label: 'Red', icon: Globe },
  { id: 'compass', label: 'Brújula', icon: Compass },
  { id: 'eye', label: 'Visor', icon: Eye },
  { id: 'bot', label: 'Robot', icon: Bot },
  { id: 'gamepad', label: 'Gamepad', icon: Gamepad2 },
  { id: 'ghost', label: 'Fantasma', icon: Ghost },
  { id: 'skull', label: 'Calavera', icon: Skull },
  { id: 'crown', label: 'Corona', icon: Crown },
  { id: 'star', label: 'Estrella', icon: Star },
  { id: 'heart', label: 'Corazón', icon: Heart },
  { id: 'sun', label: 'Sol', icon: Sun },
  { id: 'moon', label: 'Luna', icon: Moon },
  { id: 'sparkles', label: 'Destello', icon: Sparkles },
  { id: 'database', label: 'Base de Datos', icon: Database },
  { id: 'server', label: 'Servidor', icon: Server },
  { id: 'layers', label: 'Capas', icon: Layers },
  { id: 'box', label: 'Caja', icon: Box },
  { id: 'package', label: 'Paquete', icon: Package },
  { id: 'gitbranch', label: 'Git Branch', icon: GitBranch },
  { id: 'gitcommit', label: 'Git Commit', icon: GitCommit },
  { id: 'gitpr', label: 'Git PR', icon: GitPullRequest },
  { id: 'bug', label: 'Bug', icon: Bug },
  { id: 'wrench', label: 'Llave', icon: Wrench },
  { id: 'hammer', label: 'Martillo', icon: Hammer },
  { id: 'key', label: 'Llave Key', icon: Key },
  { id: 'lock', label: 'Candado', icon: Lock },
  { id: 'target', label: 'Diana', icon: Target },
  { id: 'anchor', label: 'Ancla', icon: Anchor },
  { id: 'feather', label: 'Pluma', icon: Feather },
  { id: 'lightbulb', label: 'Foco', icon: Lightbulb },
  { id: 'headphones', label: 'Audífonos', icon: Headphones },
  { id: 'music', label: 'Música', icon: Music },
  { id: 'radio', label: 'Radio', icon: Radio },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'camera', label: 'Cámara', icon: Camera },
  { id: 'crosshair', label: 'Mira', icon: Crosshair },
  { id: 'magnet', label: 'Imán', icon: Magnet },
  { id: 'orbit', label: 'Órbita', icon: Orbit },
  { id: 'atom', label: 'Átomo', icon: Atom },
  { id: 'fingerprint', label: 'Huella', icon: Fingerprint },
  { id: 'sword', label: 'Espada', icon: Sword },
  { id: 'wand', label: 'Varita', icon: Wand2 },
  { id: 'gem', label: 'Gema', icon: Gem },
  { id: 'smile', label: 'Sonrisa', icon: Smile }
];

interface AvatarIconProps {
  avatarId: string;
  size?: number;
  className?: string;
  isBot?: boolean;
}

export const AvatarIcon: React.FC<AvatarIconProps> = ({ avatarId, size = 24, className = '', isBot = false }) => {
  if (isBot) {
    return <Bot size={size} className={className} />;
  }

  const option = AVATAR_OPTIONS.find((a) => a.id === avatarId);
  const IconComponent = option ? option.icon : Terminal;

  return <IconComponent size={size} className={className} />;
};
