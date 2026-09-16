import fs from "node:fs";
import path from "node:path";

/**
 * Server-only (build-time) helper — never import this from a client <script>,
 * "node:fs" can't be bundled for the browser.
 */
const PRODUCTOS_DIR = path.join(process.cwd(), "public", "productos");

export function getProductPhotoUrl(slug: string): string | null {
  const filename = `${slug}.jpg`;
  return fs.existsSync(path.join(PRODUCTOS_DIR, filename)) ? `/productos/${filename}` : null;
}
