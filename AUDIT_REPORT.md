# PINBALLZZZ — Comprehensive Implementation Audit Report

**Date:** 2026-07-03  
**Scope:** Milestones M0 (Complete), M1 (Complete), M2 (Complete)  
**Reference Documents:** GDD v2.0, TDD v0.6, Implementation Plan v1.10, AGENTS.md, Spike Verdicts

---

## Executive Summary

This audit compares the current codebase against all project specifications (GDD, TDD, implementation plan, spike verdicts) to identify functional gaps, deviations, and technical errors.

**Overall Status:** The codebase has a solid architectural foundation with good separation of concerns. However, there are **18 spec violations**, **14 deviations**, **9 missing features**, and **6 potential technical issues** across the completed milestones.

| Category | Count | Severity |
|----------|-------|----------|
| Spec Violations | 18 | Critical / Major |
| Spec Deviations | 14 | Major / Minor |
| Missing Features | 9 | Major / Minor |
| Potential Technical Issues | 6 | Major |
| **Total Issues** | **47** | |

The most critical issues involve: (1) Anchor system behavioral deviation from GDD/TDD, (2) FallFloor implementation contradicting the approved spike verdict, (3) InputBridge bypassing remappable keybindings, (4) missing gamepad support, (5) sector transition missing full-screen inversion + title card, and (6) simulation state mutation violations.

---

## 1. CRITICAL SPEC VIOLATIONS

These issues represent direct contradictions with authoritative specifications and should be resolved before proceeding.

### 1.1 Anchor System — Fundamental Behavioral Deviation

**Files:** `src/simulation/entities/Anchor.ts`, `src/simulation/session/PlayerState.ts`

| Aspect | Spec (GDD §6, TDD §5.4) | Implementation | Gap |
|--------|-------------------------|----------------|-----|
| **Anchor placement** | Pre-placed on tower walls as magnetic catch-points | Dynamically created at ball's current position via revolute joint | Mechanic fundamentally different |
| **Simultaneous anchors** | Max 2 anchors on walls, each independently tracks charges | Single `anchorCharges = 2` counter, no independent tracking | Spec says 2 anchors × 3 catches = 6 total; impl has 2 total uses |
| **Catch charges** | 3 catches per anchor before repositioning | No per-anchor charge tracking | Missing entirely |
| **Catch window** | 0.4s kinematic hold, then auto-release to dynamic | Indefinite hold via revolute joint, no auto-release | Missing entirely |

**Impact:** The anchor system works as a "pin to current position" mechanic rather than a "magnetic catch-point on wall" mechanic. This changes the core recovery gameplay loop described in GDD §6.

---

### 1.2 FallFloor — Contradicts Approved Spike Verdict

**File:** `src/simulation/entities/FallFloor.ts`

The M0.5 spike verdict (rated 5/5) explicitly chose "Relative Height Position Filtering" and **rejected** "Linear Velocity Filtering" because:

> "linear velocity filtering suffers from edge-case tunneling: if a player hits the ball and it loses upward velocity just inside the platform boundary, the platform would instantly become solid, causing the ball to glitch and eject violently."

The implementation uses velocity-based filtering (`ballVel.y <= 0.1`) — the exact approach the spike rejected.

Additionally:
- **Missing 2-second active duration timer** — `FALL_FLOOR_ACTIVE_DURATION_MS = 2000` is defined in constants but never used
- **Collision group values differ from verdict spec** — verdict specifies `0x0001ffff`; implementation uses whatever Rapier defaults to

**Impact:** The tunneling/ejection glitch the spike was designed to prevent can still occur.

---

### 1.3 Nudge Charges — Time-Based Regeneration vs Checkpoint-Only

**File:** `src/simulation/Simulation.ts:241-243`

```typescript
if (this.frameIndex % 180 === 0 && this.playerState.nudgeCharges < 3) {
  this.playerState.nudgeCharges++;
}
```

