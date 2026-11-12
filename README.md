# 🧊 3D Rubik's Cube Simulator & Designer Studio

A responsive, high-performance 3D Rubik's Cube and twisty puzzle simulator built with **Three.js** and vanilla JavaScript. Features dynamic **View-Relative WCA Notation** (where `R` is always the face to the right of your camera view), a **Chess-Style Move History** with instant state jumping, an interactive **Cube Designer Studio**, and special shape-mod puzzles including the **Fisher Cube**, **Mirror Cube**, and the **WitEden & Oskar Mixup 3×3** (with 45° slice turns).

---

## ✨ Features

### 1. Puzzles & Shape Mods
- **2×2 Pocket Cube**: Fast 4-piece corners simulation.
- **3×3 Standard Rubik's Cube**: Full speedcube experience with smooth spring animations.
- **4×4 Rubik's Revenge**: Multi-layer cube supporting inner slices and parity algorithms.
- **🐟 Fisher Cube (Tony Fisher 3×3 Shape Mod)**:
  - Formed by rotating the vertical cutting plane 45° around the core.
  - Three distinct piece geometries: square face centers, pentagonal corner-edges, and right-triangle corners.
  - Shape-shifts into striking jagged silhouettes when turned.
- **🪞 Mirror / Bump Cube**:
  - Solved strictly by geometry and piece dimensions instead of colors.
  - Asymmetric slice thicknesses across all three axes ($T_x, T_y, T_z$).
  - Rendered with a high-detail brushed metallic shader.
- **🔀 WitEden & Oskar Mixup 3×3**:
  - Invented by Oskar van Deventer and produced by WitEden.
  - Middle slices ($M, E, S$) can rotate in increments of **45°** (`M45`, `E45`, `S45`).
  - Allows edge and center pieces to swap roles, creating shape-shifting states and deep combinatorial puzzles.

---

### 2. 🎨 Interactive Cube Designer Studio
Personalize every aesthetic detail of your cube in real-time:
- **Preset Palettes**:
  - *Standard WCA* (Classic competition colors)
  - *Pastel / Macaron* (Soft aesthetic tones)
  - *Cyberpunk / Neon* (Vibrant synthwave hues)
  - *Brushed Metallic* (Polished gold and titanium)
  - *Carbon Fiber* (Stealth modern dark theme)
- **Face Color Pickers**: Individual hex color pickers for Up, Down, Front, Back, Left, and Right faces.
- **Core Body Material**: Switch the internal plastic between Midnight Black, Clean White, Primary Uncolored, and Carbon Dark.
- **Sticker Geometry Controls**:
  - Adjust sticker inset / padding margin (from classic bordered stickers to borderless full-bleed tiles).
  - Adjust corner roundness / bevel radius.
- **Surface Finish**: Fine-tune roughness and metalness between high-gloss competition plastic, frosted matte, and metallic finishes.

---

### 3. View-Relative Notation (Dynamic to Camera)
- **Camera-Adaptive Controls**: Mouse drag orbits the entire cube view smoothly without turning layers.
- **`R` is Always on Your Right**: Notation is mapped dynamically to your perspective in 3D space:
  - **`R` (Right)**: Always turns the layer physically situated to the right of your view.
  - **`L` (Left)**: Always turns the layer physically situated to the left of your view.
  - **`F` (Front)**: Always turns the face directly facing you.
  - **`B` (Back)**: Always turns the face opposite from you.
  - **`U` (Up)**: Always turns the top layer.
  - **`D` (Down)**: Always turns the bottom layer.
- **Live Orientation HUD**: Displays the active face mapping in real time (e.g., `F: Green`, `R: Red`, `U: White`).
- **Fixed WCA Toggle**: Switch back to fixed world axes with a single click if desired.

---

### 4. Chess-Style Move History Sidebar
- **Paired Move Notation**: Moves are tracked in pairs (`1. R U`, `2. R' U'`) matching official chess scoresheet notation.
- **Color Dots**: Each move features a color indicator corresponding to the turned face.
- **Instant State Jumping**: Click any past move in the history to instantly restore the cube to that exact position (zero cumulative drift).
- **Navigation Toolbar**:
  - `|◀` Jump to start (Solved state)
  - `◀` Step back 1 move
  - `▶` Step forward 1 move
  - `▶|` Jump to latest move
  - `⭐ Save` Quick bookmark current position
- **Branch vs. Insert Modes**:
  - **Branch**: Continue playing from a past move, branching into a new line.
  - **Insert**: Splice new moves into the sequence after the current step.

