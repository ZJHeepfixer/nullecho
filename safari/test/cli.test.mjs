/**
 * The Safari tools run as CLIs when the path they are started by goes through a symlink.
 *
 * Each tool decides it was run directly by comparing process.argv[1] with import.meta.url. Node
 * resolves import.meta.url to the real path; argv[1] keeps the path as typed. macOS /tmp is a
 * symlink to /private/tmp and Xcode passes /tmp/… paths, so a plain path.resolve() comparison
 * skipped the main block and the script exited 0 having done nothing (2026-10-31: the Xcode embed
 * phase ran build-extension.mjs from a worktree under /tmp, built nothing, and only its own
 * manifest.json check caught it). Here every tool is started through a symlinked repo path and
 * must actually do its work.
 *
 * Run: `node --test safari/test/*.test.mjs` from the repo root.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO } from './helpers.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-safari-cli-'));
const LINKED = path.join(tmp, 'repo');
fs.symlinkSync(REPO, LINKED, 'dir');

const run = (tool, args) => execFileSync(process.execPath, [path.join(LINKED, 'safari', 'tools', tool), ...args],
  { encoding: 'utf8', env: { PATH: process.env.PATH } });

test('the symlinked path really differs from the real one (or this file proves nothing)', () => {
  const script = path.join(LINKED, 'safari', 'tools', 'build-extension.mjs');
  assert.notEqual(path.resolve(script), fs.realpathSync(script));
});

test('build-extension.mjs through a symlink builds the extension', () => {
  const out = path.join(tmp, 'out');
  const log = run('build-extension.mjs', ['--out', out]);
  assert.ok(fs.existsSync(path.join(out, 'manifest.json')), `no manifest.json in ${out}; the CLI printed: ${JSON.stringify(log)}`);
  assert.match(log, /src\/gpc\.js/);
});

test('safari-rules.mjs through a symlink prints its summary', () => {
  assert.match(run('safari-rules.mjs', []), /Safari-only exclusion\(s\)/);
});

test('asc-listing.mjs through a symlink prints the offline plan', () => {
  assert.match(run('asc-listing.mjs', ['--plan', '--offline']), /^PLAN for Nullecho /);
});