**Spec says:** GDD §6 — "3 charges per fall reset. Charges refill each time the player reaches a new height checkpoint." TDD §5.3 — "3 charges in PlayerState; refill on checkpoint."

The implementation adds timer-based regeneration every 180 frames (~3 seconds), giving players effectively unlimited nudges over time. The `CheckpointSystem` already restores charges on checkpoint, making this redundant and incorrect.

---

### 1.4 InputBridge — Hardcoded Keys Ignore Remappable Settings

**File:** `src/render/InputBridge.ts`

| Issue | Spec (GDD §6) | Implementation |
|-------|---------------|----------------|
| **Key remapping** | "All actions remappable via the Settings menu" | All key codes hardcoded; never reads from `SettingsSystem.keyBindings` |
| **Anchor key** | `S` / `Down Arrow` | `Shift` / `C` |
| **SettingsSystem not consumed** | Settings affect gameplay | Changing settings has no effect on gameplay |

**Impact:** The entire SettingsSystem keybinding feature is non-functional. Players cannot customize controls.

---

### 1.5 Missing Gamepad Support

**File:** `src/render/InputBridge.ts`

**Spec says:** GDD §6 and TDD §13 both specify gamepad mappings (L2, R2, Left Stick pull, D-Pad).

Zero gamepad code exists anywhere in the codebase. Phaser has a built-in gamepad API (`this.scene.input.gamepad`).

---

### 1.6 SectorTransition — Missing Full-Screen Inversion + Title Card

**File:** `src/render/transitions/SectorTransition.ts`

**Spec says:** GDD §7 — "brief full-screen inversion (white flash on black, then back) and a one-line title card."

**Implementation:** Simple `camera.fadeIn` / `camera.fadeOut` (black fade). No white flash, no color inversion, no title card rendering.

---

### 1.7 WinConditionSystem — Height Check Instead of Sensor Collider

**File:** `src/simulation/systems/WinConditionSystem.ts:17`

**Spec says:** TDD §7.3 — "Monitors the ball's overlap with the Sector exit boundary sensor (campaign mode) or exit/goal block (UGC/Creator mode)."

**Implementation:** `if (ballPos.y >= this.WIN_HEIGHT_METRES)` — hardcoded Y threshold. This triggers even if the ball is horizontally outside the exit area. The exit block from level data is ignored.

Additionally, `WIN_HEIGHT_METRES = 500.0` is hardcoded. For UGC levels with different heights or the Abyss (no ceiling), this system cannot function without modification.

---

### 1.8 Simulation State Mutation in SectorChunkManager

**File:** `src/tower/SectorChunkManager.ts:55`

```typescript
this.simulation.staticBodies = this.simulation.staticBodies.filter(...)
```

**Spec says:** TDD §1 Principle 1 — "Simulation is authoritative. All gameplay state lives in simulation/. No other system may own or mutate game state."

The SectorChunkManager directly mutates the simulation's `staticBodies` array from outside the simulation layer. It should call a method on `Simulation` (e.g., `simulation.removeStaticBody(body)`).

---

## 2. SPEC DEVIATIONS

These issues represent departures from specifications that may be intentional improvements but should be documented and validated.

### 2.1 Physics Timestep: 1/240s vs 1/60s

**File:** `src/simulation/PhysicsWorld.ts:8-9`

**Spec says:** TDD §2, §9 — "Rapier fixed step at 1/60 s"

**Implementation:** Rapier world timestep is `1/240s` with 4 substeps per frame. While the effective simulation rate is 60Hz, Rapier's internal solver operates at 240Hz. This is arguably better for physics accuracy (pinball benefits from substeps) but differs from the authoritative spec.

**Impact:** Replay hash comparisons between configurations using different world timesteps will fail. The spec should be updated to document this design choice.

---

### 2.2 Flipper Motor Parameters

**File:** `src/simulation/entities/Flipper.ts:17-18`

**Spec says:** `docs/spikes/flipper-feel-verdict.md` — Motor Speed: 30.0 rad/s, Max Torque: 3000.0

