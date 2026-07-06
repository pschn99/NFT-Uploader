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

**Goal:** Verify programmatic flipper and plunger mechanics in spike sandbox scenes.

**Estimate:** ~1.5 days

### 0.1 Project Verification & Setup
- `[x]` **[NEW]** Verify standard folders structure (`scenes/`, `scripts/`, `assets/`, `autoload/`) and confirm input mappings settings.
- `[x]` **[NEW]** Verify `project.godot` physics parameters are active (240 Hz tick rate, sub-ticks steps cap, 2d thread mode). **(S, 0.2d)**

### 0.2 Flipper Kinematics Spike (TDD §4.1)
- `[x]` **[NEW]** Create a sandbox scene `scenes/flipper_spike.tscn` to test flipper feel:
  * Implement `AnimatableBody2D` programmatically driven inside `_physics_process`.
  * Validate limits clamping and verify realistic collision bounce impulses transferred to dynamic test bodies. **(S, 0.5d)**

### 0.3 Plunger Spring Curve Spike (TDD §4.3)
- `[x]` **[NEW]** Create a sandbox scene `scenes/plunger_spike.tscn` to test plunger spring compression:
  * Implement a hold-duration charge timer and calculate release velocity using a quadratic spring compression curve.
  * Apply launch impulses vertically upward to check ball launch consistency. **(S, 0.5d)**

### 0.4 Simple Audio setup
- `[x]` **[NEW]** Test low-latency retro sound player nodes playing on impact signals. **(S, 0.3d)**

### Exit Criteria
- Godot project runs, and imports basic sprites/sounds.
- Flipper and plunger sandbox mechanics verify satisfying kinetic impulses.

---

**Goal:** Implement the dynamic ball, flippers with input buffering, plunger launch curve, static camera shake, HUD, core UI overlays, and Autoload stubs.

**Estimate:** ~6.8 days

### 1.1 Dynamic Ball Setup
- `[x]` **[NEW]** Setup `Ball.tscn`:
  * Dynamic `RigidBody2D` with custom `PhysicsMaterial` (high bounciness, low friction).
  * Enable Continuous Collision Detection (CCD - ray/shape casting).
  * Add a simple `Line2D` visual trail tracking ball coordinates over the past 16 frames for visual smoothness at high speeds. **(M, 1.5d)**

### 1.2 Buffered Flippers
- `[x]` **[NEW]** Setup `Flipper.tscn` using `AnimatableBody2D`:
  * Programmatic rotation limits clamping in `_physics_process`.
  * Implement the flipper anti-ghosting input latching buffer in GDScript (capturing sub-tick presses in `_unhandled_input` and enforcing a 6-physics-tick minimum swing duration). **(M, 1.5d)**

### 1.3 Plunger Launcher
- `[x]` **[NEW]** Implement plunger Area2D lane launcher mapping hold time to launch velocities. **(S, 0.5d)**

### 1.4 Active Score HUD
- `[x]` **[NEW]** Build CanvasLayer HUD overlay showing current points score, multiplier banners, and remaining balls remaining tracker (starts at 3). **(S, 1.0d)**

### 1.5 UI CanvasLayer Screens
- `[x]` **[NEW]** Build the core menu overlays as CanvasLayer nodes:
  * `StartMenu.tscn`: Render game title, leaderboard table, and Play button.
  * `InitialsEntry.tscn`: Render character cycler (A-Z) and Confirm button.
  * `PauseMenu.tscn`: Render Resume, Settings (Custom Keybindings & Volume), and Exit buttons. Set `process_mode` to `PROCESS_MODE_WHEN_PAUSED`. **(M, 1.5d)**

### 1.6 Camera Setup & Trauma Shake
- `[x]` **[NEW]** Configure static `Camera2D` viewport properties (fixed position center, zoom set to `0.5`, smoothing disabled, drag margins at 0) and implement trauma-based offset camera shake logic inside `GameSession` triggered by impact and nudge signals. **(S, 0.5d)**

### 1.7 Autoload Stubs
- `[x]` **[NEW]** Setup `ScoreManager.gd` and `SoundController.gd` Autoload scripts as stubs registering basic signal routes, placeholder methods, and default states to support early HUD and SFX testing. **(S, 0.3d)**

### Exit Criteria
- A playable canvas where the player can launch a ball, strike it with buffered flippers, pause the game, hear basic synthetic test chimes, and navigate the start, pause, and initials screen flows.

---

## Milestone 2 — Table Elements & Game Loop

**Goal:** Complete the table layout, bumpers, slingshots, ramps, nudge/tilt mechanics, save configurations, game state transitions, pause states, and audio streams.

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

### 2.4 Scores & Settings Storage
- `[ ]` **[MODIFY]** Expand the `ScoreManager.gd` Autoload stub to handle saving/loading high scores (`user://leaderboard.cfg`) and custom settings/keybindings (`user://settings.cfg`), verifying first-launch checks initialize defaults gracefully. **(S, 0.5d)**

### 2.5 SoundController Audio Setup
- `[ ]` **[MODIFY]** Expand the `SoundController.gd` Autoload stub:
  * Configure AudioServer buses (Master, Music, SFX) and wire volume controls.
  * Load Positional SFX streams (.wav) and BGM loops (.ogg), implementing silent fallbacks if files are missing. **(S, 0.5d)**

### 2.6 Game State Machine & Pause Integration
- `[ ]` **[NEW]** Implement the core `GameState` enum machine inside `GameSession` (transitions for MENU, PLAYING, PAUSED, TILT, DRAINED, and GAME_OVER states), controlling flipper/plunger inputs, pausing physics loops (`GetTree().paused`), and toggling UI overlays. **(S, 0.5d)**

### Exit Criteria
- Complete pinball table cycle from launch, playing bumpers/slingshots/ramps, score accumulation, nudging, tilt disables, ball drains, and game over loops.

---

## Milestone 3 — Playtesting, Tuning & Native Export

**Goal:** Tune physics parameters, balance scoring structures, and export native target builds.

**Estimate:** ~2.5 days

### 3.1 Empirical Tuning & Calibration
- `[ ]` **[MODIFY]** Conduct focused playtesting sessions to calibrate physical parameters:
  * Tune ball gravity, plunger maximum launch velocity, flipper rotation velocity, slingshot bounce impulse, and bumper rebound forces to maximize kinetic fun.
  * Balance score points mapping (e.g. ramp completions vs bumper hits).
  * Fine-tune nudge impulses and tilt thresholds to make recovery rewarding but risky. **(M, 1.5d)**

### 3.2 Platform Exports
- `[ ]` **[NEW]** Configure Godot export templates for Windows, macOS, and Linux targets. Compile standalone executables. **(S, 1.0d)**

### Exit Criteria
- Fully balanced, playable, standalone pinball game exported as a native executable.
- Local leaderboard saves names and scores persistent across application restarts.
