# 🧊 3D Rubik's Cube Simulator (2×2, 3×3, 4×4)

A responsive 3D Rubik's Cube simulator built with **Three.js** and vanilla JavaScript. Features dynamic **View-Relative WCA Notation** (where `R` is always the face to the right of your camera view), a **Chess-Style Move History** with instant state jumping, and comprehensive **State Saving / Bookmarking**.

---

## ✨ Features

### 1. Multi-Size Support (2×2, 3×3, 4×4)
- **2×2 Pocket Cube**: Fast 4-piece corners simulation.
- **3×3 Standard Cube**: Full Rubik's speedcube experience.
- **4×4 Rubik's Revenge**: Multi-layer cube with inner slice moves and parity algorithms.
- Switch seamlessly between sizes anytime with the top bar.

### 2. View-Relative Notation (Dynamic to Camera)
- **Camera-Adaptive Controls**: Mouse drag orbits the whole cube without turning slices.
- **`R` is Always on Your Right**: Notation is mapped dynamically to your perspective in 3D space:
  - **`R` (Right)**: Always turns the layer physically situated to the right of your view.
  - **`L` (Left)**: Always turns the layer physically situated to the left of your view.
  - **`F` (Front)**: Always turns the face directly facing you.
  - **`B` (Back)**: Always turns the face opposite from you.
  - **`U` (Up)**: Always turns the top layer.
  - **`D` (Down)**: Always turns the bottom layer.
- **Live Orientation HUD**: A color-coded HUD displays the active mapping (e.g., `F: Green`, `R: Red`, `U: White`) and updates in real-time as you orbit.
- **Fixed WCA Toggle**: Easily toggle between View-Relative and fixed world coordinates if needed.

### 3. Chess-Style Move History Sidebar
- **Paired Move Notation**: Moves are tracked in pairs (`1. R U`, `2. R' U'`) just like a chess scoresheet.
- **Color Dots**: Each move displays a mini color indicator matching the face that turned.
- **Instant State Jumping**: Click any past move in the history to instantly restore the cube to that exact position.
- **Navigation Toolbar**:
  - `|◀` Jump to start (Solved state)
  - `◀` Step back 1 move
  - `▶` Step forward 1 move
  - `▶|` Jump to latest move
  - `⭐ Save` Quick bookmark current position
- **Branch vs. Insert Modes**:
  - **Branch**: Continue playing from a past move, branching into a new line.
  - **Insert**: Splice new moves into the sequence after the current step.

### 4. Saved States & Bookmarks (Checkpoints)
- **Bookmark Any Position**: Name and save states (e.g., *"Cross Solved"*, *"F2L"*, *"Checkerboard"*).
- **Persistent Storage**: Saved states persist across sessions in `localStorage`.
- **Import / Export JSON**: Export saved states as a `.json` backup file or import existing states.

### 5. Algorithm Presets & WCA Scramble Generator
- **Algorithm Library**: Pre-loaded with common triggers and permutations:
  - *Sexy Move* (`R U R' U'`), *Sune*, *Anti-Sune*
  - *T-Perm*, *Y-Perm*, *J-Perm*, *H-Perm*, *Z-Perm*
  - *Patterns*: Checkerboard, Cube in a Cube, Anaconda, Superflip
  - *4×4 Parity*: OLL Parity, PLL Parity, Center Swap
- **WCA Scrambler**: Generates official-style scrambles tailored to each cube size.

### 6. Speed Control & Playback
- **Speed Slider**: Adjustable turn animation speed from **Instant (0ms)** to **Fast (90ms)**, **Normal (220ms)**, and **Slow (450ms)**.
- **Timeline Bar**: Real-time progress bar with animated chips highlighting active moves.
- **Invert Sequence**: Instantly reverses and inverts any entered sequence.

---

## 🚀 Quick Start

### Option 1: Open Directly in Browser
Simply double-click or open `index.html` in any web browser (Chrome, Edge, Firefox, Safari). No installation or build steps required.

### Option 2: Run via Node.js
```bash
# Clone the repository
git clone https://github.com/jonaskroedel/rubiks-simulator.git
cd rubiks-simulator

# Start the local server
npm start
```
Then visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Notation Reference

| Notation | Description |
|---|---|
| `U`, `D`, `L`, `R`, `F`, `B` | Single clockwise 90° turn of the respective face |
| `U'`, `D'`, `L'`, `R'`, `F'`, `B'` | Counter-clockwise (prime) 90° turn |
| `U2`, `D2`, `L2`, `R2`, `F2`, `B2` | Half turn (180°) |
| `Rw` or `r`, `Uw`, `Dw`, `Lw`, `Fw`, `Bw` | Wide turn (2 outer layers simultaneously) |
| `M`, `E`, `S` | Slice moves (Middle, Equator, Standing) |
| `2R`, `2L`, `2U`, `2D` (4×4) | Single inner slice turn |
| `x`, `y`, `z` | Whole cube rotation in the direction of `R`, `U`, `F` |

---

## 🛠️ Project Structure

```
rubiks-simulator/
├── index.html       # Main HTML markup and UI structure
├── style.css        # Modern glassmorphic dark theme stylesheet
├── cube.js          # Three.js 3D WebGL cube engine & snapshot state manager
├── notation.js      # WCA notation parser, validator, and scrambler
├── app.js           # Application logic, chess history, and bookmark manager
├── server.js        # Zero-dependency local HTTP static server
├── package.json     # Project metadata and scripts
├── .gitignore       # Git ignore rules
└── README.md        # Documentation
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
