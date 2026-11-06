import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";

const ROOT = path.join(process.cwd(), "data");

export interface StoredDoc<T> {
  value: T;
  etag: string | null;
}

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readDoc<T>(key: string): Promise<StoredDoc<T> | null> {
  if (blobEnabled()) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return { value: JSON.parse(text) as T, etag: result.blob.etag };
  }
  try {
    const text = await readFile(path.join(ROOT, key), "utf8");
    return { value: JSON.parse(text) as T, etag: null };
  } catch {
    return null;
  }
}

export async function writeDoc(key: string, value: unknown, etag: string | null): Promise<boolean> {
  const body = JSON.stringify(value);
  if (blobEnabled()) {
    try {
      await put(key, body, {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
        ...(etag ? { ifMatch: etag } : { allowOverwrite: true }),
      });
      return true;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) return false;
      throw error;
    }
  }
  const file = path.join(ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return true;
}

export async function removeDoc(key: string): Promise<void> {
  if (blobEnabled()) {
    await del(key).catch(() => undefined);
    return;
  }
  await rm(path.join(ROOT, key), { force: true });
}
