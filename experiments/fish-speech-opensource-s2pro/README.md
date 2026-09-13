# Fish Speech (open-source S2 Pro) — Malayalam TTS evaluation

CTO-requested experiment (2026-09-01/02). **Isolated from production ARTEQ AI**
— nothing here is wired into the backend/kiosk npm workspaces, and this
directory is `.gitignore`d for weights/output.

This directory evaluates the actual **open-source, self-hostable** Fish
Speech model, not Fish Audio's hosted API (that was a separate, earlier
misdirected experiment — see `experiments/fish-speech-2.1-pro-malayalam/`,
now superseded and unused).

## 1. Model verification (official sources only)

| | |
|---|---|
| Model | Fish Audio **S2 Pro** — 4B-param dual-autoregressive TTS (4B slow-AR + 400M fast-AR) + separate neural codec |
| Code repo | https://github.com/fishaudio/fish-speech |
| Weights | https://huggingface.co/fishaudio/s2-pro (public, no auth/token required — confirmed via live HEAD requests, 2026-09-02) |
| License | **Fish Audio Research License** — non-commercial only. Commercial/product use requires a separate paid license from Fish Audio (business@fish.audio). This is a hard business constraint independent of technical quality: ARTEQ AI is a commercial product. |
| Install requirements | Python 3.12; **Linux or WSL only** — no native Windows support documented |
| GPU requirement (official) | **24 GB VRAM for CUDA inference** (official benchmark numbers use an NVIDIA H200) |
| CPU inference | A `pip install -e .[cpu]` path is documented as a real option — but no quantization/offloading is documented, so the full weights still need to fit in RAM |
| Malayalam support | **Not explicitly named** in the official docs' language list ("English, Chinese, Japanese, Korean, Arabic, German, French... AND MORE!"). Treated as **unconfirmed** — only real inference settles this. |

## 2. Weight files (verified via HTTP HEAD, 2026-09-02, no auth needed)

| File | Size | HF ETag (sha256) |
|---|---|---|
| `model-00001-of-00002.safetensors` | 4,986,872,984 bytes (4.65 GB) | `846c156e6b669f8189017dfec10e68759c42a05b04f77eebc843ea1e7be820e5` |
| `model-00002-of-00002.safetensors` | 4,136,876,104 bytes (3.85 GB) | `1b3970e611d3532181a747a46c6c9453efaca2b6e02a583aa3af46556543f66c` |
| `codec.pth` | 1,871,099,728 bytes (1.74 GB) | `708d4c6aba8134c5fb74878b268f89f0df22f72ff1a38e0db89a159e85d4ab0f` |

**Total: ~10.24 GB.** Plus small config/tokenizer files (negligible size).

Reproduce with: `node download.mjs` (downloads to `weights/`, verifies sha256
against the ETags above, skips files already present with a matching size).

## 3. This machine's hardware reality (checked 2026-09-02)

| | |
|---|---|
| RAM | 3.5 GB total, ~373 MB free at time of check |
| GPU | AMD integrated graphics only — no discrete GPU, no CUDA path |
| CPU | AMD Athlon Silver 3050U (low-power, 2-core class) |
| Python | Not installed |
| WSL | Not set up (`wsl --status` returns the generic help/usage output, the standard sign the WSL feature itself isn't installed/initialized) |
| Disk | 141.5 GB free — the only dimension this machine ISN'T the blocker on |

**Conclusion: this machine cannot run the model under any documented
configuration.** The weights alone (~10.24 GB) exceed total system RAM more
than 2.5x over — this is a hard "won't load" blocker, not a "will be slow"
one. It applies identically whether targeting CPU or GPU inference, and is
independent of the missing Python/WSL/GPU (each of which is *also*
independently blocking).

## 4. Minimum realistic configuration to actually run this

- **GPU:** NVIDIA, ≥24 GB VRAM (official number) — e.g. RTX 3090/4090 24GB,
  A10G, L4 (24GB variant), or a datacenter card (A100/H100/H200). Community
  reports (unverified, not from official docs) suggest ~16GB may work with
  bitsandbytes quantization, but the official install docs don't document
  any quantized path, so treat 24GB as the number to plan around.
- **OS:** Linux, or Windows + WSL2 with a Linux distro.
- **Python:** 3.12, with the project's CUDA extras (`cu126`/`cu128`/`cu129`
  depending on driver).
- **RAM:** not separately documented, but should comfortably exceed the
  ~10.24 GB weight size for the host process on top of whatever the GPU
  driver stack needs — 32GB+ system RAM would be a safe target.

None of this exists on the current laptop. The weights are staged here
specifically so they can be copied to a real GPU machine (local or cloud)
without needing to re-resolve/re-verify the download — see `weights/`.

## 5. Test sentence set

See `sentences.mjs` — Malayalam, Manglish, mixed Malayalam+English, and
hospital-receptionist phrases, covering the categories the CTO specified
(English/Malayalam/Manglish/mixed/hospital-terms/doctor+department names),
plus the exact "tooth pain / need to see a dentist" phrase already used
extensively in this project's real-mic Gemini Live testing, so the same
phrase can be A/B'd by ear once real inference is possible.

## 6. Status

- [x] Official model/license/hardware verification
- [x] Weight download (public, no auth) — staged in `weights/` (gitignored)
- [ ] Local inference — **blocked on this machine**, needs a GPU host (see §4)
- [ ] Malayalam/Manglish listening evaluation — blocked on the above
- [ ] Gemini comparison — blocked on the above

Next step is entirely a hardware/infra decision: either provision a GPU
machine (local or cloud, ≥24GB VRAM) and run the harness there, or decide
this isn't worth pursuing given the non-commercial license already requires
a separate paid agreement with Fish Audio regardless of quality.
