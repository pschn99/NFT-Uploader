# PINBALLZZZ

**Technical Design Document v0.6**

**Status:** ✅ Ready for prototype — Local v1.0 scope locked. Next milestone: vertical slice with replay round-trip.

**Last updated:** 2026-07-03

**Changelog v0.6:** Aligned with GDD v2.0 release split. **Local v1.0** = offline Electron desktop; **Online v1.1+** = Steam + server validation. Renamed `ugc/` → `src/levels/` (serialization/migration). Renamed `server/replay-runner/` → `tools/replay-runner/` (local CI, not hosted). Clear Check split into Playability Check (`verifier: "local"`) vs Verified Clear Check (`verifier: "server"`). Replay round-trip moved into M1 vertical slice. CI replay count phased: 1 → 5 → 30 → 50 (v1.0) → 100 (v1.1+). Added §14.1 performance verification plan.

> **Next step:** Build a vertical slice (M1) that answers all four P0 questions: flipper feel, fixed-step performance, WASM init latency, **and end-to-end replay record → replay → hash round-trip**. Replay must land in M1 because it constrains input buffering, simulation state shape, RNG rules, and physics stepping.

---

## 0. Document Scope

This TDD translates the design intent in the GDD into concrete technical decisions, architecture choices, and system contracts. It is the authoritative reference for the engineering team during prototyping and early production.

### Release Phases

| Phase | Scope | Network |
| --- | --- | --- |
| **Local v1.0** | Full campaign, Creator Studio MVP, local save, Playability Check, replay CI | None at runtime |
| **Online v1.1+** | Steam, Workshop, Verified Clear Check, leaderboards, UGC browser | Server + CDN required |

Simulation, level JSON format, and replay infrastructure are identical across phases. Online v1.1+ adds `src/online/` (publish, browse, leaderboard clients) and hosted `server/` endpoints — it does not rewrite core game logic.

---

## 1. Architectural Principles

These principles govern every decision in this document. New contributors should read this section before the implementation details.

1. **Simulation is authoritative.** All gameplay state lives in `simulation/`. No other system may own or mutate game state.
2. **Rendering never owns gameplay state.** `PhaserRenderer` observes and mirrors simulation state. It never drives it.
3. **Every gameplay system must be testable without Phaser.** If a test requires a canvas or a browser, it is in the wrong layer.
4. **Replay determinism is a first-class requirement.** Any change that could affect physics output must be validated against the replay regression suite before merging.
5. **Data formats are versioned and migratable.** Every persisted format carries a `format_version`. A migration function exists for every version increment.
6. **Systems communicate through typed interfaces.** No stringly-typed event names. All inter-system communication uses TypeScript interfaces defined in `simulation/events.ts`.

---

## 2. Engine & Platform

| Decision | Choice | Rationale |
|---|---|---|
| **Language** | TypeScript | Enormous AI coding tool training corpus; excellent type safety; fast incremental compilation; first-class VSCode support |
| **IDE** | VSCode | Best-in-class AI agentic coding extensions (Claude Code, Copilot, Cursor); no proprietary editor lock-in |
| **Game Framework** | Phaser.js 3.x | Rendering, camera, input, animation, audio, asset loading, scene management — used purely as IO/rendering layer; owns no game state |
| **Physics Backend** | Rapier.js 2D (WASM) | CCD; revolute joints; designed for determinism under fixed timestep; active development; no velocity cap needed |
| **Build Tooling** | Vite | Near-instant HMR; native TypeScript + ESM; minimal config; excellent VSCode integration |
| **PC / Mac Build** | Electron | Wraps the Phaser web app as a native desktop binary (Local v1.0) |
| **Steam Integration** | Online v1.1+ — evaluate before M5 (see §16 Q4) | GreenWorks has maintenance gaps; audit `steamworks.js` and alternatives before committing |
| **Mobile / Tablet** | Post-launch via Capacitor | Same web build wrapped as iOS/Android; deferred to protect v1.0 PC/Mac focus |
| **Target Framerate** | 60 fps display; 240Hz physics timestep (4 substeps of 1/240s per 1/60s frame) | Deliberate substepping optimization to prevent tunneling of high-speed ball/flipper collisions; mandatory for replay determinism |
| **Switch** | ❌ Dropped from scope | Stack cannot target Switch |

