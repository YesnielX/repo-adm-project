/**
 * Logger compartido del servidor (Pino). En desarrollo (NODE_ENV !=
 * "production") se embellece con pino-pretty; en producción emite JSON plano.
 * Si pino-pretty no carga, se cae a la instancia JSON y el servidor sigue.
 */
import { pino, type Logger } from "pino";

const isProduction = process.env.NODE_ENV === "production";

function createLogger(): Logger {
  try {
    return pino({
      level: process.env.LOG_LEVEL ?? "info",
      ...(isProduction ? {} : { transport: { target: "pino-pretty" } }),
    });
  } catch {
    return pino({ level: process.env.LOG_LEVEL ?? "info" });
  }
}

export const logger = createLogger();
