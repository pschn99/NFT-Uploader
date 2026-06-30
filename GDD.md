# PINBALLZZZ

**Game Design Document v2.0**

**Status:** Pre-production — Local v1.0 target defined

**Last updated:** 2026-06-30

**Changelog v2.0:** Release strategy split into **Local v1.0** (offline desktop game) and **Online v1.1+** (Steam, Workshop, server Clear Check, leaderboards). Local v1.0 is the first shippable milestone; it does **not** satisfy the full Steam/UGC launch promise. Clear Check renamed/split into **Playability Check** (local, v1.0) vs **Verified Clear Check** (server, v1.1+).

| Category | Decision |
| --- | --- |
| **Genre** | Physics precision platformer / vertical pinball / UGC |
| **Local v1.0 Platform** | PC, Mac — offline Electron desktop build |
| **Online v1.1+ Platform** | PC, Mac — Steam (Workshop, achievements, leaderboards) |
| **Secondary Platform Target** | iOS / Android — post-launch |
| **High Concept** | *Downwell* aesthetics meet *Jump King* climbing with a creator economy inspired by *Super Mario Maker*. |
| **Elevator Pitch** | Climb a towering, minimalist black-and-white pinball machine one shot at a time. Every clean hit sends you higher; every miss can send you tumbling back down. Master the physics, chase clean runs, and snap together brutal community gauntlets using a highly expandable, modular toolset. |

## Release Strategy

PINBALLZZZ ships in two phases. **Local v1.0** proves the game is fun offline. **Online v1.1+** adds the creator economy and Steam distribution layer on top.

| | **Local v1.0** | **Online v1.1+** |
| --- | --- | --- |
| **What it is** | Complete offline desktop game | Steam launch + community platform |
| **Campaign** | Sectors 0–5 + Abyss | Same content, distributed via Steam |
| **Creator Studio** | Build, test, save/load local `.json` files | + Workshop publish & browse |
| **Clear Check** | **Playability Check** — client-only, stamps `verifier: "local"` | **Verified Clear Check** — server replay validation, `verifier: "server"`, Clear Badge |
| **Progression** | Local unlocks (ball skins/trails) | + Steam achievements |
| **Competition** | Personal bests only | Leaderboards + ranked playlists |
| **Network** | None required at runtime | CDN, moderation, server validation |

> **Naming rule:** Never display a local Playability Check as a Verified Clear Badge. The UI must distinguish `verifier: "local"` (self-certified, offline) from `verifier: "server"` (anti-cheat validated, online).

## 0. Critical Design Position

PINBALLZZZ is strongest when it is about **earned vertical progress under physical uncertainty**. To prototype this rapidly and effectively, the game adopts a strict **minimalist visual and structural philosophy**.

The core promise is:

1. The ball feels excellent to strike.
2. Height is the main form of progress.
3. The visual language is purely functional: high-contrast black-and-white.
4. The game scales through modular mechanical expansion (new physics blocks, infinite verticality) rather than graphic-intensive biomes.

## 1. Design Pillars

| Pillar | Meaning | Design Test |
| --- | --- | --- |
| **High-Stakes Physics** | The player advances through precision, timing, and controlled risk. | A missed shot costs progress, but the player understands why. |
| **Kinetic Satisfaction** | Hitting the ball is pleasurable. | Flipper impact, sound, and screen response feel good in isolation. |
| **1-Bit Readability** | Chaos is legible. | The stark black-and-white graphics allow instant identification of hazards, targets, and safe zones. |
| **Meaningful Recovery** | Failure creates tactical play. | Falling exposes alternate catches or Anchor saves. |
| **Modular First** | The game is an expanding toy box. | All new content is built from snapping together discrete, reusable geometric components. |

## 2. Target Audience

| Segment | Motivation | Examples |
| --- | --- | --- |
| **Primary Players** | Master a difficult physics challenge. | Fans of *Jump King*, *Downwell*, *Celeste*, and *Getting Over It*. |
| **UGC Creators** | Build clever, demanding tower puzzles. | Players who enjoy *Super Mario Maker* or *Baba Is You*. |
| **Competitive Players** | Optimize routes and prove mastery. | Speedrunners, leaderboard chasers. |

## 3. Scope Strategy (Prototype First)

