# PINBALLZZZ — Implementation Plan (v1.10)

Translates [GDD.md](file:///Users/ps/Dev/NFT-Uploader/GDD.md) v2.0 + [TDD.md](file:///Users/ps/Dev/NFT-Uploader/TDD.md) v0.6 into a phased, milestone-driven build plan.

**Changes in v1.10:** Reconciled milestone estimate math to exactly 53 d for Local v1.0 (planning range ~50–55 d). Changed Sector 3 theme to plunger vaults using MVP-supported blocks. Moved BlockRegistry to src/levels/BlockRegistry.ts. Added level_hash to serialization format and PlayabilityCheck. Detailed the InputBuffer schema to support flippers, plunger, and analog inputs. Moved Steamworks audit to M5. Removed ASM.js Safari fallback from WASM init spike.

---

## Strategic Decision (locked)

**Local v1.0 = offline desktop game.** It is a complete, shippable product — campaign, Creator Studio, local saves — with zero network dependency.

**Online v1.1+ = Steam-ready UGC product.** Workshop, server Verified Clear Check, leaderboards, and moderation are a separate milestone (M5) built on top of the finished local game.

This matches GDD v2.0 and TDD v0.6. Local v1.0 does **not** satisfy the full Steam/creator-economy launch promise; that is explicitly v1.1+.

---

## Release Strategy

PINBALLZZZ is **single-player**. What gets deferred is the **online platform layer**.

### Local v1.0 — first shippable version

**Planning estimate: ~50–55 developer days** (M0–M4; see Effort Summary).

Everything runs on the player's machine. No backend required.

| In scope | Out of scope (M5 / v1.1+) |
| --- | --- |
| Full campaign (Sectors 0–5 + Abyss) | Steam Workshop upload/download |
| Creator Studio MVP — build, test, save/load local `.json` | UGC browser & online map discovery |
| **Playability Check** — client re-sim, stamps `verifier: "local"` | **Verified Clear Check** — server validation, `verifier: "server"` |
| Local save (progression, keybindings) | Leaderboards & score submission |
| Replay regression in local CI (`npm run replay-ci`) | Hosted `server/` endpoints |
| Signed Electron builds (Windows + macOS) | Steam achievements & Workshop |
| Ball skins / progression (local unlocks) | Moderation queue, CDN |

### Online v1.1+ — deferred (~13–18 d additional)

See **Milestone 5 — Online & Steam (Deferred)**.

> **Interface pattern:** `PlayabilityCheckProvider` with `LocalPlayabilityCheck` (v1.0) and `ServerVerifiedClearCheck` (v1.1+). Level JSON and simulation unchanged.

---

## Technical Estimates & Sizing Guide

| Size | Range |
| --- | --- |
| **Small (S)** | 1–2 days |
| **Medium (M)** | 3–5 days |
| **Large (L)** | 6–10 days |

> Estimates assume one experienced TypeScript/game-dev contributor working full-time. Art/audio authoring is not included. M3 includes a **+3 d content-authoring buffer** for six campaign sectors.

---

## Milestone Dependency Graph

```
M0 (Scaffold + P0 Spikes)
 └─▶ M1 (Vertical Slice + replay round-trip)  ◀── replay gate
      └─▶ M2 (Full Prototype — Sector 0 run)
           └─▶ M3 (Creator MVP + Campaign)
                └─▶ M4 (Local v1.0 Polish & Ship)  ◀── v1.0 SHIP
                     └─▶ M5 (Online & Steam)        ◀── v1.1+ deferred
```

**Hard gates:**

| Gate | Blocks | Resolved in |
| --- | --- | --- |
| Flipper feel verdict (TDD §16 Q2) | All flipper-dependent work | M0.2 |
| Pixel-to-metre ratio (TDD §16 Q1) | Level JSON, checkpoints, Fall Floors | M0.3 |
| WASM init latency (TDD §16 Q3) | Boot flow, first-frame UX | M0.4 |
| Fall Floor collision approach (TDD §16 Q7) | Fall Floor entity in M2 | M0.5 |
| **Replay record → replay → hash round-trip** | All replay-dependent systems, Playability Check | **M1.4** |

---

## User Review Required

> [!IMPORTANT]
> **Pixel-to-metre ratio** must be locked in M0.3 before M1 sector geometry. Document in `src/simulation/constants.ts`.

> [!WARNING]
> **Flipper feel (TDD §16 Q2)** — highest-risk unknown. Verdict required in M0.2 before M1.

> [!WARNING]
> **Replay in M1 is non-negotiable.** Input buffering, RNG (`mulberry32`), and simulation state shape must be replay-aware from the first vertical slice (TDD §0 next step).

> [!NOTE]
> **Playability Check ≠ Verified Clear Check.** Local export stamps `verifier: "local"`. Only M5 server validation stamps `verifier: "server"`. UI must never conflate them.

---

## Asset Pipeline Specification

### Art Assets (PC/Mac)
- **Palette:** `#FFFFFF` active, `#000000` background.
- **Format:** Transparent PNG sprite sheets on uniform grid (tracked via Git LFS; must match M0.3 `PIXELS_PER_METRE`).
- **Import:** Vite static assets → Phaser `this.load.spritesheet()`.

### Audio Stems & SFX
- **Source:** `.wav` (44.1 kHz, 16-bit) in `assets/audio/raw/` (tracked via Git LFS).
- **Build:** Shell script with ffmpeg `loudnorm` filter for loudness normalization (LUFS) and loop marker injection → `.ogg`/`.mp3` files in `public/assets/audio/`.
- **Stems:** Identical loop length, tempo, downbeat alignment for crossfading.

---

## Milestone 0 — Project Scaffold & P0 Spikes

**Goal:** Toolchain runs; all P0 open questions have written answers.

**Estimate:** ~6 d

### 0.1 Repository & Toolchain
- `[ ]` **[NEW]** Repository Scaffold — package.json (Vite + TS + Phaser + Rapier + Electron + Jest/ts-jest + scripts: dev, lint, typecheck, test) and Git LFS config (`.gitattributes`) to track `.png` and `.wav` binaries **(S, 0.5d)**
- `[ ]` **[NEW]** `tsconfig.json`, `vite.config.ts`, `.eslintrc.ts` (simulation boundary) **(S, 0.5d)**
- `[ ]` **[NEW]** `electron/main.ts` & `preload.ts` **(S, 0.25d)**
- `[ ]` **[NEW]** `src/main.ts` & `application.ts` — stubs for `SaveSystem` / `SettingsSystem` **(S, 0.25d)**
- `[ ]` **[NEW]** `src/core/StorageProvider.ts` — StorageProvider core interface definition **(S, 0.25d)**
- `[ ]` **[NEW]** `src/types/input.ts` — Typed InputBuffer schema definition (`{ frame: number, action: string, phase: "down" | "up" | "value", value?: number }` to capture flippers, plunger, and analog inputs) **(S, 0.25d)**
- `[ ]` **[NEW]** `.github/workflows/ci.yml` — lint, typecheck, Jest (no replay-ci yet) **(S, 0.25d)**

### 0.2 Physics Feel Spike (TDD §16 Q2)
- `[ ]` **[NEW]** `src/spikes/flipper-feel/FlipperSpike.ts` — Spike verdict must measure max motor torque, compare response latency side-by-side with a real pinball reference, and rate impact satisfaction on a 1–5 scale. Flipper feel sign-off requires rating >= 4. **(M, 1.0d)**
- `[ ]` **[NEW]** `docs/spikes/flipper-feel-verdict.md` **(S, 0.25d)**

### 0.3 Coordinate System Spike (TDD §16 Q1)
- `[ ]` **[NEW]** `src/simulation/constants.ts` — `PIXELS_PER_METRE`, grid, checkpoint interval, Fall Floor offset, seeded RNG constants (mulberry32 seed configuration), and dynamic chunking bounds **(S, 0.5d)**
- `[ ]` **[NEW]** `docs/spikes/coordinate-system.md` — Defines chunking boundaries and seeded RNG parameters **(S, 0.25d)**

### 0.4 WASM Init Spike (TDD §16 Q3)
- `[ ]` **[NEW]** `src/spikes/wasm-init/WasmInitSpike.ts` — Spike WASM compilation and initialization within the Electron container **(S, 0.5d)**
- `[ ]` **[NEW]** `docs/spikes/wasm-init-verdict.md` — Define Apple Silicon target cold-start success criteria < 200ms **(S, 0.25d)**

### 0.5 Fall Floor Collision Spike (TDD §16 Q7)
- `[ ]` **[NEW]** `src/spikes/fall-floor/FallFloorSpike.ts` — Test Rapier collision groups vs sensor+impulse for one-way platform catch behavior **(S, 0.5d)**
- `[ ]` **[NEW]** `docs/spikes/fall-floor-verdict.md` — Chosen Rapier approach **(S, 0.25d)**

### 0.6 Rapier Version Bump Protocol
- `[ ]` **[NEW]** `docs/rapier-version-bump-protocol.md` & `npm run rapier-bump-check` — Define the regression protocol and write regression script re-simulating golden replay hashes against new Rapier version in CI **(S, 0.75d)**

### M0 Exit Criteria
- [ ] `npm run lint && npm run typecheck && npm test` pass.
- [ ] Electron opens Phaser boot scene.
- [ ] Six spike/protocol docs merged; `PIXELS_PER_METRE` committed.
- [ ] Team sign-off on flipper feel (verdict subjective rating >= 4).

---

## Milestone 1 — Vertical Slice + Replay Round-Trip

**Goal:** Physics sandbox **and** minimal replay pipeline. Ball, flippers, plunger, CCD, camera, minimal Sector 0. Record inputs → headless replay → fixed-point hash match on **1 golden replay**.

**Estimate:** ~11 d

### 1.1 Simulation Layer
- `[ ]` **[NEW]** `src/simulation/events.ts` + `EventBus.ts` **(S, 0.5d)**
- `[ ]` **[NEW]** `src/simulation/PhysicsWorld.ts` — Fixed 1/60 s step; CCD on ball; `getBodyCount()` for perf tests **(S, 0.75d)**
- `[ ]` **[NEW]** `src/simulation/Simulation.ts` — Fixed-step loop; `mulberry32` seeded RNG (never `Math.random()`) **(S, 0.75d)**
- `[ ]` **[NEW]** `src/simulation/session/` — `PlayerState`, `WorldState`, `GameSession` **(S, 0.75d)**
- `[ ]` **[NEW]** `src/simulation/entities/` — `Ball`, `Flipper`, `Plunger` (Bumper deferred to M2.1) **(M, 1.5d)**

### 1.2 Input & Rendering Bridge & Storage Base
- `[ ]` **[NEW]** `src/core/InputBuffer.ts` — Fixed-step queue; uses early input types `{ action, frame }` **(S, 0.5d)**
- `[ ]` **[NEW]** `src/render/InputBridge.ts` — Keyboard + gamepad → `InputBuffer` **(S, 0.25d)**
- `[ ]` **[NEW]** `src/render/PhaserRenderer.ts` — Interpolation + 8-point ball trail **(S, 0.75d)**
- `[ ]` **[NEW]** `src/render/CameraController.ts` — Dead-zone follow **(S, 0.25d)**
- `[ ]` **[NEW]** `src/render/scenes/` — `BootScene`, `GameScene` only **(S, 0.5d)**
- `[ ]` **[NEW]** `src/core/StorageProvider.ts` — Implement `BrowserStorageProvider` LocalStorage fallback, and `StorageProviderFactory` for clean DI configuration (interface defined in M0.1) **(S, 0.25d)**

### 1.3 Sector 0 + Simulation Tests
- `[ ]` **[NEW]** `src/tower/SectorLoader.ts` **(S, 0.75d)**
- `[ ]` **[NEW]** `levels/campaign/sector_00.json` — Minimal ~50 m layout **(S, 0.5d)**
- `[ ]` **[NEW]** `tests/simulation/` — Flipper response + CCD tunneling **(S, 0.5d)**

### 1.4 Replay Round-Trip (P0 gate — blocks M2)
- `[ ]` **[NEW]** `src/replay/ReplaySystem.ts` — Facade on `GameSession` **(S, 0.25d)**
- `[ ]` **[NEW]** `src/replay/InputRecorder.ts` — `{ action, frame }` recording **(S, 0.25d)**
- `[ ]` **[NEW]** `src/replay/ReplayHash.ts` — Fixed-point hash (`HASH_PRECISION = 1000`) **(S, 0.25d)**
- `[ ]` **[NEW]** `src/replay/ReplayRunner.ts` — Node runner shell `tools/replay-runner/index.ts` stub (including worker-pool scaffolding) + compare logic + register `replay-ci` script in `package.json` **(M, 1.5d)**
- `[ ]` **[NEW]** `tests/replays/golden_01.json` — **1 golden replay** with expected hash; manual gate before M2 **(S, 0.25d)**

### M1 Exit Criteria
- [ ] 5-min sandbox: flippers responsive; no tunneling at max tested speed.
- [ ] **Golden replay:** record 30 s of play → replay headlessly → hash matches.
- [ ] Simulation tests pass with zero Phaser dependency.
- [ ] ESLint simulation boundary enforced.

---

## Milestone 2 — Full Prototype (Single Tower Run)

**Goal:** Complete Sector 0 (~500 m). Recovery mechanics, sector flow, audio. Scale replay suite to 5. Performance smoke tests begin.

**Estimate:** ~12 d

### 2.1 Recovery Mechanics & Checkpoints
- `[ ]` **[NEW]** `src/simulation/entities/Anchor.ts` **(M, 1.5d)**
- `[ ]` **[NEW]** `src/simulation/systems/NudgeSystem.ts` **(S, 0.5d)**
- `[ ]` **[NEW]** `src/simulation/entities/Bumper.ts` — Standard bouncing bumper entity and collision response (deferred from M1) **(S, 0.5d)**
- `[ ]` **[NEW]** `src/simulation/entities/FallFloor.ts` — Per M0.5 verdict **(M, 1.5d)**
- `[ ]` **[NEW]** `src/simulation/systems/CheckpointSystem.ts` **(S, 0.75d)**
- `[ ]` **[NEW]** `src/simulation/systems/WinConditionSystem.ts` — exit sensor & win tracking **(S, 0.5d)**
- `[ ]` **[MODIFY]** `levels/campaign/sector_00.json` — Full ~500 m **(S, 0.25d)**

### 2.2 Sector Flow & UI
- `[ ]` **[NEW]** `src/render/scenes/MenuScene.ts` **(S, 0.5d)**
- `[ ]` **[NEW]** `src/render/transitions/SectorTransition.ts` **(S, 0.5d)**
- `[ ]` **[NEW]** `src/render/hud/HUD.ts` **(S, 0.5d)**
- `[ ]` **[NEW]** `src/tower/SectorChunkManager.ts` — Dynamic chunk loading and unloading **(M, 1.0d)**

### 2.3 Replay Scale + Perf Smoke (target: 5 replays)
- `[ ]` **[MODIFY]** `tests/replays/` — Expand to 5 replays via `replay-runner` script **(S, 0.5d)**
- `[ ]` **[NEW]** `tests/perf/body-count.test.ts` — Assert ≤ 50 bodies during Sector 0 run **(S, 0.5d)**
- `[ ]` **[NEW]** `tests/perf/replay-speed.test.ts` — 500 m re-sim < 10 s headless **(S, 0.25d)**

### 2.4 Audio
- `[ ]` **[NEW]** `src/audio/AudioSystem.ts` **(M, 1.5d)**
- `[ ]` **[NEW]** Audio build script — shell script with ffmpeg `loudnorm` filter and loop-point metadata generation **(S, 0.5d)**
- `[ ]` **[NEW]** Anchor, FallFloor, checkpoint, replay integration tests **(S, 0.5d)**

### 2.5 Campaign Sector 3 Layout JSON
- `[ ]` **[NEW]** Campaign Content: Sector 3 Layout JSON — Design plunger, timing launcher, and booster layouts directly in Sector 3 campaign JSON using MVP-supported blocks **(S, 1.0d)**

### M2 Exit Criteria
- [ ] Creator Studio Scope Freeze Decision: Review progress, evaluate scope creep risks (undo/redo, copy/paste), and finalize Creator Studio cuts before M3 kickoff.
- [ ] Full Sector 0 clear from menu to win.
- [ ] Checkpoints, Fall Floors, Anchor per GDD §6.
- [ ] `npm run replay-ci` passes 5 replays.
- [ ] Perf smoke: body count ≤ 50; replay re-sim < 10 s.
- [ ] Adaptive audio responds to fall and sector entry.

---

## Milestone 3 — Creator MVP + Campaign

**Goal:** Creator Studio MVP operational. Campaign Sectors 1–5 authored. Abyss live. Playability Check with `verifier: "local"`. Replay CI at 30.

**Estimate:** ~18 d

### Creator Studio MVP Definition (v1.0 scope boundary)

**In MVP:**
- 32×32 grid overlay with snap-on-drag
- Block palette: wall, flipper (6 angles), bumper, plunger, checkpoint marker (including exit/goal clear block)
- Test Play (snapshot → run → restore editor)
- Save/load local `.json` via Electron file dialog
- Playability Check on export (`verifier: "local"`)
- Import bundled campaign JSON for editing

**Explicitly out of MVP (post-v1.0 polish or v1.1+):**
- Undo/redo history, copy/paste multi-select
- Moving platforms, rotating geometry blocks (Sector 3+ may use hand-placed JSON until blocks exist)
- Workshop upload, online browse, thumbnail generation
- Collaborative editing

### 3.1 Creator Studio Core
- `[ ]` **[NEW]** `src/levels/BlockRegistry.ts` — Block definition registry containing physics collider shapes and category parameters, keeping simulation decoupling clean from rendering code **(S, 0.25d)**
- `[ ]` **[NEW]** `src/render/scenes/CreatorGrid.ts` — grid, snap logical layout, block snap-on-drag, palette selection **(M, 3.0d)**
- `[ ]` **[NEW]** `src/render/scenes/CreatorTestPlay.ts` — snapshot creation of world state, run simulation session, restore editor state cycle **(M, 1.5d)**
- `[ ]` **[NEW]** Creator File Dialog Storage — Electron fs `dialog` implementation of `StorageProvider` interface; default path `~/Documents/PINBALLZZZ/levels/` **(M, 1.0d)**
- `[ ]` **[NEW]** `src/render/scenes/CreatorScene.ts` — Phaser scene composition, user interface overlay rendering, input orchestration **(M, 2.0d)**
- `[ ]` **[NEW]** `src/levels/serialize.ts` & `migrate.ts` — Format v3 with `playability_check.verifier` and `level_hash` fields **(S, 0.75d)**
- `[ ]` **[NEW]** `tests/levels/` — Migration + round-trip tests **(S, 0.25d)**
- `[ ]` **[NEW]** `src/core/SettingsSystem.ts` & `src/save/SaveSystem.ts` **(S, 0.25d)**
- `[ ]` **[NEW]** `src/core/StorageProvider.ts` — Wire StorageProvider factory injection, test interface swap between BrowserStorageProvider and ElectronStorageProvider **(S, 0.5d)**

### 3.2 Playability Check & Campaign Content
- `[ ]` **[NEW]** `src/replay/PlayabilityCheck.ts` — Client re-sim; stamps `{ verified, verifier: "local", level_hash, replay_hash, replay_engine_version }` **(S, 0.5d)**
- `[ ]` **[NEW]** `levels/campaign/sector_01.json` … `sector_05.json` — Authored in Creator Studio (layout design and Win Condition exit placement) **(M, 3.5d)**
- `[ ]` **[NEW]** `src/simulation/systems/AbyssGenerator.ts` — Generates chunks on demand using `BlockRegistry` (neutral layer) **(S, 0.75d)**
- `[ ]` **[NEW]** Multi-sector campaign transition wiring **(S, 0.25d)**

### 3.3 Replay CI + Perf (target: 30 replays)
- `[ ]` **[NEW]** `tools/replay-runner/index.ts` — Standalone execution script optimized with parallel workers (no Jest overhead) **(S, 0.5d)**
- `[ ]` **[NEW]** Expand `tests/replays/` to 30 files **(M, 1.0d)**
- `[ ]` **[NEW]** `tests/perf/chunk-unload.test.ts` — Sector transition drops stale bodies **(S, 0.25d)**
- `[ ]` **[NEW]** `tests/perf/level-load.test.ts` — Largest sector loads + migrates < 250 ms **(S, 0.25d)**
- `[ ]` **[NEW]** `tests/perf/memory.test.ts` — Automated heap profile test tracking memory usage during full campaign run **(S, 0.5d)**
- `[ ]` **[MODIFY]** `.github/workflows/ci.yml` — Parallelized replay regression run on every PR **(S, 0.25d)**
- `[ ]` **[NEW]** `tests/creator/playability-export.test.ts` — Automated integration test for Creator Studio level generation -> Playability Check -> serialised export round-trip **(S, 0.5d)**

### M3 Exit Criteria
- [ ] Creator MVP features complete per definition above.
- [ ] Export → local save → reload → campaign play round-trip works.
- [ ] Playability Check stamps `verifier: "local"`; UI does not show Clear Badge.
- [ ] 30-replay CI green; campaign Sectors 0–5 + Abyss playable.
- [ ] Perf: memory test passes; chunk unload test passes; level load < 250 ms; manual Sector 5 frame profile ≤ 16.7 ms.

---

## Milestone 4 — Local v1.0 Polish & Ship

**Goal:** Progression, ball skins, signed builds, 50-replay suite. **v1.0 ship.**

**Estimate:** ~5 d

### 4.1 Progression & Polish
- `[ ]` **[NEW]** `src/core/ProgressionSystem.ts` + ball skin rendering **(S, 1.0d)**
- `[ ]` **[NEW]** `docs/rapier-version-bump-protocol.md` **(S, 0.25d)**
- `[ ]` **[MODIFY]** `tests/replays/` — Expand to 50 files **(M, 1.0d)**

### 4.2 Release Build
- `[ ]` **[MODIFY]** `.github/workflows/ci.yml` — Signed Electron builds CI pipeline configuration (Windows/macOS) and macOS entitlements.plist setup **(M, 1.5d)**
- `[ ]` **[NEW]** `Signed Builds Debugging & Notarization` — Provisioning cert installation and Apple notarization debugging **(M, 1.0d)**
- `[ ]` **[NEW]** Release smoke checklist **(S, 0.25d)**

### M4 Exit Criteria (v1.0 SHIP)
- [ ] Full offline campaign completable.
- [ ] Creator MVP save/load + Playability Check works.
- [ ] 50-replay CI green.
- [ ] Signed desktop artifacts from CI.
- [ ] **No network calls at runtime.**
- [ ] RAM < 512 MB during full campaign (manual check).

---

## Milestone 5 — Online & Steam (v1.1+ — Deferred)

**Goal:** Steam, Workshop, Verified Clear Check (`verifier: "server"`), leaderboards, UGC browser.

**Estimate:** ~13–18 d (+ infra buffer if backend is greenfield)

**Prerequisite:** M4 shipped. `PlayabilityCheckProvider` interface stable.

### 5.1 Steam
- `[ ]` `docs/spikes/steam-bindings-audit.md` **(S, 0.5d)**
- `[ ]` `src/steam/SteamSystem.ts` + `electron/preload.ts` IPC **(M, 2.5d)**

### 5.2 Online Platform
- `[ ]` `server/` — Greenfield Node.js server (WASM Rapier re-simulation, validation pipeline, leaderboard store, moderation hooks) **(L, 6.0d)**
- `[ ]` `src/replay/VerifiedClearCheck.ts` — `verifier: "server"` **(M, 1.0d)**
- `[ ]` `src/render/scenes/UGCBrowserScene.ts` + publish flow **(M, 3.0d)**
- `[ ]` Moderation hooks **(M, 1.0d)**
- `[ ]` Expand replays to 100 **(M, 1.0d)**

### M5 Exit Criteria
- [ ] Workshop publish → download on second client → playable.
- [ ] Server rejects tampered hash.
- [ ] Clear Badge shown **only** for `verifier: "server"`.
- [ ] 100-replay CI green.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Flipper motor feel insufficient | Medium | High | M0.2 spike + impulse fallback |
| Replay built too late → rework | Medium | High | M1.4 golden replay gate |
| Fall Floor one-way non-trivial in Rapier | Medium | Medium | M0.5 spike before M2 |
| Creator Studio + content under-budgeted | **High** | **High** | MVP scope boundary; +3 d buffer; hand-author Sector 3 blocks if needed |
| Cross-platform replay hash drift | Medium | High | Fixed-point hash; pinned Rapier; CI ramp |
| Local Playability Check mistaken for Verified | Low | Medium | `verifier` field; UI never shows Clear Badge for `"local"` |

---

## Verification Plan

### Automated Testing Commands
```bash
npm run lint          # ESLint — simulation import boundaries
npm run typecheck     # tsc --noEmit
npm test              # Jest — simulation/ + levels/ + perf/ (no browser)
npm run replay-ci     # Re-simulate tests/replays/ via tools/replay-runner
```

### Manual Verification Checklist

| Milestone | Manual test |
| --- | --- |
| **M0** | FlipperSpike + FallFloorSpike sign-off |
| **M1** | Sandbox feel + golden replay hash match |
| **M2** | Full Sector 0 run; 5-replay CI; perf smoke green |
| **M3** | Creator MVP round-trip; Playability Check; 30-replay CI |
| **M4 (v1.0 ship)** | Full offline campaign; signed build |
| **M5 (deferred)** | Workshop publish/download; server hash rejection |

### Replay Regression Ramp

| Phase | Count | CI |
| --- | --- | --- |
| M1 | 1 | Manual gate |
| M2 | 5 | Nightly |
| M3 | 30 | Every PR |
| M4 (v1.0) | 50 | Every PR |
| M5 (v1.1+) | 100 | Every PR |

---

## Effort Summary

| Milestone | Estimate | Release |
| --- | --- | --- |
| M0 — Scaffold + spikes | ~6 d | v1.0 |
| M1 — Vertical slice + replay | ~11 d | v1.0 |
| M2 — Full prototype | ~12 d | v1.0 |
| M3 — Creator MVP + campaign | ~18 d | v1.0 |
| M4 — Polish & ship | ~6 d | **v1.0 ship** |
| **Local v1.0 subtotal** | **~53 d** | |
| M5 — Online & Steam | ~13–18 d | v1.1+ |

**Planning number: ~50–55 developer days** for Local v1.0.

The ~53 d subtotal is the exact item-sum of M0–M4. Use **50–55 d** in scheduling to account for standard integration variation.
