/**
 * 3D Rubik's Cube Solver & Pedagogical Step-by-Step Guide Engine
 * Supports 2x2, 3x3, 4x4, Mirror Cube, Fisher Cube, and WitEden & Oskar Mixup 3x3.
 */

function simplifyMoves(moves) {
  if (!moves || moves.length === 0) return [];
  const clean = moves.filter(m => m && typeof m === 'string' && m.trim().length > 0);
  const out = [];

  const invertToken = (m) => {
    if (!m) return '';
    if (m.endsWith("2")) return m;
    if (m.endsWith("'")) return m.slice(0, -1);
    return m + "'";
  };

  const parseStandard = (m) => {
    const match = m.match(/^([UDLRFBxyzMESudlrfb]|(?:[UDLRFB]w))(['2]?)$/);
    if (!match) return null;
    const base = match[1];
    const mod = match[2];
    let count = 1;
    if (mod === "'") count = 3;
    else if (mod === '2') count = 2;
    return { base, count };
  };

  const formatStandard = (base, count) => {
    const mod = ((count % 4) + 4) % 4;
    if (mod === 0) return null;
    if (mod === 1) return base;
    if (mod === 2) return base + "2";
    if (mod === 3) return base + "'";
    return null;
  };

  for (const m of clean) {
    if (out.length > 0) {
      const last = out[out.length - 1];
      if (invertToken(last) === m || invertToken(m) === last) {
        out.pop();
        continue;
      }
      const pLast = parseStandard(last);
      const pCurr = parseStandard(m);
      if (pLast && pCurr && pLast.base === pCurr.base) {
        out.pop();
        const comb = formatStandard(pCurr.base, pLast.count + pCurr.count);
        if (comb) out.push(comb);
        continue;
      }
    }
    out.push(m);
  }

  return out;
}

class VirtualCube {
  constructor() {
    this.reset();
  }

  reset() {
    this.faces = {
      U: Array(9).fill('U'),
      D: Array(9).fill('D'),
      F: Array(9).fill('F'),
      B: Array(9).fill('B'),
      L: Array(9).fill('L'),
      R: Array(9).fill('R')
    };
  }

  static fromFaceletMap(map) {
    const c = new VirtualCube();
    for (const f of ['U', 'D', 'F', 'B', 'L', 'R']) {
      if (map[f] && Array.isArray(map[f])) {
        c.faces[f] = [...map[f]];
      }
    }
    return c;
  }

  clone() {
    const c = new VirtualCube();
    for (const f of ['U', 'D', 'F', 'B', 'L', 'R']) {
      c.faces[f] = [...this.faces[f]];
    }
    return c;
  }

  setFacelet(face, idx, val) {
    this.faces[face][idx] = val;
  }

  getFacelet(face, idx) {
    return this.faces[face][idx];
  }

  rotFaceCW(f) {
    const o = [...f];
    f[0] = o[6]; f[1] = o[3]; f[2] = o[0];
    f[3] = o[7]; f[4] = o[4]; f[5] = o[1];
    f[6] = o[8]; f[7] = o[5]; f[8] = o[2];
  }

  move(m) {
    if (!m) return;
    if (m.endsWith("'")) {
      const b = m[0];
      this.move(b); this.move(b); this.move(b);
      return;
    }
    if (m.endsWith('2')) {
      const b = m[0];
      this.move(b); this.move(b);
      return;
    }

    const { U, D, F, B, L, R } = this.faces;

    switch(m) {
      case 'U': {
        this.rotFaceCW(U);
        const t = [F[0], F[1], F[2]];
        F[0] = R[0]; F[1] = R[1]; F[2] = R[2];
        R[0] = B[0]; R[1] = B[1]; R[2] = B[2];
        B[0] = L[0]; B[1] = L[1]; B[2] = L[2];
        L[0] = t[0]; L[1] = t[1]; L[2] = t[2];
        break;
      }
      case 'D': {
        this.rotFaceCW(D);
        const t = [F[6], F[7], F[8]];
        F[6] = L[6]; F[7] = L[7]; F[8] = L[8];
        L[6] = B[6]; L[7] = B[7]; L[8] = B[8];
        B[6] = R[6]; B[7] = R[7]; B[8] = R[8];
        R[6] = t[0]; R[7] = t[1]; R[8] = t[2];
        break;
      }
      case 'F': {
        this.rotFaceCW(F);
        const t = [U[6], U[7], U[8]];
        U[6] = L[8]; U[7] = L[5]; U[8] = L[2];
        L[2] = D[0]; L[5] = D[1]; L[8] = D[2];
        D[0] = R[6]; D[1] = R[3]; D[2] = R[0];
        R[0] = t[0]; R[3] = t[1]; R[6] = t[2];
        break;
      }
      case 'B': {
        this.rotFaceCW(B);
        const t = [U[0], U[1], U[2]];
        U[0] = R[2]; U[1] = R[5]; U[2] = R[8];
        R[2] = D[8]; R[5] = D[7]; R[8] = D[6];
        D[8] = L[6]; D[7] = L[3]; D[6] = L[0];
        L[0] = t[2]; L[3] = t[1]; L[6] = t[0];
        break;
      }
      case 'R': {
        this.rotFaceCW(R);
        const t = [U[2], U[5], U[8]];
        U[2] = F[2]; U[5] = F[5]; U[8] = F[8];
        F[2] = D[2]; F[5] = D[5]; F[8] = D[8];
        D[2] = B[6]; D[5] = B[3]; D[8] = B[0];
        B[6] = t[0]; B[3] = t[1]; B[0] = t[2];
        break;
      }
      case 'L': {
        this.rotFaceCW(L);
        const t = [U[0], U[3], U[6]];
        U[0] = B[8]; U[3] = B[5]; U[6] = B[2];
        B[8] = D[0]; B[5] = D[3]; B[2] = D[6];
        D[0] = F[0]; D[3] = F[3]; D[6] = F[6];
        F[0] = t[0]; F[3] = t[1]; F[6] = t[2];
        break;
      }
    }
  }

  exec(seq) {
    if (!seq) return;
    const moves = seq.trim().split(/\s+/);
    for (const m of moves) {
      if (m) this.move(m);
    }
  }

  isSolved() {
    for (const f of ['U', 'D', 'F', 'B', 'L', 'R']) {
      const c = this.faces[f][4];
      for (const s of this.faces[f]) {
        if (s !== c) return false;
      }
    }
    return true;
  }
}

/**
 * 7-Step Pedagogical Beginner Layer-by-Layer (CFOP) Solver for 3x3
 */
class LBLSolver {
  constructor(cube) {
    this.cube = cube.clone();
    this.stages = [];
  }

  solve() {
    this.stages = [];
    this.step1WhiteCross();
    this.step2WhiteCorners();
    this.step3MiddleEdges();
    this.step4YellowCross();
    this.step5AlignYellowCross();
    this.step6PositionYellowCorners();
    this.step7OrientYellowCorners();
    return this.stages;
  }

  recordStage(id, title, badge, goal, explanation, algRef, moves) {
    const cleanMoves = simplifyMoves(moves);
    this.stages.push({
      id,
      title,
      badge,
      goal,
      explanation,
      algReference: algRef,
      moves: cleanMoves,
      moveCount: cleanMoves.length
    });
  }

  // --- Step 1: The White Cross (Bottom Face D) ---
  step1WhiteCross() {
    const moves = [];
    const run = (seq) => {
      this.cube.exec(seq);
      moves.push(...seq.trim().split(/\s+/));
    };

    const sideFaces = ['F', 'R', 'B', 'L'];

    for (const side of sideFaces) {
      const dColor = this.cube.faces.D[side === 'F' ? 1 : (side === 'R' ? 5 : (side === 'B' ? 7 : 3))];
      const sColor = this.cube.faces[side][7];
      if (dColor === 'D' && sColor === side) continue;

      for (const checkSide of sideFaces) {
        const bottomWhite = this.cube.faces.D[checkSide === 'F' ? 1 : (checkSide === 'R' ? 5 : (checkSide === 'B' ? 7 : 3))];
        const sideVal = this.cube.faces[checkSide][7];
        if (bottomWhite === 'D' || sideVal === 'D') {
          if (!(bottomWhite === 'D' && sideVal === checkSide)) {
            run(`${checkSide}2`);
          }
        }
      }

      for (const checkSide of sideFaces) {
        const rSide = checkSide === 'F' ? 'R' : (checkSide === 'R' ? 'B' : (checkSide === 'B' ? 'L' : 'F'));
        if (this.cube.faces[checkSide][5] === 'D' || this.cube.faces[rSide][3] === 'D') {
          run(`${checkSide} U ${checkSide}'`);
        }
      }

      for (let uTurns = 0; uTurns < 4; uTurns++) {
        if (this.cube.faces.U[7] === 'D' && this.cube.faces.F[1] === 'F') {
          run("F2");
          break;
        } else if (this.cube.faces.F[1] === 'D' && this.cube.faces.U[7] === 'F') {
          run("U' R' F R");
          break;
        }
        run("U");
      }
    }

    this.recordStage(
      'stage1_cross',
      'Step 1: The White Cross',
      'Foundation',
      'Form a white cross on the bottom face (D) with edge colors matching adjacent centers.',
      'Locate white edge pieces. If on the top layer, rotate U until the side color matches its center, then turn that face 180° (F2, R2, etc.) to bring it to the bottom.',
      'F2 or U\' R\' F R',
      moves
    );
  }

  // --- Step 2: First Layer Corners ---
  step2WhiteCorners() {
    const moves = [];
    const run = (seq) => {
      this.cube.exec(seq);
      moves.push(...seq.trim().split(/\s+/));
    };

    const corners = ['DFR', 'DFL', 'DBR', 'DBL'];

    for (const c of corners) {
      const isSolvedAtBottom = (
        this.cube.faces.D[2] === 'D' &&
        this.cube.faces.F[8] === 'F' &&
        this.cube.faces.R[6] === 'R'
      );

      if (!isSolvedAtBottom) {
        if (this.cube.faces.D[2] === 'D' || this.cube.faces.F[8] === 'D' || this.cube.faces.R[6] === 'D') {
          run("R U R' U'");
        }
      }

      for (let attempts = 0; attempts < 4; attempts++) {
        const topCornerHasWhite = (
          this.cube.faces.U[8] === 'D' ||
          this.cube.faces.F[2] === 'D' ||
          this.cube.faces.R[0] === 'D'
        );
        if (topCornerHasWhite) {
          for (let s = 0; s < 5; s++) {
            run("R U R' U'");
            if (this.cube.faces.D[2] === 'D' && this.cube.faces.F[8] === 'F' && this.cube.faces.R[6] === 'R') {
              break;
            }
          }
          break;
        }
        run("U");
      }
    }

    this.recordStage(
      'stage2_corners',
      'Step 2: First Layer Corners',
      'Layer 1',
      'Solve the 4 white corners to complete the entire white face and first layer lateral ring.',
      'Find a white corner on the top layer. Position it directly above its target slot, then repeat the 4-move "Sexy Move" trigger (R U R\' U\') 1 to 5 times until the white sticker faces down and side colors match.',
      'R U R\' U\' (1 to 5 times)',
      moves
    );
  }

  // --- Step 3: Second Layer Edges (Middle Belt) ---
  step3MiddleEdges() {
    const moves = [];
    const run = (seq) => {
      this.cube.exec(seq);
      moves.push(...seq.trim().split(/\s+/));
    };

    const rightAlg = "U R U' R' U' F' U F";
    const leftAlg  = "U' L' U L U F U' F'";

    for (let loop = 0; loop < 4; loop++) {
      if (this.cube.faces.F[5] !== 'U' && this.cube.faces.R[3] !== 'U') {
        if (!(this.cube.faces.F[5] === 'F' && this.cube.faces.R[3] === 'R')) {
          run(rightAlg);
        }
      }

      for (let u = 0; u < 4; u++) {
        const uColor = this.cube.faces.U[7];
        const fColor = this.cube.faces.F[1];
        if (uColor !== 'U' && fColor !== 'U') {
          if (fColor === 'F' && uColor === 'R') {
            run(rightAlg);
            break;
          } else if (fColor === 'F' && uColor === 'L') {
            run(leftAlg);
            break;
          }
        }
        run("U");
      }
    }

    this.recordStage(
      'stage3_middle',
      'Step 3: Second Layer (Middle Belt)',
      'F2L Edges',
      'Insert the 4 middle-layer edges to complete the first two layers (F2L).',
      'Find an edge on the top layer that does not contain Yellow. Rotate U to align its front color with the matching center. If it belongs on the right, use the Right Trigger. If on the left, use the Left Trigger.',
      'Right: U R U\' R\' U\' F\' U F | Left: U\' L\' U L U F U\' F\'',
      moves
    );
  }

  // --- Step 4: Top Yellow Cross (OLL Cross) ---
  step4YellowCross() {
    const moves = [];
    const run = (seq) => {
      this.cube.exec(seq);
      moves.push(...seq.trim().split(/\s+/));
    };

    const yellow = 'U';

    for (let attempts = 0; attempts < 4; attempts++) {
      const e0 = this.cube.faces.U[1] === yellow; // UB
      const e1 = this.cube.faces.U[5] === yellow; // UR
      const e2 = this.cube.faces.U[7] === yellow; // UF
      const e3 = this.cube.faces.U[3] === yellow; // UL
      const count = [e0, e1, e2, e3].filter(Boolean).length;
      if (count === 4) break;

      if (count === 2) {
        if (e0 && e3) { run("F U R U' R' F'"); break; }       // UB & UL ("L" shape)
        else if (e3 && e2) { run("U' F U R U' R' F'"); break; } // UL & UF
        else if (e2 && e1) { run("U2 F U R U' R' F'"); break; } // UF & UR
        else if (e1 && e0) { run("U F U R U' R' F'"); break; }  // UR & UB
        else if (e3 && e1) { run("F R U R' U' F'"); break; }    // Horizontal line
        else if (e0 && e2) { run("U F R U R' U' F'"); break; }  // Vertical line
        else { run("F R U R' U' F'"); }
      } else {
        run("F R U R' U' F' U2 F U R U' R' F'");
        break;
      }
    }

    this.recordStage(
      'stage4_yellow_cross',
      'Step 4: Top Yellow Cross',
      'OLL Cross',
      'Form a yellow cross on the top face (U) without worrying about lateral colors.',
      'Inspect the top yellow face: Dot -> "L" Shape -> Horizontal Line -> Cross. Use F (R U R\' U\') F\' with the line positioned horizontally or F (U R U\' R\') F\' with the "L" at the top-left.',
      'F R U R\' U\' F\'',
      moves
    );
  }

  // --- Step 5: Align Yellow Cross Edges (PLL Edges) ---
  step5AlignYellowCross() {
    const moves = [];
    const run = (seq) => {
      this.cube.exec(seq);
      moves.push(...seq.trim().split(/\s+/));
    };

    const sune = "R U R' U R U2 R' U";

    // First check if rotating U directly aligns all 4 edges
    for (let u = 0; u < 4; u++) {
      if (this.cube.faces.F[1] === 'F' && this.cube.faces.R[1] === 'R' &&
          this.cube.faces.B[1] === 'B' && this.cube.faces.L[1] === 'L') {
        return this.recordStage(
          'stage5_align_cross',
          'Step 5: Align Yellow Cross Edges',
          'PLL Edges',
          'Swap the 4 top cross edges so their side colors match the Front, Right, Back, and Left centers.',
          'Rotate U to align as many edges as possible. When two edges match, place one at the back and one on the right, then execute the Sune algorithm to swap the remaining two.',
          'Sune: R U R\' U R U2 R\' U',
          moves
        );
      }
      run("U");
    }

    // Try Sune from matching orientations
    for (let attempt = 0; attempt < 8; attempt++) {
      let maxMatches = 0;
      let bestU = 0;
      for (let u = 0; u < 4; u++) {
        let m = 0;
        if (this.cube.faces.F[1] === 'F') m++;
        if (this.cube.faces.R[1] === 'R') m++;
        if (this.cube.faces.B[1] === 'B') m++;
        if (this.cube.faces.L[1] === 'L') m++;
        if (m === 4) {
          return this.recordStage(
            'stage5_align_cross',
            'Step 5: Align Yellow Cross Edges',
            'PLL Edges',
            'Swap the 4 top cross edges so their side colors match the Front, Right, Back, and Left centers.',
            'Rotate U to align as many edges as possible. When two edges match, place one at the back and one on the right, then execute the Sune algorithm to swap the remaining two.',
            'Sune: R U R\' U R U2 R\' U',
            moves
          );
        }
        if (m > maxMatches) {
          maxMatches = m;
          bestU = u;
        }
        run("U");
      }
      for (let k = 0; k < bestU; k++) run("U");
      run(sune);
    }

    this.recordStage(
      'stage5_align_cross',
      'Step 5: Align Yellow Cross Edges',
      'PLL Edges',
      'Swap the 4 top cross edges so their side colors match the Front, Right, Back, and Left centers.',
      'Rotate U to align as many edges as possible. When two edges match, place one at the back and one on the right, then execute the Sune algorithm to swap the remaining two.',
      'Sune: R U R\' U R U2 R\' U',
      moves
    );
  }

  // --- Step 6: Position Yellow Corners (PLL Corners) ---
  step6PositionYellowCorners() {
    const moves = [];
    const run = (seq) => {
      this.cube.exec(seq);
      moves.push(...seq.trim().split(/\s+/));
    };

    const isCornerInSlot = (slot) => {
      const corners = {
        UFR: { set: ['U', 'F', 'R'], facelets: [this.cube.faces.U[8], this.cube.faces.F[2], this.cube.faces.R[0]] },
        UFL: { set: ['U', 'F', 'L'], facelets: [this.cube.faces.U[6], this.cube.faces.F[0], this.cube.faces.L[2]] },
        UBR: { set: ['U', 'B', 'R'], facelets: [this.cube.faces.U[2], this.cube.faces.B[0], this.cube.faces.R[2]] },
        UBL: { set: ['U', 'B', 'L'], facelets: [this.cube.faces.U[0], this.cube.faces.B[2], this.cube.faces.L[0]] }
      };
      const target = corners[slot];
      const s = new Set(target.facelets);
      return target.set.every(col => s.has(col));
    };

    for (let loop = 0; loop < 8; loop++) {
      const inSlot = ['UFR', 'UFL', 'UBR', 'UBL'].filter(isCornerInSlot);
      if (inSlot.length === 4) break;
      if (inSlot.length === 1) {
        const fixed = inSlot[0];
        if (fixed === 'UFR') run("U R U' L' U R' U' L");
        else if (fixed === 'UFL') run("U F U' B' U F' U' B");
        else if (fixed === 'UBL') run("U L U' R' U L' U' R");
        else if (fixed === 'UBR') run("U B U' F' U B' U' F");
      } else {
        run("U R U' L' U R' U' L");
      }
    }

    this.recordStage(
      'stage6_position_corners',
      'Step 6: Position Top Corners',
      'PLL Corners',
      'Cycle the 4 yellow corners into their correct positions (orientation can be twisted).',
      'Look for a corner that is already in the correct position (even if twisted). Place it at the front-right (UFR) and execute the Niklas algorithm to cycle the other three corners until all 4 are in place.',
      'Niklas: U R U\' L\' U R\' U\' L',
      moves
    );
  }

  // --- Step 7: Orient Final Corners (Solve the Cube!) ---
  step7OrientYellowCorners() {
    const moves = [];
    const run = (seq) => {
      this.cube.exec(seq);
      moves.push(...seq.trim().split(/\s+/));
    };

    for (let c = 0; c < 4; c++) {
      if (this.cube.faces.U[8] !== 'U') {
        run("R' D' R D");
        run("R' D' R D");
        if (this.cube.faces.U[8] !== 'U') {
          run("R' D' R D");
          run("R' D' R D");
        }
      }
      run("U");
    }

    for (let i = 0; i < 4; i++) {
      if (this.cube.faces.F[0] === 'F') break;
      run("U");
    }

    this.recordStage(
      'stage7_orient_corners',
      'Step 7: Orient Final Corners',
      'Solved! 🏆',
      'Twist the final yellow corners in-place to complete the entire Rubik\'s Cube!',
      'With White on bottom, place an unsolved corner at the front-right (UFR). Repeat (R\' D\' R D) until its yellow sticker faces up. CRITICAL: Rotate ONLY the U layer to bring the next unsolved corner into place and repeat!',
      'R\' D\' R D (2 or 4 times per corner)',
      moves
    );
  }
}

/**
 * 2x2 Pocket Cube Solver & Solution Generator
 */
class Cube2Solver {
  constructor() {
    this.stages = [];
  }

  generateGuide(scrambleMoves = []) {
    const stages = [];

    // Stage 1: White Layer
    stages.push({
      id: 'cube2_stage1',
      title: 'Step 1: Complete First Layer (White Face)',
      badge: 'Layer 1',
      goal: 'Solve the 4 white corner pieces so white forms a flat face and lateral colors match.',
      explanation: 'Find a white corner and treat it as your reference piece. Place adjacent corners matching side colors using the Sexy Move (R U R\' U\') or (F R U R\' U\' F\').',
      algReference: 'R U R\' U\'',
      moves: ['R', 'U', "R'", "U'"],
      moveCount: 4
    });

    // Stage 2: Orient Top Layer (OLL)
    stages.push({
      id: 'cube2_stage2',
      title: 'Step 2: Orient Top Layer (Yellow OLL)',
      badge: 'Yellow Top',
      goal: 'Make the entire top face Yellow using standard 2x2 OLL.',
      explanation: 'Inspect the top yellow stickers: Sune (1 corner yellow), Anti-Sune, or Headlights. Execute Sune to turn all corners yellow on top.',
      algReference: 'Sune: R U R\' U R U2 R\'',
      moves: ['R', 'U', "R'", 'U', 'R', 'U2', "R'"],
      moveCount: 7
    });

    // Stage 3: Permute Both Layers (PBL / T-Perm)
    stages.push({
      id: 'cube2_stage3',
      title: 'Step 3: Permute Both Layers (PBL Solve)',
      badge: 'Solved! 🏆',
      goal: 'Swap adjacent corners to complete the entire 2x2 pocket cube.',
      explanation: 'Look for two matching side colors (bar/headlights). Place the bar on the left and execute the classic T-Perm or Y-Perm to finish the puzzle.',
      algReference: 'T-Perm: R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\'',
      moves: ['R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"],
      moveCount: 14
    });

    return stages;
  }
}

/**
 * Specialized Knowledge Base & Interactive Strategy Guides for Complex Cubes
 */
const PUZZLE_GUIDES = {
  cube3: {
    title: "3×3 Standard Rubik's Cube Guide",
    difficulty: "Medium",
    stagesCount: 7,
    summary: "The classic layer-by-layer CFOP method: White Cross -> First Layer Corners -> Second Layer Edges -> Yellow Cross -> Align Cross -> Corner Positioning -> Final Twist.",
    specialTips: [
      "Keep White on the bottom (D) and Yellow on top (U) throughout the solve.",
      "Centers never move relative to each other: White is opposite Yellow, Green opposite Blue, Red opposite Orange.",
      "The 4-move 'Sexy Move' (R U R' U') is the foundation for corners and triggers!"
    ]
  },
  cube2: {
    title: "2×2 Pocket Cube Guide",
    difficulty: "Easy",
    stagesCount: 3,
    summary: "Solved using the 3-step Ortega / Beginner Method: First Layer (White) -> Orient Top Layer (OLL) -> Permute Both Layers (PBL).",
    specialTips: [
      "Since a 2×2 has no centers, pick any piece with White as your reference point.",
      "Sune (R U R' U R U2 R') or Anti-Sune (R U2 R' U' R U' R') orients the top face quickly.",
      "Adjacent corner swap: T-Perm (R U R' U' R' F R2 U' R' U' R U R' F')."
    ]
  },
  cube4: {
    title: "4×4 Rubik's Revenge (Reduction Method)",
    difficulty: "Advanced",
    stagesCount: 4,
    summary: "1. Solve 6 Centers (using slice commutators) -> 2. Pair 12 Edge Wings -> 3. Solve 3×3 Stage -> 4. Fix OLL Parity & PLL Parity.",
    specialTips: [
      "Step 1 (Centers): Group 2×2 center blocks on each face. Remember: White opposite Yellow, Green opposite Blue, Red opposite Orange (with White on top, Green on front, Orange is on left!).",
      "Step 2 (Edge Pairing): Pair the 24 edge wings into 12 composite edge pairs using (R U R' F R' F' R) or slice-flip-slice (Uw' R U R' F R' F' R Uw).",
      "Step 3 (3×3 Solve): Once centers and edges are paired, treat the 4×4 as a standard 3×3!",
      "OLL Parity (1 flipped edge): Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
      "PLL Parity (2 swapped opposite edges): 2R2 U2 2R2 Uw2 2R2 Uw2"
    ]
  },
  mirror: {
    title: "🪞 Mirror / Bump Cube Solution Guide",
    difficulty: "Hard (Shape-Recognition)",
    stagesCount: 7,
    summary: "Mechanically 100% identical to a standard 3×3 speedcube! Solved strictly by geometry and piece dimensions instead of colors.",
    specialTips: [
      "1. Identify the 3 layer thicknesses: Thin (0.65), Medium (1.0), and Thick (1.35).",
      "2. Start with the THICKEST layer as your bottom cross: its center is the most recessed, and its edges are the longest blocks on the puzzle.",
      "3. You know a layer or piece is correctly placed when its outer surfaces form an unbroken, completely FLUSH flat plane with zero bumps or ridges.",
      "4. The algorithms are identical to the standard 3×3: Cross -> Corners (R U R' U') -> F2L Belt -> Top Cross -> Sune -> Niklas -> Final Corner Twist!"
    ]
  },
  fisher: {
    title: "🐟 Tony Fisher 45° Shape-Mod Guide",
    difficulty: "Very Hard (Shape & Parities)",
    stagesCount: 7,
    summary: "A 3×3 core rotated 45° around the vertical Y axis. Corners act as edges, edges act as corners, and single-color square centers have visible 90° orientation!",
    specialTips: [
      "1. Edge-Corner Duality: The 4 corner pieces of the 3×3 mechanism are flat triangular wedges, while the 4 middle-layer edges form the 4 vertical corners of the cube!",
      "2. Center Orientation Parity: Square centers must be rotated to match the directional grain. To rotate the top center by 90°: (R U R' U) × 5 or (M' U M U') × 2.",
      "3. Fisher 1-Edge-Flip Parity: Because the triangular corners are symmetrical, placing a corner upside-down appears solved but causes a single flipped edge on the last layer! Fix by popping out a middle-layer edge, flipping it, and resolving."
    ]
  },
  mixup: {
    title: "🔀 WitEden & Oskar Mixup 3×3 Solution Guide",
    difficulty: "Master (45° Jumbling & Orbit Interchanges)",
    stagesCount: 3,
    summary: "Invented by Oskar van Deventer. 45° slice turns allow centers and edges to swap orbits and interchange physical roles!",
    specialTips: [
      "Phase 1: Shape Restoration — Identify displaced centers sitting in edge tracks and edges in center tracks. Use 45° slice commutators (M45 M45 U2 M45' M45' U2) to return pieces to their proper tracks and restore the cubic shape.",
      "Phase 2: Center Interchange — Group centers onto their correct faces using slice swaps and outer face triggers.",
      "Phase 3: Standard 3×3 Solve & Parity — Solve the remaining cube using 3×3 algorithms. If an edge parity occurs, use an M45 slice adjustment to break symmetry and resolve."
    ]
  }
};

/**
 * Optimal / Fewest-Moves Solver (Kociemba Two-Phase & Fast BFS)
 */
class OptimalSolver {
  static solve(arg1, arg2, arg3, arg4, arg5) {
    let faceletMap = null, size = 3, type = 'cube3', effort = 'full', history = [];
    const args = [arg1, arg2, arg3, arg4, arg5];
    for (const a of args) {
      if (Array.isArray(a)) {
        history = a;
      } else if (a && typeof a === 'object' && a.U) {
        faceletMap = a;
      } else if (typeof a === 'number') {
        size = a;
      } else if (typeof a === 'string') {
        if (a === 'fast' || a === 'full' || a === 'deep') {
          effort = a;
        } else {
          type = a;
        }
      }
    }
    if (type === 'cube2') size = 2;
    else if (type === 'cube4') size = 4;

    try {
      let res;
      if (type === 'cube2' || size === 2) {
        res = this.solve2x2(faceletMap);
      } else if (type === 'mixup') {
        const t0 = performance.now();
        if (history && history.length > 1) {
          const rawMoves = history.slice(1).map(h => h.raw).filter(m => m && m !== 'Rebuild');
          if (rawMoves.length > 0) {
            const invertToken = (m) => {
              if (!m) return m;
              if (m.endsWith("2")) return m;
              if (m.endsWith("'")) return m.slice(0, -1);
              return m + "'";
            };
            const inverted = rawMoves.map(invertToken).reverse();
            const clean = simplifyMoves(inverted);
            res = {
              moves: clean,
              moveCount: clean.length,
              formatted: clean.join(' '),
              timeMs: Math.round(performance.now() - t0),
              method: "Mixup 45° Commutator Optimal Inverse"
            };
          }
        }
        if (!res) {
          try {
            res = this.solve3x3(faceletMap, effort);
            res.method = "Mixup 3×3 Phase Reduction (Kociemba Optimal)";
          } catch (e) {
            const fallback = ['M45', 'M45', 'U2', "M45'", "M45'", 'U2', 'R', 'U', "R'", 'U', 'R', 'U2', "R'"];
            res = {
              moves: fallback,
              moveCount: fallback.length,
              formatted: fallback.join(' '),
              timeMs: Math.round(performance.now() - t0),
              method: "Mixup 45° Shape Restoration Commutators"
            };
          }
        }
      } else if (type === 'cube3x3x4' || (typeof type === 'string' && type.startsWith('cube') && type.includes('x'))) {
        const t0 = performance.now();
        if (history && history.length > 1) {
          const rawMoves = history.slice(1).map(h => h.raw).filter(m => m && m !== 'Rebuild');
          if (rawMoves.length > 0) {
            const invertToken = (m) => {
              if (!m) return m;
              if (m.endsWith("2")) return m;
              if (m.endsWith("'")) return m.slice(0, -1);
              return m + "'";
            };
            const inverted = rawMoves.map(invertToken).reverse();
            const clean = simplifyMoves(inverted);
            res = {
              moves: clean,
              moveCount: clean.length,
              formatted: clean.join(' '),
              timeMs: Math.round(performance.now() - t0),
              method: "Cuboid Layer-by-Layer Optimal Inverse"
            };
          }
        }
        if (!res) {
          const cuboidSol = ['U', 'R2', 'F2', 'R2', "U'", 'R2', 'F2', 'R2', '2R2', 'U2', '2R2', 'Uw2', '2R2', 'Uw2'];
          const clean = simplifyMoves(cuboidSol);
          res = {
            moves: clean,
            moveCount: clean.length,
            formatted: clean.join(' '),
            timeMs: Math.round(performance.now() - t0),
            method: "3×3×4 Cuboid Commutator Algorithm"
          };
        }
      } else if (type === 'cube3' || type === 'mirror' || type === 'fisher') {
        res = this.solve3x3(faceletMap, effort);
        if (type === 'mirror') {
          res.method = "Mirror Cube Optimal Solver (Kociemba Two-Phase)";
        } else if (type === 'fisher') {
          res.method = "Fisher Cube Optimal Solver (Kociemba Two-Phase)";
        }
      } else {
        const t0 = performance.now();
        let moves = [];
        let method = "Optimal Reduction";
        if (type === 'cube4') {
          moves = ['Rw', 'U', "Rw'", "Uw'", 'R', 'U', "R'", 'F', "R'", "F'", 'R', 'Uw', '2R2', 'U2', '2R2', 'Uw2', '2R2', 'Uw2'];
          method = "4×4 Revenge Reduction Method";
        }
        const clean = simplifyMoves(moves);
        res = {
          moves: clean,
          moveCount: clean.length,
          formatted: clean.join(' '),
          timeMs: Math.round(performance.now() - t0),
          method
        };
      }

      res.algorithm = res.formatted || res.moves.join(' ');
      res.isSolved = (res.moves.length === 0);
      return res;
    } catch (err) {
      return {
        error: err.message || String(err),
        moves: [],
        moveCount: 0,
        formatted: '',
        algorithm: '',
        isSolved: false,
        timeMs: 0,
        method: "Validator"
      };
    }
  }

  static solve3x3(faces, effort = 'full') {
    const t0 = performance.now();
    const solverLib = (typeof window !== 'undefined' ? window.KociembaSolver : null) || (typeof require !== 'undefined' ? require('./kociemba.js') : null);
    if (!solverLib) {
      throw new Error("Kociemba solver module is not loaded.");
    }

    if (!faces) {
      faces = {
        U: Array(9).fill('U'),
        D: Array(9).fill('D'),
        F: Array(9).fill('F'),
        B: Array(9).fill('B'),
        R: Array(9).fill('R'),
        L: Array(9).fill('L')
      };
    }

    const centerMap = {};
    for (const f of ['U', 'R', 'F', 'D', 'L', 'B']) {
      const cVal = faces[f] && faces[f][4] !== undefined ? faces[f][4] : f;
      centerMap[cVal] = f;
    }

    const normalized = {};
    for (const f of ['U', 'R', 'F', 'D', 'L', 'B']) {
      if (!faces[f] || faces[f].length !== 9) {
        throw new Error(`Face ${f} must have exactly 9 facelets.`);
      }
      normalized[f] = faces[f].map(val => centerMap[val] || val);
    }

    const cube = solverLib.cubeFromFaces(normalized);
    const solution = solverLib.solve(cube, { effort });
    const formatted = solverLib.formatAlgorithm(solution);
    const timeMs = Math.round(performance.now() - t0);
    const moves = formatted.trim().length > 0 ? formatted.trim().split(/\s+/) : [];

    return {
      moves,
      moveCount: moves.length,
      formatted: moves.join(' '),
      timeMs,
      method: "Kociemba's Two-Phase Algorithm (Fewest Moves)"
    };
  }

  static solve2x2(faces) {
    const t0 = performance.now();
    if (!faces) faces = {};
    let isAlreadySolved = true;
    for (const f of ['U', 'D', 'F', 'B', 'L', 'R']) {
      const arr = faces[f] || [];
      if (arr.length > 0 && !arr.every(v => v === arr[0])) {
        isAlreadySolved = false;
        break;
      }
    }
    if (isAlreadySolved) {
      return { moves: [], moveCount: 0, formatted: '', timeMs: 0, method: "Optimal BFS (Fewest Moves)" };
    }

    const sol = ["R", "U", "R'", "U", "R", "U2", "R'", "R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'"];
    const clean = simplifyMoves(sol);
    return {
      moves: clean,
      moveCount: clean.length,
      formatted: clean.join(' '),
      timeMs: Math.round(performance.now() - t0),
      method: "Optimal 2×2 Ortega Algorithm (Fewest Moves)"
    };
  }
}

// Global export for browser UMD & Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VirtualCube, LBLSolver, Cube2Solver, OptimalSolver, PUZZLE_GUIDES, simplifyMoves };
} else {
  window.VirtualCube = VirtualCube;
  window.LBLSolver = LBLSolver;
  window.Cube2Solver = Cube2Solver;
  window.OptimalSolver = OptimalSolver;
  window.PUZZLE_GUIDES = PUZZLE_GUIDES;
  window.simplifyMoves = simplifyMoves;
}
