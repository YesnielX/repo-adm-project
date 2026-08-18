/**
 * Infraestructura compartida: la app Express y el servidor HTTP/Socket.IO
 * que usan el resto de módulos del servidor.
 */
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

export { app, httpServer, io };
