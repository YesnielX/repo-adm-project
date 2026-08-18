/**
 * Servidor de CodeImpostor: salas en memoria sincronizadas con Socket.io.
 * El host proyecta y nunca juega; los móviles entran con el QR o el código.
 * Se corre con `npm run server` (Node 24 ejecuta TS nativo, así que aquí solo
 * hay sintaxis borrable). Este archivo solo arranca el servidor: los handlers
 * de socket viven en handlers.ts, la máquina de fases en phases.ts (con la
 * lógica de los bots en bots.ts) y la infraestructura compartida en io.ts.
 */
import { app, httpServer, io } from "./core/io.ts";
import { PORT } from "./config.ts";
import { LOCAL_IP } from "./core/ip.ts";
import { logger } from "./core/logger.ts";
import { registerSocketHandlers } from "./socket/handlers.ts";

registerSocketHandlers();

// Endpoint de salud: útil para monitorear que el servidor está vivo.
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info(`Servidor CodeImpostor escuchando en http://${LOCAL_IP}:${PORT}`);
});

let shuttingDown = false;

/** Cierre ordenado ante SIGINT/SIGTERM; con guard para no dispararse dos veces. */
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[server] señal ${signal} recibida, cerrando...`);
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
