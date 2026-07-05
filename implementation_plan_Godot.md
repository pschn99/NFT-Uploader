# PINBALLZZZ — Implementation Plan (Godot 4.x)

Translates [GDD_Godot.md](file:///Users/ps/Dev/NFT-Uploader/GDD_Godot.md) and [TDD_Godot.md](file:///Users/ps/Dev/NFT-Uploader/TDD_Godot.md) into a phased, milestone-driven build plan for the Godot 4 Engine.

---

## Strategic Decision

* **Engine:** Godot Engine 4.x utilizing **GDScript** and native **2D Physics**.
* **Scope Boundary:** Focused entirely on a single-player offline campaign (Sectors 0-5) and an endless procedural Abyss mode.
* **Excluded:** The User Generated Content (UGC) Creator Studio editor, local/server JSON serialization and validations, replay regression frameworks, and online Steam Workshop integrations are **completely removed** to prioritize gameplay feel and layout precision.

---

## Technical Estimates & Sizing Guide

| Size | Range |
| --- | --- |
| **Small (S)** | 1–2 days |
| **Medium (M)** | 3–5 days |
| **Large (L)** | 6–10 days |

*Estimates assume one game developer working full-time. Graphic and audio asset creation is excluded.*

---

## Milestone Dependency Graph

```
M0 (Project Setup & Spikes)
 └─▶ M1 (Core Sandbox & Physics feel)
      └─▶ M2 (Gameplay Mechanics & Hazards)
           └─▶ M3 (Campaign Sectors & Adaptive Audio)
                └─▶ M4 (Polish, Saves & Native Export) ──▶ SHIP!
```

---

## Milestone 0 — Project Setup & Spikes

**Goal:** Establish directories, input mappings, and verify flipper rotation mechanics and coordinate-to-metric scales.

**Estimate:** ~4 days

### 0.1 Project Directory Scaffolding
- `[ ]` **[NEW]** Initialize Godot 4 project directory with standard folder structure:
  * `scenes/` (UI, Ball, Flipper, Anchor, Bumpers, Sectors)
  * `scripts/` (Autoloads, entity logic, manager scripts)
  * `assets/` (Sprites, sounds, fonts)
  * `autoload/` (CampaignManager, AudioSystem, SettingsSystem)
- `[ ]` **[NEW]** Setup project input mappings in project settings for keyboard and gamepad inputs. **(S, 0.5d)**

### 0.2 Flipper Physics Feel Spike (TDD §4.1)
- `[ ]` **[NEW]** Create a temporary sandbox scene `scenes/flipper_spike.tscn` to test flipper kinematics:
  * Verify `RigidBody2D` input response times.
  * Implement sleeping prevention by disabling `can_sleep` or calling `sleeping = false` on input triggers.
  * Verify physical static collider stop limits vs software clamp limits.
  * Measure solenoid velocity acceleration (45.0 rad/s target) and spring return torque feel. **(M, 1.5d)**

### 0.3 Coordinate System & Scaling Spike (TDD §2)
- `[ ]` **[NEW]** Define standard coordinate scalar constant `PIXELS_PER_METER = 100` in a global script.
  * Verify that a 18.25-meter wide play area spans 1825 viewport pixels correctly.
  * Map layout baseline constants (pivots, slope offsets) into the editor grid settings. **(S, 0.5d)**

### 0.4 Audio Stream Setup Spike
- `[ ]` **[NEW]** Build a basic sound player prototype testing dynamic volume modifications to verify latency-free crossfading. **(S, 0.5d)**

### Exit Criteria
- Godot project runs, and imports basic prototype assets.
- Flipper feel spike signed off with immediate physical response.
- Layout constants aligned to editor grid scales.

---

## Milestone 1 — Core Physics Sandbox

**Goal:** Implement dynamic ball physics, basic controls, camera tracking, and a minimal sector run.

**Estimate:** ~5 days

### 1.1 Ball Scene & CCD
- `[ ]` **[NEW]** Setup `Ball.tscn`:
  * Dynamic `RigidBody2D` configuration with custom `PhysicsMaterial` (high bounciness, low friction).
  * Enable Continuous Collision Detection (CCD) to cast shapes or rays.
  * Create a custom Line2D visual trail drawing node tracking the past 8 global coordinate coordinates. **(M, 1.5d)**

### 1.2 Camera Controller
- `[ ]` **[NEW]** Implement `CameraController2D.gd`:
  * Limit horizontal camera scrolling.
  * Follow the ball vertically with dead-zone boundaries and smooth vertical dampening.
  * Handle screen-shake impulse logic triggered via signals. **(S, 1.0d)**

### 1.3 Controls Bridge
- `[ ]` **[NEW]** Implement user inputs mapping to flippers and plunger pulls in `_unhandled_input` loops. **(S, 0.5d)**

### 1.4 Sector 0 Setup
- `[ ]` **[NEW]** Create `scenes/sectors/Sector0.tscn` representing a 50m tutorial layout.
  * Place static boundary walls, symmetrical flippers, and a plunger channel.
  * Verify ball release, shooting, and paddle striking flows. **(M, 1.5d)**

### Exit Criteria
- Playable 50m sandbox scene where the ball can be launched, flipped, and tracked by the camera without physics tunneling.

---

## Milestone 2 — Gameplay Mechanics & Hazards

**Goal:** Implement recovery tools, checkpoints, bumpers, and regression safety boundaries.

**Estimate:** ~7 days

### 2.1 Bumper & Plunger Channels
- `[ ]` **[NEW]** Create standard `Bumper.tscn` (Area2D/StaticBody2D):
  * Trigger immediate rebound velocities when the ball overlaps the boundary.
  * Play visual expansion scaling animations and sound effects.
- `[ ]` **[NEW]** Wire plunger channel release velocities based on holding release duration. **(S, 1.0d)**

### 2.2 Nudge System
- `[ ]` **[NEW]** Create `NudgeSystem.gd`:
  * Track 3 nudge charges (refilled on checkpoints).
  * Apply immediate horizontal impulse force vectors to the ball: `ball.apply_central_impulse(...)`.
  * Emit screen-shake signals to the camera. **(S, 1.0d)**

### 2.3 Anchor Recovery System
- `[ ]` **[NEW]** Create `Anchor.tscn` (Area2D wall catches):
  * Monitor ball overlaps.
  * Catch the ball by setting it to kinematic freeze state for `0.4` seconds.
  * Track charges (max 3 catches per anchor, limit of 2 active anchors in level).
  * Release ball to dynamic state after time limits expire. **(M, 2.0d)**

### 2.4 Fall Floor & Checkpoint Boundaries
- `[ ]` **[NEW]** Create `Checkpoint.tscn` Area2D sensors:
  * Triggered every 100m.
  * Save active checkpoint altitude coordinate and refill nudge/anchor charges.
- `[ ]` **[NEW]** Create `FallFloor.tscn` (StaticBody2D with `one_way_collision = true`):
  * Positioned 10m below newly crossed checkpoints.
  * When the ball descends below the checkpoint altitude, activate the floor's collision shape for exactly `2.0` seconds before disabling collision layer masks. **(M, 2.0d)**

### 2.5 Respawn Orchestration
- `[ ]` **[MODIFY]** Update `GameSession.gd` to monitor ball coordinate falls:
  * When the ball drains below the active sector boundary, pause the game for `0.8` seconds, reset ball velocity vectors, and respawn the ball at the last active checkpoint altitude. **(S, 0.5d)**

### Exit Criteria
- Playable sandbox demonstrating bumpers, anchor catches, nudge controls, checkpoint height saving, and fall floor captures.

---

## Milestone 3 — Campaign Sectors & Adaptive Audio

**Goal:** Implement Campaign Sectors 0-5, endless procedural Abyss mode, and adaptive sound systems.

**Estimate:** ~9 days

### 3.1 authored Sectors (0 to 5)
- `[ ]` **[NEW]** Design and build Godot scenes for all 6 campaign sectors:
  * `Sector0_Lobby.tscn` (Tutorial, basic bumpers/plungers)
  * `Sector1_Shaft.tscn` (Narrow spaces, wall-bounce segments)
  * `Sector2_BumperGarden.tscn` ( bumper chain reactions)
  * `Sector3_PlungerVault.tscn` (Gravity boosters, plunger channels)
  * `Sector4_NegativeSpace.tscn` (Invisible blocks, high-contrast layouts)
  * `Sector5_Storm.tscn` (High velocity, dynamic wind vectors)
- `[ ]` **[NEW]** Implement sector transition triggers (Area2D boundary at 500m height) with screen invert animations and sector card labels. **(L, 5.0d)**

### 3.2 Sector Chunk Manager
- `[ ]` **[NEW]** Build `SectorChunkManager.gd`:
  * Monitor Camera2D position.
  * Load and unload geometry scenes dynamically in a 250m window (using height checks to account for tall boundaries).
  * Ensure active physics bodies do not exceed 50 count. **(M, 1.5d)**

### 3.3 Procedural Abyss (Sector ∞)
- `[ ]` **[NEW]** Build `AbyssGenerator.gd`:
  * Initialize seeded random logic `RandomNumberGenerator`.
  * Procedurally instantiate random block scene chunks every 100m.
  * Automatically unload old chunks trailing below the camera. **(M, 1.5d)**

### 3.4 Adaptive Music System
- `[ ]` **[NEW]** Setup Autoload `AudioSystem.gd`:
  * Loop multi-channel audio tracks in sync.
  * Alter volume profiles based on altitude levels.
  * Instantly mute melody stems (leaving base basslines) on ball fall signals, fading them back on flipper strike signals. **(S, 1.0d)**

### Exit Criteria
- Complete vertical climb flow from Sector 0 to Sector 5.
- Abyss mode activates after clearing Sector 5.
- Music stems react dynamically to elevation and ball drops.

---

## Milestone 4 — Polish, Saves, & Native Export

**Goal:** Progression unlocks, settings configs, and building native executables.

**Estimate:** ~5 days

### 4.1 HUD & UI Menus
- `[ ]` **[NEW]** Build Main Menu (Start, Settings, Exit) and active HUD scene (Height readout, Nudge/Anchor charge meters, Skin customizer). **(M, 1.5d)**

### 4.2 Save & Settings System
- `[ ]` **[NEW]** Build `SettingsSystem.gd` & `CampaignManager.gd` Autoloads:
  * Write user preferences (keys, sound volumes) to `user://settings.cfg`.
  * Track campaign progress and high scores to `user://save_data.cfg`. **(M, 1.5d)**

### 4.3 Customization & Polish
- `[ ]` **[NEW]** Add ball customization unlocks (skins, trail variants) triggered on campaign progression clears. **(S, 1.0d)**

### 4.4 Build Export & Verification
- `[ ]` **[NEW]** Setup Godot desktop export presets for Windows, macOS, and Linux.
  * Trigger native compilation scripts.
  * Complete a full local run to verify stability. **(S, 1.0d)**

### Exit Criteria
- Finished native executable builds for targeted operating systems.
- Offline save progression and key configuration persistent across game boots.
- Smooth execution without memory or body leaks.