**Implementation:** Motor speed: 45.0 rad/s (50% higher), velocityDamping: 300.0

The spike verdict rated 30.0 rad/s as 5/5 for feel. The higher value may make flippers feel too fast and reduce the "heavy ball" feel.

---

### 2.3 FlipperStruck Event — Hardcoded Angular Velocity

**File:** `src/simulation/Simulation.ts:182, 193`

```typescript
this.eventBus.emit('FlipperStruck', { side: 'left', angularVelocity: 30.0 });
```

**Spec says:** TDD §6 defines `angularVelocity: number` implying the actual measured velocity.

**Implementation:** Hardcoded to 30.0 / -30.0 instead of reading `flipper.body.angvel()`. Downstream consumers (audio, renderer) receive inaccurate data.

---

### 2.4 Drain Threshold — Arbitrary vs World Boundary

**File:** `src/simulation/Simulation.ts:267`

**Spec says:** TDD §7.2 — "drained only when it falls below the bottom-most boundary of the loaded world chunks"

**Implementation:** `if (pos.y < -1.5)` — hardcoded threshold. For levels with different starting heights or chunk configurations, this could trigger drain prematurely or fail to trigger.

---

### 2.5 NudgeSystem — Vertical Impulse Added

**File:** `src/simulation/systems/NudgeSystem.ts:8`

**Spec says:** TDD §5.3 — `rigidBody.applyImpulse({ x: nudgeForce, y: 0 }, true)` — y component explicitly 0.

**Implementation:** Adds `NUDGE_IMPULSE_Y = 0.8` for "minor vertical lift to break friction." While this may improve feel, it contradicts the spec.

---

### 2.6 ReplayHash — FNV-1a Instead of SHA-256

**File:** `src/replay/ReplayHash.ts`

**Spec says:** TDD §9 — `sha256(`${x},${y}`)`

**Implementation:** Uses FNV-1a hash. Functionally equivalent for local verification and faster, but differs from spec. The `PlayabilityCheck.ts` prepends `sha256:` to an FNV-1a hash, which is misleading.

---

### 2.7 Events.ts — 9 Event Types Instead of 8

**File:** `src/simulation/events.ts:15`

**Spec says:** TDD §6 defines exactly 8 event types.

**Implementation:** Adds `PlungerFired: { force: number }` — a well-typed addition not in the TDD spec. Should be added to TDD §6 or removed.

---

### 2.8 EventBus.ts — Missing Generic Constraint

**File:** `src/simulation/EventBus.ts:1`

**Spec says:** TDD §6 — `export class EventBus<T extends Record<string, object>>`

**Implementation:** Uses bare `T` without constraint. Reduces compile-time type safety.

---

### 2.9 GameSession Missing ReplaySystem Member

**File:** `src/simulation/session/GameSession.ts`

**Spec says:** TDD §3.1 — `class GameSession { simulation, replay, player, world }`

**Implementation:** Has `simulation`, `eventBus`, `player`, `world` but missing `replay: ReplaySystem`.

---

### 2.10 PhaserRenderer — Hardcoded Screen Height

**File:** `src/render/PhaserRenderer.ts` (7 occurrences of `768`)

The Y-axis flip uses hardcoded `768` instead of reading from `this.scene.scale.height`. If the window is resized, rendering breaks.

---

### 2.11 InputBuffer — Unbounded Growth

**File:** `src/core/InputBuffer.ts`

Entries accumulate indefinitely. For a 30-minute session at 60fps, this is ~108,000 entries. The spec says "fixed-step input queue" implying consumed entries should be removed.

---

### 2.12 SectorChunkManager — Load Range Too Small

**File:** `src/tower/SectorChunkManager.ts:20`

**Spec says:** TDD §7.1 — "only the current Sector and the one immediately above are active"

**Implementation:** 40m buffer means only walls within 40m of the ball are loaded. Each sector is ~500m tall, so only a small fraction is active at any time.

---

