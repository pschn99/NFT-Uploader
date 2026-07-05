# PINBALLZZZ — Game Design Document (Godot 4.x)

**Game Design Document v3.0**

**Status:** Ready for production — Focused Godot 4 campaign target defined
**Last updated:** 2026-07-05

| Category | Decision |
| --- | --- |
| **Genre** | Physics precision platformer / vertical pinball |
| **Target Platform** | PC, Mac, Linux — native Godot desktop export |
| **High Concept** | *Downwell* aesthetics meet *Jump King* climbing in a stark, high-stakes physics gauntlet. |
| **Elevator Pitch** | Climb a towering, minimalist black-and-white vertical pinball machine. Every clean strike sends you higher; every miss can send you tumbling back down. Master the physics, manage your recovery tools, and conquer brutal authored sector challenges. |

---

## 1. Design Pillars

| Pillar | Meaning | Design Test |
| --- | --- | --- |
| **High-Stakes Physics** | Progress is earned through timing, control, and calculated risk. | A missed shot costs height, but the player understands why and learns. |
| **Kinetic Satisfaction** | Ball strikes feel immediate and powerful. | Flipper impact, sound response, and screen-shake feel satisfying in isolation. |
| **1-Bit Readability** | High speed, high clarity. | The stark black-and-white graphics allow instant identification of hazards, targets, and safe zones. |
| **Meaningful Recovery** | Falling is not instantly terminal; it is tactical. | Drops expose alternate catches, anchor opportunities, or Fall Floor saves. |

---

## 2. Target Audience

* **Primary Players:** Lovers of high-difficulty physics and precision games (e.g., *Jump King*, *Downwell*, *Getting Over It*, *Celeste*).
* **Competitive Speedrunners:** Players seeking to optimize climb routes, exploit layout geometry, and establish personal best completion times.

---

## 3. Scope Strategy (Focused Campaign)

To establish excellent game feel, this version strips out all User Generated Content (UGC) editors and online Workshop platforms to focus purely on campaign level progression, polished physics feel, and local high-score validation.

| Feature | Campaign Scope | Status | Notes |
| --- | --- | --- | --- |
| Refined Flipper & Ball feel | P0 | Active | High-fidelity Godot 2D physics integration. |
| Campaign Tower (Sectors 0–5) | P0 | Active | Hand-authored, thematic vertical layouts. |
| Procedural Endless Mode (Abyss) | P0 | Active | Seeded endless climb after campaign clear. |
| Anchor Recovery System | P0 | Active | Magnetic checkpoints positioned on walls. |
| Nudge & Fall Floor Systems | P0 | Active | Micro-corrections and regression safety nets. |
| Local Progress & Settings | P0 | Active | Progression unlocking skins/trails + custom controls. |
| Creator Studio & UGC Web Sharing | **OUT** | Removed | Removed to focus purely on core campaign experience. |
| Server Validation & Replays | **OUT** | Removed | Simplified; no online anti-cheat / sharing server. |

---

## 4. Visual Direction: 1-Bit Arcade

The visual style is strictly black and white. It relies on stark contrast, geometry, and motion rather than color.

* **Background:** Deep solid black (`#000000`).
* **Geometry/Walls:** Solid white outlines (`#FFFFFF`) with minimal vector stylings.
* **The Ball:** Solid white sphere, emitting a trailing stream of particles/pixels to convey velocity vectors and trajectory arcs.
* **Bumpers & Interactables:** Differentiated via simple animated geometric patterns (e.g., crosshatching, checkerboard tiles, concentric circles).
* **Readability:** Absolute lack of visual clutter ensures that the player's eye is always tracked to the ball's trajectory and active hazards.

---

## 5. Level Layout & Symmetry Constants

To ensure standard ball interactions and clean spacing, all campaign sectors adhere to the following spatial constants:

* **Play Area Width:** `18.25` meters (excluding the `2.23`m plunger lane on the far right).
* **Play Area Center line:** Exactly **`9.125`m**.
* **Flipper Pivots:** Symmetrical placement flanking the center line:
  * **Left Flipper Pivot:** `x = 6.925`m
  * **Right Flipper Pivot:** `x = 11.325`m
  * **Paddles:** `1.6`m total length each, leaving a clean `1.2`m gap.
