# Coordinate System Specification (Milestone 0.3)

- **Date**: 2026-07-01
- **Status**: ✅ LOCKED
- **Resolution Path**: централизованные константы в `src/simulation/constants.ts`

---

## 1. Pixel-to-Metre Ratio (PPM)

To bridge the Rapier.js physics simulation (which calculates forces and bounds in physical metres) with the Phaser.js rendering view (which displays pixels):
- **`PIXELS_PER_METRE = 50`** (1 metre = 50 pixels)
- **`METRES_PER_PIXEL = 0.02`** (1 pixel = 0.02 metres)

### Rationale
Our baseline desktop canvas size is `1024 x 768` pixels.
- A width of `1024px` maps to **`20.48` metres**.
- A height of `768px` maps to **`15.36` metres**.
This coordinate scale matches Rapier's recommended object dimensions (keeping active rigid bodies between `0.1` and `10.0` metres to prevent numerical instability).

---

## 2. Coordinate Space Projection

Rapier uses standard Cartesian coordinates where Y-axis increases **upwards**. Phaser uses screen coordinates where Y-axis increases **downwards**.

### Conversion Formulas
When projecting physics state to visual sprites:
$$\text{Screen X} = \text{Physics X} \times \text{PPM}$$
$$\text{Screen Y} = \text{Canvas Height} - (\text{Physics Y} \times \text{PPM})$$
$$\text{Sprite Rotation} = -\text{Body Rotation}$$

*Note: Sprite rotation is negated because clockwise rotation is positive in Phaser, whereas counter-clockwise rotation is positive in Rapier.*

---

## 3. Creator Studio Grid Cells

Creator Studio features a **`32 x 32` pixel** grid overlay.
- In physics units, each grid cell is exactly **`0.64 x 0.64` metres**.
- Snapping math for grid placement:
  $$\text{Grid X} = \lfloor \text{Screen X} / 32 \rfloor$$
  $$\text{Grid Y} = \lfloor \text{Screen Y} / 32 \rfloor$$
- Physics placement of grid elements:
  $$\text{Physics Center X} = (\text{Grid X} + 0.5) \times 0.64$$
  $$\text{Physics Center Y} = \text{Canvas HeightMetres} - (\text{Grid Y} + 0.5) \times 0.64$$

---

## 4. Vertical Bounds & Checkpoints

- **Checkpoint Interval**: Placed every **`100.0` metres** of vertical height (equivalent to `5,000` pixels).
- **Fall Floor Offset**: A semi-permeable boundary activates **`10.0` metres** (`500` pixels) below a recently cleared checkpoint to catch falling balls.
- **Dynamic Chunking**: Chunks of width `20.48m` (screen-wide) and height `10.0m` (500px) are dynamically loaded and unloaded. The system keeps a buffer of 3 chunks above and below the active viewport.