### 2.13 StorageProvider — Key Prefix Mismatch

**Files:** `src/core/BrowserStorageProvider.ts`, `src/core/ElectronStorageProvider.ts`

`ElectronStorageProvider` uses `pinballzzz_` prefix; `BrowserStorageProvider` uses no prefix. Data saved in Electron won't load in browser and vice versa.

---

### 2.14 GameScene — Hardcoded to Sector 00

**File:** `src/render/scenes/GameScene.ts:15`

```typescript
import sector00 from '../../../levels/campaign/sector_00.json'
```

Does not use `CampaignManager` for multi-sector progression. `CampaignManager` exists but is not integrated. Sector transitions (GDD §7) are not wired.

---

## 3. MISSING FEATURES

These features are specified but not implemented in the completed milestones.

### 3.1 No Pause Functionality

**Spec:** GDD §6 lists Pause as a distinct action (`Esc` / `Start`).

**Implementation:** Escape key returns to menu, not pause. The `InputAction` type includes `'pause'` but it is never processed in `Simulation.step()`.

---

### 3.2 No Anchor Entity Rendering

**File:** `src/render/PhaserRenderer.ts`

The `Anchor` entity exists in simulation but has no visual representation in PhaserRenderer. Players cannot see where their anchors are placed.

---

### 3.3 No Sector Transition Management in WinConditionSystem

**Spec:** TDD §7.3 — "Manages progression flow from Sector to Sector by notifying the Application session of sector clears."

**Implementation:** Only emits `WinConditionMet` event and returns boolean. Does not track which sector was cleared or manage transition flow.

---

### 3.4 No Fall-Scoped Charge Tracking

**Spec:** GDD §6 — "3 charges per fall reset" implies charges are scoped to a fall event.

**Implementation:** `PlayerState` has `nudgeCharges` but no concept of which fall they belong to. Charges are reset on checkpoint AND regenerate over time (Issue 1.3), making "per fall" semantics ambiguous.

---

### 3.5 Missing WorldState Chunk Boundary State

**File:** `src/simulation/session/WorldState.ts`

Only has `activeSectorIndex` and `currentLevelHash`. Missing:
- Active chunk tracking (for drain detection per TDD §7.2)
- Loaded geometry boundaries
- Sector height data

---

### 3.6 AbyssGenerator — Bumper/Flipper Bodies Not Tracked for Cleanup

**File:** `src/simulation/systems/AbyssGenerator.ts:165-173`

Bumper and flipper bodies created via `addBumper()` / `addFlipper()` are not tracked in the chunk's `bodies[]` array. When chunks are unloaded, only wall bodies are removed. Bumper/flipper bodies persist, causing body count to grow unboundedly.

**Impact:** Violates TDD §14 performance target of ≤50 simultaneous rigid bodies. Over time, body count will exceed the 100 hard limit.

---

### 3.7 Missing Chunk Width Constant

**File:** `src/simulation/constants.ts`

`CHUNK_HEIGHT_METRES = 10.0` in constants.ts conflicts with `CHUNK_HEIGHT_M = 100.0` in AbyssGenerator.ts. Different purposes but confusing naming collision.

---

### 3.8 No `levels/sandbox/` Directory

**Spec:** TDD §4 lists `levels/sandbox/` in the project structure.

**Status:** Directory is empty or missing.

---

### 3.9 PlayabilityCheck — Missing `clear_time_s`

**File:** `src/replay/PlayabilityCheck.ts`

**Spec:** TDD §8.4 shows `clear_time_s` in the example playability stamp.

**Implementation:** `clear_time_s` field is defined in `PlayabilityCheckStamp` but never populated.

---

## 4. POTENTIAL TECHNICAL ISSUES

These issues may cause runtime problems under certain conditions.

### 4.1 Bumper Double Impulse

**File:** `src/simulation/entities/Bumper.ts:19-21, 43`

