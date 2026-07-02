# Fall Floor Collision Spike Verdict (Milestone 0.5)

- **Date**: 2026-07-01
- **Status**: ✅ APPROVED (Subjective Rating: 5/5)
- **Target Mechanics**: One-way platform catch floor

---

## 1. Selected Approach

Rapier.js does not native support one-way platform colliders out of the box. We evaluated two architectures:
1. **Linear Velocity Filtering**: Toggle collision groups purely by checking `ball.linvel().y > 0`.
2. **Relative Height Position Filtering**: Toggle collision groups by checking if the ball's lowest point is above the platform's highest point.

### Chosen Design: **Relative Height Position Filtering**
We choose **Relative Height Position Filtering** because linear velocity filtering suffers from edge-case tunneling: if a player hits the ball and it loses upward velocity just inside the platform boundary, the platform would instantly become solid, causing the ball to glitch and eject violently.

### Implementation Logic
In the simulation pre-step, we check:
```typescript
const ballBottomY = ballPos.y - ballRadius;
const floorTopY = floorY + floorHalfHeight;

if (ballBottomY >= floorTopY - 0.02) {
  // Ball is above the platform. Make it solid.
  floorCollider.setCollisionGroups(0x0001ffff); // Default collision group
} else {
  // Ball is below or passing through. Make it permeable.
  floorCollider.setCollisionGroups(0x00000000); // Disables all collisions
}
```

---

## 2. Advantages of the Chosen Approach

1. **Determinism**: Since the translation coordinates and dimensions of both the ball and platform are fixed-point and step-bound, this test is 100% deterministic and replay-safe.
2. **Smooth Transit**: The ball seamlessly passes upwards through the platform regardless of speed, and lands reliably.
3. **No Collision Glitches**: The `0.02` buffer prevents boundary chatter when the ball comes to rest on top of the catch floor.
