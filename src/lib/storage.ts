import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

/**
 * Storage abstraction.
 *
 * Local-filesystem implementation by default (data lives under MEDIA_STORAGE_PATH).
 * The interface is S3-compatible in shape so an S3 adapter can be swapped in
 * without touching callers (see docs/DEPLOYMENT.md for backup requirements).
 */
export interface StorageAdapter {
  put(key: string, data: Buffer | string, contentType?: string): Promise<string>;
  get(key: string): Promise<{ data: Buffer; contentType?: string } | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  size(key: string): Promise<number | null>;
}

function encodedObjectPath(key: string): string {
  return key
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function supabaseHeaders(contentType?: string): HeadersInit {
  if (!env.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return {
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function supabaseObjectUrl(key: string): string {
  if (!env.supabaseUrl) throw new Error("SUPABASE_URL is not configured");
  const base = env.supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/${encodeURIComponent(env.supabaseStorageBucket)}/${encodedObjectPath(key)}`;
}

function resolveRoot() {
  const root = path.resolve(env.mediaStoragePath);
  return root;
}

function safeJoin(root: string, key: string): string {
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error(`storage: invalid key "${key}"`);
  }
  return full;
}

const localStorage: StorageAdapter = {
  async put(key, data, _contentType) {
    const full = safeJoin(resolveRoot(), key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return key;
  },
  async get(key) {
    try {
      const data = await readFile(safeJoin(resolveRoot(), key));
      return { data };
    } catch {
      return null;
    }
  },
  async delete(key) {
    const fs = await import("node:fs/promises");
    await fs.rm(safeJoin(resolveRoot(), key), { force: true });
  },
  async exists(key) {
    try {
      await stat(safeJoin(resolveRoot(), key));
      return true;
    } catch {
      return false;
    }
  },
  async size(key) {
    try {
      const s = await stat(safeJoin(resolveRoot(), key));
      return s.size;
    } catch {
      return null;
    }
  },
};

const supabaseStorage: StorageAdapter = {
  async put(key, data, contentType) {
    const response = await fetch(supabaseObjectUrl(key), {
      method: "POST",
      headers: { ...supabaseHeaders(contentType), "x-upsert": "true" },
      body: typeof data === "string" ? data : new Uint8Array(data),
    });
    if (!response.ok) {
      throw new Error(`Supabase Storage upload failed (${response.status}): ${await response.text()}`);
    }
    return key;
  },
  async get(key) {
    const response = await fetch(supabaseObjectUrl(key), { headers: supabaseHeaders() });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Supabase Storage download failed (${response.status})`);
    return {
      data: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? undefined,
    };
  },
  async delete(key) {
    const response = await fetch(supabaseObjectUrl(key), { method: "DELETE", headers: supabaseHeaders() });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase Storage delete failed (${response.status})`);
    }
  },
  async exists(key) {
    return (await this.get(key)) !== null;
  },
  async size(key) {
    const found = await this.get(key);
    return found?.data.length ?? null;
  },
};

export const storage: StorageAdapter = env.storageDriver === "supabase" ? supabaseStorage : localStorage;