---

## 3. Architecture Overview

### 3.1 Core principle

**Simulation owns the game. Rendering observes it.**

```
┌─────────────────────────────────────────────────────┐
│                   Application                       │
│                                                     │
│  ┌──────────────────────────────┐                   │
│  │         GameSession          │  (null in menus)  │
│  │  ┌────────────┐              │                   │
│  │  │ Simulation │◀── authoritative game state      │
│  │  │ ReplaySystem│             │                   │
│  │  │ PlayerState │             │                   │
│  │  │ WorldState  │             │                   │
│  │  └────────────┘              │                   │
│  └──────────────────────────────┘                   │
│                                                     │
│  ┌────────────────┐  ┌──────────────────────────┐   │
│  │ PhaserRenderer │  │  SteamSystem             │   │
│  │ (observes sim) │  │  SettingsSystem           │   │
│  │                │  │  SaveSystem               │   │
│  │                │  │  StorageProvider         │   │
│  └────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

```typescript
class Application {
  session:  GameSession | null  // null when in menus or creator without active run
  renderer: PhaserRenderer
  steam:    SteamSystem
  settings: SettingsSystem
  save:     SaveSystem
  storage:  StorageProvider     // Abstracted for Electron fs vs Browser local storage
}

class GameSession {
  simulation: Simulation        // physics world, entity state, game rules
  replay:     ReplaySystem      // input recording and playback
  player:     PlayerState       // height record, charges, checkpoint
  world:      WorldState        // active sector, loaded chunks
}
```

```typescript
export interface StorageProvider {
  save(key: string, data: unknown): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  // Optional methods for Creator Studio file dialogs (Electron fs only)
  saveFileDialog?(defaultName: string, data: unknown): Promise<boolean>;
  loadFileDialog?(): Promise<unknown | null>;
}
```

`Application` manages the lifecycle (boot, menu, session start/end, quit). `GameSession` is created when a run begins and destroyed when the run ends or returns to menu. This separation makes it straightforward to reset game state without restarting the application.

### 3.2 Dependency direction rules

Dependencies may only point **toward** `simulation`. `simulation` may never import from `render`, `audio`, `creator`, `levels`, `online`, or any other layer.

```
render   ──▶ simulation
audio    ──▶ simulation
creator  ──▶ simulation
levels   ──▶ simulation
replay   ──▶ simulation
online   ──▶ simulation   (v1.1+)

