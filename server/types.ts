/**
 * Tipos del dominio del servidor de CodeImpostor.
 *
 * El servidor guarda las salas en memoria (`Map<roomCode, Room>`). Todo lo que
 * el cliente recibe pasa por `getSanitizedRoomState`: los campos privados del
 * juego (palabra secreta, rol, token) nunca viajan en broadcasts; el rol y la
 * palabra llegan por eventos privados dirigidos por `socket.id`.
 */

/**
 * Estados del flujo de vida de una partida en una sala.
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

/** Rol del jugador en la partida: Tripulante o Impostor */
export type Role = 'CREWMATE' | 'IMPOSTOR';

/** Ganador final de la partida */
export type Winner = 'CREWMATES' | 'IMPOSTOR';

/** Categorías temáticas de conceptos técnicos y de gestión de proyectos */
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

/** Objeto que encapsula una palabra secreta con su respectiva categoría */
export interface SecretWord {
  /** Categoría temática a la que pertenece la palabra */
  category: WordCategory;
  /** Concepto o término técnico en español */
  word: string;
}

/** Representación completa de un jugador registrado en una sala (incluye bots) en el servidor */
export interface Player {
  /** ID del socket actual asignado al jugador (o identificador único si es bot) */
  id: string;
  /** Identidad persistente única (UUID) para reconexión de sesión; nunca se expone por broadcast */
  token: string;
  /** Nombre visible del jugador */
  name: string;
  /** Identificador de avatar seleccionado */
  avatar: string;
  /** Color hexadecimal distintivo del jugador */
  color: string;
  /** Indica si este socket es la pantalla del Host/Proyector */
  isHost: boolean;
  /** Indica si el jugador es un bot simulado */
  isBot: boolean;
  /** Estado de la conexión de red (true si está conectado al socket) */
  connected: boolean;
  /** Indica si fue expulsado en una ronda anterior (pasa a modo espectador) */
  eliminated: boolean;
  /** Rol asignado durante la partida actual */
  role: Role | null;
  /** Pista de texto enviada por el jugador en la ronda en curso */
  hint: string | null;
  /** ID del jugador por quien votó, o 'SKIP' */
  vote: string | null;
  /** Puntuación acumulada a lo largo de las rondas */
  score: number;
  /** Temporizador de gracia de desconexión (45s) pendiente, si lo hay */
  disconnectTimer: NodeJS.Timeout | null;
}

/** Resumen público del jugador expulsado para la pantalla de expulsión (EJECTION) */
export interface EjectedPlayer {
  /** ID del jugador expulsado */
  id: string;
  /** Nombre visible */
  name: string;
  /** Avatar del jugador */
  avatar: string;
  /** Rol revelado al ser expulsado */
  role: Role;
}

/** Estructura de estado interna completa de una sala en memoria */
export interface Room {
  /** Código alfanumérico único de 4 dígitos de la sala */
  roomCode: string;
  /** Socket ID del host (pantalla proyector) */
  hostId: string;
  /** Estado o fase actual de la partida */
  status: GameStatus;
  /** Lista de jugadores (humanos y bots) registrados en la sala */
  players: Player[];
  /** Palabra secreta actual de la ronda */
  secretWord: SecretWord | null;
  /** ID del jugador asignado como impostor (permanece constante durante toda la partida) */
  impostorId: string | null;
  /** Opciones de palabras presentadas en la última oportunidad, conservadas para reconexión */
  guessOptions: string[] | null;
  /** Segundos restantes en el temporizador de la fase actual */
  timer: number;
  /** Intervalo de Node.js que actualiza el temporizador segundo a segundo */
  timerInterval: NodeJS.Timeout | null;
  /** Datos del jugador expulsado en la ronda actual */
  ejectedPlayer: EjectedPlayer | null;
  /** Ganador de la partida cuando status es GAME_OVER */
  winner: Winner | null;
  /** Indica si el impostor acertó en su intento de adivinanza final */
  impostorGuessedCorrectly: boolean | null;
  /** Conteo de votos de la última votación realizada (solo relevante durante EJECTION) */
  voteCounts: Record<string, number> | null;
  /** Número de ronda actual (1 a MAX_ROUNDS) */
  round: number;
  /** Número total de rondas configuradas para la partida */
  maxRounds: number;
}

/* =========================================================================
 * Estado público (sanitizado) enviado a clientes mediante 'room_updated'
 * ========================================================================= */

/** Representación pública de un jugador sin datos sensibles */
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
  /** Solo se expone desde SHOWCASE en adelante; null durante HINT_PHASE */
  hint: string | null;
  hasVoted: boolean;
  score: number;
}

/** Estado de sala enviado a todos los clientes conectados; libre de datos confidenciales */
export interface PublicRoomState {
  roomCode: string;
  status: GameStatus;
  hostId: string;
  round: number;
  maxRounds: number;
  category: string | null;
  /** Solo se expone públicamente cuando la partida culmina (GAME_OVER) */
  secretWord: string | null;
  players: PublicPlayer[];
  timer: number;
  /** Duración en segundos de cada fase para que el cliente configure sus animaciones */
  phaseSeconds: Record<string, number>;
  ejectedPlayer: EjectedPlayer | null;
  winner: Winner | null;
  impostorGuessedCorrectly: boolean | null;
  voteCounts: Record<string, number> | null;
}

/* =========================================================================
 * Payloads Cliente -> Servidor
 * ========================================================================= */

/** Payload enviado por un cliente para unirse o reconectarse a una sala */
export interface JoinRoomPayload {
  roomCode: string;
  name: string;
  avatar: string;
  color: string;
  token?: string;
}

/** Payload enviado por un jugador para registrar su pista */
export interface SubmitHintPayload {
  hint: string;
}

/** Payload enviado por un jugador para registrar su voto */
export interface SubmitVotePayload {
  targetId: string;
}

/** Payload enviado por el impostor al intentar adivinar la palabra secreta */
export interface SubmitImpostorGuessPayload {
  guessedWord: string;
}

/** Payload enviado por el host para agregar bots de prueba a la sala */
export interface AddBotsPayload {
  count: number;
}

/* =========================================================================
 * Payloads Servidor -> Cliente (Eventos privados dirigidos a un socket específico)
 * ========================================================================= */

/** Payload privado que informa al jugador su rol y, en caso de tripulante, la palabra secreta */
export interface YourRolePayload {
  role: Role;
  category: string;
  /** Solo visible para tripulantes; null si el receptor es el impostor */
  word: string | null;
}

/** Opciones de palabras presentadas al impostor durante su última oportunidad */
export interface GuessWordOptionsPayload {
  options: string[];
}

