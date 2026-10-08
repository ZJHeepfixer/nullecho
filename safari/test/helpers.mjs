/**
 * Shared by the Safari tests: build the extension once into a temp dir, or read a tree that
 * `NULLECHO_SAFARI_DIST` points at. The override exists so a test can be run against a
 * deliberately broken tree (a naive copy of ext/rules, a manifest with webRequest, …) to prove
 * it fails — the same convention as `NULLECHO_SHIM_SRC` in ext/src/test-realm-rig.js.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../tools/build-extension.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const EXT = path.join(REPO, 'ext');
export const SAFARI_SRC = path.resolve(HERE, '../extension');

let cached = null;
/** @returns {Promise<string>} the assembled extension folder */
export async function distDir() {
  if (cached) return cached;
  if (process.env.NULLECHO_SAFARI_DIST) {
    cached = path.resolve(process.env.NULLECHO_SAFARI_DIST);
    return cached;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-safari-'));
  const out = path.join(tmp, 'safari', 'extension');
  await build({ outDir: out, quiet: true });
  cached = out;
  return cached;
}

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Every file under a directory, as sorted posix-relative paths. */
export function walk(dir) {
  const out = [];
  (function rec(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) rec(full);
      else out.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  })(dir);
  return out.sort();
}
