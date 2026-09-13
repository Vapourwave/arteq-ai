#!/usr/bin/env node
// CTO-requested experiment (2026-08-31/09-01): benchmark Fish Audio's
// hosted "S2.1 Pro" TTS model (model header "s2.1-pro") on Malayalam,
// Manglish, and hospital-receptionist test sentences, for later A/B
// comparison against Gemini Live's native audio.
//
// DELIBERATELY ISOLATED from the production app: this is a standalone
// Node script (no npm workspace, no build step) that only talks to Fish
// Audio's hosted API over plain HTTPS — nothing here touches the backend,
// kiosk, or the existing dev-only FishTTSProvider.ts (which targets the
// older "s2-pro" model for a separate, still-valid evaluation). Node 24's
// built-in fetch is enough; no dependencies to install.
//
// Model/API verified directly against https://docs.fish.audio (2026-08-31),
// not assumed from memory — see README.md in this directory for the full
// verification notes, license distinction, and resource-constraint findings.
//
// Usage: node run.mjs
// Reads FISH_API_KEY from apps/backend/.env (same secret already configured
// for the existing s2-pro experiment — never duplicated/hardcoded here).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");
const FISH_TTS_ENDPOINT = "https://api.fish.audio/v1/tts";
const FISH_MODEL = "s2.1-pro";

function loadFishApiKey() {
  const envPath = path.join(__dirname, "..", "..", "apps", "backend", ".env");
  const raw = readFileSync(envPath, "utf8");
  const match = raw.match(/^FISH_API_KEY=(.+)$/m);
  if (!match || !match[1].trim()) {
    throw new Error(
      `FISH_API_KEY not found in ${envPath} — set it there first (same key the existing s2-pro dev harness uses).`,
    );
  }
  return match[1].trim();
}

// The CTO's evaluation set, one entry per requested category (A-J), plus
// the two critical dental-pain phrasings (the exact sentence used
// extensively in this project's real-mic Gemini Live testing) and four
// natural Malayalam+English mixed sentences.
const SENTENCES = [
  {
    id: "critical-dental-v1",
    category: "critical",
    label: "Critical dental phrase (variant 1 — as used in Gemini testing)",
    text: "എനിക്ക് നല്ല പല്ലുവേദനയുണ്ട്. എനിക്ക് ഡെന്റിസ്റ്റിനെ കാണണം.",
  },
  {
    id: "critical-dental-v2",
    category: "critical",
    label: "Critical dental phrase (variant 2 — space before വേദന)",
    text: "എനിക്ക് നല്ല പല്ല് വേദനയുണ്ട്. എനിക്ക് ഡെന്റിസ്റ്റിനെ കാണണം.",
  },
  {
    id: "a-short",
    category: "A. Short sentence",
    label: "Short sentence",
    text: "എനിക്ക് നാളെ ഒരു ഡോക്ടറെ കാണണം.",
  },
  {
    id: "b-long",
    category: "B. Long sentence",
    label: "Long sentence",
    text:
      "ദയവായി ക്ഷമിക്കണം, നിങ്ങൾ പറഞ്ഞ ലക്ഷണങ്ങൾ അനുസരിച്ച് ഞാൻ നിങ്ങളെ ദന്തരോഗ വിഭാഗത്തിലേക്ക് നയിക്കുകയാണ്, അവിടെ ഡോക്ടർ നിങ്ങളെ പരിശോധിച്ച ശേഷം അടുത്ത ഘട്ടം തീരുമാനിക്കും.",
  },
  {
    id: "c-question",
    category: "C. Question",
    label: "Question",
    text: "എനിക്ക് ഏത് ഡിപ്പാർട്ട്മെന്റിലേക്കാണ് പോകേണ്ടത്?",
  },
  {
    id: "d-confirmation",
    category: "D. Confirmation",
    label: "Confirmation",
    text: "ശരി, നിങ്ങൾ തിരഞ്ഞെടുത്ത ഡോക്ടറുടെ ഓ.പി ടിക്കറ്റ് എടുക്കാം.",
  },
  {
    id: "e-polite-receptionist",
    category: "E. Polite receptionist statement",
    label: "Polite receptionist statement",
    text: "ദയവായി ഇരിക്കൂ, നിങ്ങളുടെ ഊഴം വരുമ്പോൾ ഞങ്ങൾ വിളിക്കാം.",
  },
  {
    id: "f-hospital-terms",
    category: "F. Medical/hospital terminology",
    label: "Hospital terminology",
    text: "ദന്തരോഗ വിഭാഗത്തിൽ ഇപ്പോൾ ഏത് ഡോക്ടർമാരാണ് ലഭ്യമായിട്ടുള്ളത്?",
  },
  {
    id: "g-mixed-1",
    category: "G. Malayalam + English mixed",
    label: "Mixed — dentist",
    text: "എനിക്ക് dentist-നെ കാണണം.",
  },
  {
    id: "g-mixed-2",
    category: "G. Malayalam + English mixed",
    label: "Mixed — dental department",
    text: "എനിക്ക് dental department-ലേക്ക് പോകണം.",
  },
  {
    id: "g-mixed-3",
    category: "G. Malayalam + English mixed",
    label: "Mixed — doctor available",
    text: "നാളെ രാവിലെ doctor available ആണോ?",
  },
  {
    id: "g-mixed-4",
    category: "G. Malayalam + English mixed",
    label: "Mixed — OP ticket",
    text: "എനിക്ക് OP ticket വേണം.",
  },
  {
    id: "h-numbers-times",
    category: "H. Numbers / times",
    label: "Numbers / times",
    text: "നിങ്ങളുടെ ക്യൂ നമ്പർ പതിനഞ്ച് ആണ്. ഏകദേശം ഇരുപത് മിനിറ്റ് കാത്തിരിക്കണം.",
  },
  {
    id: "i-doctor-name",
    category: "I. Doctor name",
    label: "Doctor name",
    text: "ഡോക്ടർ അഞ്ജലി മേനോൻ ഇന്ന് ലഭ്യമാണ്.",
  },
  {
    id: "j-department-name",
    category: "J. Department name",
    label: "Department name",
    text: "ദന്തരോഗ വിഭാഗം ഒന്നാം നിലയിലാണ്.",
  },
  {
    id: "extra-doctor-choice",
    category: "extra",
    label: "Doctor choice question",
    text: "നിങ്ങൾക്ക് ഏത് ഡോക്ടറെയാണ് തിരഞ്ഞെടുക്കേണ്ടത്?",
  },
  {
    id: "extra-wait-time",
    category: "extra",
    label: "Wait-time question",
    text: "ഡോക്ടറെ കാണാൻ ഏകദേശം എത്ര സമയം കാത്തിരിക്കണം?",
  },
];

