# CodeImpostor

Juego multijugador de **deducción social en tiempo real** (estilo *Among Us* / *El Topo*) para la clase de **Administración de Proyectos de Software**. Se ejecuta en la red Wi-Fi local del aula: la pantalla del proyector (Host) muestra el tablero y un **código QR**; los estudiantes se unen desde sus teléfonos escaneándolo o ingresando el código de sala, sin instalar nada.

## Cómo se juega

- **Tripulantes**: conocen la **palabra secreta** (concepto de software o gestión de proyectos, ej. `SCRUM`, `GIT COMMIT`, `REFACTORIZACIÓN`). Escriben una pista suficientemente clara para demostrar que la conocen, sin ponérsela fácil al Impostor.
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

## Stack y arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 (React Compiler) |
| Estilos | Tailwind CSS v4 con tema cyberpunk/glassmorphism |
| Tiempo real | Socket.io 4 (cliente + servidor) |
| Servidor | Node.js / Express 5 en TypeScript (`server/index.ts`, salas en memoria) |
| Extras | `qrcode.react` (QR del host), `html5-qrcode` (escáner móvil), `canvas-confetti`, `gsap`, `lucide-react` |

```
proyecto-personal/
├── server/
│   ├── index.ts            # Servidor Socket.io (TypeScript): salas, fases, bots, puntuación
│   ├── types.ts            # Tipos del dominio (Room, Player, eventos)
│   └── words.ts            # Banco de 41 palabras + pistas para bots
├── src/
│   ├── components/
│   │   ├── HostView.tsx       # Pantalla del proyector (QR, tablero, pistas, votos)
│   │   ├── PlayerView.tsx     # Vista móvil del jugador (unirse, pista, voto, adivinar)
│   │   ├── QRScannerModal.tsx # Escáner de QR con cámara
│   │   └── AvatarIcon.tsx     # 50 avatares temáticos
│   ├── context/
│   │   └── SocketContext.tsx  # Hook useGameSocket: encapsula Socket.io y estado global
│   ├── App.tsx                # Router: Landing / Host (?host=true) / Jugador (?room=XXXX)
│   └── index.css              # Estilos globales
├── index.html
└── package.json
```

### Seguridad por diseño

- La **palabra secreta** solo se expone en la pantalla de Game Over; las **pistas** solo desde la fase de debate.
- El **rol y la palabra** viajan por eventos privados dirigidos a cada jugador (`your_role`, `guess_word_options`), nunca por broadcast.
- Estado centralizado y sanitizado para el cliente (`getSanitizedRoomState`).

## Cómo ejecutar

**Requisitos**: Node.js 18+ (o [bun](https://bun.sh)).

```bash
# 1. Instalar dependencias
npm install          # o: bun install

# 2. Servidor de Socket.io (puerto 3001)
npm run server

# 3. Frontend Vite (puerto 5173, expuesto en la red local)
npm run dev
```

> Son **dos procesos separados**: `npm run server` no levanta el frontend, y viceversa.

### Cómo jugar

1. **Host (proyector)**: abre `http://localhost:5173` y pulsa **MODO PROYECTOR** (o entra con `?host=true`). Aparecerá el código de sala y el QR apuntando a la IP local.
2. **Móviles**: escanean el QR, o ingresan el código de 4 dígitos manualmente en `http://<IP-del-host>:5173`. Eligen nombre, avatar y color.
3. El Host inicia la partida con **3 o más jugadores** (los bots cuentan).

### Nota sobre el escáner QR con cámara

El escáner usa `getUserMedia`, que **solo funciona en contexto seguro** (HTTPS o `localhost`). Al abrir la app desde un móvil por `http://192.168.x.x:5173`, el navegador bloquea la cámara por política de seguridad (no es un fallo del código). Por eso los móviles pueden **ingresar el código de sala manualmente** — el flujo principal de la clase no requiere cámara.

Si en el futuro se quiere cámara desde los móviles, las opciones son: (a) un **túnel HTTPS público** (ngrok/cloudflared) hacia el puerto 5173 — con internet en el aula; o (b) **mkcert** con la CA local instalada en cada móvil — sin internet.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Dev server de Vite (puerto 5173, accesible en la LAN) |
| `npm run server` | Servidor Socket.io (puerto 3001) |
| `npm run build` | Compila TypeScript + build de producción (`dist/`) |
| `npm run preview` | Previsualiza el build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck:server` | Type-check del servidor (`tsconfig.server.json`) |

---
*Proyecto académico — Administración de Proyectos de Software.*