simulation ──▶ ∅   (no external imports except Rapier and stdlib)
```

Violating this rule (e.g. `simulation` importing a Phaser type) is a build error. ESLint import rules enforce this boundary in CI.

### 3.3 ECS (future consideration)

For v1.0 the entity model remains simple (plain TypeScript objects and maps). Once UGC levels introduce hundreds of simultaneous bumpers, triggers, moving platforms, portals, and hazards, an ECS library should be evaluated. This is a post-launch architectural upgrade, not a launch requirement (see §16 Q9 for post-launch roadmap item).

---

## 4. Repository & Project Structure

```
pinballzzz/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.ts                 # Enforces simulation/ import boundary rules
├── electron/
│   ├── main.ts
│   └── preload.ts
├── tools/
│   └── replay-runner/
│       └── index.ts             # Local CI: Node + Rapier only — zero Phaser, no network
├── server/                      # Online v1.1+ only — hosted endpoints (deferred)
│   └── ...
├── src/
│   ├── main.ts                  # Phaser bootstrap + Application instantiation
│   ├── application.ts           # Application root class
│   │
│   ├── simulation/              # ★ Pure game logic — zero Phaser dependency
│   │   ├── Simulation.ts
│   │   ├── PhysicsWorld.ts
│   │   ├── events.ts            # ★ Typed SimulationEvents interface (see §6)
│   │   ├── session/
│   │   │   ├── GameSession.ts
│   │   │   ├── PlayerState.ts
│   │   │   └── WorldState.ts
│   │   ├── entities/
│   │   │   ├── Ball.ts
│   │   │   ├── Flipper.ts
│   │   │   ├── Bumper.ts
│   │   │   ├── Plunger.ts
│   │   │   ├── Anchor.ts
│   │   │   └── FallFloor.ts
│   │   └── systems/
│   │       ├── CheckpointSystem.ts
│   │       ├── NudgeSystem.ts
│   │       ├── WinConditionSystem.ts
│   │       └── AbyssGenerator.ts
│   │
│   ├── tower/
│   │   ├── SectorLoader.ts
│   │   └── SectorChunkManager.ts
│   │
│   ├── render/                  # Phaser rendering layer — reads simulation only
│   │   ├── PhaserRenderer.ts
│   │   └── scenes/
│   │       ├── BootScene.ts
│   │       ├── MenuScene.ts
│   │       ├── GameScene.ts
│   │       ├── CreatorScene.ts
│   │       └── UGCBrowserScene.ts   # Online v1.1+ (deferred)
│   │
│   ├── replay/
│   │   ├── ReplaySystem.ts
│   │   ├── InputRecorder.ts
│   │   ├── ReplayRunner.ts
│   │   ├── ReplayHash.ts        # Fixed-point position hashing (see §9)
│   │   ├── PlayabilityCheck.ts  # verifier: "local" (v1.0)
│   │   └── VerifiedClearCheck.ts # verifier: "server" (v1.1+, deferred)
│   │
│   ├── creator/
│   ├── levels/                  # Level serialization & migration (not online-specific)
│   │   ├── migrate.ts           # migrateToLatest(), per-version migration fns
│   │   └── serialize.ts
│   ├── online/                  # Online v1.1+ — publish, browse, leaderboard (deferred)
│   ├── audio/
│   └── save/
│
├── public/assets/
│   ├── sprites/
│   ├── audio/
│   └── fonts/
├── levels/                      # Bundled level data (JSON)
│   ├── campaign/
│   └── sandbox/
└── tests/
    ├── simulation/              # Pure simulation unit tests (no browser)
    ├── levels/                  # Migration and serialization tests
    └── replays/                 # Stored replay files for CI regression (phased count)
```

---

## 5. Physics System

Rapier.js owns all physics. `PhaserRenderer` reads body transforms each frame and moves Phaser sprites to match. No game state lives in Phaser.

### 5.1 Ball

* `RAPIER.RigidBodyDesc.dynamic()` with per-Sector restitution and friction.
* CCD: `rigidBodyDesc.setCcdEnabled(true)` — no velocity cap needed.
* Gravity tunable per Sector via `world.gravity`.
* Trail: 8-point position history in `PhaserRenderer`; drawn as a Phaser `Graphics` object.

### 5.2 Flipper

* `RAPIER.RigidBodyDesc.dynamic()` pinned at pivot via `RAPIER.JointData.revolute()`.
* Motor: `joint.configureMotorVelocity(targetVel, damping)` toggled on input press/release.
* Ball impact force emerges naturally from Rapier collision response.

### 5.3 Nudge

* `rigidBody.applyImpulse({ x: nudgeForce, y: 0 }, true)` on the ball.
* 3 charges in `PlayerState`; refill on checkpoint. Fires a `NudgeFired` event consumed by `AudioSystem` and `PhaserRenderer` (camera shake).

### 5.4 Anchor

* Rapier sensor collider at Anchor position; `EventQueue` monitored each step.
* On collision: ball held kinematically for 0.4s catch window, then restored to dynamic.
* Max 2 simultaneous Anchors; 3 catch charges each.

### 5.5 Fall Floor

* `RAPIER.RigidBodyDesc.fixed()` one-way collider spawned 10 virtual-metres below each passed checkpoint.
* Active 2 seconds after ball crosses checkpoint boundary descending; removed after timeout.
* **Implementation note:** Rapier has no native one-way platform. Use collision groups / active hooks with velocity-direction filtering, or a sensor + impulse catch. Validate approach in M0.5 Fall Floor spike before M2 implementation.

---

## 6. Typed Simulation Event Interface

All inter-system communication uses the typed `SimulationEvents` interface. No raw string event names anywhere in the codebase.

```typescript
// simulation/events.ts