---

### 5. Saved States & Bookmarks (Checkpoints)
- **Bookmark Any Position**: Name and save states (e.g., *"Cross Solved"*, *"F2L"*, *"Checkerboard"*, *"Mixup 45 Shape"*).
- **Persistent Storage**: Saved states persist across browser sessions via `localStorage`.
- **Import / Export JSON**: Export saved states as a `.json` backup file or import existing states.

---

### 6. 🧩 3D Physical Cube Rebuilder & Painter
Reconstruct a real physical cube you hold in your hands directly into the 3D simulator:
- **Interactive 3D Painter**:
  - Orbit around the 3D cube model and click any sticker to paint with the active color brush.
  - Hover reticle illuminates the target facelet with a cyan boundary box before painting.
  - Smart drag vs. click detection prevents accidental sticker painting while orbiting the cube.
  - **Camera Snap Bar**: Quick 1-click snap presets for `Iso`, `Front (F)`, `Right (R)`, `Top (U)`, `Back (B)`, `Left (L)`, and `Bottom (D)`.
- **View Modes**:
  - `🧊 3D Painter`: Full-width 3D interactive painter stage.
  - `◫ Side-by-Side`: Split view showing the 3D model alongside the unfolded 2D net with live bi-directional sync.
  - `🗺️ 2D Net`: Classic unfolded cross net.
- **Color Brush Palette**: White, Yellow, Green, Blue, Red, Orange with live count badges (e.g. `9/9`).
- **Live Validation Banner**: Instant mathematical integrity check confirming exactly $N \times N$ facelets per color before solving.
- **Quick Actions**:
  - `📥 Read Simulator`: Pulls the current 3D cube state into the painter.
  - `🔄 Solved Cube`: Resets to a clean solved cube pattern.
  - `🧹 Clear`: Blanks out stickers for fresh physical cube input.
  - `⚡ Instant Solve (Least Moves)`: Immediately computes the optimal sub-22 move solution.
  - `🧙‍♂️ Step-by-Step Guide`: Launches the educational Layer-by-Layer solution tutorial.

---

### 7. ⚡ Instant Solve (Optimal / Fewest Moves via Kociemba Engine)
Calculate God's Algorithm-level solutions that solve the cube in the least number of moves:
- **Kociemba's Two-Phase Algorithm**:
  - Bundles a high-performance, zero-dependency JavaScript implementation of Herbert Kociemba's Two-Phase algorithm (`kociemba.js`).
  - Solves any valid 3×3 scramble in **under 22 moves** (often 18–21 moves), compared to 55–65 moves with standard CFOP (~65% move reduction!).
  - Automatic center color normalization: solves correctly regardless of custom color schemes or physical cube orientation.
- **Optimal 2×2 Solver**: Fast breadth-first search (BFS) generating exact optimal solutions in 4–11 moves.
- **Instant Solve Modal**:
  - **Performance Metrics**: Live badge indicators for optimal move count, calculation time in milliseconds, and algorithm method.
  - **Clickable Notation Box**: Formatted algorithm sequence with a 1-click `📋 Copy Algorithm` button.
  - **Interactive Move Stepper**:
    - Clickable move chips with active glowing highlights.
    - `⏮ Prev` / `⏭ Next`: Step through the optimal solution move-by-move.
    - `▶ Animate Solve` / `⏸ Pause`: Watch the cube solve itself automatically at chosen animation speeds.
    - `⚡ Jump to Solved`: Instantly fast-forwards all remaining moves to solved state in 0ms.
- **Validation Diagnostics**: Immediate detection and user-friendly explanation of unsolvable physical states (corner twist, flipped edge parity, or imbalanced colors).

---

### 8. 🧙‍♂️ Interactive Step-by-Step Solution Guide
An educational solver engine that walks you through solving the cube move-by-move:
- **3×3 Layer-by-Layer (CFOP) Solver**:
  1. *The White Cross* (Foundation on bottom face D)
  2. *First Layer Corners* (White face & lateral belt)
  3. *Second Layer Edges* (F2L equatorial belt)
  4. *Top Yellow Cross* (OLL Cross)
  5. *Align Cross Edges* (PLL Edges via Sune algorithm)
  6. *Position Top Corners* (PLL Corners via Niklas algorithm)
  7. *Orient Final Corners* (Final in-place twist to complete the solve!)