By reducing the visual scope to retro minimal graphics, **Local v1.0** aggressively prioritizes core feel, campaign, and a Creator Studio MVP. Online/Steam features are explicitly deferred to **v1.1+**.

| Feature | Local v1.0 | Online v1.1+ | Notes |
| --- | --- | --- | --- |
| Excellent flipper, plunger, ball, nudge feel | ✅ P0 | — | Absolute core of the prototype. |
| Endless vertical generation (Abyss) | ✅ P0 | — | Seamless upward scrolling. |
| Anchor recovery system | ✅ P0 | — | Primary anti-frustration mechanic. |
| Creator Studio MVP (local file I/O) | ✅ P0 | — | Grid editor, Test Play, save/load `.json`. See §8 for MVP scope. |
| Official campaign (Sectors 0–5) | ✅ P1 | — | Authored in Creator Studio. |
| Deterministic replay (local CI) | ✅ P1 | — | Proves physics stability; required before Playability Check. |
| Playability Check (client-only) | ✅ P1 | — | Self-certify level is beatable before local export. |
| Steam distribution & Workshop | — | ✅ P1 | Deferred from Local v1.0. |
| Verified Clear Check (server) | — | ✅ P1 | Server replay validation + Clear Badge. |
| UGC publishing, browsing, leaderboards | — | ✅ P1 | Requires moderation + backend. |
| Mobile / tablet play | — | Post-launch | Capacitor wrapper; deferred. |
| Creator Studio on tablet | — | Post-launch | Dedicated touch UX pass. |

## 4. Core Gameplay Loop

**Flip → Ascend → Miss → Fall → Recover → Adapt → Ascend Again**

The player starts at the base of a vertical tower. Progress is spatial, not score-based: height matters more than points.

## 5. Visual Direction: 1-Bit Arcade

The visual style is strictly black and white. It relies on stark contrast, geometry, and motion rather than color.

* **The World:** Deep black background.
* **The Geometry:** Thick white outlines for walls, ramps, and obstacles.
* **The Ball:** Solid white, emitting a short, stylized trail to communicate speed and arc.
* **Hazards/Interactables:** Differentiated through animation (spinning, pulsing) and internal geometric patterns (stripes, stippling, checkerboards) rather than color.
* **Readability:** The absolute lack of visual clutter means the player's eye is always drawn exactly to the moving physics objects.

## 6. Physics And Controls

### Feel Targets

| Element | Target Feel |
| --- | --- |
| **Ball** | Heavy, readable, fast. |
| **Flippers** | Immediate input response; strong impact. |
| **Nudge** | A limited recovery correction (3 charges per fall). |

### Desktop Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Flipper Left | `Z` / `Left Arrow` | `L2` |
| Flipper Right | `X` / `Right Arrow` | `R2` |
| Plunger (hold/release) | `Space` | `Left Stick` pull + release |
| Nudge Left | `A` | `D-Pad Left` |
| Nudge Right | `D` | `D-Pad Right` |
| Place Anchor | `S` / `Down Arrow` | `D-Pad Down` |
| Pause | `Esc` | `Start` |

All actions remappable via the Settings menu.

### Mobile / Tablet Controls (Post-launch reference)

| Action | Gesture |
|---|---|
| Flipper Left | Tap left half of screen |
| Flipper Right | Tap right half of screen |
| Plunger | Press and hold bottom-centre zone; release to fire |
| Nudge Left / Right | Swipe left / right anywhere on screen |
| Place Anchor | Tap designated anchor slot indicator on wall |
| Pause | Tap pause button (top-right HUD) |

### Ball Loss Prevention

The game deliberately avoids the traditional "drain" failure state. Instead, ball loss is replaced by a *Fall* — a controlled regression of height.

* **Side Walls (Infinite):** The tower walls extend the full height of the map; the ball always bounces back in-bounds.
* **Anchor System:** The player can set up to 2 Anchors — magnetic catch-points on the tower wall. If the ball passes a placed Anchor during a fall, it is briefly held, giving the player a short window to re-engage a flipper. Each Anchor has a 3-use charge before it must be repositioned.
* **Nudge (Micro-correction):** 3 charges per fall reset. Applies a short lateral impulse to the ball in mid-air to correct a bad angle. Charges refill each time the player reaches a new height checkpoint.
* **Fall Floors:** Every N meters, a semi-permeable "catch floor" activates for 2 seconds if the ball drops below a checkpoint the player has already passed. It prevents full resets to the bottom and rewards partial recovery.

