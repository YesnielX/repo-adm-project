# Servidor de CodeImpostor

Backend en tiempo real de CodeImpostor: un servidor **Socket.IO + Express 5** en TypeScript ejecutado con **Node 24** (que ejecuta TypeScript nativamente, por eso los imports usan la extensión `.ts`). Las salas viven **en memoria** (un `Map<roomCode, Room>`) y se sincronizan con los clientes por Socket.IO; no hay base de datos ni capa de persistencia.

## Arquitectura por módulos

| Módulo | Responsabilidad | Exports |
| --- | --- | --- |
| `index.ts` | Bootstrap del proceso: registra los handlers, expone `GET /health`, escucha en `0.0.0.0` y cierra ordenadamente ante `SIGINT`/`SIGTERM` (con guard anti doble disparo). | — (arranca el servidor) |
| `config.ts` | Constantes del juego: `PORT` (3001), `MAX_ROUNDS` (5), `PHASE_SECONDS` (duración de cada fase), `THEMED_BOT_NAMES`, `BOT_COLORS`, `DISCONNECT_GRACE_MS` (45 s). Lee `PORT` y `LOG_LEVEL` del entorno. | `PORT`, `MAX_ROUNDS`, `THEMED_BOT_NAMES`, `BOT_COLORS`, `PHASE_SECONDS`, `DISCONNECT_GRACE_MS` |
| `types.ts` | Tipos del dominio: `Room`, `Player`, `PublicRoomState`, `EjectedPlayer`, `SecretWord`, `WordCategory` y los payloads de eventos. | tipos (solo types) |
| `core/io.ts` | Singleton compartido: la app Express (con CORS), el `httpServer` y el `Server` de Socket.IO. | `app`, `httpServer`, `io` |
| `core/ip.ts` | Detección de la IP LAN real del host (para el QR) y las IPs candidatas, descartando interfaces virtuales/VPN. | `LOCAL_IP`, `getLocalIpCandidates` |
| `core/logger.ts` | Logger compartido con **pino**; en desarrollo (`NODE_ENV !== "production"`) embellece con `pino-pretty`, en producción emite JSON plano. Si `pino-pretty` falla, cae a la instancia JSON. | `logger` |
| `game/rooms.ts` | Registro de salas en memoria: el `Map` de salas activas, el índice `socket.id → roomCode`, y utilidades de código (4 dígitos) y timer. | `rooms`, `roomBySocket`, `generateRoomCode`, `roomOfSocket`, `clearRoomTimer` |
| `game/public-state.ts` | Frontera secreto/público: `getSanitizedRoomState` produce el único estado que llega por broadcast. | `getSanitizedRoomState` |
| `game/phases.ts` | Máquina de fases con timers por fase y los caminos de victoria. | `emitRoles`, `beginRoleReveal`, `awardRoundBonus`, `startNextRound`, `startHintPhase`, `startShowcasePhase`, `startVotingPhase`, `processVotingResults`, `startGuessPhase`, `finishGuess` |
| `game/bots.ts` | Bots de práctica: creación con nombres únicos (temáticos y numerados) y sus acciones automáticas en cada fase (pistas, votos, adivinanza). | `createBotPlayers`, `scheduleBotHints`, `scheduleBotVotes`, `scheduleBotGuess` |
| `socket/handlers.ts` | Handlers de Socket.IO: registra todos los eventos cliente → servidor y valida cada payload con zod. | `registerSocketHandlers` |
| `data/words.ts` | Banco de palabras: `WORD_BANK` (334 palabras en 18 categorías), `SAMPLE_HINTS`, `GENERIC_IMPOSTOR_HINTS`, `getRandomWord` y `getBotHint`. | `WORD_BANK`, `SAMPLE_HINTS`, `GENERIC_IMPOSTOR_HINTS`, `getRandomWord`, `getBotHint` |

## Protocolo de eventos

### Cliente → servidor

| Evento | Payload (zod) | Notas |
| --- | --- | --- |
| `create_room` | — | Crea una sala; el socket emisor queda como host. |
| `add_bots` | `{ count: number }` | Agrega bots de práctica (solo host, solo en `LOBBY`). Sin `count` válido se agregan 3 por defecto. |
| `join_room` | `{ roomCode, name?, avatar?, color?, token? }` | Entra a una sala; si hay `token`, hace **rejoin** y restaura la sesión (rol, pista, voto, puntos). |
| `start_game` | — | Inicia la partida (solo host, requiere ≥3 jugadores; los bots cuentan). |
| `submit_hint` | `{ hint: string }` | Envía la pista (solo en `HINT_PHASE`); el servidor la trunca a 50 caracteres. |
| `submit_vote` | `{ targetId: string }` | Vota a un jugador vivo o `"SKIP"` (solo en `VOTING`). |
| `submit_impostor_guess` | `{ guessedWord: string }` | Adivinanza del impostor (solo en `GUESS_PHASE`, solo el impostor). |
| `reset_game` | — | Vuelve a `LOBBY` conservando jugadores y puntuaciones (solo host). |
| `disconnect` | (evento nativo) | Desconexión: el host cierra la sala; un jugador tiene 45 s de gracia para volver con su token. |

