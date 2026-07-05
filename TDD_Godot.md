# PINBALLZZZ — Technical Design Document (Godot 4.x)

**Technical Design Document v3.0**

**Status:** Ready for production — Godot 4 architectural specs defined
**Last updated:** 2026-07-05

---

## 1. Architectural Principles

These principles govern every system, node setup, and script in this project:

1. **Scene Tree Structure is Authoritative.** Scenes represent logical boundaries (entities, sectors, menus). Root nodes driver their children.
2. **Decoupled System Interactions.** Nodes communicate downward through direct calls/properties, and upward/laterally using Godot **Signals**. Direct cyclic dependencies are strictly prohibited.
3. **Audio & UI are Observers.** UI (HUD) and Audio (Music/SFX) systems subscribe to signals emitted by the physics/gameplay nodes; they never drive or mutate gameplay state.
4. **Physically Stable Timestep.** Physics configurations are tuned for 240Hz update frequencies to prevent high-speed tunneling and coordinate jitter.
5. **No UGC/Serialization Overhead.** Standard Godot scenes (`.tscn`) and resources (`.tres`) act as level formats. External JSON serialization and migration code is removed.

---

## 2. Technology Stack & Configuration

| Decision | Choice | Rationale |
|---|---|---|
| **Game Engine** | Godot Engine 4.x | Lightweight footprint, instant compile/load times, clean 2D physics system. |
| **Scripting Language** | GDScript | Highly integrated, native to Godot scene lifecycle, rapid iteration times. |
| **Physics Engine** | Godot Built-in 2D Physics | Stable, lightweight solver with native Continuous Collision Detection (CCD). |
| **Target Framerate** | VSync enabled / 60+ Hz | Smooth rendering with physics substepping. |
| **Physics Tick Rate** | 240 Hz | `physics/common/physics_ticks_per_second` set to `240` in `project.godot` to prevent collision tunneling of fast-moving balls. |
| **Platform Target** | Windows, macOS, Linux | Native desktop executables. |
| **Data Storage** | ConfigFile / JSON (via FileAccess) | Simple, native local key-value store for progress, options, and keybindings. |

---

## 3. Architecture Overview

### 3.1 Scene Hierarchy

```
root (SceneTree)
├── Autoload: CampaignManager (campaign progress)
├── Autoload: AudioSystem (music/sfx orchestration)
├── Autoload: SettingsSystem (volume, keys configuration)
└── MainScene (handles boot, main menu, loading scenes)
    └── GameSession (spawned during active gameplay)
        ├── World2D (container for active sectors/chunks)
        │   ├── Sector0 (active layout scene)
        │   └── Ball (RigidBody2D)
        ├── Camera2D (smooth follow and shake)
        └── HUD (CanvasLayer - height, charges, menu overlay)
```

### 3.2 Key Node Roles

* **MainScene:** Boot controller. Handles loading menus, transition animations, and instantiating `GameSession` nodes.
* **GameSession:** Orchestrator of an active gameplay run. Destroys itself on return to menu. Manages player life state (respawns) and sector transitions.
* **Ball (RigidBody2D):** The dynamic physics ball. Emits a visual trail using a custom 2D particle/line renderer that reads local velocity.
* **CampaignManager (Autoload):** Holds high-level state: highest sector unlocked, best clear times. Persists data to user storage.
* **AudioSystem (Autoload):** Dynamically alters music tracks based on the ball's elevation and sector transitions. Plays crunch/impact SFX.

---

## 4. Physics & Entity Implementation

### 4.1 Flipper Setup

The flipper is a `RigidBody2D` pinned to a static anchor using a `PinJoint2D` or rotated programmatically in `_physics_process`.

* **Dynamic Body Sleep (Flipper Unresponsiveness):**
  To prevent the physics solver from putting resting paddles to sleep (which makes inputs feel dead or sluggish), the flipper script must explicitly set `sleeping = false` in `_physics_process` when inputs are received. Alternatively, disable sleeping on the flipper `RigidBody2D` node by setting `can_sleep = false`.
* **Limits:**
  Physical limits are enforced using static colliders (`StaticBody2D`) acting as mechanical stops. This provides natural bounce feedback when paddles hit their boundaries.
* **Kinematics:**
  * **Active Swing:** Apply a high target velocity when key is pressed (e.g., `angular_velocity = 45.0` rad/s, torque scaling to mimic high-current solenoid acceleration).
  * **Resting/Holding:** When key is released, apply a strong spring torque restoring force to drive the paddle back to the resting baseline, keeping it locked to prevent gravity sag.

### 4.2 Ball Setup

