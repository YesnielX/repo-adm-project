/**
 * Servidor principal de CodeImpostor: salas en memoria sincronizadas con Socket.IO.
 *
 * Arquitectura:
 * - El host proyecta la pantalla en el aula y nunca juega como participante.
 * - Los estudiantes se unen desde sus teléfonos móviles escaneando el código QR o ingresando el código de sala.
 * - Ejecutado con `npm run server` (Node.js 24 ejecuta TypeScript de forma nativa).
 *
 * Módulos integrados:
 * - `server/socket/handlers.ts`: Manejadores de eventos bidireccionales de Socket.IO y validaciones zod.
 * - `server/game/phases.ts`: Máquina de estados y fases del juego.
 * - `server/game/bots.ts`: Lógica y simulación de jugadores controlados por la computadora.
 * - `server/core/io.ts`: Instancias base de Express, HTTP y Socket.IO.
 * - `server/core/logger.ts`: Logger centralizado estructurado con Pino.
 */
import { app, httpServer, io } from "./core/io.ts";
import { PORT } from "./config.ts";
import { LOCAL_IP } from "./core/ip.ts";
import { logger } from "./core/logger.ts";
import { registerSocketHandlers } from "./socket/handlers.ts";

// Inicializa y suscribe todos los manejadores de eventos de Socket.IO
registerSocketHandlers();

/**
 * Endpoint HTTP de verificación de salud (health check).
 * Útil para monitorear la disponibilidad del servidor o para balanceadores de carga/túneles.
 */
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Inicia la escucha del servidor HTTP en todas las interfaces de red (0.0.0.0)
httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info(`Servidor CodeImpostor escuchando en http://${LOCAL_IP}:${PORT}`);
});

/** Bandera para evitar ejecuciones múltiples del proceso de apagado */
let shuttingDown = false;

/**
 * Realiza un cierre ordenado (Graceful Shutdown) ante señales del sistema operativo (SIGINT, SIGTERM).
 *
 * Proceso:
 * 1. Cierra conexiones activas de Socket.IO para notificar a los clientes.
 * 2. Cierra el servidor HTTP subyacente para dejar de aceptar peticiones.
 * 3. Establece un temporizador de seguridad forzado (5s) por si alguna conexión queda bloqueada.
 *
 * @param signal Nombre de la señal recibida (ej: "SIGINT" o "SIGTERM").
 */
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[server] señal ${signal} recibida, cerrando...`);
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

// Registro de señales de terminación del proceso
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

