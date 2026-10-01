import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const PORT_MIN = 1024;
const PORT_MAX = 65535;

/** Same local-part rule as app/src/lib/files/identity.ts */
export function usernameToEmail(username) {
  const trimmed = String(username ?? "").trim().toLowerCase();
  if (!trimmed) throw new Error("Username is required");
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@drivebay.local`;
}

/**
 * Static port used for router forwarding.
 * Matches save-port.cjs: integers from 1024 through 65535.
 */
export function parsePort(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error("Port must be a number from 1024 to 65535.");
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < PORT_MIN || port > PORT_MAX) {
    throw new Error("Port must be a number from 1024 to 65535.");
  }
  return port;
}

/** True when nothing is accepting TCP connections on 0.0.0.0:port. */
export function isPortFree(port) {
  const checked = parsePort(port);
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ port: checked, host: "0.0.0.0", exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

export function readJson(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

export function readConfig(home) {
  const raw = readJson(path.join(home, "config.json"));
  const mode = raw.mode === "tailscale" ? "tailscale" : "regular";
  return {
    port: parsePort(raw.port),
    mode,
    version: raw.version == null ? "" : String(raw.version),
  };
}

/** Settings can rewrite drivebay.port. Random is ignored so the forwarded port stays put. */
export function resolveListenPort(home, configPort) {
  const file = path.join(home, "drivebay.port");
  try {
    const raw = fs.readFileSync(file, "utf8").trim().toLowerCase();
    if (raw && raw !== "random") return parsePort(raw);
  } catch {
    /* missing */
  }
  return configPort;
}