* Node type: `RigidBody2D`.
* Properties:
  * `continuous_cd` (Continuous Collision Detection) set to `CON_CD_CAST_SHAPE` or `CON_CD_CAST_RAY` to ensure collision checks verify sub-frame movements.
  * Custom `PhysicsMaterial` with high restitution (bounciness) and low friction.
* Visual Trail:
  A `Line2D` node attached to the Ball scene. It records global coordinates of the ball inside `_process` and discards indices older than 8 frames, generating a fading 1-bit tail.

### 4.3 Anchor Setup

* Node type: `Node2D` with an `Area2D` sensor component.
* Logic:
  * Placed symmetrically on sector walls.
  * When the ball enters the Area2D:
    1. If the Anchor has remaining charges (max 3), the ball's freeze state is activated: `ball.freeze = true` (or custom kinematic capture).
    2. A timer holds the ball for `0.4` seconds.
    3. Emits `anchor_triggered(anchor_id, charges)`.
    4. Upon timeout, `ball.freeze = false` is restored, allowing gravity/flipper forces to act again.
    5. Decrements charge. Refills to 3 only when the player resets at a checkpoint.

### 4.4 Nudge System

* Node type: Scripted system on `GameSession`.
* Logic:
  * Captures left/right nudge inputs (max 3 charges, refilled at checkpoints).
  * Applies a direct horizontal impulse to the ball: `ball.apply_central_impulse(Vector2(nudge_impulse, 0))`.
  * Triggers a small camera shake vector in `CameraController` via signal and emits `nudge_fired`.

### 4.5 Fall Floor

* Node type: `StaticBody2D` with a `CollisionShape2D` (configured with `one_way_collision = true`).
* Logic:
  * Spawns exactly `10` meters below any newly reached checkpoint.
  * When the ball descends past the checkpoint Y coordinate, the collision layer is enabled for exactly `2.0` seconds to catch a falling ball.
  * Once the timeout completes, collisions are disabled, returning the floor to a pass-through state.

---

## 5. Signals Interface

To keep the game architecture highly decoupled, inter-system events use Godot's built-in **Signals**.

```gdscript
# Emitted by gameplay nodes and observed by HUD / AudioSystem
signal ball_impact(position: Vector2, impulse: float)
signal checkpoint_reached(y_pos: float, charges_restored: int)
signal ball_fell(from_y: float)
signal anchor_triggered(anchor_id: String, charges_remaining: int)
signal nudge_fired(direction: String, charges_remaining: int)
signal sector_entered(sector_index: int)
signal win_condition_met(final_position: Vector2, clear_time_ms: float)
signal flipper_struck(side: String, angular_velocity: float)
```

---

## 6. Sector Loading & Chunk Manager

### 6.1 Chunk loading and Tall Boundaries
Giant boundaries and geometry walls spanning vertical sectors must not be unloaded prematurely. The chunk manager tracks camera viewport intersections based on the full height span of each chunk:
```gdscript
# Viewport evaluation logic in SectorChunkManager
var in_range = (chunk.y - chunk.half_height <= max_y) and (chunk.y + chunk.half_height >= min_y)
if in_range and not chunk.is_loaded():
    chunk.load_bodies()
elif not in_range and chunk.is_loaded():
    chunk.unload_bodies()
```
This ensures colliders are active when needed and freed when out of range to keep the overall active physics body count below 50.

### 6.2 Procedural Endless Mode (Abyss)

* Activates after clearing Sector 5.
* `AbyssGenerator` class uses a seeded custom random generator:
  ```gdscript
  var rng = RandomNumberGenerator.new()
  rng.seed = hash(String(global_start_time) + String(player_id))
  ```
* Spawns modular obstacle chunks (assembled from predefined sub-scenes) every 100 meters dynamically, freeing outdated chunks below the viewport buffer to conserve memory.

---

## 7. Sound & Adaptive Music

The `AudioSystem` manages a background music stream container using multiple looping tracks (stems) synchronized on playback.

* **Elevation Track Fading:** Volume properties of stems are crossfaded dynamically in `_process` based on the ball's Y height progression.
* **Fall Dampening:** On receiving the `ball_fell` signal, the high-frequency melodic stems are faded to `0` volume instantly, leaving only a basic low-frequency bassline loop playing to accentuate the tension of height loss. Flipper input signals (`flipper_struck`) gradually restore active stems to full volume.

---

## 8. Save & Settings Persistence

Configuration files are handled natively via Godot's `ConfigFile` class.

* **Save Path:** `user://save_data.cfg`
* **Settings Path:** `user://settings.cfg`
* **Data structures:**
  * Save data tracks unlocked skins/trails and Campaign Sector high scores (best clear times).
  * Settings data tracks audio volumes (Master, SFX, Music) and customized action keys mapped to the input server.