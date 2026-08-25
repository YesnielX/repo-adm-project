# ClassArcade

Plataforma de juegos multijugador en tiempo real para la clase de **Administración de Proyectos de Software**. Su juego insignia es **CodeImpostor**, un juego de **deducción social** (estilo _Among Us_ / _El Topo_) que se ejecuta en la red Wi-Fi local del aula: la pantalla del proyector (Host) muestra el tablero y un **código QR**; los estudiantes se unen desde sus teléfonos escaneándolo o ingresando el código de sala, sin instalar nada.

## CodeImpostor: cómo se juega

- **Tripulantes**: conocen la **palabra secreta** (concepto de software o gestión de proyectos, ej. `Scrum`, `Git Commit`, `Refactorización`). Escriben una pista suficientemente clara para demostrar que la conocen, sin ponérsela fácil al Impostor.
- **Impostor**: **no conoce la palabra** (solo la categoría). Debe disimular con una pista ambigua, evitar ser votado y, si lo descubren, adivinar la palabra en su última oportunidad.

### Flujo de una partida (multi-ronda)

```
LOBBY → Ronda 1..5: Revelación de roles (6s) → Pistas (30s) → Debate (35s)
→ Votación (20s) → Escena de votos (8s) → ¿Impostor? → Última oportunidad (15s) → Fin
```

- Cada ronda usa una **palabra secreta nueva** y el **mismo impostor**.
- **Impostor expulsado** → elige entre 4 opciones de palabra: acierta y roba la victoria (+150); falla y ganan los Tripulantes vivos (+50).
- **Tripulante expulsado** → pasa a espectador. Con ≤1 tripulante vivo, gana el Impostor.
- **Empate** → nadie sale, siguiente ronda.
- **Sin atraparlo en 5 rondas** → gana el Impostor por supervivencia (+100).
- **Puntuación**: +10 por ronda sobrevivida a los tripulantes vivos; Impostor +100 (sobrevive) / +150 (adivina); Tripulantes +50 (si el Impostor falla). El Host puede jugar otra partida conservando las puntuaciones.
- **Bots de práctica**: agrega +3, +20, +30 o +50 bots con un clic para probar partidas completas.

## Hub Arcade

El hub (`src/data/games.ts`) lista **6 juegos**: CodeImpostor, Tira y Afloja, Papa Caliente, DrawDash, Trivia Royale y SwipeRight. **CodeImpostor es el juego jugable** (estado `available`); el resto son tarjetas del catálogo (estado `soon`).

## Stack y arquitectura

| Capa        | Tecnología                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Frontend    | React 19 + TypeScript + Vite 8 (React Compiler)                                                                               |
| Enrutado    | TanStack Router v1 (file-based: hub, selección, host, unirse)                                                                 |
| Estilos     | Tailwind CSS v4 con tema **arcade** (matte/phosphor) y tema **Matrix** opcional                                               |
| Tiempo real | Socket.IO 4 (cliente + servidor)                                                                                              |
| Servidor    | Node.js 24 / Express 5 en TypeScript (salas en memoria)                                                                       |
| Validación  | zod 4 (contratos compartidos `shared/schemas.ts`)                                                                             |
| Logs        | pino + pino-pretty                                                                                                            |
| Pruebas     | vitest                                                                                                                        |
| Extras      | `qrcode.react` (QR del host), `html5-qrcode` (escáner móvil), `cuelume` (sonidos), `canvas-confetti`, `gsap`, `lucide-react` |

> Sobre el diseño: la estética es deliberadamente anti-neón. El tema por defecto `arcade` usa superficies matte (negro `#0a0b0d`) con acento de fósforo verde (`#a3e635`) y cero glow. El tema **Matrix** (opcional, aplicado con `html.theme-matrix`) recoloriza los tokens a verde terminal (`#00ff41`) manteniendo la estructura.

### Estructura del proyecto