### Servidor → cliente

| Evento | Direccionamiento | Contenido |
| --- | --- | --- |
| `room_created` | privado (host) | Código de sala, IP LAN, IPs candidatas y estado inicial. |
| `joined_successfully` | privado | `playerId`, `playerToken` y estado actual de la sala. |
| `your_role` | **privado** (por `socket.id`) | Rol + categoría; la palabra solo para tripulantes (el impostor recibe `null`). |
| `guess_word_options` | **privado** (impostor) | Las 4 opciones de la última oportunidad. |
| `error_message` | privado | Errores de flujo (sala inexistente, partida en curso, voto inválido, host se fue, etc.). |
| `room_updated` | broadcast | Estado público sanitizado de la sala (`getSanitizedRoomState`). |
| `timer_tick` | broadcast | Cuenta regresiva de la fase actual (segundos restantes). |

Los eventos **privados** se emiten a un socket específico (`io.to(socket.id).emit(...)`), nunca por broadcast. En un **rejoin**, el servidor re-emite los eventos privados perdidos (`your_role` y, si aplica, `guess_word_options`).

## Máquina de fases

| Estado | Duración | Qué ocurre |
| --- | --- | --- |
| `LOBBY` | — | La sala acepta jugadores y bots; solo el host inicia. |
| `ROLE_REVEAL` | 6 s | Se reparten rol y palabra por eventos privados. |
| `HINT_PHASE` | 30 s | Cada jugador escribe su pista; los bots lo hacen con un retraso aleatorio. |
| `SHOWCASE` | 35 s | Se muestran todas las pistas; debate antes de votar. |
| `VOTING` | 20 s | Cada jugador vota a un objetivo o `SKIP`; los bots votan al azar. |
| `EJECTION` | 8 s | Escena de votos; se resuelve quién sale (o si hubo empate). |
| `GUESS_PHASE` | 15 s | Última oportunidad del impostor: adivinar entre 4 opciones. |
| `GAME_OVER` | — | Palabra revelada, ganador y puntuaciones finales. |

Transiciones:

- **Voto → expulsión** (`processVotingResults`): si el expulsado es el **impostor** → `GUESS_PHASE` (puede robar la victoria). Si es un **tripulante** → pasa a espectador; con ≤1 tripulante vivo el impostor gana de inmediato; si no, siguiente ronda. **Empate** → nadie sale, siguiente ronda.
- **Siguiente ronda** (`startNextRound`): bono +10 a los tripulantes vivos, palabra secreta nueva y pistas/votos limpios. Al superar `MAX_ROUNDS` (5) el impostor gana por supervivencia (+100).
- **Adivinanza** (`finishGuess` / `submit_impostor_guess`): acierto → impostor +150; fallo → tripulantes vivos +50. Ambos casos terminan en `GAME_OVER`.

## Seguridad por diseño

- La **palabra secreta** solo se expone en `GAME_OVER`; las **pistas** solo desde `SHOWCASE` en adelante (lo garantiza `getSanitizedRoomState` y lo verifican los tests).
- El **rol y la palabra** viajan únicamente por eventos privados dirigidos por `socket.id` (`your_role`, `guess_word_options`), nunca en broadcasts.
- El **token** de sesión de cada jugador nunca se expone por broadcast.
- Todo payload cliente → servidor se valida con **zod** (`shared/schemas.ts`), la única fuente de verdad para cliente y servidor.

## Tests

Pruebas unitarias con **vitest** (configuración en `vitest.config.ts`, incluye `server/**/*.test.ts`):

- `server/game/public-state.test.ts` — verifica la **frontera de seguridad**: la palabra no se filtra antes de `GAME_OVER` y las pistas no se filtran antes de `SHOWCASE`.
- `server/game/phases.test.ts` — verifica la **máquina de fases** con timers falsos (`vi.useFakeTimers`): transiciones entre fases, expulsiones, adivinanza y victorias por supervivencia.

```bash
bun run test     # o: npm test
```

## Configuración

Variables de entorno (ver `.env.example` en la raíz del repo):

| Variable | Default | Descripción |
| --- | --- | --- |
| `PORT` | `3001` | Puerto donde escucha el servidor. |
| `LOG_LEVEL` | `info` | Nivel del logger (pino). |

## Ejecución

```bash
# Dev con recarga: Node 24 ejecuta TS nativo (--watch), carga .env si existe
bun run server

# Health check
curl http://localhost:3001/health   # -> { "ok": true }

# Arranque completo (servidor + frontend en terminal dividido)
bun start
```

Detalles:

- El endpoint `GET /health` responde `{ "ok": true }`; útil para monitorear que el servidor está vivo.
- `bun run server` equivale a `node --env-file-if-exists=.env --watch server/index.ts`.
- `bun start` (`scripts/start.mjs`) libera los puertos 3001/5173 y abre Windows Terminal con dos paneles verticales 50/50 (SERVER arriba, FRONTEND abajo); sin Windows Terminal cae a `concurrently`.
