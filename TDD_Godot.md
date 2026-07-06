# PINBALLZZZ — Technical Design Document (Godot 4.x)

**Technical Design Document v4.0**

**Status:** Ready for production — Simplified single-table technical baseline locked
**Last updated:** 2026-07-05

---

## 1. Architectural Principles

These principles govern every system, node configuration, and script in this project:

1. **Static Table Hierarchy.** The table layout is loaded as a single persistent scene (`Table.tscn`). There are no dynamic loaders, chunk managers, or vertical scrolling cameras.
2. **Decoupled System Interactions.** Nodes communicate downward through direct calls/properties, and upward/laterally using Godot **Signals**. Direct cyclic dependencies are strictly prohibited.
3. **Audio & UI are Observers.** UI (HUD) and Audio systems subscribe to signals emitted by the physics/gameplay nodes; they never drive or mutate gameplay state.
4. **Physically Stable Timestep.** Physics configurations are tuned for 240Hz update frequencies to prevent high-speed tunneling and coordinate jitter.
5. **Clean Data Model.** All game data (key configurations, persistent high scores) are stored locally on disk using Godot's built-in `ConfigFile` format.

---

## 2. Technology Stack & Configuration

| Decision | Choice | Rationale |
|---|---|---|
| **Game Engine** | Godot Engine 4.x | Lightweight footprint, instant compile/load times, clean 2D physics system. |
| **Scripting Language** | GDScript | Highly integrated, native to Godot scene lifecycle, rapid iteration times. |
| **Physics Engine** | Godot Built-in 2D Physics | Deprecates old Rapier joint/sleep rules in favor of programmatic `AnimatableBody2D` flippers (no joints or solver sleep). |
| **Target Framerate** | VSync enabled / 60+ Hz | Smooth rendering with physics substepping. |
| **Physics Tick Rate** | 240 Hz | Set to `240` to prevent collision tunneling of fast-moving balls. |
| **Platform Target** | Windows, macOS, Linux | Native desktop executables. |
| **Data Storage** | ConfigFile (native helper) | Simple, native local key-value store for progress, options, and keybindings. |

### 2.1 Physics Engine Configuration Settings (`project.godot`)

To guarantee physics solver precision and prevent collision issues, the following configurations must be explicitly configured. While 240 Hz is the standard target, developers can scale the rate down to 180 Hz or 120 Hz for lower-power devices (mobile/web builds), provided that Continuous Collision Detection (CCD) is kept enabled.

*Note: Running 2D physics on a separate thread can cause sporadic physics desyncs on macOS/Linux with certain GPU drivers. If desync issues arise during QA, set `run_on_separate_thread = false`.*

```ini
[physics]
common/physics_ticks_per_second = 240      ; Target rate for substepping (fallback to 120 or 180 if needed)
common/max_physics_steps_per_frame = 8     ; Cap physics loop iterations to prevent execution death spiral
2d/run_on_separate_thread = true           ; Decouple physics step processing from rendering loops (fallback to false if desyncs occur)
```

### 2.2 Measurement Units & Pixel-to-Meter Scaling

Godot's 2D engine computes physics and positions in **Pixels**, while our design layout constants are defined in **Meters**. To reconcile this, we establish a rigid scaling factor of **100 pixels = 1 meter**:

```gdscript
const PIXELS_PER_METER = 100.0
```

This constant maps all physical layout boundaries and kinematic values into Godot's pixel coordinate space:

* **Table Dimensions & Layout:**
  * **Total Table Dimensions:** `20.0m` width by `30.0m` height = `2000` × `3000` pixels (composed of a `18.0m` play area, a `2.0m` plunger lane on the far right, and a unified table height).
  * **Play Area Center line:** Exactly `9.0m` = `900` pixels.
  * **Left Flipper Pivot:** `x = 6.8m` = `680` pixels.
  * **Right Flipper Pivot:** `x = 11.2m` = `1120` pixels.
  * **Flipper length:** `1.6m` = `160` pixels each.
  * **Flipper Gap:** Exactly `1.2m` = `120` pixels.
  * **Left Slope:** Spans `0` to `680` pixels (`x = 340` px center, `340` px half-width).
  * **Right Slope:** Spans `1120` to `1800` pixels (`x = 1460` px center, `340` px half-width).
  * **Vertical Offset:** Slope Y is positioned exactly `150` pixels higher than the flipper pivot baseline (e.g. if Flipper Y is `800` px, Slope Y is `650` px).

