import { createFileRoute } from "@tanstack/react-router";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { basename } from "node:path";
import { getSessionUser, authConfigured, DEV_USER_ID } from "@/lib/auth/verify.server";
import * as fsUtil from "@/lib/files/fs.server";

function contentDisposition(filename: string): string {
  // RFC 5987 filename* for non-ASCII; basic filename fallback.
  const safe = filename.replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export const Route = createFileRoute("/api/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getSessionUser();
          if (authConfigured && !user) {
            return new Response("Unauthorized", { status: 401 });
          }
          if (!authConfigured && !user && !DEV_USER_ID) {
            return new Response("Unauthorized", { status: 401 });
          }

          const url = new URL(request.url);
          const filePath = url.searchParams.get("path");
          if (!filePath) {
            return new Response("Missing path", { status: 400 });
          }

          const resolved = fsUtil.resolveSafePath(filePath);
          const st = await stat(resolved);
          if (!st.isFile()) {
            return new Response("Not a file", { status: 400 });
          }

          const name = basename(resolved);
          const ext = fsUtil.extOf(name);
          const mime = fsUtil.mimeOf(ext);
          const nodeStream = createReadStream(resolved);
          const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

          return new Response(webStream, {
            status: 200,
            headers: {
              "Content-Type": mime,
              "Content-Length": String(st.size),
              "Content-Disposition": contentDisposition(name),
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Download failed";
          const status = message === "Unauthorized" ? 401 : 400;
          return new Response(message, { status });
        }
      },
    },
  },
});
