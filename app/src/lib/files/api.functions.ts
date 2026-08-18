import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { DirListing, Drive, PreviewPayload, SearchResult } from "./types";

export const hasOwner = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from "user"`;
  return (rows[0]?.n ?? 0) > 0;
});

export const listDrives = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<Drive[]> => {
    const { listDrives: list } = await import("./fs.server");
    const lock = await import("./server-lock.server");
    const drives = await list();
    const policy = lock.readServerLock();
    if (!policy.allowedRoots.length) return drives;
    return drives.filter((d) => lock.isPathAllowedByRoots(d.path, policy.allowedRoots));
  });

export const listEntries = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1), showHidden: z.boolean() }))
  .handler(async ({ data }): Promise<DirListing> => {
    const fs = await import("./fs.server");
    const lock = await import("./server-lock.server");
    const resolved = fs.resolveSafePath(data.path);
    lock.assertPathAllowed(resolved);
    return fs.listEntries(data.path, data.showHidden);
  });

export const getPreview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1) }))
  .handler(async ({ data }): Promise<PreviewPayload> => {
    const fs = await import("./fs.server");
    const lock = await import("./server-lock.server");
    const resolved = fs.resolveSafePath(data.path);
    lock.assertPathAllowed(resolved);
    const ext = fs.extOf(resolved);
    if (fs.isImageExt(ext)) {
      return { kind: "image", mime: fs.mimeOf(ext) };
    }
    if (fs.isTextExt(ext)) {
      const preview = await fs.readTextPreview(resolved);
      return { kind: "text", ...preview };
    }
    try {
      const preview = await fs.readTextPreview(resolved, 24_000);
      return { kind: "text", ...preview };
    } catch {
      return { kind: "binary" };
    }
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ parent: z.string().min(1), name: z.string().min(1).max(255) }))
  .handler(async ({ data }) => {
    const fs = await import("./fs.server");
    const lock = await import("./server-lock.server");
    lock.assertPolicy("allowCreateFolder");
    lock.assertPathAllowed(fs.resolveSafePath(data.parent));
    const path = await fs.createFolder(data.parent, data.name);
    return { path };
  });

export const renameEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1), name: z.string().min(1).max(255) }))
  .handler(async ({ data }) => {
    const fs = await import("./fs.server");
    const lock = await import("./server-lock.server");
    lock.assertPolicy("allowRename");
    lock.assertPathAllowed(fs.resolveSafePath(data.path));
    const path = await fs.renameEntry(data.path, data.name);
    return { path };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1) }))
  .handler(async ({ data }) => {
    const fs = await import("./fs.server");
    const lock = await import("./server-lock.server");
    lock.assertPolicy("allowDelete");
    lock.assertPathAllowed(fs.resolveSafePath(data.path));
    await fs.removeEntry(data.path);
    return { ok: true as const };
  });

export const uploadFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      parent: z.string().min(1),
      name: z.string().min(1).max(255),
      contentBase64: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const fs = await import("./fs.server");
    const lock = await import("./server-lock.server");
    lock.assertPolicy("allowUpload");
    lock.assertPathAllowed(fs.resolveSafePath(data.parent));
    const buf = Buffer.from(data.contentBase64, "base64");
    lock.assertUploadSize(buf.length);
    const path = await fs.writeUpload(data.parent, data.name, buf);
    return { path, size: buf.length };
  });

export const readFileBase64 = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { promises: fsp } = await import("node:fs");
    const fs = await import("./fs.server");
    const lock = await import("./server-lock.server");
    const resolved = fs.resolveSafePath(data.path);
    lock.assertPathAllowed(resolved);
    const st = await fsp.stat(resolved);
    if (!st.isFile()) throw new Error("Not a file");
    // Inline base64 is only for small previews (images). Large downloads use /api/download.
    if (st.size > 32 * 1024 * 1024) {
      throw new Error("File is too large to preview — use Download");
    }
    const bytes = await fsp.readFile(resolved);
    return {
      name: resolved.split(/[\\/]/).pop() ?? "file",
      mime: fs.mimeOf(fs.extOf(resolved)),
      contentBase64: bytes.toString("base64"),
      size: st.size,
    };
  });

export const searchFiles = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      root: z.string().min(1),
      query: z.string().min(2).max(120),
      showHidden: z.boolean(),
    }),
  )
  .handler(async ({ data }): Promise<SearchResult> => {
    const fs = await import("./fs.server");
    const lock = await import("./server-lock.server");
    lock.assertPathAllowed(fs.resolveSafePath(data.root));
    return fs.searchEntries(data.root, data.query, data.showHidden);
  });

export const getSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const settings = await import("./settings.server");
    const lock = await import("./server-lock.server");
    return {
      ...settings.readAppSettings(),
      serverLock: lock.toPublicServerLock(),
    };
  });

export const savePortSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      style: z.enum(["random", "static"]),
      port: z.number().int().min(1024).max(65535),
    }),
  )
  .handler(async ({ data }) => {
    const settings = await import("./settings.server");
    const lock = await import("./server-lock.server");
    lock.assertPolicy("allowPortChangeFromUi");
    return settings.writePortSettings(data.style, data.port);
  });
