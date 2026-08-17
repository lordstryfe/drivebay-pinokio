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
    return list();
  });

export const listEntries = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1), showHidden: z.boolean() }))
  .handler(async ({ data }): Promise<DirListing> => {
    const fs = await import("./fs.server");
    return fs.listEntries(data.path, data.showHidden);
  });

export const getPreview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1) }))
  .handler(async ({ data }): Promise<PreviewPayload> => {
    const fs = await import("./fs.server");
    const resolved = fs.resolveSafePath(data.path);
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
    const path = await fs.createFolder(data.parent, data.name);
    return { path };
  });

export const renameEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1), name: z.string().min(1).max(255) }))
  .handler(async ({ data }) => {
    const fs = await import("./fs.server");
    const path = await fs.renameEntry(data.path, data.name);
    return { path };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1) }))
  .handler(async ({ data }) => {
    const fs = await import("./fs.server");
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
    const buf = Buffer.from(data.contentBase64, "base64");
    // Upload still goes through base64 server-fn (memory-bound). 512 MB soft ceiling.
    if (buf.length > 512 * 1024 * 1024) {
      throw new Error("File is larger than 512 MB");
    }
    const path = await fs.writeUpload(data.parent, data.name, buf);
    return { path, size: buf.length };
  });

export const readFileBase64 = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ path: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { promises: fsp } = await import("node:fs");
    const fs = await import("./fs.server");
    const resolved = fs.resolveSafePath(data.path);
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
    return fs.searchEntries(data.root, data.query, data.showHidden);
  });

export const getSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const settings = await import("./settings.server");
    return settings.readAppSettings();
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
    return settings.writePortSettings(data.style, data.port);
  });
