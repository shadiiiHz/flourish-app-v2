import fs from "node:fs/promises";
import path from "node:path";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/**
 * Deletes a locally-stored upload (a "/uploads/<file>" URL returned by the
 * admin upload endpoint) from disk; a no-op for anything else — external
 * URLs, empty/undefined values, or an already-missing file.
 */
export async function deleteUploadedFile(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;
  const filename = url.slice("/uploads/".length);
  // No nested paths expected from this endpoint; reject anything that could
  // escape UPLOADS_DIR (e.g. a stray "..") instead of resolving it.
  if (!filename || filename.includes("/") || filename.includes("..")) return;
  await fs.rm(path.join(UPLOADS_DIR, filename), { force: true }).catch(() => {});
}

export async function deleteUploadedFiles(urls: (string | null | undefined)[]): Promise<void> {
  await Promise.all(urls.map(deleteUploadedFile));
}