export interface Vec2 { x: number; y: number }

export interface SimulationEvents {
  BallImpact:        { position: Vec2; impulse: number }
  CheckpointReached: { checkpointY: number; chargesRestored: number }
  BallFell:          { fromY: number }
  AnchorTriggered:   { anchorId: string; chargesRemaining: number }
  NudgeFired:        { direction: 'left' | 'right'; chargesRemaining: number }
  SectorEntered:     { sectorIndex: number }
  WinConditionMet:   { finalPosition: Vec2; clearTimeMs: number }
  FlipperStruck:     { side: 'left' | 'right'; angularVelocity: number }
}
```

A lightweight typed emitter wraps this interface:

```typescript
// simulation/EventBus.ts
export class EventBus<T extends Record<string, object>> {
  emit<K extends keyof T>(event: K, data: T[K]): void { ... }
  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void { ... }
  off<K extends keyof T>(event: K, handler: (data: T[K]) => void): void { ... }
}

// Usage
const bus = new EventBus<SimulationEvents>();
bus.emit('BallImpact', { position: { x: 120, y: 340 }, impulse: 4.2 });
```

`AudioSystem`, `PhaserRenderer`, and `ReplaySystem` subscribe to this bus. `simulation/` emits to it but never imports from the subscribers.

---

## 7. Tower & Sector System

### 7.1 Vertical Scrolling & Chunk Loading

* `PhaserRenderer` reads ball Y from `Simulation` and moves the Phaser camera with a configurable dead zone.
* `SectorLoader` parses level JSON (after migration) into Rapier colliders and entity state in `WorldState`.
 * `SectorChunkManager` handles loading and unloading sector colliders dynamically within a 250-metre buffer (500m total vertical coverage, approximately one full sector) around the ball's Y position to optimize performance and memory.

### 7.2 Checkpoint System

* Rapier sensor colliders every 100 virtual metres. `CheckpointSystem` polls `EventQueue` each step.
* On overlap: `PlayerState.lastCheckpointY` updated; `CheckpointReached` event emitted.
* On ball drain: The ball is considered "drained" only when it falls below the bottom-most boundary of the loaded world chunks (where no collision geometry exists). When a drain occurs, the ball is respawned at `lastCheckpointY` with zero velocity after a 0.8s pause.
* Height regression: If the ball falls past a checkpoint but remains within the loaded geometry, the player is free to recover the ball via lower flippers, Anchors, or the active Fall Floor.

### 7.3 Win Condition System

* Monitors the ball's overlap with the Sector exit boundary sensor (campaign mode) or exit/goal block (UGC/Creator mode).
* On overlap, triggers `WinConditionMet` event, passing final positions and clear times.
* Manages progression flow from Sector to Sector by notifying the `Application` session of sector clears.

### 7.4 Procedural Abyss (Sector ∞)

* `AbyssGenerator` uses seeded `mulberry32` RNG (`playerId + runStartTimestamp`).
* Generates 100m chunks on demand from `BlockRegistry`.
* Abyss runs go through the full replay validation pipeline.

---

## 8. Creator Studio

### 8.1 Grid & Snapping

* 32×32px logical grid overlay in `CreatorScene`. Blocks snap on drag-end. Flippers snap to 6 angles.
* `BlockRegistry`: block type key -> Rapier collider shape + category. Lives in a neutral layer (`src/levels/BlockRegistry.ts`) to prevent the simulation layer from importing rendering/Phaser code. Rendering assets (Phaser sprite keys) are mapped separately in the renderer.

### 8.2 Level Serialization Format

```json
{
  "format_version": 3,
  "author_id": "steam_uid",
  "sector_height_m": 120,
  "blocks": [
    { "type": "flipper_left", "grid_x": 4, "grid_y": 12, "rotation_index": 0 },
    { "type": "bumper_standard", "grid_x": 9, "grid_y": 7 }
  ],
  "checkpoints": [20, 60, 100],
  "playability_check": {
    "verified": true,
    "verifier": "local",
    "level_hash": "sha256:xyz456...",
    "replay_hash": "sha256:abc123...",
    "replay_engine_version": "0.18.0",
    "clear_time_s": 312
  }
}
```

`verifier` is `"local"` (client Playability Check, v1.0) or `"server"` (Verified Clear Check, v1.1+). UI must never treat `"local"` as equivalent to a Workshop Clear Badge.

### 8.3 Level Format Migration Pipeline

```typescript
// src/levels/migrate.ts
const CURRENT_FORMAT_VERSION = 3;

