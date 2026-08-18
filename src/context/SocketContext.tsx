import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { play } from "cuelume";
import type {
  AddBotsPayload,
  GuessWordOptionsPayload,
  JoinRoomPayload,
  SubmitHintPayload,
  SubmitImpostorGuessPayload,
  SubmitVotePayload,
  YourRolePayload,
} from "../../shared/schemas";

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isHost: boolean;
  isBot?: boolean;
  connected: boolean;
  eliminated?: boolean;
  hasSubmittedHint: boolean;
  hint: string | null;
  hasVoted: boolean;
  score: number;
}

export interface RoomState {
  roomCode: string;
  status:
    | "LOBBY"
    | "ROLE_REVEAL"
    | "HINT_PHASE"
    | "SHOWCASE"
    | "VOTING"
    | "EJECTION"
    | "GUESS_PHASE"
    | "GAME_OVER";
  hostId: string;
  round?: number;
  maxRounds?: number;
  category: string | null;
  secretWord: string | null;
  players: Player[];
  timer: number;
  ejectedPlayer: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  } | null;
  winner: "CREWMATES" | "IMPOSTOR" | null;
  impostorGuessedCorrectly: boolean | null;
  voteCounts?: Record<string, number> | null;
}

interface SocketContextType {
  socket: Socket | null;
  roomState: RoomState | null;
  localIp: string | null;
  localIpCandidates: string[];
  setLocalIp: (ip: string | null) => void;
  myPlayerId: string | null;
  myPlayerToken: string | null;
  myRoleInfo: YourRolePayload | null;
  impostorOptions: string[];
  errorMessage: string | null;
  createRoom: () => void;
  addBots: (count?: number) => void;
  joinRoom: (
    roomCode: string,
    name: string,
    avatar: string,
    color: string,
    token?: string,
  ) => void;
  startGame: () => void;
  submitHint: (hint: string) => void;
  submitVote: (targetId: string) => void;
  submitImpostorGuess: (word: string) => void;
  resetGame: () => void;
  clearError: () => void;
  resetToLanding: () => void;
}

const SESSION_STORAGE_KEY = "codeimpostor_player_session";
const PROFILE_STORAGE_KEY = "codeimpostor_player_profile";

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [localIpCandidates, setLocalIpCandidates] = useState<string[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myPlayerToken, setMyPlayerToken] = useState<string | null>(null);
  const [myRoleInfo, setMyRoleInfo] = useState<YourRolePayload | null>(null);
  const [impostorOptions, setImpostorOptions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const joinedRef = useRef(false);

  useEffect(() => {
    const serverUrl =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? "http://localhost:3001"
        : `http://${window.location.hostname}:3001`;

    const newSocket = io(serverUrl, {
      transports: ["websocket", "polling"],
    });

    setTimeout(() => setSocket(newSocket), 0);

    newSocket.on("connect", () => {
      setMyPlayerId(newSocket.id || null);

      if (joinedRef.current) {
        try {
          const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
          const profileData = localStorage.getItem(PROFILE_STORAGE_KEY);
          if (sessionData && profileData) {
            const session = JSON.parse(sessionData);
            const profile = JSON.parse(profileData);
            if (session?.roomCode && session?.token && profile?.name) {
              newSocket.emit("join_room", {
                roomCode: session.roomCode,
                name: profile.name,
                avatar: profile.avatar,
                color: profile.color,
                token: session.token,
              } satisfies JoinRoomPayload);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    });

    newSocket.on("room_created", ({ localIp, ipCandidates, roomState }) => {
      setLocalIp(localIp);
      setLocalIpCandidates(Array.isArray(ipCandidates) ? ipCandidates : []);
      setRoomState(roomState);
      play("ready");
    });

    newSocket.on(
      "joined_successfully",
      ({ playerId, playerToken, roomState }) => {
        joinedRef.current = true;
        setMyPlayerId(playerId);
        setMyPlayerToken(playerToken ?? null);
        setRoomState(roomState);
        setErrorMessage(null);
        play("success");

        // Guardar sesión (token de reconexión) para poder re-unirse tras un refresh
        if (roomState?.roomCode && playerToken) {
          try {
            localStorage.setItem(
              SESSION_STORAGE_KEY,
              JSON.stringify({
                roomCode: roomState.roomCode,
                token: playerToken,
              }),
            );
          } catch (err) {
            console.error(err);
          }
        }
      },
    );

    newSocket.on("room_updated", (updatedState: RoomState) => {
      setRoomState(updatedState);
      if (updatedState.status === "LOBBY") {
        setMyRoleInfo(null);
        setImpostorOptions([]);
      }
    });

    newSocket.on("your_role", (roleData: YourRolePayload) => {
      setMyRoleInfo(roleData);
    });

    newSocket.on("guess_word_options", (payload: GuessWordOptionsPayload) => {
      setImpostorOptions(payload.options);
    });

    newSocket.on("timer_tick", (seconds: number) => {
      setRoomState((prev) => (prev ? { ...prev, timer: seconds } : null));
    });

    newSocket.on("error_message", (msg: string) => {
      play("error");

      const isFatal =
        typeof msg === "string" &&
        (msg.startsWith("La sala no existe") ||
          msg.startsWith("El Host ha cerrado la sala") ||
          msg.startsWith("La partida ya está en curso"));

      if (isFatal) {
        setErrorMessage(msg);
        setRoomState(null);
        setMyPlayerToken(null);
        joinedRef.current = false;
        // La sala expiró o no existe: la sesión guardada ya no sirve
        try {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (err) {
          console.error(err);
        }
      } else {
        // Errores no fatales (p.ej. 'Voto inválido'): solo mostrar el mensaje,
        // conservando la sesión, el estado de la sala y la URL.
        setErrorMessage(msg);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const createRoom = () => {
    if (socket) socket.emit("create_room");
  };

  const addBots = (count?: number) => {
    if (socket)
      socket.emit("add_bots", { count: count ?? 3 } satisfies AddBotsPayload);
  };

  const joinRoom = (
    roomCode: string,
    name: string,
    avatar: string,
    color: string,
    token?: string,
  ) => {
    if (socket)
      socket.emit("join_room", {
        roomCode,
        name,
        avatar,
        color,
        token,
      } satisfies JoinRoomPayload);
  };

  const startGame = () => {
    if (socket) socket.emit("start_game");
  };

  const submitHint = (hint: string) => {
    if (socket)
      socket.emit("submit_hint", { hint } satisfies SubmitHintPayload);
  };

  const submitVote = (targetId: string) => {
    if (socket)
      socket.emit("submit_vote", { targetId } satisfies SubmitVotePayload);
  };

  const submitImpostorGuess = (guessedWord: string) => {
    if (socket)
      socket.emit("submit_impostor_guess", {
        guessedWord,
      } satisfies SubmitImpostorGuessPayload);
  };

  const resetGame = () => {
    if (socket) socket.emit("reset_game");
  };

  const clearError = () => setErrorMessage(null);

  const resetToLanding = () => {
    setRoomState(null);
    setErrorMessage(null);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        roomState,
        localIp,
        localIpCandidates,
        setLocalIp,
        myPlayerId,
        myPlayerToken,
        myRoleInfo,
        impostorOptions,
        errorMessage,
        createRoom,
        addBots,
        joinRoom,
        startGame,
        submitHint,
        submitVote,
        submitImpostorGuess,
        resetGame,
        clearError,
        resetToLanding,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGameSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useGameSocket debe ser usado dentro de un SocketProvider");
  }
  return context;
};