## 7. Campaign Structure: Abstract Sectors

The official campaign is a single continuous vertical tower divided into **named Sectors**. Each Sector is roughly 500m tall and introduces one dominant mechanical theme. All Sectors are authored entirely in the Creator Studio, so they double as canonical showcase examples for UGC builders.

| Sector | Name | Dominant Mechanic | Aesthetic Hook |
|--------|------|-------------------|----------------|
| 0 | **The Lobby** | Tutorial — flippers, plunger, nudge | Clean white geometry, slow ball speed |
| 1 | **The Shaft** | Narrow corridors, tight flipper angles | Vertical stripes, tight wallbounce |
| 2 | **The Bumper Garden** | Dense bumper fields, chain reactions | Checkerboard tiles, chaotic ricochets |
| 3 | **The Plunger Vault** | Manual boosters, plunger ramps, timing launchers | Industrial copper, steam venting |
| 4 | **The Negative Space** | Invisible ramps, silhouette-only geometry | Sparse layout, high readability required |
| 5 | **The Storm** | High-speed ball, fast flipper timing windows | Scanline aesthetic, aggressive tempo |
| ∞ | **The Abyss** | Procedural / endless — no ceiling | Glitch/noise visual corruption filter |

**Sector transitions** are marked by a brief full-screen inversion (white flash on black, then back) and a one-line title card. No cutscenes; the game never stops the player.

**Height checkpoints** are placed every 100m within a Sector. Failing mid-Sector returns the player to the last checkpoint, not the Sector start.

**Win Condition / Sector Clear:**
Reaching the very top of a Sector (e.g. 500m height) activates a sensor collider that triggers the Sector transition. Clearing a Sector is verified by the `WinConditionSystem` when the ball overlaps this boundary. In the Creator Studio, the author must designate a goal/exit block that functions as the sector clear trigger, which is required to pass the Playability Check.

## 8. Creator Studio & Modularity

The engine is built so that adding a new "level" or "mechanic" is as simple as adding a new block to the editor.

* **Smart-Grid:** Actuators (Flippers) snap to predefined rotational angles to ensure physics remain predictable.

* **Creator Studio MVP (Local v1.0):** Grid overlay, block palette (walls, flippers, bumpers, plunger, checkpoints), snap-on-drag, flipper angle presets, Test Play, save/load local `.json` files. No Workshop upload, no online browse.

* **Playability Check (Local v1.0):** Before exporting a level locally, the creator must complete it once. The run is recorded as a deterministic replay and re-simulated client-side. On success, the level JSON is stamped with `playability_check: { verified: true, verifier: "local", replay_hash, replay_engine_version }`. This is **self-certification only** — it confirms the author cleared their own level, not that the level is fair or tamper-proof.

* **Verified Clear Check (Online v1.1+):** Required before Workshop publish. Extends Playability Check with server-side replay validation:
  1. **Author Must Clear:** Same as Playability Check — recorded deterministic replay.
  2. **Server Replay Validation:** On publish, the server replays inputs against the final level state. Success stamps `verifier: "server"`.
  3. **Clear Badge:** Server-verified levels display a badge in the UGC browser. Locally verified levels do **not** receive this badge.
  4. **Soft Time Cap:** Recordings exceeding 30 minutes warn the creator but do not block publishing.

* **Expandability:** Future updates will inject new mechanical blocks (e.g., "Portal Block", "Sticky Bumper") into the toolset, seamlessly expanding both the official campaign and UGC capabilities.

## 9. Progression And Rewards

Rewards leverage the minimal aesthetic to offer stark, highly noticeable visual changes.

| Category | Examples |
| --- | --- |
| **Ball Skins** | Hollow, Checkered, Glitch, 8-bit Pixel |
| **Ball Trails** | Halftone dots, Inverted scanlines, Binary code |

## 10. Audio Direction

* **Music:** Chiptune or dark synthwave. Music grows more complex with elevation.
* **SFX:** High-bitrate arcade sounds. Deep, crunchy impacts. Major falls instantly strip the music back to a lone, rhythmic bassline to emphasize the tension of the drop.