const migrations: Record<number, (data: unknown) => unknown> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
};

export function migrateToLatest(data: unknown): LevelData {
  let d = data as any;
  let safety = 0;
  while (d.format_version < CURRENT_FORMAT_VERSION && safety++ < 20) {
    d = migrations[d.format_version](d);
  }
  if (d.format_version < CURRENT_FORMAT_VERSION) {
    throw new Error(`Migration stalled at version ${d.format_version}`);
  }
  return d as LevelData;
}
```

`SectorLoader` always calls `migrateToLatest` before parsing. Migration functions are unit-tested in `tests/levels/`.

### 8.4 Playability Check & Verified Clear Check

**Playability Check (Local v1.0):**

1. Creator completes their level. `InputRecorder` captures inputs using the defined schema.
2. On export: `PlayabilityCheck` re-simulates inputs headlessly in a fresh Rapier world. No Phaser involved.
3. If verified: `playability_check.verified = true`, `verifier: "local"`, level content hash (`level_hash`) stamped, fixed-point hash stored (`replay_hash`), `replay_engine_version` stamped.
4. If creator edits geometry after clearing, the computed geometry hash will no longer match `level_hash`, invalidating the verification.

**Verified Clear Check (Online v1.1+ — deferred):**

5. On Workshop publish: hosted `server/` re-simulates against signed JSON via `VerifiedClearCheck`. Hash mismatch = auto-reject. Success stamps `verifier: "server"`.

---

## 9. Deterministic Replay System

With a fixed timestep, pinned Rapier version, seeded randomness, and identical inputs, the replay system is designed to produce consistent results across supported platforms. Server-side validation verifies each simulation before accepting leaderboard submissions.

> **Caveat:** Bit-identical results across all platforms are not guaranteed. Rapier's WASM build significantly reduces variance, but Rapier version changes, compiler changes, or surrounding code changes can shift results. The Rapier version is pinned in `package.json` and must not be bumped without a full replay regression pass. Existing signed replays are invalidated on version bumps.

### Fixed-point position hashing

Raw floating-point ball coordinates are not hashed directly — insignificant numerical differences between environments could break validation. Instead, coordinates are rounded to a fixed precision before hashing:

```typescript
// replay/ReplayHash.ts
const HASH_PRECISION = 1000; // 3 decimal places of virtual-metre coordinates