Bumper has `restitution = 1.1` (>1.0), which makes Rapier apply a restitution-based bounce impulse. Then `resolveHit()` adds a manual `pushForce = 8.0` impulse. The ball receives two impulses per frame when touching a bumper, potentially producing excessively bouncy behavior.

---

### 4.2 Bumper Manual Collision Check Can Miss Fast Balls

**File:** `src/simulation/entities/Bumper.ts:29-47`

The `resolveHit()` method checks `dist <= this.radius + ball.radius + 0.05`. If the ball moves fast enough to tunnel past the bumper between frames, the distance check won't trigger. CCD protects against tunneling through thin walls but the manual bumper check does not benefit from CCD.

---

### 4.3 Plunger Sensor Collider Is Dead Code

**File:** `src/simulation/entities/Plunger.ts:24-27`

A sensor collider is created but never used. The `fire()` method uses manual proximity checks instead.

---

### 4.4 CheckpointSystem — Hardcoded Floor X

**File:** `src/simulation/systems/CheckpointSystem.ts:34`

```typescript
const floorX = 10.24; // Canvas center width
```

Fall Floor X position is hardcoded to the center of a 1024px canvas. Should be configurable.

---

### 4.5 Elapsed Time Is Approximate

**File:** `src/simulation/Simulation.ts:220`

```typescript
this.elapsedTimeMs += 16.666; // Approx 1 frame duration at 60fps
```

Hardcoded increment instead of parameter. If actual frame rate varies, elapsed time will be inaccurate. For deterministic replay, this should be tied to the fixed timestep.

---

### 4.6 Ball Radius Not in Constants

**File:** `src/simulation/entities/Ball.ts:7`

Ball radius `0.35` is hardcoded. Should be exported from `constants.ts` for consistency.

---

## 5. TEST INFRASTRUCTURE ISSUES

### 5.1 Replay Runner — No True Parallelism

**File:** `tools/replay-runner/index.ts:117`

**Spec says:** TDD §10, implementation_plan 3.8.1 — "Node's `worker_threads` or `piscina`" for true CPU parallelism.

**Implementation:** Uses `Promise.all` in batches. Since Rapier WASM is CPU-bound, this provides no real parallelism. Replays execute sequentially within a single thread.

---

### 5.2 All 30 Golden Replays Use Sector 00 Only

**Spec says:** TDD §10 — "Stored replays cover: campaign Sectors, Abyss runs, Playability Check examples, and edge cases (multi-Anchor saves, max-speed ball, Fall Floor catch)."

**Implementation:** All 30 replays are variations of sector_00 with different input patterns. No edge cases covered.

---

### 5.3 Memory Test — Wrong Metric

**File:** `tests/perf/memory.test.ts:25, 38`

**Spec says:** TDD §14 — "RSS < 512 MB peak"

**Implementation:** Uses `process.memoryUsage().heapUsed` instead of `process.memoryUsage().rss`. Verifies relative growth, not absolute RSS limit.

---

### 5.4 Chunk Unload Test — Wrong Sector and Threshold

**File:** `tests/perf/chunk-unload.test.ts`

**Spec says:** TDD §14.1 — "Load Sector 5 + Abyss, transition, assert body count drops to baseline (≤ 50)"

**Implementation:** Uses sector_00 only. Asserts body count ≤ 60 (not 50). No sector transition test.

---

### 5.5 Rapier Bump Check — Only Checks One Replay

**File:** `tools/rapier-bump-check.ts:35`

**Spec says:** `docs/rapier-version-bump-protocol.md` — "performs a headless re-simulation of all golden replays"

**Implementation:** Only checks `golden_01.json`. Missing version comparison/reporting.

---

### 5.6 Audio Normalize Script — Missing Features

**File:** `tools/audio/normalize-audio.sh`

Missing per implementation_plan 2.4 and TDD §12:
- Loop-point metadata generation
- .ogg/.mp3 output conversion
- Batch processing for multiple audio layers
- Two-pass loudnorm for consistent results

---

### 5.7 CI/CD — Missing Timeout for Replay Regression

