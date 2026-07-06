# Pinballzzz Project Design Rules & Guidelines (Godot 4.x)

This document outlines the authoritative constraints and gotchas that coding agents MUST follow when implementing the Godot 4 transition of the Pinballzzz arcade game.

---

## 1. Physics Settings & Solver Constraints

* **Physics rate override:** Set `physics/common/physics_ticks_per_second = 240` and `physics/common/max_physics_steps_per_frame = 8` in `project.godot`. A hardware fallback configuration of `120` or `180` Hz is permitted on low-power devices, provided CCD is enabled.
* **Physics thread safety:** `physics/2d/run_on_separate_thread` is configured to `true` by default, but fallback to `false` if platform-specific macOS/Linux GPU driver desyncs occur during QA.
* **Continuous Collision Detection (CCD):** Enable shape/ray cast CCD on the `RigidBody2D` ball.

---

## 2. Programmatic Kinematic Flippers

* **No Physics Joints:** Do not use `PinJoint2D` or physical constraints. Flippers must be programmatically rotated `AnimatableBody2D` nodes inside `_physics_process`.
* **Clamping:** Hard-clamp rotation limits in script, setting `angular_velocity` to `0` when limits are reached.
* **Kinematics:** Active swing velocity target is `40.0` rad/s (solenoid sweep). Release damping should return the paddle quickly to rest.
* **Anti-Ghosting Buffer:** Capture presses in `_unhandled_input(event)`, set latch `pending_strike = true`, clear latch in `_physics_process`, and enforce a minimum Active Swing duration of exactly `6` physics ticks (25ms) before accepting release inputs.

---

## 3. Scale, Coordinates & Viewport

* **Coordinate Scale:** `1 meter = 100 pixels` (`const PIXELS_PER_METER = 100.0`).
* **Table Boundaries:** `2000` px wide by `3000` px high.
* **Camera2D Setup:** Fixed viewport center `Vector2(1000, 1500)` with `zoom = Vector2(0.5, 0.5)` to fit a `1000×1500` px game viewport (scaled to `600×900` px default window). Drag margins set to 0. Viewport shake maps to `Camera2D.offset` trauma damping.
* **Symmetry Constants:**
  * Play Area Width: `1800` px. Plunger Lane Width: `200` px. Center Line: `900` px.
  * Left Pivot: `x = 680` px. Right Pivot: `x = 1120` px. Flipper Gap: `120` px.
  * Slopes: Left slope spans `0` to `680` px. Right slope spans `1120` to `1800` px.
  * Vertical Offset: Slope centers are exactly `150` px higher than the flipper pivots baseline.

---

## 4. UI processing & Audio Fallbacks

* **HUD processing mode:** HUD overlay node (`HUD.tscn`) must have `process_mode = PROCESS_MODE_ALWAYS` so scores/animations render cleanly when the game loop pauses.
* **Pause overlays:** The Pause menu (`PauseMenu.tscn`) must have `process_mode = PROCESS_MODE_WHEN_PAUSED`.
* **Audio fallbacks:** Positional SFX streams (.wav) and global BGM (.ogg) must verify path validity (using `FileAccess`) before loading. If resources are missing, fallback gracefully to silence without crashing.

---

## 5. ConfigFile Persistence & First-Launch

* **Leaderboard Config:** Saved to `user://leaderboard.cfg`.
* **Settings Config:** Custom bindings and volumes saved to `user://settings.cfg`.
* **First-Launch Guard:** Always check `file_exists()` on boot. If config files are missing, initialize local directories with default placeholder scores (e.g. 5000, 4000, 3000, 2000, 1000) and standard keybindings to prevent application crashes.
* **Version control:** Keep header version prefix `const SAVE_VERSION = 1` for migrations.
