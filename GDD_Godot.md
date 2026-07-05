# PINBALLZZZ — Game Design Document (Godot 4.x)

**Game Design Document v4.0**

**Status:** Ready for production — Simplified single-table arcade pinball target locked
**Last updated:** 2026-07-05

| Category | Decision |
| --- | --- |
| **Genre** | Arcade Pinball Simulation |
| **Target Platform** | PC, Mac, Linux — native Godot desktop export |
| **High Concept** | Stark, fast-paced 1-bit arcade pinball with high-contrast vector design and satisfying kinetic physics. |
| **Elevator Pitch** | Test your reflexes on a single, highly-polished 1-bit arcade pinball table. Launch the ball, hit high-velocity bumpers, slide up ramps, and track your high score local leaderboard. Keep the ball in play—letting it drain costs you one of your 3 balls. |

---

## 1. Design Pillars

| Pillar | Meaning | Design Test |
| --- | --- | --- |
| **Kinetic Physics Feel** | Ball speed, gravity, and paddle strikes must feel natural and satisfying. | Ball bounces off bumpers with crisp kinetic force, and flippers hit the ball with immediate mechanical feedback. |
| **1-Bit Readability** | Visual simplicity allows immediate state reading. | Clean white geometries on a solid black background make the ball, bumpers, and active lanes instantly recognizable. |
| **Score Chasing** | The primary progression loop is earning points. | Every target, bumper hit, and ramp loop increments score counters, driving the player to beat their personal local bests. |

---

## 2. Core Game Loop

```
[Main Menu] ──▶ [Launch Ball (1 of 3)] ──▶ [Active Play: Bumpers / Ramps / Scoring]
      ▲                                                   │
      │                                                   ▼
[Game Over Screen] ◀── [Check High Score] ◀── [Ball Drains (Losing a Ball)]
```

1. **Launch:** Pull back the mechanical plunger to shoot the ball into the table.
2. **Active Play:** Use the left and right flippers to hit bumpers, trigger slingshots, complete lane sequences, and loop ramps to accumulate score points.
3. **Save/Nudge:** Nudge the table laterally if the ball gets too close to the drain pocket, risking a Tilt penalty if nudged too aggressively.
4. **Drain:** Let the ball fall past the baseline flippers into the drain. This costs 1 ball.
5. **Game Over:** After losing all 3 balls, if the final score exceeds any high score on the local leaderboard, the player can enter their initials to save their record.

---

## 3. The Table Layout

The game features a single, carefully tuned pinball table layout divided into distinct vertical zones:

* **Plunger Lane:** The launcher channel on the far right of the table where the ball sits at start-of-play. A one-way gate prevents the ball from returning to this lane once it enters the main table.
* **Baseline Flippers:** Symmetrical left and right flipper paddles positioned at the bottom center to guard the drain opening.
* **Slingshots:** Triangles positioned directly above the flippers that kick the ball away with lateral velocity when struck.
* **Bumper Field:** A dense cluster of round active bumpers in the upper half of the table, causing rapid chain-reaction rebounds when hit.
* **Lanes & Ramps:** Guided steel loops at the top of the table. Successfully guiding the ball up a ramp returns it safely to the inlanes and grants high score multipliers.
* **Drain Pocket:** The failure boundary below the flippers. Falling here resets the ball at the plunger and decrements the active ball count.

### 3.1 Layout and Symmetry Constants

To make coordinate calculations and vector math straightforward, the table layout is designed using round numbers mapped under the `100 pixels = 1 meter` scale:

* **Total Table Dimensions:** `20.0m` width by `30.0m` height = `2000` × `3000` pixels (composed of a `18.0m` play area width, a `2.0m` plunger lane width on the far right, and a unified table height).
* **Play Area Center line:** Exactly `9.0m` = `900` pixels.
* **Flipper Pivots:** Symmetrical placement flanking the center line:
  * **Left Flipper Pivot:** `x = 6.8m` = `680` pixels.
  * **Right Flipper Pivot:** `x = 11.2m` = `1120` pixels.
  * **Flipper length:** `1.6m` = `160` pixels each.
  * **Flipper Gap:** Exactly `1.2m` = `120` pixels (leaves space between paddle tips at rest).