export function hashFinalPosition(pos: Vec2): string {
  const x = Math.round(pos.x * HASH_PRECISION);
  const y = Math.round(pos.y * HASH_PRECISION);
  return sha256(`${x},${y}`);
}
```

`HASH_PRECISION` is a versioned constant. Any change to it invalidates all existing replay hashes.

### System summary

* **Fixed timestep:** Rapier stepped at 1/240 s with 4 substeps per frame (effective 60Hz display rate, 240Hz solver rate). Display interpolates.
* **Seeded RNG:** `mulberry32` everywhere; never `Math.random()`.
* **Input recording:** `InputRecorder` writes inputs using a schema of `{ frame: number, action: string, phase: "down" | "up" | "value", value?: number }` to capture flipper down/up state, plunger hold/release values, and analog pull dynamics.
* **Replay playback:** `ReplayRunner` feeds seed + inputs into a fresh Rapier world.
* **Leaderboard validation:** `hashFinalPosition` of ball at win condition stored with entry; server re-simulates and compares.
* **Version lock:** `replay_engine_version` in replay files; server rejects mismatched versions.

---

## 10. CI & Replay Regression

Replay regression catches physics changes that silently alter simulation output. Count ramps by release phase:

| Phase | Replay count | CI enforcement |
| --- | --- | --- |
| M1 (vertical slice) | 1 | Manual gate — blocks M2 |
| M2 (prototype) | 5 | Nightly / optional on PR |
| M3 (Creator + campaign) | 30 | Every PR |
| M4 (Local v1.0 ship) | 50 | Every PR |
| M5 (Online v1.1+) | 100 | Every PR |

```
GitHub Actions (on every PR — from M3 onward)
│
├── lint          # ESLint — enforces simulation/ import boundary rules
├── typecheck     # tsc --noEmit
├── unit-tests    # Jest — simulation/, levels/, and creator/ (playability-export round-trip) suites
│
└── replay-regression
      │
      ├── loads tests/replays/
      ├── runs each through tools/replay-runner/ (Node + Rapier; no Phaser; no network)
      ├── compares output hash to stored expected hash
      │
      ├── all pass  → ✅ build green
      └── any mismatch → ❌ build fails with diff of affected replays
