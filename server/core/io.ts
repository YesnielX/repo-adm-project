/**
 * Infraestructura de red y comunicación en tiempo real.
 *
 * Exporta las instancias centrales de Express, el servidor HTTP nativo de Node.js
 * y el servidor de Socket.IO configurado con soporte CORS abierto para permitir
 * conexiones desde dispositivos móviles en la red de área local (LAN).
 */
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

/** Aplicación Express utilizada para endpoints auxiliares (como /health) */
const app = express();
app.use(cors());

/** Servidor HTTP que envuelve la app Express y sobre el cual se monta Socket.IO */
const httpServer = createServer(app);

/**
 * Instancia del servidor de Socket.IO.
 *
 * Configurada con política CORS permisiva (origen "*") para permitir que clientes
 * web ejecutándose en teléfonos móviles (a través de la IP local) o en localhost
 * puedan establecer conexiones WebSocket sin restricciones de navegador.
 */
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

export { app, httpServer, io };