```
proyecto-personal/
├── server/                      # Servidor Socket.IO + Express 5 (Node 24, TS nativo)
│   ├── index.ts                 # Bootstrap, /health, cierre ordenado (SIGINT/SIGTERM)
│   ├── config.ts                # Puerto, límites, duración de fases, nombres/colores de bots
│   ├── types.ts                 # Tipos del dominio (Room, Player, payloads, estado público)
│   ├── core/                    # io.ts (app/HTTP/Socket.io), ip.ts (IP LAN), logger.ts (pino)
│   ├── game/                    # rooms.ts, phases.ts (máquina de fases), bots.ts, public-state.ts
│   ├── socket/                  # handlers.ts (eventos Socket.IO + validación zod)
│   └── data/                    # words.ts (banco de 334 palabras en 18 categorías)
├── shared/
│   └── schemas.ts               # Contratos compartidos (zod) cliente <-> servidor
├── scripts/
│   └── start.mjs                # Arranque dividido (Windows Terminal / concurrently)
└── src/                         # Frontend React 19 + TanStack Router (hub Arcade + juego)
    ├── main.tsx, router.tsx, routeTree.gen.ts
    ├── routes/                  # File-based: __root, index, codeimpostor/{index,host,unirse}
    ├── components/              # HostView, PlayerView, QRScannerModal, AvatarIcon, landing/
    ├── context/                 # SocketContext, ThemeContext
    ├── data/games.ts            # Catálogo de 6 juegos del hub
    └── audio/gameSounds.ts      # Sonidos del juego (cuelume)
```

Configuración de raíz: `vitest.config.ts`, `vite.config.ts`, `eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.server.json`, `.prettierrc`, `.env.example`, `cspell.json`.

### Seguridad por diseño

- La **palabra secreta** solo se expone en la pantalla de Game Over; las **pistas** solo desde la fase de debate (`SHOWCASE` en adelante).
- El **rol y la palabra** viajan por eventos privados dirigidos a cada jugador (`your_role`, `guess_word_options`), nunca por broadcast.
- Estado centralizado y sanitizado para el cliente (`getSanitizedRoomState`).
- Los **payloads** cliente → servidor se validan con **zod** (`shared/schemas.ts`), la única fuente de verdad para cliente y servidor.

## Cómo ejecutar

**Requisitos**: Node.js 24+ y [bun](https://bun.sh) para instalar dependencias (o `npm install`).

```bash
# 1. Instalar dependencias
bun install        # o: npm install

# 2. Configuración opcional (puerto y nivel de log)
cp .env.example .env

# 3. Servidor de Socket.io (puerto 3001)
bun run server

# 4. Frontend Vite (puerto 5173, expuesto en la red local)
bun run dev
```

> `bun start` (o `npm start`) ejecuta `scripts/start.mjs`: libera los puertos 3001/5173 si quedaron ocupados y abre **Windows Terminal** con dos paneles verticales 50/50 y títulos propios (**SERVER** arriba, **FRONTEND** abajo). Si Windows Terminal no está disponible (Linux/macOS, o Windows sin `wt`), cae a `concurrently` con logs intercalados. En cualquier caso son **dos procesos separados**: `bun run server` no levanta el frontend, y viceversa.

### Cómo jugar

1. **Host (proyector)**: abre `http://localhost:5173`, entra al hub Arcade y pulsa **CodeImpostor** → **MODO PROYECTOR**. Aparecerá el código de sala y el QR apuntando a la IP local.
2. **Móviles**: escanean el QR, o ingresan el código de 4 dígitos manualmente en `http://<IP-del-host>:5173`. Eligen nombre, avatar y color.
3. El Host inicia la partida con **3 o más jugadores** (los bots cuentan).

### Nota sobre el escáner QR con cámara

El escáner usa `getUserMedia`, que **solo funciona en contexto seguro** (HTTPS o `localhost`). Al abrir la app desde un móvil por `http://192.168.x.x:5173`, el navegador bloquea la cámara por política de seguridad (no es un fallo del código). Por eso los móviles pueden **ingresar el código de sala manualmente** — el flujo principal de la clase no requiere cámara.

Si en el futuro se quiere cámara desde los móviles, las opciones son: (a) un **túnel HTTPS público** (ngrok/cloudflared) hacia el puerto 5173 — con internet en el aula; o (b) **mkcert** con la CA local instalada en cada móvil — sin internet.

## Scripts

| Comando                    | Descripción                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`              | Dev server de Vite (puerto 5173, `--host`, accesible en la LAN)                |
| `npm run server`           | Servidor Socket.io (puerto 3001, Node con watch y `.env`)                      |
| `npm start`                | `scripts/start.mjs`: terminal dividido SERVER/FRONTEND; fallback a `concurrently` |
| `npm test`                 | Pruebas con vitest (ejecución única)                                           |
| `npm run test:watch`       | Pruebas con vitest en modo watch                                               |
| `npm run build`            | `tsc -b` + `vite build` (salida en `dist/`)                                    |
| `npm run lint`             | ESLint                                                                          |
| `npm run format`           | Formatea todo el repo con Prettier                                              |
| `npm run preview`          | Previsualiza el build (`vite preview`)                                          |
| `npm run typecheck:server` | Type-check del servidor (`tsconfig.server.json`)                                |

---

_Proyecto académico — Administración de Proyectos de Software._
