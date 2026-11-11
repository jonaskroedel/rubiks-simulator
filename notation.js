/**
 * Rubik's Cube Notation Parser, Validator, and Scramble Generator
 * Supports 2x2, 3x3, and 4x4 standard WCA notation.
 */

class NotationEngine {
  constructor(cubeSize = 3) {
    this.size = cubeSize;
  }

  setSize(size) {
    this.size = size;
  }

  /**
   * Tokenizes and parses a notation string.
   * Handles spaces, brackets, parentheses, comments, and standard WCA tokens.
   * Returns: { valid: boolean, moves: Move[], error: string|null, rawTokens: string[] }
   */
  parse(input) {
    if (!input || typeof input !== 'string') {
      return { valid: true, moves: [], error: null, rawTokens: [] };
    }

    // Clean input: remove parentheses, brackets, commas, quotes
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
   * Parses an individual notation token for the current cube size.
   * Stores both semantic metadata (face, multiplier, prefix, isWide, isSlice)
   * and default fixed-orientation parameters.
   */
  parseToken(token) {
    const N = this.size;
    // Regex matches:
    // 1: optional layer prefix number (e.g., 2 in 2R or 3 in 3Rw)
    // 2: base face / slice / rotation: U, D, L, R, F, B, Uw, Dw, etc., or lowercase u, d, etc., or M, E, S, or x, y, z
    // 3: suffix modifiers: ', 2, 2', etc.
    const match = token.match(/^([1-9])?([UDLRFBxyzMESudlrfb]|(?:[UDLRFB]w))(['2]*)$/);
    if (!match) return null;

    const layerPrefix = match[1] ? parseInt(match[1], 10) : null;
    let base = match[2];
    const suffix = match[3] || '';

    // Validate layer prefix vs cube size
    if (layerPrefix !== null && layerPrefix > N) {
      return null;
    }

    // Modifiers: multiplier for quarter turns
    let multiplier = 1;
    if (suffix === "'") {
      multiplier = -1;
    } else if (suffix === '2' || suffix === "2'") {
      multiplier = 2;
    } else if (suffix === '') {
      multiplier = 1;
    } else {
      return null;
    }

    // Whole Cube Rotations: x, y, z
    if (base === 'x' || base === 'y' || base === 'z') {
      if (layerPrefix !== null) return null;
      return {
        raw: token,
        name: `${base}${suffix}`,
        baseLetter: base,
        type: 'rotation',
        isRotation: true,
        isSlice: false,
        isWide: false,
        multiplier
      };
    }

    // Slice Moves: M, E, S
    if (base === 'M' || base === 'E' || base === 'S') {
      if (N === 2) return null; // 2x2 has no slice moves
      if (layerPrefix !== null) return null;

      return {
        raw: token,
        name: `${base}${suffix}`,
        baseLetter: base,
        type: 'slice',
        isRotation: false,
        isSlice: true,
        isWide: false,
        multiplier
      };
    }

    // Standard Faces & Wide moves
    let isWide = false;
    if (base.endsWith('w')) {
      isWide = true;
      base = base[0]; // extract face letter (U, D, L, R, F, B)
    } else if (base >= 'a' && base <= 'z') {
      isWide = true;
      base = base.toUpperCase();
    }

    // Validate valid face letter
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
    if (N === 2) {
      return this.generate2x2Scramble(10);
    } else if (N === 4) {
      return this.generate4x4Scramble(38);
    } else {
      return this.generate3x3Scramble(21);
    }
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

// Support both window global and ES module / CommonJS
if (typeof window !== 'undefined') {
  window.NotationEngine = NotationEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotationEngine };
}
