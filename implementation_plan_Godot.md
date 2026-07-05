# PINBALLZZZ — Implementation Plan (Godot 4.x)

Translates [GDD_Godot.md](file:///Users/ps/Dev/NFT-Uploader/GDD_Godot.md) and [TDD_Godot.md](file:///Users/ps/Dev/NFT-Uploader/TDD_Godot.md) into a phased, milestone-driven build plan for the Godot 4 Engine.

---

## Strategic Decision

* **Engine:** Godot Engine 4.x utilizing **GDScript** and native **2D Physics**.
* **Scope Boundary:** Focused entirely on a single-table arcade pinball game with persistent local high scores.
* **Excluded:** Vertical climbing mechanics, camera vertical scrolling, checkpoints, anchors, fall floors, procedural Abyss modes, dynamic chunk managers, and multi-track adaptive sound mixes are **completely removed** to prioritize a classic, highly-polished single-table pinball experience.

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
 └─▶ M1 (Core Physics & UI Sandbox)
      └─▶ M2 (Table Elements & Game Loop)
           └─▶ M3 (Playtesting, Tuning & Export) ──▶ SHIP!
```

---

## Milestone 0 — Project Setup & Spikes

**Goal:** Establish directories, configure physics settings, and verify programmatic flipper and plunger mechanics.

**Estimate:** ~3.5 days

### 0.1 Project Initialization & Settings
- `[ ]` **[NEW]** Initialize Godot 4 project directory with standard folder structure:
  * `scenes/` (HUD, Ball, Flipper, Bumper, Table)
  * `scripts/` (Autoloads, entity script controllers)
  * `assets/` (Sprites, sounds, fonts)
- `[ ]` **[NEW]** Setup project input mappings in project settings for keyboard and gamepad inputs.
- `[ ]` **[NEW]** Configure explicit physics parameters in `project.godot`:
  * `physics/common/physics_ticks_per_second = 240`
  * `physics/common/max_physics_steps_per_frame = 8`
  * `physics/2d/run_on_separate_thread = true` **(S, 0.5d)**

### 0.2 Flipper Kinematics Spike (TDD §4.1)
- `[ ]` **[NEW]** Create a sandbox scene `scenes/flipper_spike.tscn` to test flipper feel:
  * Implement `AnimatableBody2D` programmatically driven inside `_physics_process`.
  * Validate limits clamping and verify realistic collision bounce impulses transferred to dynamic test bodies.
  * Measure solenoid velocity acceleration feel (constant rotation speed target). **(M, 1.5d)**

### 0.3 Plunger Spring Curve Spike (TDD §4.3)
- `[ ]` **[NEW]** Create a sandbox scene `scenes/plunger_spike.tscn` to test plunger spring compression:
  * Implement a hold-duration charge timer.
  * Calculate release velocity using a quadratic spring compression curve.
  * Apply launch impulses vertically upward to check ball launch consistency. **(S, 1.0d)**

### 0.4 Simple Audio setup
- `[ ]` **[NEW]** Test low-latency retro sound player nodes playing on impact signals. **(S, 0.5d)**

### Exit Criteria
- Godot project runs, and imports basic sprites/sounds.
- Flipper and plunger sandbox mechanics verify satisfying kinetic impulses.

---

## Milestone 1 — Core Physics & UI Sandbox

**Goal:** Implement the dynamic ball, flippers with input buffering, plunger launch curve, static camera shake, and basic score HUD overlay.

**Estimate:** ~5 days

### 1.1 Dynamic Ball Setup
- `[ ]` **[NEW]** Setup `Ball.tscn`:
  * Dynamic `RigidBody2D` with custom `PhysicsMaterial` (high bounciness, low friction).
  * Enable Continuous Collision Detection (CCD - ray/shape casting).
  * Add a simple `Line2D` visual trail tracking ball coordinates over the past 16 frames for visual smoothness at high speeds. **(M, 1.5d)**

### 1.2 Buffered Flippers
- `[ ]` **[NEW]** Setup `Flipper.tscn` using `AnimatableBody2D`:
  * Programmatic rotation limits clamping in `_physics_process`.
  * Implement the flipper anti-ghosting input latching buffer in GDScript (capturing sub-tick presses in `_unhandled_input` and enforcing a 5-physics-tick minimum swing duration). **(M, 1.5d)**

### 1.3 Plunger Launcher
- `[ ]` **[NEW]** Implement plunger Area2D lane launcher mapping hold time to launch velocities. **(S, 0.5d)**

### 1.4 Active Score HUD
- `[ ]` **[NEW]** Build CanvasLayer HUD overlay showing current points score, multiplier banners, and remaining balls remaining tracker (starts at 3). **(S, 1.0d)**

### 1.5 Camera Setup & Trauma Shake
- `[ ]` **[NEW]** Configure static `Camera2D` viewport properties (fixed position center, smoothing disabled, drag margins at 0) and implement trauma-based offset camera shake logic inside `GameSession` triggered by impact and nudge signals. **(S, 0.5d)**

### Exit Criteria
- A playable canvas where the player can launch a ball, strike it with buffered flippers, and see points and remaining ball indicators update on the HUD.

---

## Milestone 2 — Table Elements & Game Loop

**Goal:** Complete the table layout, bumpers, slingshots, ramps, nudge/tilt mechanics, save configurations, game state transitions, and audio.

**Estimate:** ~5 days

### 2.1 Table Construction
- `[ ]` **[NEW]** Design and lay out static borders and ramps in `Table.tscn`:
  * Place static outer walls, plunger lane separators, and flipper pivots.
  * Map collision layers (Ball on Layer 1, Walls on Layer 2, Flippers on Layer 3). **(M, 1.5d)**

### 2.2 Bumpers, Slingshots & Drain
- `[ ]` **[NEW]** Setup `Bumper.tscn` and Slingshots:
  * Program rebound impulses on ball collisions.
  * Emit score signals to the HUD.
- `[ ]` **[NEW]** Implement the `DrainArea` Area2D sensor:
  * Detect ball entry, deduct one ball count, reset the ball at the plunger, and trigger Game Over events when ball count reaches 0. **(M, 1.5d)**

### 2.3 Nudge & Tilt System
- `[ ]` **[NEW]** Implement lateral table nudging:
  * Apply direct horizontal impulse force to the ball rigid body.
  * Add nudge count tracking and decay rates.
  * If nudge count exceeds maximum limit, trigger the **TILT** state (temporarily disable flipper inputs, play screen alert). **(S, 0.5d)**

### 2.4 Scores Saving & Sound
- `[ ]` **[NEW]** Setup `ScoreManager.gd` Autoload to save/load the top 5 local high scores using `ConfigFile` (`user://leaderboard.cfg`) with version prefix checking.
- `[ ]` **[NEW]** Build `SoundController.gd` Autoload playing back chiptune loops and bounce SFX triggered by signals. **(S, 1.0d)**

### 2.5 Game State Machine
- `[ ]` **[NEW]** Implement the core `GameState` enum machine inside `GameSession` (transitions for MENU, PLAYING, TILT, DRAINED, and GAME_OVER states), controlling flipper/plunger active input windows and HUD visual state updates. **(S, 0.5d)**

### Exit Criteria
- Complete pinball table cycle from launch, playing bumpers/slingshots/ramps, score accumulation, nudging, tilt disables, ball drains, and game over loops.

---

## Milestone 3 — Playtesting, Tuning & Native Export

**Goal:** Tune physics parameters, balance scoring structures, and export native target builds.

**Estimate:** ~3.5 days

### 3.1 Empirical Tuning & Calibration
- `[ ]` **[MODIFY]** Conduct focused playtesting sessions to calibrate physical parameters:
  * Tune ball gravity, plunger maximum launch velocity, flipper rotation velocity, slingshot bounce impulse, and bumper rebound forces to maximize kinetic fun.
  * Balance score points mapping (e.g. ramp completions vs bumper hits).
  * Fine-tune nudge impulses and tilt thresholds to make recovery rewarding but risky. **(M, 1.5d)**

### 3.2 Leaderboard Submission UI & Menus
- `[ ]` **[NEW]** Build a simple Start Menu with High Scores listing and an Initials Input screen (e.g. "AAA") on earning a leaderboard record. **(S, 1.0d)**

### 3.3 Platform Exports
- `[ ]` **[NEW]** Configure Godot export templates for Windows, macOS, and Linux targets. Compile standalone executables. **(S, 1.0d)**

### Exit Criteria
- Fully balanced, playable, standalone pinball game exported as a native executable.
- Local leaderboard saves names and scores persistent across application restarts.