* **Physics Forces & Velocities:**
  * **Standard Gravity:** `9.8` m/s² scales by `100` to `980` pixels/s² (which maps directly to Godot's default `980` gravity setting).
  * **Plunger Launch Velocity:** Standard launch velocities ranging from `3.0` m/s to `20.0` m/s are multiplied by `PIXELS_PER_METER`, translating to `300` to `2000` pixels/second.

---

## 3. Architecture & Scene Hierarchy

### 3.1 Scene Tree

```
root (SceneTree)
├── Autoload: ScoreManager (tracks active points, high scores)
├── Autoload: SoundController (sfx/chiptune player)
└── MainScene (handles start menu, game session lifecycle)
    └── GameSession (active run container)
        ├── Table (Table.tscn layout scene)
        │   ├── OuterWalls (StaticBody2D)
        │   ├── FlipperLeft (AnimatableBody2D)
        │   ├── FlipperRight (AnimatableBody2D)
        │   ├── PlungerZone (Node2D/Area2D)
        │   ├── BumperField (StaticBody2D array)
        │   ├── Slingshots (StaticBody2D array)
        │   ├── RampsAndLanes (StaticBody2D/Area2D gates)
        │   ├── DrainArea (Area2D)
        │   └── Ball (RigidBody2D)
        ├── Camera2D (fixed viewport center, smoothing = 0, offset shake offsets)
        └── HUD (CanvasLayer - score display, balls remaining, game over overlay)
```

### 3.2 Key System Roles

* **MainScene:** Boot controller. Handles loading menus, managing game sessions, and displaying the local leaderboard.
* **GameSession:** Spawns when a play session begins. Manages the active play cycles, tracks active ball stocks, and handles reset/gameover state transitions.
* **Ball (RigidBody2D):** Dynamic ball entity. Emits a visual trail using a simple trailing `Line2D` node that tracks recent global coordinate histories.
* **Camera2D Setup:**

* **Node Type:** `Camera2D` attached to the `GameSession` node.
* **Framing Target:**
  * **Viewport Size:** `1000` × `1500` pixels.
  * **Default Window Size:** `600` × `900` pixels (allows scaled down windowing).
  * **Position:** Fixed at the center coordinates `Vector2(1000, 1500)`.
  * **Zoom:** Set to `Vector2(0.5, 0.5)`. This scales the `2000` × `3000` pixel table down by half to fit the viewport dimensions cleanly.
* **Properties:**
  * `position_smoothing_enabled = false`
  * `drag` margins set to `0`
* **Trauma Shake:** Screen shake is driven by a trauma model. Impact and nudge signals add a trauma decimal value between `0.0` and `1.0`. In `_process(delta)`, trauma decays linearly. The camera offset is set by applying a random rotation and directional offset using noise (e.g. `FastNoiseLite`) scaled by `trauma^2` applied directly to `Camera2D.offset` (damped inside `_process`).
* **ScoreManager (Autoload):** Manages current run score, multiplier triggers, and persists high scores to disk.
* **SoundController (Autoload):** Manages simple looping retro synthesizer backtracks and plays impact SFX on signal triggers.

### 3.3 Game State Management

Gameplay execution flow is managed within `GameSession` using a clean state machine pattern. Flipper/plunger inputs, collision responses, and UI renders behave differently based on the active `GameState` state:

```gdscript
enum GameState {
    MENU,       # Table inputs disabled. HUD displays local high scores. Plunger lane empty.
    PLAYING,    # Standard active play. Flippers, nudges, plunger, and score managers active.
    PAUSED,     # Gameplay paused. Physics processing halted; Pause Menu Overlay visible.
    TILT,       # Nudge limit exceeded. Flipper inputs disabled; flippers drop limply; scoring disabled.
    DRAINED,    # Ball has entered the drain sensor. Input and score tracking paused; decrements ball count.
    GAME_OVER   # All balls lost. Displays initials entry overlay if a new high score is achieved.
}
```

#### State Transition Rules:
1. **Boot/Initial:** Sets state to `MENU`.
2. **Start Clicked:** Transitions from `MENU` to `PLAYING`. Spawns the first ball (1 of 3) in the plunger pocket.
3. **Nudge limit Exceeded (Tilt):** Transitions from `PLAYING` to `TILT`. Disables flippers, plays Tilt warnings, and holds state for 2.0 seconds or until the ball drains.
4. **Tilt Recovery Timeout:** Transitions from `TILT` to `PLAYING` (if ball did not drain).
5. **Ball Overlaps Drain:** Transitions from `PLAYING` (or `TILT`) to `DRAINED`. Decrements active ball count.
6. **Ball Respawn:** Transitions from `DRAINED` to `PLAYING` (if remaining balls > 0) after instantiating a fresh ball in the plunger pocket.
7. **No Balls Remaining:** Transitions from `DRAINED` to `GAME_OVER` (if remaining balls == 0). Displays the high score registration overlay.
8. **High Score Confirmed / Exit:** Transitions from `GAME_OVER` back to `MENU`.
9. **Pause Input Toggle (Esc/Start):** Transitions from `PLAYING` to `PAUSED` (setting `GetTree().paused = true` and opening the Pause Overlay), or transitions from `PAUSED` to `PLAYING` (setting `GetTree().paused = false` and closing the overlay).

### 3.4 Audio Architecture

Positional and global audio streams are routed through Godot's AudioServer bus configuration to ensure low latency and responsive playback:

* **Audio Streams & Formats:**
  * **Positional Sound Effects (SFX):** Loaded as raw `.wav` streams for low-latency hardware execution (e.g. bumper hits, flipper releases).
  * **Background Music (BGM):** Loaded as `.ogg` streams to optimize storage footprints and support clean loop transitions.
* **Audio Buses:**
  * **Master:** Central audio output.
  * **Music** (child of Master): Background track bus. Pausing the game utilizes a low-pass filter effect or volume reduction (`AudioServer.set_bus_volume_db`) on this bus.
  * **SFX** (child of Master): Positional sound effects bus.
* **SoundController (Autoload):**
  * Spawns instances of `AudioStreamPlayer` for music and a pool of `AudioStreamPlayer2D` nodes for 2D spatial collision sounds.
  * Captures signals emitted by physics nodes (`ball_impact`, `bumper_hit`, `table_tilted`) and triggers corresponding sound playback.
  * **Fallback Handling:** If an audio resource is missing or corrupt, the script handles the exception gracefully (using standard error codes and printing warnings) by falling back to a silent state without crashing.

### 3.5 User Interface CanvasLayers

The UI uses independent `CanvasLayer` structures to separate rendering from the physical play scene and manage layered displays:

1. **`HUD` Overlay:**
   * **Node:** `HUD.tscn` (always active under `GameSession`).
   * **UI Elements:** Score label, score multiplier banner, and dynamic ball count indicators.
   * **Processing:** The HUD has its `process_mode` set to `PROCESS_MODE_ALWAYS` to ensure score/balls updates and transitions render cleanly during pause state changes.
2. **`StartMenu` Screen:**
   * **Node:** `StartMenu.tscn` (active under `MainScene` during `MENU` state).
   * **UI Elements:** Game title, Play button, and local Leaderboard list showing top 5 scores.
3. **`InitialsEntry` Screen:**
   * **Node:** `InitialsEntry.tscn` (active under `MainScene` during `GAME_OVER` state when a new high score is achieved).
   * **UI Elements:** Text prompt showing "NEW HIGH SCORE", character cycles (A-Z), and Confirm button.
4. **`PauseMenu` Screen:**
   * **Node:** `PauseMenu.tscn` (active under `GameSession` during `PAUSED` state).
   * **UI Elements:** Pause banner, Resume button, Settings/Keybindings panel, and Exit button.
   * **Processing:** The pause menu has its `process_mode` set to `PROCESS_MODE_WHEN_PAUSED`, allowing it to process button hover and press inputs while the main physics loop is frozen.

---

## 4. Physics & Entity Implementation

### 4.1 Flipper Setup

The flipper is implemented as an `AnimatableBody2D` node (StaticBody2D with physics synchronization enabled). By driving rotation programmatically rather than using joint physics, we ensure a highly deterministic, crisp flipper feel that avoids limits slippage, solver failure, or sagging under gravity at high velocities.

* **Parameters:**
  * `@export var rest_angle_deg: float = 30.0`
  * `@export var stroke_angle_deg: float = -30.0`
  * `@export var flipper_speed: float = 40.0` (rad/s velocity, typical solenoid target velocity; tuned empirically in M3)
* **Limits:**
  Enforced programmatically in the script. When the rotation angle reaches the min/max thresholds (e.g. resting baseline vs. active stroke limits), angular velocity is set to `0.0` and the angle is clamped directly.
* **Kinematics:**
  * **Active Swing:** On active input, rotate the paddle towards the stroke limit at a constant high target velocity (`flipper_speed`) representing solenoid activation.
  * **Resting/Holding:** On release, rotate the paddle back to the resting baseline at a high damping speed.
  * **Physics Interaction:** Godot automatically computes the linear and angular velocities of the `AnimatableBody2D` during `_physics_process`. When the dynamic `RigidBody2D` ball makes contact with the moving paddle, the solver reads these velocities and applies a realistic bounce impulse vector to the ball. Sleeping issues are non-existent since animatable bodies do not undergo physics sleep.
* **Anti-Ghosting Input Buffer:**
  To prevent extremely fast inputs (e.g. key press-and-release occurring in a sub-frame interval) from being swallowed or canceled before they are processed by the physics solver:
  1. An event listener `_unhandled_input(event)` captures flipper press actions and sets a latch state `pending_strike = true`.
  2. In `_physics_process(delta)`:
     * If `pending_strike` is `true`, the flipper initiates the solenoid **Active Swing** immediately, even if the physical key has already been released.
     * The `pending_strike` latch is reset to `false`.
     * The flipper script enforces a minimum active swing duration of `6` physics ticks (exactly 25ms) before it accepts release inputs. This guarantees the paddle sweeps its physical volume and transfers kinetic energy to the ball.

### 4.2 Ball Setup

* Node type: `RigidBody2D`.
* Properties:
  * `continuous_cd` (Continuous Collision Detection) set to `CON_CD_CAST_SHAPE` or `CON_CD_CAST_RAY` to ensure collision checks verify sub-frame movements.
  * Custom `PhysicsMaterial` with high restitution (bounciness) and low friction.
* Visual Trail:
  A `Line2D` node attached to the Ball scene. It records `global_position` inside `_process` and discards indices older than 16 frames (approx. 0.27s at 60fps), generating a smooth, fading 1-bit tail.

### 4.3 Plunger Setup

* Node type: `Node2D` containing a plunger sprite and an `Area2D` overlap sensor situated at the bottom of the plunger lane.
* Properties:
  * `@export var min_launch_speed: float = 3.0`
  * `@export var max_launch_speed: float = 20.0`
  * `@export var max_charge_time: float = 1.0`
* Logic:
  * **Charging:** While the plunger input is pressed and held (and the ball is resting inside the `Area2D`), a timer `hold_time` increments each frame, capped at `max_charge_time`.
  * **Launch Release:** When the input is released, the plunger sprite snaps back instantly. If the ball is inside the sensor, the script computes a vertical release velocity based on a quadratic spring compression curve:
    $$V_{launch} = min\_launch\_speed + (max\_launch\_speed - min\_launch\_speed) \times \left(\frac{hold\_time}{max\_charge\_time}\right)^2$$
  * **Impulse Application:** The velocity vector is assigned directly to the ball:
    ```gdscript
    ball.linear_velocity = Vector2(0, -V_launch)
    ```

### 4.4 Nudge & Tilt System

* Logic:
  * Captures left/right nudge inputs.
  * Applies a direct horizontal impulse to the ball: `ball.apply_central_impulse(Vector2(nudge_impulse, 0))`.
  * Increments a local `tilt_count` integer by 1.
  * Triggers a small camera shake by adding a trauma offset vector to `Camera2D.offset` (damped in `_process`).
  * If `tilt_count` exceeds `@export var max_nudges: int = 3`, transition the table into a **TILT** state: disable flipper inputs immediately for 2 seconds, letting the ball drain.
  * The `tilt_count` decays by 1 every 4 seconds of active play without nudging.

### 4.5 Collision Layers Configuration

The physics world enforces collision interactions using the following dedicated 2D physics layers:

| Layer | Name | Description |
|---|---|---|
| **Layer 1** | Ball | The dynamic ball rigid body. |
| **Layer 2** | Walls | Static boundary boundaries, lanes, and static table guides. |
| **Layer 3** | Flippers | Programmatic animatable body paddles. |
| **Layer 4** | Bumpers | Static body bumper nodes (rebound trigger zones). |
| **Layer 5** | Sensors | Area2D triggers for score triggers, ramp passes, and drain sensors. |

---

## 5. Signals Interface

To keep the game architecture highly decoupled, inter-system events use Godot's built-in **Signals**.

```gdscript
signal ball_impact(position: Vector2, impulse: float)
signal bumper_hit(score_value: int)
signal ramp_completed(multiplier_increment: float)
signal nudge_fired(direction: String)
signal tilt_warning(warning_number: int)
signal table_tilted()
signal ball_drained()
```

---

## 6. Score & Data Persistence

High scores and key configurations are persisted using Godot's `ConfigFile` API to `user://` directories.

* **Leaderboard Path:** `user://leaderboard.cfg`
* **Settings Path:** `user://settings.cfg`
* **First-Launch Guards:**
  The `ScoreManager` and config loading scripts must check `FileAccess.file_exists(path)` on boot. If the config files do not exist (e.g. first-launch), the scripts must initialize the local files with default parameters:
  * **Leaderboard Defaults:** Empty top 5 list initialized with default placeholder scores (e.g., 5000, 4000, 3000, 2000, 1000) and standard initials (e.g., "PBL").
  * **Settings Defaults:** Default controls mappings (Z/Left Arrow, X/Right Arrow, Space, A, D, Esc) and default volume levels set to 80% (0.8).
* **Version Control:**
  All save files are written with a constant version header to allow clean parsing:
  ```gdscript
  const SAVE_VERSION = 1
  ```
  If save structures change in future updates, the `SAVE_VERSION` increments, forcing a format initialization or migration to avoid application crashes.