**File:** `.github/workflows/ci.yml`

No timeout configured for the replay-regression job. If a replay hangs, CI runs until the default 6-hour GitHub Actions timeout.

---

### 5.8 Playability Export Test — VERIFIER_BADGE_RULE May Be Dead Code

**File:** `tests/creator/playability-export.test.ts:168-174`

The `VERIFIER_BADGE_RULE` assertion is guarded by `if (result.verified && result.stamp)`. The trivial test level may not pass verification, so the assertion may never execute.

---

## 6. CORRECTLY IMPLEMENTED (Passing Spec)

The following components fully match their specifications:

| Component | Spec Reference | Status |
|-----------|---------------|--------|
| Ball entity (CCD, dynamic body, reset) | TDD §5.1 | ✅ PASS |
| Constants (PIXELS_PER_METRE=50, checkpoint interval, grid) | M0.3 | ✅ PASS |
| EventBus core API (emit/on/off with copy safety) | TDD §6 | ✅ PASS |
| Event payload shapes (all 8 original types) | TDD §6 | ✅ PASS |
| CheckpointSystem (100m intervals, charge restoration) | TDD §7.2 | ✅ PASS |
| NudgeSystem (3 charges check, impulse application) | TDD §5.3 | ✅ PASS |
| Plunger (charge-and-release launch) | TDD | ✅ PASS |
| PhysicsWorld (getBodyCount, createRigidBody) | TDD §5 | ✅ PASS |
| Math.random() prohibition in simulation | TDD §1 | ✅ PASS |
| LevelData types (Format v3) | TDD §8.2 | ✅ PASS |
| BlockRegistry (7 block types, collider shapes) | TDD §8.1 | ✅ PASS |
| serialize.ts (canonical ordering, deterministic) | TDD §8.2 | ✅ PASS |
| migrate.ts (v1→v2→v3 pipeline, safety counter) | TDD §8.3 | ✅ PASS |
| SectorLoader (migrateToLatest before parsing) | TDD §8.3 | ✅ PASS |
| StorageProvider interface | TDD §3.1 | ✅ PASS |
| StorageProviderFactory (environment detection) | TDD §3.1 | ✅ PASS |
| PlayabilityCheck (verifier: "local" stamp) | TDD §8.4 | ✅ PASS |
| simulation.test.ts (flipper response, CCD) | TDD 1.3 | ✅ PASS |
| migrate.test.ts (v1→v3, v2→v3, round-trip) | impl 3.1.6 | ✅ PASS |
| level-load.test.ts (< 100ms, stricter than 250ms limit) | TDD 14.1 | ✅ PASS |

---

## 7. RECOMMENDED PRIORITY ORDER

### Before M3 Kickoff (Critical):
1. Fix FallFloor to use position-based filtering per spike verdict
2. Remove nudge time-based regeneration
3. Wire InputBridge to SettingsSystem for remappable controls
4. Fix SectorChunkManager simulation state mutation
5. Add 2-second active duration to FallFloor

### During M3 (Major):
6. Implement gamepad support in InputBridge
7. Fix SectorTransition to show full-screen inversion + title card
8. Integrate CampaignManager into GameScene for multi-sector progression
9. Add Anchor entity rendering to PhaserRenderer
10. Fix WinConditionSystem to use sensor collider from level data
11. Fix AbyssGenerator body tracking for chunk cleanup
12. Implement true parallelism in replay runner (worker_threads)

### Before M4 Ship (Minor):
13. Update flipper motor parameters to match spike verdict
14. Fix FlipperStruck to read actual angular velocity
15. Fix drain threshold to use world boundaries
16. Add RSS metric to memory test
17. Add edge-case replays (multi-Anchor, max-speed, FallFloor, Abyss, sector transition)
18. Fix rapier-bump-check to test all replays

---

*Report generated by comprehensive audit of PINBALLZZZ implementation against GDD v2.0, TDD v0.6, and Implementation Plan v1.10.*