```

Stored replays cover: campaign Sectors, Abyss runs, Playability Check examples, and edge cases (multi-Anchor saves, max-speed ball, Fall Floor catch). New gameplay features must ship with at least one new replay added to the suite. The Creator Studio export integration test (`creator/playability-export.test.ts`) runs on every PR to verify the round-trip from editor to playability check and export serialization.

* **Replay Execution Performance & Parallelism:** 
  To prevent CI bottlenecks as the suite scales (e.g. 50+ replays in M4, 100+ in M5), `tools/replay-runner/` is implemented as a standalone Node.js script optimized for concurrent execution rather than running inside Jest. It uses a parallel worker pool (e.g. Node's `worker_threads` or `piscina`) to re-simulate levels in parallel. Individual simulations are budgeted at `< 10s` each, and the entire 100-replay suite is targeted to complete in under 2 minutes.

---

## 11. Publishing Pipeline

### Local v1.0

| Stage | Owner | Notes |
|---|---|---|
| Local authoring | Client | `CreatorScene` — PC/Mac |
| Playability Check | Client | `PlayabilityCheck` + `ReplayRunner`; stamps `verifier: "local"` |
| Save / load | Client | Local `.json` via Electron file dialog |
| Campaign play | Client | Bundled `levels/campaign/` + user-saved levels |

### Online v1.1+ (deferred)

| Stage | Owner | Notes |
|---|---|---|
| Verified Clear Check | Server | Hosted `server/` re-simulates; stamps `verifier: "server"` |
| Upload | Client → CDN | Compressed JSON + preview screenshot |
| Moderation | Auto + Manual | Profanity filter + manual queue |
| Browse & Play | Client | `UGCBrowserScene`; Clear Badge on server-verified levels only |

---

## 12. Audio System

`AudioSystem` subscribes to `SimulationEvents` via the typed `EventBus`. It never reads Phaser state.

| Layer | Type | Trigger event |
|---|---|---|
| **Ambient base** | Looping stem | Always playing |
| **Elevation layer** | Additive stem | `SectorEntered` / height threshold |
| **Fall sting** | One-shot | `BallFell` |
| **Bassline** | Looping stem | `BallFell` → until `FlipperStruck` |
| **Impact SFX** | Sample bank (4 variants) | `BallImpact` |

SFX exported as `.ogg` (desktop) and `.mp3` (iOS, post-launch).

---

## 13. Input

### Desktop

| Action | Keyboard | Gamepad |
|---|---|---|
| Flipper Left | `Z` / `Left Arrow` | `L2` |
| Flipper Right | `X` / `Right Arrow` | `R2` |
| Plunger (hold/release) | `Space` | `Left Stick` pull + release |
| Nudge Left | `A` | `D-Pad Left` |
| Nudge Right | `D` | `D-Pad Right` |
| Place Anchor | `S` / `Down Arrow` | `D-Pad Down` |
| Pause | `Esc` | `Start` |

Phaser `InputPlugin` captures raw input → translated to `InputBuffer` entries → consumed by `Simulation` each fixed step. No key codes in simulation logic.

### Mobile / Tablet (Post-launch)

Touch input via Capacitor. See GDD §6 for intended mapping.

---

## 14. Performance Targets

| Metric | Target | Hard Limit |
|---|---|---|
| Frame time (Desktop) | ≤ 8.3 ms | 16.7 ms |
| Frame time (Mobile, post-launch) | ≤ 16.7 ms | 33.3 ms |
| Peak RAM (Desktop) | < 256 MB | 512 MB |
| Rapier WASM bundle (gzipped) | < 1 MB | — |
| Level JSON load + migrate | < 100 ms | 250 ms |
| Rapier rigid bodies (simultaneous) | ≤ 50 | 100 |
| Ball velocity | Uncapped — CCD handles all speeds | — |

### 14.1 Performance Verification Plan

Performance targets (§14) are validated at milestone exit, not just documented.

| Check | When | Method |
| --- | --- | --- |
| Rapier body count ≤ 50 (hard limit 100) | M2, M3 exit | `PhysicsWorld.getBodyCount()` assertion in perf smoke test |
| Chunk unload — no stale bodies after sector transition | M2, M3 exit | Automated test: load Sector 5 + Abyss, transition, assert body count drops |
| Frame time ≤ 16.7 ms (desktop hard limit) | M3 exit | Manual profile of worst-case Sector 5 scene; document in perf log |
| Replay re-sim speed — 500 m sector < 10 s headless | M2 exit | `tools/replay-runner` benchmark in CI (runs parallelized via Node worker threads) |
| Level JSON load + migrate < 250 ms | M3 exit | Jest timing test on largest campaign sector |
| Playability export round-trip integrity | M3 exit | Automated integration test: CreatorScene -> PlayabilityCheck -> serialization -> reload round-trip |
| RAM < 512 MB peak | M3, M4 exit | Automated heap profile test (`tests/perf/memory.test.ts`) + manual Electron check |

Perf smoke tests live in `tests/perf/` and run as part of `npm test` from M2 onward.

## 15. Development Toolchain

| Tool | Purpose |
|---|---|
| **VSCode** | Primary IDE |
| **TypeScript 5.x** | Language |
| **Vite** | Dev server + bundler |
| **Phaser 3.x** | Rendering, input, audio, scenes |
| **Rapier.js 2D (WASM)** | Physics |
| **Electron** | PC / Mac desktop wrapper |
| **Steamworks bindings** | Online v1.1+ — evaluate before M5 |
| **Capacitor** | iOS / Android (post-launch) |
| **Jest + ts-jest** | Unit and integration tests |
| **ESLint + Prettier** | Code style + boundary enforcement |
| **GitHub Actions** | CI: lint, typecheck, unit tests, replay regression |

---

## 16. Open Questions

| # | Question | Owner | Priority |
|---|---|---|---|
| 1 | What is the pixel-to-virtual-metre conversion for height tracking and UGC coordinate portability? | Engineering | P0 |
| 2 | **Validate Rapier revolute joint motor feel for flippers** — does it deliver "immediate, strong impact"? This is the most important prototype question. | Engineering | P0 |
| 3 | Rapier WASM async init — confirm it does not cause visible delay on target hardware | Engineering | P0 |
| 4 | Steamworks Node.js bindings — audit before Online v1.1+ (M5) | Engineering | P1 (deferred) |
| 5 | Server-side replay runner — self-hosted Node.js or cloud function? Evaluate before M5 | Engineering + Production | P1 (deferred) |
| 6 | Rapier version bump process — define regression protocol before first public leaderboard (M5) | Engineering | P1 (deferred) |
| 7 | Fall Floor one-way collision — collision groups vs sensor+impulse (M0.5 spike) | Engineering | P0 |
| 8 | Creator Studio tablet UX — post-launch scope and timeline | Design + Production | P2 |
| 9 | ECS evaluation — once UGC entity counts grow large, evaluate TypeScript ECS libraries | Engineering | Post-launch |