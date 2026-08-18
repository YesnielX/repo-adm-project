/**
 * Arranque dividido estilo tmux.
 *
 * Si Windows Terminal (wt) está disponible, abre una ventana con dos paneles:
 *   - SERVER   (arriba)   -> bun run server
 *   - FRONTEND (abajo)    -> bun run dev
 *
 * Antes de abrir, libera los puertos 3001 (server) y 5173 (vite) si quedaron
 * ocupados por una ejecución anterior. Si wt no existe (Linux/macOS, o Windows
 * sin Windows Terminal), cae a `concurrently` con logs intercalados.
 */
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const DEV_PORTS = [3001, 5173];

/** Ruta de wt.exe en Windows, o null si no está disponible. */
function findWindowsTerminal() {
  if (process.platform !== "win32") return null;
  try {
    const res = spawnSync("where.exe", ["wt"], { encoding: "utf8" });
    if (res.status !== 0) return null;
    const line = res.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().endsWith("wt.exe"));
    return line ?? null;
  } catch {
    return null;
  }
}

/**
 * Mata los procesos que estén escuchando en los puertos de desarrollo.
 * Evita que una ejecución anterior deje vite en 5174 o el server caído.
 */
function freeDevPorts() {
  if (process.platform !== "win32") return;
  const ps = [
    "Get-NetTCPConnection",
    "-State",
    "Listen",
    "-ErrorAction",
    "SilentlyContinue",
    "|",
    "Where-Object",
    "{",
    "$_.LocalPort",
    "-in",
    "@(3001,5173)",
    "}",
    "|",
    "ForEach-Object",
    "{",
    "Stop-Process",
    "-Id",
    "$_.OwningProcess",
    "-Force",
    "-ErrorAction",
    "SilentlyContinue;",
    "Write-Output",
    "('[' + $_.LocalPort + '] liberado (PID ' + $_.OwningProcess + ')')",
    "}",
  ];
  try {
    const res = spawnSync("powershell.exe", ["-NoProfile", "-Command", ps.join(" ")], {
      encoding: "utf8",
    });
    const output = (res.stdout ?? "").trim();
    if (output) console.log(`[start] ${output.split(/\r?\n/).join(" | ")}`);
  } catch {
    // Si falla la limpieza, seguimos: vite pedirá otro puerto.
  }
}

function startSplit(wtPath) {
  const args = [
    "-w", "0",
    "nt", "--title", "SERVER",
    "bun", "run", "server",
    ";",
    "split-pane", "-V", "-s", "0.5", "--title", "FRONTEND",
    "bun", "run", "dev",
  ];
  const child = spawn(wtPath, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  child.on("error", (err) => {
    console.error("[start] no se pudo abrir Windows Terminal:", err.message);
    console.error("[start] usando concurrently como fallback.");
    startConcurrently();
  });
}

function startConcurrently() {
  const child = spawn(
    "npx",
    [
      "concurrently",
      '"npm run server"',
      '"npm run dev"',
      "--names",
      "SERVER,FRONTEND",
      "--prefix-colors",
      "magenta,cyan",
    ],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}

const wt = findWindowsTerminal();
if (wt) {
  freeDevPorts();
  console.log(`[start] Windows Terminal detectado (${wt})`);
  startSplit(wt);
} else {
  console.log("[start] Windows Terminal no detectado; usando concurrently.");
  startConcurrently();
}