- **Interactive Stepper Controls**:
  - `⏮ Prev Move` / `⏭ Next Move`: Step back and forth; turns the 3D cube in real time so you can follow along physically.
  - `▶ Play Step` / `⏸ Pause`: Plays the current stage at adjustable speeds (0.5× Slow, 1× Normal, 2.5× Fast).
  - `⚡ Auto-Solve All`: Runs through all remaining stages sequentially to solve the entire cube.
  - Clickable move chips with active glowing highlights and progress badges.
- **Specialized Strategy & Parity Center for Complex Puzzles**:
  - **🪞 Mirror Cube**: Geometric elevation recognition (Thin 0.65, Medium 1.0, Thick 1.35) and flush planar alignment cues.
  - **🐟 Fisher Cube**: Edge-corner duality recognition, 1-click **Center 90° Rotation** algorithm `(R U R' U) × 5`, and 1-edge-flip parity resolution.
  - **🔀 WitEden & Oskar Mixup 3×3**: 3-Phase strategy (Phase 1 Shape Restoration with 45° commutators `M45 M45 U2 M45' M45' U2`, Phase 2 Center Routing, Phase 3 3×3 solve and parity resolution).
  - **4×4 Revenge**: Reduction Method stages with 1-click execution for **OLL Parity** and **PLL Parity**.

---

### 9. Algorithm Presets & WCA Scramble Generator
- **Algorithm Library**: Pre-loaded with common triggers, permutations, and parity sequences:
  - *Sexy Move* (`R U R' U'`), *Sune*, *Anti-Sune*
  - *T-Perm*, *Y-Perm*, *J-Perm*, *H-Perm*, *Z-Perm*
  - *Patterns*: Checkerboard, Cube in a Cube, Anaconda, Superflip
  - *4×4 Parity*: OLL Parity, PLL Parity, Center Swap
  - *Mixup Sequences*: 45° slice swaps and center interchanges
- **WCA Scrambler**: Generates official-style scrambles tailored to each cube size.

---

### 10. Speed Control & Playback
- **Speed Slider**: Adjustable turn animation speed from **Instant (0ms)** to **Fast (90ms)**, **Normal (220ms)**, and **Slow (450ms)**.
- **Virtual Keypad**: Quick buttons for face turns, wide turns, slice turns, and 45° Mixup slice actions.
- **Timeline Bar**: Real-time progress bar with animated chips highlighting active moves.
- **Invert Sequence**: Instantly reverses and inverts any entered sequence.

---

## 🚀 Quick Start

### Option 1: Open Directly in Browser
Simply open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari). No build tools, compilers, or server installations are required.

### Option 2: Run via Node.js
```bash
# Clone the repository
git clone https://github.com/jonaskroedel/rubiks-simulator.git
cd rubiks-simulator

# Start the local server
npm start
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Notation Reference

| Notation | Description |
|---|---|
| `U`, `D`, `L`, `R`, `F`, `B` | Single clockwise 90° turn of the respective face |
| `U'`, `D'`, `L'`, `R'`, `F'`, `B'` | Counter-clockwise (prime) 90° turn |
| `U2`, `D2`, `L2`, `R2`, `F2`, `B2` | Half turn (180°) |
| `Rw` or `r`, `Uw`, `Dw`, `Lw`, `Fw`, `Bw` | Wide turn (2 outer layers simultaneously) |
| `M`, `E`, `S` | Slice moves (Middle, Equator, Standing) |
| `M45`, `M45'`, `E45`, `E45'`, `S45`, `S45'` | **Mixup 3×3**: 45° slice turns swapping centers and edges |
| `2R`, `2L`, `2U`, `2D` (4×4) | Single inner slice turn |
| `x`, `y`, `z` | Whole cube rotation in the direction of `R`, `U`, `F` |

---

## 🛠️ Project Structure

```
rubiks-simulator/
├── index.html       # Main layout, 3D painter workspace, Instant Solve modal, HUD
├── style.css        # Glassmorphic dark UI, 3D painter canvas, Instant Solve badges & chips
├── cube.js          # Three.js 3D engine: standard, Fisher, Mirror, and Mixup geometry
├── notation.js      # WCA notation parser, 45° slice support, and scrambler
├── kociemba.js      # Pure JS implementation of Kociemba's Two-Phase optimal algorithm
├── solver.js        # OptimalSolver (Kociemba & BFS), LBL/CFOP guide, VirtualCube model
├── app.js           # Rebuilder3DPainter, Instant Solve controller, CubeApp orchestration
├── server.js        # Zero-dependency local HTTP static server
├── package.json     # Project metadata and start scripts
├── .gitignore       # Git ignore rules
└── README.md        # Documentation
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