* **Funnel Slopes:** Must align flush to the flipper pivots to guide the ball smoothly onto the paddles without pockets:
  * **Left Slope Center:** `x = 3.56`m, half-width `hx = 3.56`m (spanning `0.0`m to `7.12`m).
  * **Right Slope Center:** `x = 14.69`m, half-width `hx = 3.56`m (spanning `11.12`m to `18.25`m).
  * **Vertical Offset:** Slope centers must be set exactly `1.7`m higher than the flipper pivot baseline (e.g., if Flipper Y is `3.8`m, Slope Y is `5.5`m) to create a smooth step-down of `21`cm.

---

## 6. Physics & Controls

### Feel Targets

* **The Ball:** Feels heavy, responsive, and subject to high gravity variables in upper sectors. Uses continuous collision detection (CCD) to prevent high-velocity tunneling.
* **Flippers:** Immediate, mechanical response mimicking solenoid actuators. Swing acceleration must feel distinct from stationary spring holding.
* **Nudge:** Lateral micro-corrections (max 3 charges refilled upon checkpoints) to save a ball from an awkward drop.
* **Anchor System:** The player can place up to 2 magnetic catch-points on the walls of the sector. When the ball crosses a placed Anchor, it is held kinematically for `0.4` seconds, giving the player a brief window to line up a shot. Each anchor can catch the ball up to 3 times before losing charge.

### Controls (Godot Input Actions)

| Action | Keyboard | Gamepad |
|---|---|---|
| Flipper Left | `Z` / `Left Arrow` | `L1` / `L2` |
| Flipper Right | `X` / `Right Arrow` | `R1` / `R2` |
| Plunger (hold/release) | `Space` | `Left Stick` (pull down + release) |
| Nudge Left | `A` | `D-Pad Left` |
| Nudge Right | `D` | `D-Pad Right` |
| Place Anchor | `S` / `Down Arrow` | `D-Pad Down` |
| Pause / Menu | `Esc` | `Start` |

---

## 7. Campaign Structure: Abstract Sectors

The campaign consists of a vertical climb through 6 distinct themed sectors. Each sector is `500`m tall (except Sector 3 pacing beat) and introduces specific physical hurdles.

| Sector | Name | Theme / Mechanic | Aesthetic Hook |
|--------|------|------------------|----------------|
| **0** | **The Lobby** | Tutorial — flippers, plunger, nudge | Clean white geometry, standard gravity |
| **1** | **The Shaft** | Narrow corridors, tight flipper angles | Vertical stripes, rapid bouncing |
| **2** | **The Bumper Garden** | Dense bumper fields, chain reactions | Checkerboard tiles, chaotic ricochets |
| **3** | **The Plunger Vault** | Plunger channels, gravity boosters, launchers | Industrial lines, mechanical valves |
| **4** | **The Negative Space** | Silhouette-only paths, hidden geometry | Inverse stippling, invisible walls |
| **5** | **The Storm** | High speed, oscillating gravity | Wind vectors, flashing scanlines |
| **∞** | **The Abyss** | Seeded procedural endless climb | Glitch/noise visual corruption filter |

* **Checkpoints:** Triggered every `100`m. If the ball drains (falls below the active level boundary), it is respawned at the last checkpoint.
* **Fall Floors:** A safety barrier spawned `10`m below a newly crossed checkpoint. It remains solid for 2 seconds when the ball drops down, offering a one-time safety net before a full reset.
* **Transition:** Reaching the top boundary of a sector triggers a visual 1-bit screen flash (white/black inversion) and displays the next sector's title card without stopping ball momentum.

---

## 8. Progression & Customization

Local achievements and sector clears unlock aesthetic variations:
* **Ball Skins:** Hollow ring, checkered sphere, noise glitch, pixel grid.
* **Trails:** Halftone dots, binary trail, scanline grid, static noise particles.
* **Data Storage:** Progress is saved locally on disk, ensuring offline persistence of best times, unlocked skins, and control configurations.