* **Funnel Slopes:** Positioned flush to the flipper pivots to prevent ball traps:
  * **Left Slope:** Spans `x = 0.0m` to `6.8m` (pixels `0` to `680`). Center: `3.4m` (`340` px), half-width `3.4m` (`340` px).
  * **Right Slope:** Spans `x = 11.2m` to `18.0m` (pixels `1120` to `1800`). Center: `14.6m` (`1460` px), half-width `3.4m` (`340` px).
  * **Vertical Offset:** Slope centers are set exactly `1.5m` (`150` pixels) higher than the flipper pivot baseline (e.g., if Flipper Y is `800` px, Slope Y is `650` px).

---

## 4. Physics & Mechanics

### Feel Targets

* **The Ball:** Dynamic sphere responsive to gravity and bumper impulse triggers. Uses Continuous Collision Detection (CCD) to prevent high-velocity tunneling through flippers.
* **Flippers:** Crisp, solenoid-like activation. Swing acceleration must feel heavy and mechanical, with programmatic stops ensuring zero sagging.
* **Plunger:** A spring-loaded launcher. Holding the plunger key retracts the spring. Releasing applies a vertical force scaling non-linearly with compression time, allowing the player to target specific entry lanes.
* **Nudge & Tilt:** The player can nudge the table left or right. This applies a micro-impulse force to the ball to alter its trajectory. However, each nudge increments a hidden Tilt counter. Exceeding the threshold of 3 nudges triggers a **TILT** state, which immediately disables the flippers (causing them to drop down limply) for 2 seconds (or until the ball drains), displays a flashing 'TILT' warning on the HUD, and negates any scoring. The tilt counter decays dynamically during clean play (1 charge per 4 seconds of play without nudges).

---

## 5. Scoring Balance Settings

Points are awarded dynamically for striking targets or completing lanes:

| Action / Target | Points | Description |
| --- | --- | --- |
| **Bumper Hit** | 100 | Active round bumpers in the upper field. |
| **Slingshot Hit** | 50 | Triangle kickers positioned directly above the flippers. |
| **Ramp Completed** | 500 | Guiding the ball up the steel loop guide ramps. Completing a ramp also increments the active score multiplier by 1x (e.g., 1x -> 2x) for subsequent hits until the ball drains. |
| **Rollover Lane** | 200 | Directing the ball down the top lane channels. |
| **Ball Saved (Nudge)** | 25 | Applying a successful nudge impulse when the ball is within the drain zone. |
| **TILT Penalty** | 0 | Negates all points scored during an active tilted state. |

---

## 6. Visual Direction: 1-Bit Arcade

* **Background:** Solid black (`#000000`).
* **Geometry & Walls:** Stark, clean white outlines (`#FFFFFF`) with uniform thicknesses.
* **Ball Trail:** Visual trail recording position vector histories (16 frames length for visual smoothness) to convey trajectory and speed.
* **HUD Overlay:** Renders active Score, Balls Remaining (3/2/1), and a High Score banner at the top of the viewport in a clean retro pixel-art font.

---

## 7. Controls

### 7.1 Gameplay Mapping

| Action | Keyboard | Gamepad |
|---|---|---|
| Flipper Left | `Z` / `Left Arrow` | `L1` / `L2` |
| Flipper Right | `X` / `Right Arrow` | `R1` / `R2` |
| Plunger (hold/release) | `Space` | `Left Stick` (pull down + release) |
| Nudge Left | `A` | `D-Pad Left` |
| Nudge Right | `D` | `D-Pad Right` |
| Pause / Menu | `Esc` | `Start` |

### 7.2 Initials Entry Mapping (High Score Screen)

| Action | Keyboard | Gamepad |
|---|---|---|
| Cycle Character (A-Z) | `Up Arrow` / `Down Arrow` | `D-Pad Up` / `D-Pad Down` |
| Move Character Cursor | `Left Arrow` / `Right Arrow` | `D-Pad Left` / `D-Pad Right` |
| Confirm Selection | `Space` / `Enter` | `Button Bottom` (A/Cross) |

---

## 8. Progression & Storage

* **High Scores:** Tracks and saves local top 5 high scores (Score, Date, Initials).
* **Save Location:** Persistent ConfigFile written directly to disk.