/** Minimal WAV header parser — just enough to compute audio duration for
 * the RTF calculation, no external dependency needed. */
function wavDurationSeconds(buffer) {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  const byteRate = buffer.readUInt32LE(28);
  const dataSize = buffer.readUInt32LE(40);
  if (!byteRate) return null;
  return dataSize / byteRate;
}

async function synthesizeOne(apiKey, sentence) {
  const startedAt = performance.now();
  const response = await fetch(FISH_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      model: FISH_MODEL,
    },
    body: JSON.stringify({
      text: sentence.text,
      format: "wav",
    }),
  });

  if (!response.ok || !response.body) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}${bodyText ? ` — ${bodyText.slice(0, 300)}` : ""}`);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let timeToFirstByteMs = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (timeToFirstByteMs === null) timeToFirstByteMs = performance.now() - startedAt;
    if (value) chunks.push(value);
  }
  const totalMs = performance.now() - startedAt;
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const audioDurationSeconds = wavDurationSeconds(buffer);
  const rtf = audioDurationSeconds ? totalMs / 1000 / audioDurationSeconds : null;

  return { buffer, timeToFirstByteMs, totalMs, audioDurationSeconds, rtf };
}

async function main() {
  const apiKey = loadFishApiKey();
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`[fish-2.1-pro-experiment] model=${FISH_MODEL} sentences=${SENTENCES.length}`);
  console.log(`[fish-2.1-pro-experiment] output dir: ${OUTPUT_DIR}\n`);

  const results = [];
  for (const sentence of SENTENCES) {
    process.stdout.write(`  ${sentence.id} ... `);
    try {
      const { buffer, timeToFirstByteMs, totalMs, audioDurationSeconds, rtf } = await synthesizeOne(apiKey, sentence);
      const filePath = path.join(OUTPUT_DIR, `${sentence.id}.wav`);
      writeFileSync(filePath, buffer);
      const rtfStr = rtf !== null ? rtf.toFixed(2) : "n/a";
      const durStr = audioDurationSeconds !== null ? audioDurationSeconds.toFixed(2) : "n/a";
      console.log(`ok  (ttfb=${timeToFirstByteMs.toFixed(0)}ms total=${totalMs.toFixed(0)}ms audio=${durStr}s rtf=${rtfStr})`);
      results.push({
        ...sentence,
        status: "ok",
        file: path.relative(__dirname, filePath),
        timeToFirstByteMs: Math.round(timeToFirstByteMs),
        totalMs: Math.round(totalMs),
        audioDurationSeconds,
        rtf,
      });
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      results.push({ ...sentence, status: "error", error: err.message });
    }
  }

  const manifestPath = path.join(__dirname, "results.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        model: FISH_MODEL,
        endpoint: FISH_TTS_ENDPOINT,
        generatedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
  );

  const okCount = results.filter((r) => r.status === "ok").length;
  console.log(`\n[fish-2.1-pro-experiment] done: ${okCount}/${results.length} succeeded.`);
  console.log(`[fish-2.1-pro-experiment] manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error("[fish-2.1-pro-experiment] fatal:", err);
  process.exitCode = 1;
});
