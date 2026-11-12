/**
 * Extensible Puzzle Definition Architecture for Rubik's Cube Simulator
 * Allows defining, building, and playing custom twisty puzzles and cuboids
 * (e.g., 3x3x4, 2x2x3 Tower, 3x3x2 Domino, 3x3x5, and shape mods) with easy declarative code.
 */

class PuzzleRegistry {
  constructor() {
    this.puzzles = new Map();
    this.initBuiltins();
  }

  /**
   * Registers a new puzzle definition in the registry.
   * @param {Object} def Puzzle configuration
   */
  register(def) {
    if (!def || !def.id) {
      throw new Error("Puzzle definition requires a unique 'id' string.");
    }

    const dims = Array.isArray(def.dimensions) ? def.dimensions : [3, 3, 3];
    const size = def.size || Math.max(...dims);

    const puzzle = {
      id: def.id,
      name: def.name || def.id,
      badge: def.badge || (def.isCuboid ? 'Cuboid' : `${dims[0]}×${dims[1]}×${dims[2]}`),
      category: def.category || (def.isShapeMod ? 'Shape Mod' : (def.isCuboid ? 'Cuboid' : 'Standard')),
      dimensions: [dims[0] || 3, dims[1] || 3, dims[2] || 3],
      size: size,
      isCuboid: !!def.isCuboid || (dims[0] !== dims[1] || dims[1] !== dims[2]),
      isShapeMod: !!def.isShapeMod,
      shapeModType: def.shapeModType || null, // 'fisher', 'mirror', 'mixup', etc.
      description: def.description || `Custom ${dims[0]}×${dims[1]}×${dims[2]} Twisty Puzzle.`,
      allowedMoves: def.allowedMoves || null,
      ...def
    };

    this.puzzles.set(puzzle.id, puzzle);
    return puzzle;
  }

  get(id) {
    return this.puzzles.get(id);
  }

  getAll() {
    return Array.from(this.puzzles.values());
  }

  initBuiltins() {
    // 1. Standard WCA Cubes
    this.register({
      id: 'cube2',
      name: '2×2 Pocket Cube',
      badge: '2×2',
      category: 'Standard',
      dimensions: [2, 2, 2],
      size: 2,
      description: 'Official WCA 2×2×2 pocket cube with 8 corner pieces.'
    });

    this.register({
      id: 'cube3',
      name: '3×3 Standard Cube',
      badge: '3×3',
      category: 'Standard',
      dimensions: [3, 3, 3],
      size: 3,
      description: 'The classic Rubik\'s 3×3×3 competition speedcube.'
    });

    this.register({
      id: 'cube4',
      name: '4×4 Rubik\'s Revenge',
      badge: '4×4',
      category: 'Standard',
      dimensions: [4, 4, 4],
      size: 4,
      description: '4×4×4 multi-layer puzzle requiring center pairing and parity algorithms.'
    });

    // 2. 3×3×4 Cuboid (Fully Articulated Cuboid)
    this.register({
      id: 'cube3x3x4',
      name: '3×3×4 Cuboid',
      badge: 'Cuboid',
      category: 'Cuboid',
      dimensions: [3, 4, 3], // Width: 3, Height: 4, Depth: 3
      size: 4,
      isCuboid: true,
      description: 'Fully articulated 3×3×4 cuboid. Top and bottom (U/D) faces turn 90°, while vertical side layers (R/L/F/B) turn 180° in standard cuboid form.'
    });

    // 3. Shape Mods
    this.register({
      id: 'fisher',
      name: '🐟 Tony Fisher 45° Cube',
      badge: 'Fisher',
      category: 'Shape Mod',
      dimensions: [3, 3, 3],
      size: 3,
      isShapeMod: true,
      shapeModType: 'fisher',
      description: 'Tony Fisher\'s 1997 shape-mod with cutting planes rotated 45° around vertical axis.'
    });

    this.register({
      id: 'mirror',
      name: '🪞 Mirror / Bump Cube',
      badge: 'Mirror',
      category: 'Shape Mod',
      dimensions: [3, 3, 3],
      size: 3,
      isShapeMod: true,
      shapeModType: 'mirror',
      description: 'Asymmetric slab shape-mod solved purely by geometry and height alignment.'
    });

    this.register({
      id: 'mixup',
      name: '🔀 WitEden & Oskar Mixup 3×3',
      badge: 'Mixup',
      category: 'Shape Mod',
      dimensions: [3, 3, 3],
      size: 3,
      isShapeMod: true,
      shapeModType: 'mixup',
      description: 'WitEden & Oskar van Deventer Mixup cube with 45° middle slice turns and center-edge swaps.'
    });
  }
}

// Global registry instance
const puzzleRegistry = new PuzzleRegistry();

/**
 * Easy declarative function to define and register custom cubes
 * Example:
 *   definePuzzle({
 *     id: 'cube2x2x3',
 *     name: '2×2×3 Tower Cube',
 *     dimensions: [2, 3, 2]
 *   });
 */
function definePuzzle(config) {
  return puzzleRegistry.register(config);
}

/**
 * Generates an easy copyable JavaScript code snippet for a custom cube definition
 */
function generatePuzzleCodeSnippet(def) {
  return `definePuzzle({
  id: '${def.id || 'custom_cube'}',
  name: '${def.name || 'Custom Cube'}',
  dimensions: [${def.dimensions ? def.dimensions.join(', ') : '3, 4, 3'}],
  category: '${def.category || 'Cuboid'}',
  description: '${def.description || 'Custom twisty puzzle'}'
});`;
}

// Global exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PuzzleRegistry, puzzleRegistry, definePuzzle, generatePuzzleCodeSnippet };
} else {
  window.PuzzleRegistry = PuzzleRegistry;
  window.puzzleRegistry = puzzleRegistry;
  window.definePuzzle = definePuzzle;
  window.generatePuzzleCodeSnippet = generatePuzzleCodeSnippet;
}
