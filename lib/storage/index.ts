import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del as blobDel, put as blobPut } from "@vercel/blob";
import { env } from "@/lib/env";

/**
 * File storage behind one interface (§B3). Production uses Vercel Blob;
 * local dev uses the filesystem under .storage/. Originals are never served
 * directly to the browser — only streamed through the authorised
 * /api/documents/[id]/file route handler (§B9.4).
 */
export interface StoredFile {
  url: string;
  pathname: string;
}

export interface StorageDriver {
  put(pathname: string, data: Buffer, contentType: string): Promise<StoredFile>;
  get(file: StoredFile): Promise<Buffer>;
  delete(file: StoredFile): Promise<void>;
}

const LOCAL_ROOT = path.join(process.cwd(), ".storage");

function safeLocalPath(pathname: string): string {
  const resolved = path.resolve(LOCAL_ROOT, pathname);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error(`Unsafe storage pathname: ${pathname}`);
  }
  return resolved;
}

const localDriver: StorageDriver = {
  async put(pathname, data) {
    const full = safeLocalPath(pathname);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return { url: `local://${pathname}`, pathname };
  },
  async get(file) {
    return readFile(safeLocalPath(file.pathname));
  },
  async delete(file) {
    await rm(safeLocalPath(file.pathname), { force: true });
  },
};

const vercelBlobDriver: StorageDriver = {
  async put(pathname, data, contentType) {
    const result = await blobPut(pathname, data, {
      access: "public", // unguessable URL; never exposed to clients — served via authorised route only
      contentType,
      addRandomSuffix: true,
    });
    return { url: result.url, pathname: result.pathname };
  },
  async get(file) {
    const res = await fetch(file.url);
    if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },
  async delete(file) {
    await blobDel(file.url);
  },
};

export function getStorage(): StorageDriver {
  return env.STORAGE_DRIVER === "vercel-blob" ? vercelBlobDriver : localDriver;
}
