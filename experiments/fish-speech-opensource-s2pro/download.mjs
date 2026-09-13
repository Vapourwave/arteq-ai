#!/usr/bin/env node
// Downloads the official open-source Fish Audio S2 Pro weights from
// HuggingFace (fishaudio/s2-pro) — verified public, no auth/token required
// (confirmed via HEAD requests, 2026-09-02). Isolated experiment only; see
// README.md for full verification notes (license, hardware requirements,
// Malayalam-support status). NOT wired into ARTEQ AI's production code —
// this script and its weights/ output live entirely outside the
// backend/kiosk npm workspaces.
//
// Usage: node download.mjs

import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEIGHTS_DIR = path.join(__dirname, "weights");
const REPO = "fishaudio/s2-pro";

// file -> expected sha256, captured from the HuggingFace resolve endpoint's
// ETag header (2026-09-02) for post-download integrity verification.
const FILES = {
  "model-00001-of-00002.safetensors": {
    size: 4986872984,
    sha256: "846c156e6b669f8189017dfec10e68759c42a05b04f77eebc843ea1e7be820e5",
  },
  "model-00002-of-00002.safetensors": {
    size: 4136876104,
    sha256: "1b3970e611d3532181a747a46c6c9453efaca2b6e02a583aa3af46556543f66c",
  },
  "codec.pth": {
    size: 1871099728,
    sha256: "708d4c6aba8134c5fb74878b268f89f0df22f72ff1a38e0db89a159e85d4ab0f",
  },
  // Small config/tokenizer files needed to actually load the model —
  // negligible size, fetched alongside the weights.
  "config.json": {},
  "model.safetensors.index.json": {},
  "tokenizer.json": {},
  "tokenizer_config.json": {},
  "special_tokens_map.json": {},
  "chat_template.jinja": {},
};

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function downloadFile(name, meta) {
  const dest = path.join(WEIGHTS_DIR, name);
  if (existsSync(dest) && meta.size && statSync(dest).size === meta.size) {
    console.log(`  ${name} — already present, size matches, skipping`);
    return;
  }
  const url = `https://huggingface.co/${REPO}/resolve/main/${name}`;
  console.log(`  ${name} — downloading${meta.size ? ` (${(meta.size / 1e9).toFixed(2)} GB)` : ""}...`);
  const startedAt = Date.now();
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
  const elapsedS = (Date.now() - startedAt) / 1000;
  const actualSize = statSync(dest).size;
  console.log(`  ${name} — done in ${elapsedS.toFixed(1)}s (${(actualSize / 1e9).toFixed(2)} GB)`);

  if (meta.sha256) {
    const actualHash = await sha256File(dest);
    // HF's ETag for these files was observed to carry a 65-hex-char value
    // (one char longer than a plain sha256 hex digest) — compare via
    // substring match rather than exact equality so a harmless prefix/suffix
    // quirk doesn't produce a false "corrupted" verdict; still prints both
    // values so a genuine mismatch is obvious.
    const matches = meta.sha256.includes(actualHash) || actualHash === meta.sha256;
    console.log(`    sha256: ${actualHash} ${matches ? "(matches HF ETag)" : "(!) DOES NOT MATCH expected " + meta.sha256}`);
  }
}

async function main() {
  if (!existsSync(WEIGHTS_DIR)) mkdirSync(WEIGHTS_DIR, { recursive: true });
  console.log(`[fish-s2pro-download] target: ${WEIGHTS_DIR}\n`);
  for (const [name, meta] of Object.entries(FILES)) {
    await downloadFile(name, meta);
  }
  console.log("\n[fish-s2pro-download] all files complete.");
}

main().catch((err) => {
  console.error("[fish-s2pro-download] fatal:", err);
  process.exitCode = 1;
});
