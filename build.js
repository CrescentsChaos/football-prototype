#!/usr/bin/env node
/**
 * Build script — concatenates the split source files (js/, engine/, simulation/,
 * ai/, data/, ui/) back into one runnable dist/app.js, in the exact order recorded
 * in manifest.json.
 *
 * Why this exists: the whole game lives inside a single closure
 * (`var App = (() => { ... })();`) so that every module can share state without
 * a bundler. Browsers can't literally load one JS scope split across multiple
 * <script> tags, so this script plays the role a bundler (webpack/rollup) would
 * normally play — except it's ~60 lines of plain Node with zero dependencies,
 * so it works with no network access and no npm install.
 *
 * Usage:
 *   node build.js
 * Produces:
 *   dist/app.js  (drop-in replacement for the old monolithic app.js)
 *
 * Run this after editing any file under js/, engine/, simulation/, ai/, data/,
 * or ui/ — index.html loads dist/app.js, not the source files directly.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

const fileCache = {};
function readSrc(relPath) {
  if (!(relPath in fileCache)) {
    fileCache[relPath] = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  }
  return fileCache[relPath];
}

const chunks = [];
for (const entry of manifest) {
  const content = readSrc(entry.file);
  const startMarker = `/*@CHUNK:${entry.id}:START*/`;
  const endMarker = `/*@CHUNK:${entry.id}:END*/`;
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Chunk ${entry.id} not found in ${entry.file} — did a marker get edited/removed?`);
  }
  const body = content.slice(startIdx + startMarker.length, endIdx).replace(/^\n/, '').replace(/\n$/, '');
  chunks.push(body);
}

const out = chunks.join('\n');
const distDir = path.join(ROOT, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
fs.writeFileSync(path.join(distDir, 'app.js'), out);
console.log(`Built dist/app.js from ${manifest.length} chunks across ${new Set(manifest.map(m => m.file)).size} source files.`);
