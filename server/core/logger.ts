/**
 * Logger centralizado del servidor basado en Pino.
 *
 * Características:
 * - En modo desarrollo (NODE_ENV !== "production"): Emplea `pino-pretty` para formatear los logs con colores y legibilidad humana en consola.
 * - En modo producción: Emite JSON estructurado de alto rendimiento.
 * - Tolerante a fallos: Si `pino-pretty` no está disponible o falla su carga, cae automáticamente al logger estándar en JSON sin interrumpir el servidor.
 */
import { pino, type Logger } from "pino";

/** Verifica si la aplicación se está ejecutando en entorno de producción */
const isProduction = process.env.NODE_ENV === "production";

/**
 * Inicializa y configura la instancia de Pino.
 *
 * @returns Instancia configurada de Logger.
 */
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

/** Instancia compartida del logger en toda la aplicación backend */
export const logger = createLogger();

