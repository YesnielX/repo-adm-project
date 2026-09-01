/**
 * Utilidades de detección de red local (LAN).
 *
 * Determina la dirección IPv4 adecuada del servidor host para construir
 * la URL del código QR que los estudiantes escanean en clase, filtrando
 * adaptadores virtuales de virtualización o VPNs (Docker, WSL, VMware, etc.).
 */
import os from "os";

/**
 * Nombres comunes de interfaces de red física (Wi-Fi o cable Ethernet)
 * ordenados por preferencia según el sistema operativo (Windows, macOS, Linux).
 */
const PREFERRED_INTERFACES = [
  "Wi-Fi",
  "WLAN",
  "wlan0",
  "en0",
  "Ethernet",
  "eth0",
  "enp0s3",
];

/**
 * Expresión regular para identificar y descartar interfaces virtuales,
 * túneles de VPN, puentes o contenedores que no son accesibles por los teléfonos del aula.
 */
const VIRTUAL_NAME_PATTERN =
  /radmin|tailscale|vethernet|wsl|hyper-v|vmware|virtualbox|docker|loopback|bluetooth|tun|tap|utun|awdl|bridge|ppp/i;

/**
 * Obtiene la primera dirección IPv4 válida y no interna (no loopback 127.0.0.1)
 * de una interfaz de red específica.
 *
 * @param iface Lista de información de red de la interfaz analizada.
 * @returns La dirección IP en formato string o null si no se encuentra IPv4 externa.
 */
function firstIpv4(
  iface: os.NetworkInterfaceInfo[] | undefined,
): string | null {
  if (!iface) return null;
  for (const alias of iface) {
    if (alias.family === "IPv4" && !alias.internal) return alias.address;
  }
  return null;
}

/**
 * Determina la mejor dirección IP local del host para generar el código QR.
 *
 * Algoritmo de selección:
 * 1. Busca en las interfaces preferidas físicas conocidas (Wi-Fi, Ethernet).
 * 2. Si no coincide ninguna preferida, busca la primera interfaz que NO coincida con patrones virtuales.
 * 3. En caso extremo, toma cualquier IPv4 no interna disponible.
 * 4. Si no hay conexión de red, retorna "localhost".
 *
 * @returns Dirección IP local o 'localhost'.
 */
function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();

  for (const name of PREFERRED_INTERFACES) {
    const ip = firstIpv4(interfaces[name]);
    if (ip) return ip;
  }

  for (const [name, iface] of Object.entries(interfaces)) {
    if (VIRTUAL_NAME_PATTERN.test(name)) continue;
    const ip = firstIpv4(iface);
    if (ip) return ip;
  }

  for (const iface of Object.values(interfaces)) {
    const ip = firstIpv4(iface);
    if (ip) return ip;
  }

  return "localhost";
}

/**
 * Retorna todas las direcciones IPv4 no internas del equipo, ordenando
 * primero las redes físicas reales y al final las virtuales/secundarias.
 * Útil para que el Host pueda cambiar manualmente de IP si tiene múltiples adaptadores.
 *
 * @returns Arreglo de direcciones IP candidatas.
 */
function getLocalIpCandidates(): string[] {
  const interfaces = os.networkInterfaces();
  const real: string[] = [];
  const others: string[] = [];
  for (const [name, iface] of Object.entries(interfaces)) {
    for (const alias of iface ?? []) {
      if (alias.family !== "IPv4" || alias.internal) continue;
      (VIRTUAL_NAME_PATTERN.test(name) ? others : real).push(alias.address);
    }
  }
  return [...real, ...others];
}

/** Dirección IP local resuelta en el arranque del servidor */
export const LOCAL_IP = getLocalIpAddress();
export { getLocalIpCandidates };

