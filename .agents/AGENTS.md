# Pinballzzz Project Design Rules & Guidelines

This document contains lessons learned, critical configurations, and architectural patterns established during the physics and sandbox prototyping phases.

## 1. Rapier Physics Quirks & Solutions

### A. Dynamic Body Sleep (Flipper Unresponsiveness)
- **Problem**: When a dynamic rigid body is resting and no external forces act on it, the Rapier solver puts it to sleep to conserve CPU. Modifying Revolute Joint motor parameters (such as `configureMotorVelocity` or `configureMotorPosition`) on a sleeping body **does not automatically wake it up**, causing controls to appear dead or unresponsive.
- **Rule**: Always call `body.wakeUp()` immediately prior to modifying any joint motor settings.

### B. Revolute Joint Limits
- **Problem**: Setting `limitsEnabled` and `limits` on the construction `JointData` descriptor is ignored or discarded during impulse joint creation in some Rapier wrappers.
- **Rule**: Explicitly configure limits on the instantiated joint:
  ```typescript
  joint.setLimits(minAngle, maxAngle);
  ```

### C. Flipper Kinematics (Solenoid vs. Position)
- **Rule**: To simulate realistic pinball arcade flippers:
  - **Active Swing (Soleneoid)**: Use velocity control `configureMotorVelocity(targetSpeed, velocityDamping)` with a high gain (e.g., `velocityDamping = 300.0` at `targetSpeed = 45.0` rad/s) to mimic high-current solenoid acceleration all the way to the limit.
  - **Resting/Holding (Static)**: Use position control `configureMotorPosition(restingAngle, stiffness, damping)` with a stiff spring (e.g., `stiffness = 2000.0`, `damping = 50.0`) to keep the paddle locked at its limits without vibrating or sagging under gravity.

### D. Collision Tunneling & Substepping (240Hz)
- **Problem**: High-speed collisions (e.g. ball falling fast meeting a fast flipper stroke) can pass through colliders in a single $1/60$s frame.
- **Rule**: Run the Rapier world timestep at **`1 / 240` seconds** and execute the world step **4 times per frame** (substepping) inside the `PhysicsWorld.step()` method. This increases collision frequency by 4x and prevents tunneling without altering real-time speed.

## 2. Sector Chunk Management & Tall Boundaries
- **Problem**: Giant boundary walls spanning the entire tower height (e.g. $Y = 0 \to 520$) get unloaded by the chunk manager if it only evaluates the wall's center coordinate ($Y = 260$).
- **Rule**: Check for viewport intersection using the wall's full height span:
  ```typescript
  const inRange = (wall.y - wall.hy <= maxY) && (wall.y + wall.hy >= minY);
  ```

## 3. Level Layout & Symmetry Constants
- **Play Area Center**: Excluding the `2.23`m plunger lane on the right, the actual play area width is `18.25`m, meaning the play area center line is exactly **`9.125`m**.
- **Flippers**: Symmetrical pivots around the center:
  - Left Pivot: `x = 6.925`
  - Right Pivot: `x = 11.325`
  - Total length: `1.6`m, leaving a clean `1.2`m gap.
- **Slopes**: Funnel slopes must be aligned flush to the flipper pivots:
  - Left Slope Center: `x = 3.56`, width `hx = 3.56` (extends `0 \to 7.12`).
  - Right Slope Center: `x = 14.69`, width `hx = 3.56` (extends `11.12 \to 18.25`).
  - Vertical offset: Set slope centers `1.7`m higher than the flipper pivot baseline (e.g. Y_slope = 5.5, Y_flipper = 3.8) to create a smooth step-down of 21cm, ensuring the ball slides off slopes directly onto the paddles with no pockets.
