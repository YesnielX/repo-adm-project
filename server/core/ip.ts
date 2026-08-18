/**
 * Utilidades de red: la IP LAN real del host (para el QR) y las candidatas.
 */
import os from "os";

// Nombres típicos de redes reales (Wi-Fi o cable) por sistema operativo.
const PREFERRED_INTERFACES = [
  "Wi-Fi",
  "WLAN",
  "wlan0",
  "en0",
  "Ethernet",
  "eth0",
  "enp0s3",
];

// Nombres de interfaces virtuales/VPN a descartar al elegir la IP.
const VIRTUAL_NAME_PATTERN =
  /radmin|tailscale|vethernet|wsl|hyper-v|vmware|virtualbox|docker|loopback|bluetooth|tun|tap|utun|awdl|bridge|ppp/i;

/** Primera IP IPv4 no interna de una interfaz, o null si no hay. */
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
 * IP LAN real del host para generar el QR: primero los nombres de red típicos,
 * luego la primera interfaz no virtual, después cualquier IPv4 no interna.
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

/** Todas las IPs IPv4 no internas del equipo, con las redes reales primero. */
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

export const LOCAL_IP = getLocalIpAddress();
export { getLocalIpCandidates };
