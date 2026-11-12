/**
 * Rubik's Cube Notation Parser, Validator, and Scramble Generator
 * Supports 2x2, 3x3, 4x4, Fisher Cube, Mirror Cube, and Oskar Mixup (45° slice turns).
 */

class NotationEngine {
  constructor(cubeSize = 3, puzzleType = 'cube3') {
    this.size = cubeSize;
    this.puzzleType = puzzleType;
  }

  setSize(size, puzzleType = 'cube3', dimensions = null) {
    this.size = size;
    this.puzzleType = puzzleType;
    if (dimensions) {
      this.dimensions = dimensions;
    } else {
      const reg = (typeof puzzleRegistry !== 'undefined') ? puzzleRegistry.get(puzzleType) : null;
      if (reg && reg.dimensions) {
        this.dimensions = reg.dimensions;
      } else if (puzzleType === 'cube3x3x4') {
        this.dimensions = [3, 4, 3];
      } else {
        this.dimensions = [size, size, size];
      }
    }
  }

  setPuzzleType(puzzleType) {
    this.puzzleType = puzzleType;
  }

  /**
   * Tokenizes and parses a notation string.
   */
  parse(input) {
    if (!input || typeof input !== 'string') {
      return { valid: true, moves: [], error: null, rawTokens: [] };
    }

    let cleaned = input
      .replace(/[()[\]{},;]/g, ' ')
      .replace(/['’`]/g, "'") // Normalize apostrophes
      .trim();

    if (!cleaned) {
      return { valid: true, moves: [], error: null, rawTokens: [] };
    }

    const rawTokens = cleaned.split(/\s+/).filter(t => t.length > 0);
    const parsedMoves = [];

    for (let i = 0; i < rawTokens.length; i++) {
      const token = rawTokens[i];
      const parsed = this.parseToken(token);
      if (!parsed) {
        return {
          valid: false,
          moves: [],
          error: `Invalid move token "${token}" at position ${i + 1}`,
          rawTokens,
          errorTokenIndex: i
        };
      }
      parsedMoves.push(parsed);
    }

    return {
      valid: true,
      moves: parsedMoves,
      error: null,
      rawTokens
    };
  }

  /**
   * Parses an individual notation token.
   * Supports standard WCA moves, wide moves, slice moves, rotations,
   * and Oskar Mixup 45-degree slice turns (M45, E45, S45).
   */
  parseToken(token) {
    const N = this.size;
    // Regex matches:
    // 1: optional layer prefix number (e.g. 2 in 2R or 3 in 3Rw)
    // 2: base face / slice / rotation
    // 3: optional '45' for 45-degree turns (Mixup Cube)
    // 4: suffix modifiers: ', 2, 2'
    const match = token.match(/^([1-9])?([UDLRFBxyzMESudlrfb]|(?:[UDLRFB]w))(45)?(['2]*)$/);
    if (!match) return null;

    const layerPrefix = match[1] ? parseInt(match[1], 10) : null;
    let base = match[2];
    const is45 = (match[3] === '45');
    const suffix = match[4] || '';

    // Validate layer prefix vs cube size
    if (layerPrefix !== null && layerPrefix > N) {
      return null;
    }

    // Modifiers: multiplier for quarter turns (1 = 90 deg, 0.5 = 45 deg)
    let multiplier = 1;
    if (is45) {
      if (suffix === "'") {
        multiplier = -0.5;
      } else if (suffix === '') {
        multiplier = 0.5;
      } else {
        return null;
      }
    } else {
      if (suffix === "'") {
        multiplier = -1;
      } else if (suffix === '2' || suffix === "2'") {
        multiplier = 2;
      } else if (suffix === '') {
        multiplier = 1;
      } else {
        return null;
      }
    }

    // Whole Cube Rotations: x, y, z
    if (base === 'x' || base === 'y' || base === 'z') {
      if (layerPrefix !== null || is45) return null;
      return {
        raw: token,
        name: `${base}${suffix}`,
        baseLetter: base,
        type: 'rotation',
        isRotation: true,
        isSlice: false,
        isWide: false,
        is45: false,
        multiplier
      };
    }

    // Slice Moves: M, E, S (valid for 3x3, Fisher, Mirror, and Mixup)
    if (base === 'M' || base === 'E' || base === 'S') {
      if (N === 2) return null; // 2x2 has no slice moves
      if (layerPrefix !== null) return null;

      return {
        raw: token,
        name: token,
        baseLetter: base,
        type: 'slice',
        isRotation: false,
        isSlice: true,
        isWide: false,
        is45,
        multiplier
      };
    }

    // Standard Faces & Wide moves
    if (is45) return null; // 45 degree turns only apply to slices

    let isWide = false;
    if (base.endsWith('w')) {
      isWide = true;
      base = base[0]; // extract face letter (U, D, L, R, F, B)
    } else if (base >= 'a' && base <= 'z') {
      isWide = true;
      base = base.toUpperCase();
    }

    if (!['U', 'D', 'L', 'R', 'F', 'B'].includes(base)) {
      return null;
    }

    return {
      raw: token,
      name: token,
      baseLetter: base,
      face: base,
      type: 'face',
      isRotation: false,
      isSlice: false,
      isWide,
      is45: false,
      layerPrefix,
      multiplier
    };
  }

  invertToken(token) {
    if (!token) return '';
    if (token.endsWith("'")) {
      return token.slice(0, -1);
    } else if (token.endsWith('2')) {
      return token;
    } else {
      return token + "'";
    }
  }

  invertSequence(sequenceStr) {
    const parsed = this.parse(sequenceStr);
    if (!parsed.valid || parsed.moves.length === 0) {
      return '';
    }
    const invertedTokens = parsed.moves
      .map(m => this.invertToken(m.raw))
      .reverse();
    return invertedTokens.join(' ');
  }

  generateScramble() {
    const N = this.size;
    const type = this.puzzleType;
    const reg = (typeof puzzleRegistry !== 'undefined') ? puzzleRegistry.get(type) : null;

    if (type === 'mixup') {
      return this.generateMixupScramble(18);
    } else if (type === 'fisher' || type === 'mirror') {
      return this.generate3x3Scramble(20);
    } else if (type === 'cube3x3x4' || (reg && reg.isCuboid)) {
      const dims = this.dimensions || (reg ? reg.dimensions : [3, 4, 3]);
      return this.generateCuboidScramble(dims, 20);
    } else if (N === 2) {
      return this.generate2x2Scramble(10);
    } else if (N === 4) {
      return this.generate4x4Scramble(36);
    } else {
      return this.generate3x3Scramble(21);
    }
  }

  generateCuboidScramble(dimensions = [3, 4, 3], length = 20) {
    const [Nx, Ny, Nz] = dimensions;
    const moves = [];
    const squareFaces = [];
    const nonSquareFaces = [];

    // Axis Y: U / D
    if (Nx === Nz) squareFaces.push('U', 'D');
    else nonSquareFaces.push('U', 'D');

    // Axis X: R / L
    if (Ny === Nz) squareFaces.push('R', 'L');
    else nonSquareFaces.push('R', 'L');

    // Axis Z: F / B
    if (Nx === Ny) squareFaces.push('F', 'B');
    else nonSquareFaces.push('F', 'B');

    const squareMods = ['', "'", '2'];
    let lastFace = null;

    for (let i = 0; i < length; i++) {
      const useSquare = (squareFaces.length > 0) && (Math.random() < 0.55 || nonSquareFaces.length === 0);
      let face, move;

      if (useSquare) {
        const available = squareFaces.filter(f => f !== lastFace);
        face = available[Math.floor(Math.random() * available.length)];
        const mod = squareMods[Math.floor(Math.random() * squareMods.length)];
        move = `${face}${mod}`;
      } else {
        const available = nonSquareFaces.filter(f => f !== lastFace);
        face = available[Math.floor(Math.random() * available.length)];
        move = `${face}2`;
      }

      moves.push(move);
      lastFace = face;
    }

    return moves.join(' ');
  }

  generateMixupScramble(length = 18) {
    const moves = [];
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    const slices = ['M45', "M45'", 'E45', "E45'", 'S45', "S45'"];
    const mods = ['', "'", '2'];

    for (let i = 0; i < length; i++) {
      if (Math.random() < 0.35) {
        // Slice 45 degree turn
        moves.push(slices[Math.floor(Math.random() * slices.length)]);
      } else {
        const face = faces[Math.floor(Math.random() * faces.length)];
        const mod = mods[Math.floor(Math.random() * mods.length)];
        moves.push(`${face}${mod}`);
      }
    }
    return moves.join(' ');
  }

  generate2x2Scramble(length = 10) {
    const faces = ['U', 'R', 'F'];
    const modifiers = ['', "'", '2'];
    const moves = [];
    let lastFace = null;

    while (moves.length < length) {
      const face = faces[Math.floor(Math.random() * faces.length)];
      if (face === lastFace) continue;
      const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
      moves.push(`${face}${mod}`);
      lastFace = face;
    }
    return moves.join(' ');
  }

  generate3x3Scramble(length = 21) {
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    const modifiers = ['', "'", '2'];
    const opposites = {
      'U': 'D', 'D': 'U',
      'L': 'R', 'R': 'L',
      'F': 'B', 'B': 'F'
    };

    const moves = [];
    let lastFace = null;
    let secondLastFace = null;

    while (moves.length < length) {
      const face = faces[Math.floor(Math.random() * faces.length)];
      if (face === lastFace) continue;
      if (secondLastFace === face && opposites[lastFace] === face) continue;

      const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
      moves.push(`${face}${mod}`);
      secondLastFace = lastFace;
      lastFace = face;
    }
    return moves.join(' ');
  }

  generate4x4Scramble(length = 38) {
    const outerFaces = ['U', 'D', 'L', 'R', 'F', 'B'];
    const wideFaces = ['Uw', 'Dw', 'Lw', 'Rw', 'Fw', 'Bw'];
    const allFaces = [...outerFaces, ...wideFaces];
    const modifiers = ['', "'", '2'];

    const moves = [];
    let lastBase = null;

    while (moves.length < length) {
      const face = allFaces[Math.floor(Math.random() * allFaces.length)];
      const base = face[0];
      if (base === lastBase) continue;

      const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
      moves.push(`${face}${mod}`);
      lastBase = base;
    }
    return moves.join(' ');
  }
}

if (typeof window !== 'undefined') {
  window.NotationEngine = NotationEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotationEngine };
}
