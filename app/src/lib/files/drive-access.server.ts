/**
 * Per-drive access toggles (user-editable from Settings).
 * Stored in data/drive-access.json so Pinokio Update does not wipe them.
 *
 * On each read we scan live drives, then apply disabled ids.
 * Empty disabled list = all discovered drives allowed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { resolveDataDir } from "./settings.server";
import { listDrives } from "./fs.server";
import type { Drive } from "./types";
import { normalizeRoot } from "./server-lock.server";

export type DriveAccessState = {
  version: 1;
  /** Drive ids the owner turned OFF (volume letter, home, etc.). */
  disabledIds: string[];
  updatedAt: string;
};

export type DriveAccessRow = Drive & {
  enabled: boolean;
};

const DEFAULTS: DriveAccessState = {
  version: 1,
  disabledIds: [],
  updatedAt: new Date(0).toISOString(),
};

export function resolveDriveAccessFile(): string {
  const fromEnv = process.env.DRIVEBAY_DRIVE_ACCESS_FILE?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(resolveDataDir(), "drive-access.json");
}

function ensureFile(): string {
  const file = resolveDriveAccessFile();
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify(
        {
          ...DEFAULTS,
          updatedAt: new Date().toISOString(),
          note: "disabledIds are drive ids from the sidebar (C, X, home, …). Edit in Settings or here.",
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return file;
}

export function readDriveAccess(): DriveAccessState {
  const file = ensureFile();
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<DriveAccessState>;
    const ids = Array.isArray(raw.disabledIds)
      ? raw.disabledIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
      : [];
    return {
      version: 1,
      disabledIds: [...new Set(ids)],
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULTS, disabledIds: [] };
  }
}

export function writeDriveAccess(disabledIds: string[]): DriveAccessState {
  const file = ensureFile();
  const next: DriveAccessState = {
    version: 1,
    disabledIds: [...new Set(disabledIds.map((x) => x.trim()).filter(Boolean))],
    updatedAt: new Date().toISOString(),
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

/** Live scan + enabled flags for Settings UI. */
export async function listDrivesWithAccess(): Promise<{
  drives: DriveAccessRow[];
  disabledIds: string[];
  accessFile: string;
}> {
  const state = readDriveAccess();
  const disabled = new Set(state.disabledIds.map((x) => x.toLowerCase()));
  const scanned = await listDrives();
  const drives: DriveAccessRow[] = scanned.map((d) => ({
    ...d,
    enabled: !disabled.has(d.id.toLowerCase()),
  }));
  return {
    drives,
    disabledIds: state.disabledIds,
    accessFile: resolveDriveAccessFile(),
  };
}

export function isDriveIdEnabled(id: string, state: DriveAccessState = readDriveAccess()): boolean {
  const disabled = new Set(state.disabledIds.map((x) => x.toLowerCase()));
  return !disabled.has(id.toLowerCase());
}

/** Filter full drive list to only enabled ones (sidebar / listDrives API). */
export async function listEnabledDrives(): Promise<Drive[]> {
  const { drives } = await listDrivesWithAccess();
  return drives.filter((d) => d.enabled).map(({ enabled: _e, ...rest }) => rest);
}

/**
 * Path allowed if it sits under at least one currently enabled drive root.
 * If somehow no drives are enabled, deny everything except empty scan.
 */
export async function isPathAllowedByDriveAccess(resolvedPath: string): Promise<boolean> {
  const enabled = await listEnabledDrives();
  if (!enabled.length) return false;
  const target = normalizeRoot(resolvedPath).toLowerCase();
  return enabled.some((d) => {
    const root = normalizeRoot(d.path).toLowerCase();
    return target === root || target.startsWith(root.endsWith("\\") ? root : root + "\\");
  });
}

export async function assertPathAllowedByDriveAccess(resolvedPath: string): Promise<void> {
  const ok = await isPathAllowedByDriveAccess(resolvedPath);
  if (!ok) {
    throw new Error("This drive is turned off in Settings (Drive access).");
  }
}
