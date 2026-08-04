/**
 * Tipos del dominio del servidor de CodeImpostor.
 *
 * El servidor guarda las salas en memoria (Map<roomCode, Room>). Todo lo que
 * el cliente recibe pasa por getSanitizedRoomState: los campos privados del
 * juego (palabra secreta, rol, token) nunca viajan en broadcasts; el rol y la
 * palabra llegan por eventos privados dirigidos por socket.id.
 */

export type GameStatus =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'HINT_PHASE'
  | 'SHOWCASE'
  | 'VOTING'
  | 'EJECTION'
  | 'GUESS_PHASE'
  | 'GAME_OVER';

export type Role = 'CREWMATE' | 'IMPOSTOR';
export type Winner = 'CREWMATES' | 'IMPOSTOR';

export type WordCategory =
  | 'Metodologías Ágiles'
  | 'Desarrollo & Git'
  | 'Arquitectura & Cloud'
  | 'Conceptos de Gestión'
  | 'Pruebas & Calidad'
  | 'Lenguajes de Programación'
  | 'Frameworks & Librerías'
  | 'Bases de Datos'
  | 'Redes & Protocolos'
  | 'Seguridad Informática'
  | 'Herramientas & Productividad'
  | 'Diseño UX/UI'
  | 'Modelado & Diagramas'
  | 'DevOps & Automatización'
  | 'Inteligencia Artificial'
  | 'Sistemas Operativos'
  | 'Comunicación & Equipos'
  | 'Metodologías de Desarrollo';

export interface SecretWord {
  category: WordCategory;
  word: string;
}

/** Jugador registrado en una sala (incluye bots). */
export interface Player {
  id: string;
  /** Identidad persistente para reconexión; nunca se expone por broadcast. */
  token: string;
  name: string;
  avatar: string;
  color: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  /** Expulsado en una ronda anterior: queda como espectador. */
  eliminated: boolean;
  role: Role | null;
  hint: string | null;
  /** Id del jugador votado o 'SKIP'. */
  vote: string | null;
  score: number;
  /** Timer de gracia de desconexión (45s) pendiente, si lo hay. */
  disconnectTimer: NodeJS.Timeout | null;
}

/** Resumen del expulsado para la pantalla de expulsión. */
export interface EjectedPlayer {
  id: string;
  name: string;
  avatar: string;
  role: Role;
}

export interface Room {
  roomCode: string;
  hostId: string;
  status: GameStatus;
  players: Player[];
  secretWord: SecretWord | null;
  /** El impostor es el mismo durante toda la partida. */
  impostorId: string | null;
  /** Opciones de la última oportunidad, para re-emitirlas en un rejoin. */
  guessOptions: string[] | null;
  timer: number;
  timerInterval: NodeJS.Timeout | null;
  ejectedPlayer: EjectedPlayer | null;
  winner: Winner | null;
  impostorGuessedCorrectly: boolean | null;
  /** Conteo de votos de la última votación (solo durante EJECTION). */
  voteCounts: Record<string, number> | null;
  round: number;
  maxRounds: number;
}

/* Estado público (sanitizado) que llega por room_updated */

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  eliminated: boolean;
  hasSubmittedHint: boolean;
  /** Solo se expone desde SHOWCASE en adelante. */
  hint: string | null;
  hasVoted: boolean;
  score: number;
}

export interface PublicRoomState {
  roomCode: string;
  status: GameStatus;
  hostId: string;
  round: number;
  maxRounds: number;
  category: string | null;
  /** Solo se expone en GAME_OVER. */
  secretWord: string | null;
  players: PublicPlayer[];
  timer: number;
  ejectedPlayer: EjectedPlayer | null;
  winner: Winner | null;
  impostorGuessedCorrectly: boolean | null;
  voteCounts: Record<string, number> | null;
}

/* Payloads cliente -> servidor */

export interface JoinRoomPayload {
  roomCode: string;
  name: string;
  avatar: string;
  color: string;
  token?: string;
}

export interface SubmitHintPayload {
  hint: string;
}

export interface SubmitVotePayload {
  targetId: string;
}

export interface SubmitImpostorGuessPayload {
  guessedWord: string;
}

export interface AddBotsPayload {
  count: number;
}

/* Payloads servidor -> cliente (eventos privados) */

export interface YourRolePayload {
  role: Role;
  category: string;
  /** Solo para tripulantes; el impostor recibe null. */
  word: string | null;
}

export interface GuessWordOptionsPayload {
  options: string[];
}
