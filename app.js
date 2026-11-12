/**
 * Main Application Logic for Rubik's Cube Simulator
 * Coordinates UI, 3D Engine, Notation Parser, Playback Queue,
 * Chess-Style Move History, Saved States, Cube Designer Studio,
 * 3D Physical Cube Rebuilder, and Kociemba Optimal Instant Solver.
 */

/**
 * Interactive 3D Cube Painter for Physical Cube Rebuilder
 * Allows full orbit rotation, hover highlighting, and click-to-paint directly on cubie faces.
 */
class Rebuilder3DPainter {
  constructor(containerElement, onFaceletPainted) {
    this.container = containerElement;
    this.onFaceletPainted = onFaceletPainted;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.cubeGroup = null;
    this.hoverReticle = null;
    this.cubies = [];
    this.faceletCubieMap = { U: [], D: [], F: [], B: [], R: [], L: [] };
    this.size = 3;
    this.theme = null;
    this.materialsCache = {};
    this.bodyMaterial = null;
    this.pointerDownPos = { x: 0, y: 0 };
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isInitialized = false;
  }

  initThree() {
    if (this.isInitialized) return;
    const w = this.container.clientWidth || 480;
    const h = this.container.clientHeight || 420;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE && window.THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.enablePan = false;
      this.controls.minDistance = 3.5;
      this.controls.maxDistance = 22;
    }

    const ambLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambLight);

    const dir1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dir1.position.set(10, 15, 12);
    this.scene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0xb0c4de, 0.45);
    dir2.position.set(-10, -12, -10);
    this.scene.add(dir2);

    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    // Hover wireframe reticle
    const reticleGeo = new THREE.PlaneGeometry(0.92, 0.92);
    const edgesGeo = new THREE.EdgesGeometry(reticleGeo);
    this.hoverReticle = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 3, depthTest: false })
    );
    this.hoverReticle.visible = false;
    this.hoverReticle.renderOrder = 999;
    this.scene.add(this.hoverReticle);

    this.bindPointerEvents();
    this.isInitialized = true;

    const renderLoop = () => {
      requestAnimationFrame(renderLoop);
      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    renderLoop();
  }

  bindPointerEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointermove', (e) => {
      this.handlePointerMove(e);
    });

    dom.addEventListener('pointerup', (e) => {
      const dx = Math.abs(e.clientX - this.pointerDownPos.x);
      const dy = Math.abs(e.clientY - this.pointerDownPos.y);
      if (dx < 6 && dy < 6) {
        this.handlePointerClick(e);
      }
    });

    dom.addEventListener('pointerleave', () => {
      if (this.hoverReticle) this.hoverReticle.visible = false;
      dom.style.cursor = 'default';
    });
  }

  intersectFacelet(e) {
    if (!this.renderer || !this.camera) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.cubies, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    const cubie = hit.object;
    if (!cubie.userData) return null;

    const normal = hit.face.normal.clone().applyQuaternion(cubie.quaternion).normalize();

    let face = null;
    let localMatIdx = 0;
    if (normal.x > 0.6) { face = 'R'; localMatIdx = 0; }
    else if (normal.x < -0.6) { face = 'L'; localMatIdx = 1; }
    else if (normal.y > 0.6) { face = 'U'; localMatIdx = 2; }
    else if (normal.y < -0.6) { face = 'D'; localMatIdx = 3; }
    else if (normal.z > 0.6) { face = 'F'; localMatIdx = 4; }
    else if (normal.z < -0.6) { face = 'B'; localMatIdx = 5; }

    if (!face) return null;

    const N = this.size;
    const gx = cubie.userData.gx;
    const gy = cubie.userData.gy;
    const gz = cubie.userData.gz;

    let idx = 0;
    if (face === 'U') idx = gz * N + gx;
    else if (face === 'D') idx = (N - 1 - gz) * N + gx;
    else if (face === 'F') idx = (N - 1 - gy) * N + gx;
    else if (face === 'B') idx = (N - 1 - gy) * N + (N - 1 - gx);
    else if (face === 'R') idx = (N - 1 - gy) * N + (N - 1 - gz);
    else if (face === 'L') idx = (N - 1 - gy) * N + gz;

    return { face, idx, cubie, localMatIdx, normal };
  }

  handlePointerMove(e) {
    const hit = this.intersectFacelet(e);
    if (hit && this.hoverReticle) {
      this.hoverReticle.visible = true;
      const pos = hit.cubie.position.clone().add(hit.normal.clone().multiplyScalar(0.485));
      this.hoverReticle.position.copy(pos);
      this.hoverReticle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.normal);
      this.renderer.domElement.style.cursor = 'pointer';
    } else if (this.hoverReticle) {
      this.hoverReticle.visible = false;
      this.renderer.domElement.style.cursor = 'grab';
    }
  }

  handlePointerClick(e) {
    const hit = this.intersectFacelet(e);
    if (hit && this.onFaceletPainted) {
      this.onFaceletPainted(hit.face, hit.idx);
    }
  }

  getStickerMaterial(colorCode) {
    if (this.materialsCache[colorCode]) {
      return this.materialsCache[colorCode];
    }

    const th = this.theme || {
      U: '#F7F8FA', D: '#FFD500', F: '#009E48', B: '#0046AD', R: '#C41230', L: '#FF5500', body: '#121316'
    };
    const fillHex = th[colorCode] || '#999999';
    const bodyHex = th.body || '#121316';

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Body border
    ctx.fillStyle = bodyHex;
    ctx.fillRect(0, 0, 256, 256);

    // Rounded sticker
    const pad = 16;
    const rad = 24;
    const size = 256 - pad * 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pad, pad, size, size, rad);
    } else {
      ctx.rect(pad, pad, size, size);
    }
    ctx.fillStyle = fillHex;
    ctx.fill();

    // Subtle highlight sheen
    const grad = ctx.createLinearGradient(pad, pad, pad, pad + size * 0.45);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.28,
      metalness: 0.04
    });

    this.materialsCache[colorCode] = mat;
    return mat;
  }

  build(size = 3, theme = null, netFaces = null) {
    this.initThree();
    this.size = size;
    if (theme) {
      this.theme = theme;
      this.materialsCache = {};
    }

    const N = this.size;
    const net = netFaces || {
      U: Array(N * N).fill('U'),
      D: Array(N * N).fill('D'),
      F: Array(N * N).fill('F'),
      B: Array(N * N).fill('B'),
      R: Array(N * N).fill('R'),
      L: Array(N * N).fill('L')
    };

    while (this.cubeGroup.children.length > 0) {
      this.cubeGroup.remove(this.cubeGroup.children[0]);
    }

    this.cubies = [];
    this.faceletCubieMap = { U: [], D: [], F: [], B: [], R: [], L: [] };

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x121316,
      roughness: 0.6,
      metalness: 0.1
    });

    const offset = (N - 1) / 2;
    const geom = new THREE.BoxGeometry(0.96, 0.96, 0.96);

    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          const isExt = (x === 0 || x === N - 1 || y === 0 || y === N - 1 || z === 0 || z === N - 1);
          if (!isExt) continue;

          // Material slots: 0:R, 1:L, 2:U, 3:D, 4:F, 5:B
          const mats = [
            this.bodyMaterial,
            this.bodyMaterial,
            this.bodyMaterial,
            this.bodyMaterial,
            this.bodyMaterial,
            this.bodyMaterial
          ];

          const idxU = z * N + x;
          const idxD = (N - 1 - z) * N + x;
          const idxF = (N - 1 - y) * N + x;
          const idxB = (N - 1 - y) * N + (N - 1 - x);
          const idxR = (N - 1 - y) * N + (N - 1 - z);
          const idxL = (N - 1 - y) * N + z;

          if (x === N - 1) mats[0] = this.getStickerMaterial(net.R ? net.R[idxR] : 'R');
          if (x === 0)     mats[1] = this.getStickerMaterial(net.L ? net.L[idxL] : 'L');
          if (y === N - 1) mats[2] = this.getStickerMaterial(net.U ? net.U[idxU] : 'U');
          if (y === 0)     mats[3] = this.getStickerMaterial(net.D ? net.D[idxD] : 'D');
          if (z === N - 1) mats[4] = this.getStickerMaterial(net.F ? net.F[idxF] : 'F');
          if (z === 0)     mats[5] = this.getStickerMaterial(net.B ? net.B[idxB] : 'B');

          const cubie = new THREE.Mesh(geom, mats);
          cubie.position.set(x - offset, y - offset, z - offset);
          cubie.userData = { gx: x, gy: y, gz: z };

          if (x === N - 1) this.faceletCubieMap.R[idxR] = { cubie, matIdx: 0 };
          if (x === 0)     this.faceletCubieMap.L[idxL] = { cubie, matIdx: 1 };
          if (y === N - 1) this.faceletCubieMap.U[idxU] = { cubie, matIdx: 2 };
          if (y === 0)     this.faceletCubieMap.D[idxD] = { cubie, matIdx: 3 };
          if (z === N - 1) this.faceletCubieMap.F[idxF] = { cubie, matIdx: 4 };
          if (z === 0)     this.faceletCubieMap.B[idxB] = { cubie, matIdx: 5 };

          this.cubies.push(cubie);
          this.cubeGroup.add(cubie);
        }
      }
    }

    const distMap = { 2: 5.6, 3: 7.2, 4: 9.0 };
    const dist = distMap[N] || 7.2;
    this.camera.position.set(dist * 0.75, dist * 0.65, dist * 0.95);
    this.camera.lookAt(0, 0, 0);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  updateFacelet(face, idx, colorCode) {
    const item = (this.faceletCubieMap && this.faceletCubieMap[face]) ? this.faceletCubieMap[face][idx] : null;
    if (!item || !item.cubie) return;
    const mat = this.getStickerMaterial(colorCode);
    const mats = [...item.cubie.material];
    mats[item.matIdx] = mat;
    item.cubie.material = mats;
  }

  snapCamera(preset) {
    const distMap = { 2: 5.6, 3: 7.2, 4: 9.0 };
    const dist = distMap[this.size] || 7.2;
    const targets = {
      iso:    { x: dist * 0.75, y: dist * 0.65, z: dist * 0.95 },
      front:  { x: 0,           y: 0,           z: dist },
      back:   { x: 0,           y: 0,           z: -dist },
      top:    { x: 0,           y: dist,        z: 0.001 },
      bottom: { x: 0,           y: -dist,       z: 0.001 },
      right:  { x: dist,        y: 0,           z: 0 },
      left:   { x: -dist,       y: 0,           z: 0 }
    };
    const targetPos = targets[preset] || targets.iso;
    this.animateCameraTo(targetPos);
  }

  animateCameraTo(targetPos) {
    if (!this.camera) return;
    const startPos = this.camera.position.clone();
    const dest = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
    const startTime = performance.now();
    const duration = 280;

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1.0);
      const ease = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      this.camera.position.lerpVectors(startPos, dest, ease);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
      }

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        this.camera.position.copy(dest);
        if (this.controls) this.controls.update();
      }
    };
    requestAnimationFrame(step);
  }

  resize() {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}

class CubeApp {
  constructor() {
    this.currentSize = 3;
    this.currentType = 'cube3'; // 'cube2', 'cube3', 'cube4', 'fisher', 'mirror', 'mixup'

    const NotationEngineClass = window.NotationEngine;
    const RubiksCube3DClass = window.RubiksCube3D;

    this.engine = new NotationEngineClass(this.currentSize, this.currentType);
    
    // Playback state
    this.moveQueue = [];
    this.currentStepIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;

    // Move History Stack & Pointer
    this.history = [];
    this.historyPointer = 0;
    this.historyMode = 'branch'; // 'branch' or 'insert'

    // Saved States / Bookmarks
    this.savedStates = this.loadSavedStatesFromStorage();

    // Physical Cube Rebuilder State
    this.rebuilderActiveBrush = 'U';
    this.rebuilderNet = null;
    this.rebuilder3DPainter = null;

    // Instant Solve State
    this.instantSolveResult = null;
    this.instantMoveIdx = 0;
    this.instantIsPlaying = false;

    // Step-by-Step Solver Guide State
    this.solverStages = [];
    this.solverActiveStageIdx = 0;
    this.solverActiveMoveIdx = 0;
    this.solverIsPlaying = false;

    // Theme Presets Catalog
    this.initThemePresets();

    // Presets catalog
    this.initPresets();

    // DOM Elements
    this.cacheElements();

    // Init 3D Cube
    const canvasContainer = document.getElementById('canvas-container');
    this.cube = new RubiksCube3DClass(canvasContainer, this.currentSize, this.currentType);

    // Initial solved snapshot
    this.initHistory();

    // Bind events & orientation HUD
    this.bindEvents();

    // Initial UI state
    this.updatePresetsDropdown();
    this.renderChessHistory();
    this.renderSavedStatesList();
    this.updateKeypadForPuzzle();
    this.syncDesignerInputsFromTheme();
    this.validateAndPreviewInput();
  }

  initHistory() {
    this.history = [{
      index: 0,
      raw: 'Start',
      name: 'Solved Puzzle (Initial)',
      targetColor: 'White',
      targetColorHex: this.cube ? this.cube.theme.U : '#F7F8FA',
      snapshot: this.cube.saveSnapshot(),
      timestamp: Date.now()
    }];
    this.historyPointer = 0;
  }

  initThemePresets() {
    this.themePresets = {
      classic: {
        name: 'WCA Classic',
        U: '#F7F8FA', D: '#FFD500', F: '#009E48', B: '#0046AD', R: '#C41230', L: '#FF5500',
        body: '#121316', radius: 24, padding: 16, roughness: 0.28, metalness: 0.04
      },
      cyberpunk: {
        name: 'Cyberpunk Neon',
        U: '#fdf2f8', D: '#facc15', F: '#10b981', B: '#06b6d4', R: '#f43f5e', L: '#a855f7',
        body: '#090d16', radius: 18, padding: 14, roughness: 0.15, metalness: 0.12
      },
      pastel: {
        name: 'Pastel Dream',
        U: '#f8fafc', D: '#fef08a', F: '#86efac', B: '#93c5fd', R: '#fca5a5', L: '#fdba74',
        body: '#2d3748', radius: 32, padding: 18, roughness: 0.45, metalness: 0.02
      },
      japanese: {
        name: 'Japanese Scheme',
        U: '#F7F8FA', D: '#0046AD', F: '#009E48', B: '#FFD500', R: '#C41230', L: '#FF5500',
        body: '#121316', radius: 24, padding: 16, roughness: 0.28, metalness: 0.04
      },
      carbon: {
        name: 'Carbon Stealth',
        U: '#94a3b8', D: '#64748b', F: '#0f766e', B: '#1e3a8a', R: '#991b1b', L: '#c2410c',
        body: '#0b0f17', radius: 12, padding: 12, roughness: 0.5, metalness: 0.25
      },
      silver: {
        name: 'Mirror Silver',
        U: '#e2e8f0', D: '#cbd5e1', F: '#94a3b8', B: '#64748b', R: '#e2e8f0', L: '#cbd5e1',
        body: '#1e293b', radius: 8, padding: 10, roughness: 0.18, metalness: 0.88
      },
      gold: {
        name: 'Mirror Gold',
        U: '#fef08a', D: '#facc15', F: '#eab308', B: '#ca8a04', R: '#f59e0b', L: '#fbbf24',
        body: '#1c1917', radius: 8, padding: 10, roughness: 0.2, metalness: 0.85
      }
    };
  }

  cacheElements() {
    // Top Bar
    this.sizeButtons = document.querySelectorAll('.size-btn');
    this.camPresetButtons = document.querySelectorAll('.cam-preset-btn');
    this.resetCamBtn = document.getElementById('btn-reset-cam');
    this.btnToggleHistory = document.getElementById('btn-toggle-history');
    this.headerHistoryCount = document.getElementById('header-history-count');
    this.btnToggleDesigner = document.getElementById('btn-toggle-designer');
    this.btnToggleRebuilder = document.getElementById('btn-toggle-rebuilder');
    this.btnToggleSolver = document.getElementById('btn-toggle-solver');
    this.btnInstantSolve = document.getElementById('btn-instant-solve');
    this.btnDockInstantSolve = document.getElementById('btn-dock-instant-solve');

    // Physical Cube Rebuilder Elements
    this.rebuilderModal = document.getElementById('modal-rebuilder');
    this.btnCloseRebuilder = document.getElementById('btn-close-rebuilder');
    this.btnRebuilderRead3D = document.getElementById('btn-rebuilder-read-3d');
    this.btnRebuilderResetSolved = document.getElementById('btn-rebuilder-reset-solved');
    this.btnRebuilderClear = document.getElementById('btn-rebuilder-clear');
    this.btnRebuilderApply = document.getElementById('btn-rebuilder-apply');
    this.btnRebuilderApplySolve = document.getElementById('btn-rebuilder-apply-solve');
    this.btnRebuilderInstantSolve = document.getElementById('btn-rebuilder-instant-solve');
    this.rebuilderStatusBanner = document.getElementById('rebuilder-status-banner');
    this.rebuilderStatusText = document.getElementById('rebuilder-status-text');
    this.rebuilderStatusDetails = document.getElementById('rebuilder-status-details');
    this.cubeUnfoldedNet = document.getElementById('cube-unfolded-net');
    this.rebuilderPalettePills = document.getElementById('rebuilder-palette-pills');
    this.rebuilderPuzzleTypePill = document.getElementById('rebuilder-puzzle-type-pill');
    this.rebuilderWorkspace = document.getElementById('rebuilder-workspace');
    this.rebuilderTab3D = document.getElementById('btn-rebuilder-tab-3d');
    this.rebuilderTabSplit = document.getElementById('btn-rebuilder-tab-split');
    this.rebuilderTabNet = document.getElementById('btn-rebuilder-tab-net');
    this.rebuilder3DCanvasWrap = document.getElementById('rebuilder-3d-canvas-wrap');
    this.camSnapButtons = document.querySelectorAll('.cam-snap-btn');

    // Instant Solve (Least Moves) Modal Elements
    this.instantSolveModal = document.getElementById('modal-instant-solve');
    this.btnCloseInstant = document.getElementById('btn-close-instant');
    this.instantMoveCount = document.getElementById('instant-move-count');
    this.instantSolveTime = document.getElementById('instant-solve-time');
    this.instantSolveMethod = document.getElementById('instant-solve-method');
    this.instantAlgorithmText = document.getElementById('instant-algorithm-text');
    this.btnCopyInstantAlg = document.getElementById('btn-copy-instant-alg');
    this.instantTotalChips = document.getElementById('instant-total-chips');
    this.instantCurrentIdx = document.getElementById('instant-current-idx');
    this.instantMoveChips = document.getElementById('instant-move-chips');
    this.btnInstantPrev = document.getElementById('btn-instant-prev');
    this.btnInstantPlay = document.getElementById('btn-instant-play');
    this.instantPlayIcon = document.getElementById('instant-play-icon');
    this.instantPlayLabel = document.getElementById('instant-play-label');
    this.btnInstantNext = document.getElementById('btn-instant-next');
    this.btnInstantReset = document.getElementById('btn-instant-reset');
    this.instantSpeedSelect = document.getElementById('instant-speed-select');
    this.btnInstantJumpSolved = document.getElementById('btn-instant-jump-solved');
    this.instantEfficiencyText = document.getElementById('instant-efficiency-text');

    // Step-by-Step Solver Guide Elements
    this.solverModal = document.getElementById('modal-solver-guide');
    this.btnCloseSolver = document.getElementById('btn-close-solver');
    this.solverStageTabs = document.getElementById('solver-stage-tabs');
    this.stageBadge = document.getElementById('stage-badge');
    this.stageTitle = document.getElementById('stage-title');
    this.stageAlgRef = document.getElementById('stage-alg-ref');
    this.stageGoalText = document.getElementById('stage-goal-text');
    this.stageCoachText = document.getElementById('stage-coach-text');
    this.stageMoveCount = document.getElementById('stage-move-count');
    this.stageCurrentMoveIdx = document.getElementById('stage-current-move-idx');
    this.stageTotalMovesInStage = document.getElementById('stage-total-moves-in-stage');
    this.stageMovesChips = document.getElementById('stage-moves-chips');
    this.btnSolverPrev = document.getElementById('btn-solver-prev');
    this.btnSolverPlay = document.getElementById('btn-solver-play');
    this.btnSolverNext = document.getElementById('btn-solver-next');
    this.btnSolverResetStage = document.getElementById('btn-solver-reset-stage');
    this.btnSolverSolveAll = document.getElementById('btn-solver-solve-all');
    this.solverSpeedSelect = document.getElementById('solver-speed-select');
    this.solverTotalMoves = document.getElementById('solver-total-moves');
    this.solverPuzzleBadge = document.getElementById('solver-puzzle-badge');
    this.solverPlayIcon = document.getElementById('solver-play-icon');
    this.solverPlayLabel = document.getElementById('solver-play-label');
    this.specialPuzzleCoach = document.getElementById('special-puzzle-coach');
    this.coachAccordionToggle = document.getElementById('coach-accordion-toggle');
    this.coachTipsContainer = document.getElementById('coach-tips-container');

    // Orientation HUD
    this.btnToggleViewMode = document.getElementById('btn-toggle-view-mode');
    this.modeText = document.getElementById('mode-text');
    this.hudPills = {
      F: { color: document.getElementById('pill-color-F'), dot: document.querySelector('#pill-F .pill-dot') },
      R: { color: document.getElementById('pill-color-R'), dot: document.querySelector('#pill-R .pill-dot') },
      U: { color: document.getElementById('pill-color-U'), dot: document.querySelector('#pill-U .pill-dot') },
      L: { color: document.getElementById('pill-color-L'), dot: document.querySelector('#pill-L .pill-dot') },
      B: { color: document.getElementById('pill-color-B'), dot: document.querySelector('#pill-B .pill-dot') },
      D: { color: document.getElementById('pill-color-D'), dot: document.querySelector('#pill-D .pill-dot') }
    };

    // Input & Timeline
    this.notationInput = document.getElementById('notation-input');
    this.btnRun = document.getElementById('btn-run');
    this.btnClear = document.getElementById('btn-clear');
    this.inputStatus = document.getElementById('input-status');
    this.timelineContainer = document.getElementById('move-timeline');
    this.progressFill = document.getElementById('progress-fill');
    this.progressText = document.getElementById('progress-text');

    // Playback controls
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.btnStepNext = document.getElementById('btn-step-next');
    this.btnStepPrev = document.getElementById('btn-step-prev');
    this.btnStop = document.getElementById('btn-stop');

    // Action buttons
    this.btnScramble = document.getElementById('btn-scramble');
    this.btnResetCube = document.getElementById('btn-reset-cube');
    this.btnInvertSeq = document.getElementById('btn-invert-seq');
    this.presetSelect = document.getElementById('preset-select');

    // Speed slider
    this.speedSlider = document.getElementById('speed-slider');
    this.speedLabel = document.getElementById('speed-label');

    // Keypad & Help
    this.keypadToggleBtn = document.getElementById('btn-toggle-keypad');
    this.keypadPanel = document.getElementById('keypad-panel');
    this.keypadRowMixup = document.getElementById('keypad-row-mixup');
    this.helpToggleBtn = document.getElementById('btn-toggle-help');
    this.helpModal = document.getElementById('help-modal');
    this.helpCloseBtn = document.getElementById('btn-close-help');

    // History Sidebar
    this.historySidebar = document.getElementById('history-sidebar');
    this.btnCloseHistory = document.getElementById('btn-close-history');
    this.historyStepBadge = document.getElementById('history-step-badge');
    this.tabBtnMoves = document.getElementById('tab-btn-moves');
    this.tabBtnStates = document.getElementById('tab-btn-states');
    this.tabContentMoves = document.getElementById('tab-content-moves');
    this.tabContentStates = document.getElementById('tab-content-states');
    this.savedStatesCount = document.getElementById('saved-states-count');

    // Chess Navigation
    this.btnNavStart = document.getElementById('btn-nav-start');
    this.btnNavPrev = document.getElementById('btn-nav-prev');
    this.btnNavNext = document.getElementById('btn-nav-next');
    this.btnNavEnd = document.getElementById('btn-nav-end');
    this.btnQuickBookmark = document.getElementById('btn-quick-bookmark');

    // Chess Table
    this.chessRowStart = document.getElementById('chess-row-start');
    this.chessTableBody = document.getElementById('chess-table-body');
    this.btnCopyHistory = document.getElementById('btn-copy-history');
    this.btnClearHistory = document.getElementById('btn-clear-history');

    // Saved States Tab
    this.saveStateNameInput = document.getElementById('save-state-name-input');
    this.btnSaveStateConfirm = document.getElementById('btn-save-state-confirm');
    this.savedStatesList = document.getElementById('saved-states-list');
    this.btnExportStates = document.getElementById('btn-export-states');
    this.btnImportStates = document.getElementById('btn-import-states');
    this.importStatesFile = document.getElementById('import-states-file');

    // Designer Modal Elements
    this.designerModal = document.getElementById('designer-modal');
    this.btnCloseDesigner = document.getElementById('btn-close-designer');
    this.btnApplyDesigner = document.getElementById('btn-apply-designer');
    this.btnResetTheme = document.getElementById('btn-reset-theme');
    this.btnExportTheme = document.getElementById('btn-export-theme');
    this.presetThemeBtns = document.querySelectorAll('.theme-preset-btn');

    this.facePickers = {
      U: document.getElementById('picker-color-U'),
      D: document.getElementById('picker-color-D'),
      F: document.getElementById('picker-color-F'),
      B: document.getElementById('picker-color-B'),
      R: document.getElementById('picker-color-R'),
      L: document.getElementById('picker-color-L')
    };

    this.hexLabels = {
      U: document.getElementById('hex-U'),
      D: document.getElementById('hex-D'),
      F: document.getElementById('hex-F'),
      B: document.getElementById('hex-B'),
      R: document.getElementById('hex-R'),
      L: document.getElementById('hex-L')
    };

    this.pickerColorBody = document.getElementById('picker-color-body');
    this.bodyPresetPills = document.querySelectorAll('.body-preset-pill');

    this.sliderRadius = document.getElementById('slider-radius');
    this.valRadius = document.getElementById('val-radius');
    this.sliderPadding = document.getElementById('slider-padding');
    this.valPadding = document.getElementById('val-padding');
    this.sliderRoughness = document.getElementById('slider-roughness');
    this.valRoughness = document.getElementById('val-roughness');
    this.sliderMetalness = document.getElementById('slider-metalness');
    this.valMetalness = document.getElementById('val-metalness');
  }

  initPresets() {
    this.presets = {
      cube2: [
        { name: 'Sexy Move (4 moves)', seq: "R U R' U'" },
        { name: 'Sune (7 moves)', seq: "R U R' U R U2 R'" },
        { name: 'Anti-Sune (7 moves)', seq: "R U2 R' U' R U' R'" },
        { name: 'J-Perm (13 moves)', seq: "R U R' F' R U R' U' R' F R2 U' R'" },
        { name: '2x2 Checkerboard', seq: "R2 F2 R2" }
      ],
      cube3: [
        { name: 'Sexy Move', seq: "R U R' U'" },
        { name: 'T-Perm (PLL)', seq: "R U R' U' R' F R2 U' R' U' R U R' F'" },
        { name: 'Y-Perm (PLL)', seq: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
        { name: 'J-Perm (PLL)', seq: "R U R' F' R U R' U' R' F R2 U' R'" },
        { name: 'Sune (OLL)', seq: "R U R' U R U2 R'" },
        { name: 'Anti-Sune (OLL)', seq: "R U2 R' U' R U' R'" },
        { name: 'Checkerboard Pattern', seq: "M2 E2 S2" },
        { name: 'Cube in a Cube', seq: "F L F U' R U F2 L2 U' L' B D' B' L2 U" },
        { name: 'Anaconda Pattern', seq: "L U B' U' R L' B R' F B' D R D' F'" },
        { name: 'Superflip (20 moves)', seq: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" }
      ],
      cube4: [
        { name: 'Sexy Move', seq: "R U R' U'" },
        { name: 'Wide Sexy Move', seq: "Rw U Rw' U'" },
        { name: 'T-Perm', seq: "R U R' U' R' F R2 U' R' U' R U R' F'" },
        { name: '4x4 Checkerboard (Inner)', seq: "2R2 2L2 2U2 2D2 2F2 2B2" },
        { name: '4x4 Checkerboard (Wide)', seq: "Rw2 Lw2 Uw2 Dw2 Fw2 Bw2" },
        { name: 'OLL Parity (Opposite Edges)', seq: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'" },
        { name: 'PLL Parity (Opposite Edges)', seq: "2R2 U2 2R2 Uw2 2R2 2U2" }
      ],
      fisher: [
        { name: 'T-Perm Shape-Shift', seq: "R U R' U' R' F R2 U' R' U' R U R' F'" },
        { name: 'Sune Shape-Shift', seq: "R U R' U R U2 R'" },
        { name: 'Corner Swap Trigger', seq: "R U R' U'" },
        { name: 'Middle Layer Twist', seq: "M2 U2 M2 U2" }
      ],
      mirror: [
        { name: 'T-Perm Jagged Shift', seq: "R U R' U' R' F R2 U' R' U' R U R' F'" },
        { name: 'Cube in a Cube Jagged', seq: "F L F U' R U F2 L2 U' L' B D' B' L2 U" },
        { name: 'Checkerboard Architecture', seq: "R2 L2 U2 D2 F2 B2" },
        { name: 'Sexy Move Extrusion', seq: "R U R' U'" }
      ],
      mixup: [
        { name: '45° Edge-Center Swap (90°)', seq: "M45 M45 U2 M45 M45 U2" },
        { name: 'Mixup 45° Star Shape', seq: "M45 E45 S45" },
        { name: 'Mixup 45° Reset', seq: "S45' E45' M45'" },
        { name: 'Oskar Edge-Center Cycle', seq: "M45 M45 U2 M45' M45' U2" }
      ]
    };
  }

  updatePresetsDropdown() {
    if (!this.presetSelect) return;
    this.presetSelect.innerHTML = '<option value="" disabled selected>— Select Algorithm Preset —</option>';
    const list = this.presets[this.currentType] || this.presets[this.currentSize] || [];
    list.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.seq;
      opt.textContent = `${p.name} [${p.seq}]`;
      this.presetSelect.appendChild(opt);
    });
  }

  bindEvents() {
    // Orientation HUD listener
    this.cube.setOnOrientationChange((orientation, mode) => {
      this.updateOrientationHUD(orientation, mode);
    });

    // View Mode Toggle
    if (this.btnToggleViewMode) {
      this.btnToggleViewMode.addEventListener('click', () => {
        const nextMode = this.cube.viewMode === 'relative' ? 'fixed' : 'relative';
        this.cube.setViewMode(nextMode);
        this.showToast(nextMode === 'relative' 
          ? 'View-Relative: R is to the right of where you look' 
          : 'Fixed Mode: Standard absolute WCA orientation');
      });
    }

    // Puzzle / Size Selector
    this.sizeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const newSize = parseInt(btn.dataset.size, 10);
        const newType = btn.dataset.type || (newSize === 2 ? 'cube2' : (newSize === 4 ? 'cube4' : 'cube3'));

        if (newType === this.currentType && newSize === this.currentSize) return;

        this.sizeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.switchPuzzle(newSize, newType);
      });
    });

    // Cube Designer Modal Toggle
    if (this.btnToggleDesigner && this.designerModal) {
      this.btnToggleDesigner.addEventListener('click', () => {
        this.syncDesignerInputsFromTheme();
        this.designerModal.classList.remove('hidden');
      });
    }

    if (this.btnCloseDesigner && this.designerModal) {
      this.btnCloseDesigner.addEventListener('click', () => {
        this.designerModal.classList.add('hidden');
      });
    }

    if (this.btnApplyDesigner && this.designerModal) {
      this.btnApplyDesigner.addEventListener('click', () => {
        this.designerModal.classList.add('hidden');
        this.showToast('Custom theme applied!');
      });
    }

    // Physical Cube Rebuilder Events
    if (this.btnToggleRebuilder && this.rebuilderModal) {
      this.btnToggleRebuilder.addEventListener('click', () => {
        this.openRebuilder();
      });
    }

    if (this.btnCloseRebuilder && this.rebuilderModal) {
      this.btnCloseRebuilder.addEventListener('click', () => {
        this.rebuilderModal.classList.add('hidden');
      });
    }

    if (this.btnRebuilderRead3D) {
      this.btnRebuilderRead3D.addEventListener('click', () => {
        this.rebuilderReadFrom3D();
      });
    }

    if (this.btnRebuilderResetSolved) {
      this.btnRebuilderResetSolved.addEventListener('click', () => {
        this.rebuilderResetSolved();
      });
    }

    if (this.btnRebuilderClear) {
      this.btnRebuilderClear.addEventListener('click', () => {
        this.rebuilderClear();
      });
    }

    if (this.btnRebuilderApply) {
      this.btnRebuilderApply.addEventListener('click', () => {
        this.rebuilderApplyTo3D(false);
      });
    }

    if (this.btnRebuilderApplySolve) {
      this.btnRebuilderApplySolve.addEventListener('click', () => {
        this.rebuilderApplyTo3D(true);
      });
    }

    if (this.btnRebuilderInstantSolve) {
      this.btnRebuilderInstantSolve.addEventListener('click', () => {
        if (this.rebuilderNet) {
          this.rebuilderApplyTo3D(false);
        }
        this.openInstantSolve();
      });
    }

    // 3D Rebuilder View Tabs
    const setRebuilderView = (mode) => {
      if (!this.rebuilderWorkspace) return;
      this.rebuilderWorkspace.className = `rebuilder-workspace mode-${mode}`;
      if (this.rebuilderTab3D) this.rebuilderTab3D.classList.toggle('active', mode === '3d');
      if (this.rebuilderTabSplit) this.rebuilderTabSplit.classList.toggle('active', mode === 'split');
      if (this.rebuilderTabNet) this.rebuilderTabNet.classList.toggle('active', mode === 'net');
      setTimeout(() => {
        if (this.rebuilder3DPainter) this.rebuilder3DPainter.resize();
      }, 50);
    };

    if (this.rebuilderTab3D) this.rebuilderTab3D.addEventListener('click', () => setRebuilderView('3d'));
    if (this.rebuilderTabSplit) this.rebuilderTabSplit.addEventListener('click', () => setRebuilderView('split'));
    if (this.rebuilderTabNet) this.rebuilderTabNet.addEventListener('click', () => setRebuilderView('net'));

    // 3D Rebuilder Camera Snap Bar
    if (this.camSnapButtons) {
      this.camSnapButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const snap = btn.dataset.snap;
          if (this.rebuilder3DPainter) {
            this.rebuilder3DPainter.snapCamera(snap);
          }
        });
      });
    }

    // Instant Solve Events (Header, Dock, Modal Controls)
    if (this.btnInstantSolve) {
      this.btnInstantSolve.addEventListener('click', () => {
        this.openInstantSolve();
      });
    }

    if (this.btnDockInstantSolve) {
      this.btnDockInstantSolve.addEventListener('click', () => {
        this.openInstantSolve();
      });
    }

    if (this.btnCloseInstant && this.instantSolveModal) {
      this.btnCloseInstant.addEventListener('click', () => {
        this.instantIsPlaying = false;
        this.instantSolveModal.classList.add('hidden');
      });
    }

    if (this.btnCopyInstantAlg) {
      this.btnCopyInstantAlg.addEventListener('click', () => {
        this.copyInstantAlgorithm();
      });
    }

    if (this.btnInstantNext) {
      this.btnInstantNext.addEventListener('click', () => {
        this.instantStepNext();
      });
    }

    if (this.btnInstantPrev) {
      this.btnInstantPrev.addEventListener('click', () => {
        this.instantStepPrev();
      });
    }

    if (this.btnInstantPlay) {
      this.btnInstantPlay.addEventListener('click', () => {
        this.instantTogglePlay();
      });
    }

    if (this.btnInstantReset) {
      this.btnInstantReset.addEventListener('click', () => {
        this.instantReset();
      });
    }

    if (this.btnInstantJumpSolved) {
      this.btnInstantJumpSolved.addEventListener('click', () => {
        this.instantJumpToSolved();
      });
    }

    // Step-by-Step Solver Guide Events
    if (this.btnToggleSolver && this.solverModal) {
      this.btnToggleSolver.addEventListener('click', () => {
        this.openSolverGuide();
      });
    }

    if (this.btnCloseSolver && this.solverModal) {
      this.btnCloseSolver.addEventListener('click', () => {
        this.solverIsPlaying = false;
        this.solverModal.classList.add('hidden');
      });
    }

    if (this.btnSolverPrev) {
      this.btnSolverPrev.addEventListener('click', () => {
        this.solverStepPrev();
      });
    }

    if (this.btnSolverPlay) {
      this.btnSolverPlay.addEventListener('click', () => {
        this.solverTogglePlay();
      });
    }

    if (this.btnSolverNext) {
      this.btnSolverNext.addEventListener('click', () => {
        this.solverStepNext();
      });
    }

    if (this.btnSolverResetStage) {
      this.btnSolverResetStage.addEventListener('click', () => {
        this.solverResetCurrentStage();
      });
    }

    if (this.btnSolverSolveAll) {
      this.btnSolverSolveAll.addEventListener('click', () => {
        this.solverAutoSolveAll();
      });
    }

    if (this.coachAccordionToggle && this.specialPuzzleCoach) {
      this.coachAccordionToggle.addEventListener('click', () => {
        this.specialPuzzleCoach.classList.toggle('collapsed');
      });
    }

    // Theme Presets Click
    this.presetThemeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        const presetData = this.themePresets[presetKey];
        if (!presetData) return;

        this.presetThemeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.cube.applyTheme(presetData);
        this.syncDesignerInputsFromTheme();
        this.showToast(`Applied theme preset: ${presetData.name}`);
      });
    });

    // Color Pickers
    Object.keys(this.facePickers).forEach(face => {
      const picker = this.facePickers[face];
      if (!picker) return;
      picker.addEventListener('input', (e) => {
        const hex = e.target.value.toUpperCase();
        if (this.hexLabels[face]) this.hexLabels[face].textContent = hex;
        this.cube.applyTheme({ [face]: hex });
      });
    });

    // Body Color Picker
    if (this.pickerColorBody) {
      this.pickerColorBody.addEventListener('input', (e) => {
        const hex = e.target.value;
        this.cube.applyTheme({ body: hex });
      });
    }

    // Body Preset Pills
    this.bodyPresetPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.bodyPresetPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const col = pill.dataset.color;
        if (this.pickerColorBody) this.pickerColorBody.value = col;
        this.cube.applyTheme({ body: col });
      });
    });

    // Sliders
    if (this.sliderRadius) {
      this.sliderRadius.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.valRadius) this.valRadius.textContent = `${val}px`;
        this.cube.applyTheme({ radius: val });
      });
    }

    if (this.sliderPadding) {
      this.sliderPadding.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.valPadding) this.valPadding.textContent = `${val}px`;
        this.cube.applyTheme({ padding: val });
      });
    }

    if (this.sliderRoughness) {
      this.sliderRoughness.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.valRoughness) this.valRoughness.textContent = `${Math.round(val * 100)}%`;
        this.cube.applyTheme({ roughness: val });
      });
    }

    if (this.sliderMetalness) {
      this.sliderMetalness.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.valMetalness) this.valMetalness.textContent = `${Math.round(val * 100)}%`;
        this.cube.applyTheme({ metalness: val });
      });
    }

    // Reset Theme
    if (this.btnResetTheme) {
      this.btnResetTheme.addEventListener('click', () => {
        this.cube.applyTheme(this.themePresets.classic);
        this.syncDesignerInputsFromTheme();
        this.showToast('Reset theme to WCA Classic.');
      });
    }

    // Export Theme
    if (this.btnExportTheme) {
      this.btnExportTheme.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.cube.theme, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `cubesim_theme_${Date.now()}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
        this.showToast('Theme exported to JSON file!');
      });
    }

    // History Sidebar Toggle
    if (this.btnToggleHistory) {
      this.btnToggleHistory.addEventListener('click', () => {
        this.historySidebar.classList.toggle('collapsed');
        const isOpen = !this.historySidebar.classList.contains('collapsed');
        this.btnToggleHistory.classList.toggle('active', isOpen);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 240);
      });
    }

    if (this.btnCloseHistory) {
      this.btnCloseHistory.addEventListener('click', () => {
        this.historySidebar.classList.add('collapsed');
        if (this.btnToggleHistory) this.btnToggleHistory.classList.remove('active');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 240);
      });
    }

    // Sidebar Tab Switching
    if (this.tabBtnMoves && this.tabBtnStates) {
      this.tabBtnMoves.addEventListener('click', () => {
        this.tabBtnMoves.classList.add('active');
        this.tabBtnStates.classList.remove('active');
        this.tabContentMoves.classList.add('active');
        this.tabContentStates.classList.remove('active');
      });

      this.tabBtnStates.addEventListener('click', () => {
        this.tabBtnStates.classList.add('active');
        this.tabBtnMoves.classList.remove('active');
        this.tabContentStates.classList.add('active');
        this.tabContentMoves.classList.remove('active');
      });
    }

    // Chess Navigation Buttons
    if (this.btnNavStart) {
      this.btnNavStart.addEventListener('click', () => this.jumpToHistoryStep(0));
    }
    if (this.btnNavPrev) {
      this.btnNavPrev.addEventListener('click', () => this.jumpToHistoryStep(Math.max(0, this.historyPointer - 1)));
    }
    if (this.btnNavNext) {
      this.btnNavNext.addEventListener('click', () => this.jumpToHistoryStep(Math.min(this.history.length - 1, this.historyPointer + 1)));
    }
    if (this.btnNavEnd) {
      this.btnNavEnd.addEventListener('click', () => this.jumpToHistoryStep(this.history.length - 1));
    }
    if (this.btnQuickBookmark) {
      this.btnQuickBookmark.addEventListener('click', () => {
        const defaultName = `State at move ${this.historyPointer}` + (this.historyPointer > 0 ? ` (${this.history[this.historyPointer].raw})` : '');
        this.saveCurrentState(defaultName);
      });
    }

    if (this.chessRowStart) {
      this.chessRowStart.addEventListener('click', () => this.jumpToHistoryStep(0));
    }

    // History Mode Radios
    document.querySelectorAll('input[name="historyMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.historyMode = e.target.value;
        this.showToast(`Mode set to: ${this.historyMode === 'branch' ? 'Branch / Replace' : 'Insert after current'}`);
      });
    });

    if (this.btnCopyHistory) {
      this.btnCopyHistory.addEventListener('click', () => {
        const movesStr = this.history.slice(1).map(m => m.raw).join(' ');
        if (!movesStr) {
          this.showToast('No moves to copy.');
          return;
        }
        navigator.clipboard.writeText(movesStr).then(() => {
          this.showToast('Move sequence copied to clipboard!');
        });
      });
    }

    if (this.btnClearHistory) {
      this.btnClearHistory.addEventListener('click', () => {
        if (confirm('Clear move history and reset puzzle to solved state?')) {
          this.cube.reset();
          this.initHistory();
          this.renderChessHistory();
          this.showToast('Move history cleared.');
        }
      });
    }

    if (this.btnSaveStateConfirm) {
      this.btnSaveStateConfirm.addEventListener('click', () => {
        const name = this.saveStateNameInput.value.trim();
        this.saveCurrentState(name);
        this.saveStateNameInput.value = '';
      });
    }

    if (this.saveStateNameInput) {
      this.saveStateNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.btnSaveStateConfirm.click();
        }
      });
    }

    if (this.btnExportStates) {
      this.btnExportStates.addEventListener('click', () => this.exportStatesJSON());
    }
    if (this.btnImportStates && this.importStatesFile) {
      this.btnImportStates.addEventListener('click', () => this.importStatesFile.click());
      this.importStatesFile.addEventListener('change', (e) => this.handleImportStatesFile(e));
    }

    // Camera Presets
    this.camPresetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.cam;
        this.cube.setCameraPreset(preset);
      });
    });

    if (this.resetCamBtn) {
      this.resetCamBtn.addEventListener('click', () => {
        this.cube.setCameraPreset('isometric');
      });
    }

    // Input live typing
    this.notationInput.addEventListener('input', () => {
      this.validateAndPreviewInput();
    });

    this.notationInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.startSequenceExecution();
      }
    });

    this.btnRun.addEventListener('click', () => {
      this.startSequenceExecution();
    });

    this.btnClear.addEventListener('click', () => {
      this.notationInput.value = '';
      this.validateAndPreviewInput();
      this.notationInput.focus();
    });

    // Playback Controls
    this.btnPlayPause.addEventListener('click', () => {
      if (this.isPlaying) {
        this.pausePlayback();
      } else {
        this.resumeOrStartPlayback();
      }
    });

    this.btnStepNext.addEventListener('click', () => {
      this.stepNext();
    });

    this.btnStepPrev.addEventListener('click', () => {
      this.stepPrev();
    });

    this.btnStop.addEventListener('click', () => {
      this.stopPlayback();
    });

    this.btnScramble.addEventListener('click', () => {
      this.executeScramble();
    });

    this.btnResetCube.addEventListener('click', () => {
      this.stopPlayback();
      this.cube.reset();
      this.initHistory();
      this.renderChessHistory();
      this.showToast('Puzzle reset to solved state.');
    });

    this.btnInvertSeq.addEventListener('click', () => {
      const current = this.notationInput.value;
      const inverted = this.engine.invertSequence(current);
      if (inverted) {
        this.notationInput.value = inverted;
        this.validateAndPreviewInput();
        this.showToast('Sequence reversed and inverted!');
      }
    });

    this.presetSelect.addEventListener('change', () => {
      if (!this.presetSelect.value) return;
      this.notationInput.value = this.presetSelect.value;
      this.validateAndPreviewInput();
      this.presetSelect.selectedIndex = 0;
    });

    this.speedSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      let label = `${val}ms`;
      if (val === 0) label = 'Instant (0ms)';
      else if (val <= 100) label = `Fast (${val}ms)`;
      else if (val <= 260) label = `Normal (${val}ms)`;
      else label = `Slow (${val}ms)`;
      this.speedLabel.textContent = label;
      this.cube.setSpeed(val);
    });

    if (this.keypadToggleBtn && this.keypadPanel) {
      this.keypadToggleBtn.addEventListener('click', () => {
        this.keypadPanel.classList.toggle('hidden');
        this.keypadToggleBtn.classList.toggle('active');
      });
    }

    document.querySelectorAll('.key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const moveToken = btn.dataset.move;
        if (!moveToken) return;

        const current = this.notationInput.value.trim();
        this.notationInput.value = current ? `${current} ${moveToken}` : moveToken;
        this.validateAndPreviewInput();
        this.notationInput.focus();
      });
    });

    if (this.helpToggleBtn && this.helpModal) {
      this.helpToggleBtn.addEventListener('click', () => {
        this.helpModal.classList.remove('hidden');
      });
    }

    if (this.helpCloseBtn && this.helpModal) {
      this.helpCloseBtn.addEventListener('click', () => {
        this.helpModal.classList.add('hidden');
      });
    }

    if (this.helpModal) {
      this.helpModal.addEventListener('click', (e) => {
        if (e.target === this.helpModal) {
          this.helpModal.classList.add('hidden');
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (document.activeElement === this.notationInput || document.activeElement === this.saveStateNameInput) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.btnPlayPause.click();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.jumpToHistoryStep(Math.min(this.history.length - 1, this.historyPointer + 1));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.jumpToHistoryStep(Math.max(0, this.historyPointer - 1));
      } else if (e.key === 'r' || e.key === 'R') {
        if (e.ctrlKey) return;
        this.notationInput.focus();
      }
    });
  }

  syncDesignerInputsFromTheme() {
    const th = this.cube.theme;
    Object.keys(this.facePickers).forEach(face => {
      if (this.facePickers[face] && th[face]) {
        this.facePickers[face].value = th[face];
        if (this.hexLabels[face]) this.hexLabels[face].textContent = th[face].toUpperCase();
      }
    });

    if (this.pickerColorBody && th.body) {
      this.pickerColorBody.value = th.body;
    }

    if (this.sliderRadius && th.radius !== undefined) {
      this.sliderRadius.value = th.radius;
      if (this.valRadius) this.valRadius.textContent = `${th.radius}px`;
    }

    if (this.sliderPadding && th.padding !== undefined) {
      this.sliderPadding.value = th.padding;
      if (this.valPadding) this.valPadding.textContent = `${th.padding}px`;
    }

    if (this.sliderRoughness && th.roughness !== undefined) {
      this.sliderRoughness.value = th.roughness;
      if (this.valRoughness) this.valRoughness.textContent = `${Math.round(th.roughness * 100)}%`;
    }

    if (this.sliderMetalness && th.metalness !== undefined) {
      this.sliderMetalness.value = th.metalness;
      if (this.valMetalness) this.valMetalness.textContent = `${Math.round(th.metalness * 100)}%`;
    }
  }

  switchPuzzle(newSize, newType) {
    this.stopPlayback();
    this.currentSize = newSize;
    this.currentType = newType;

    this.engine.setSize(newSize, newType);
    this.cube.setSize(newSize, newType);

    this.initHistory();
    this.renderChessHistory();
    this.updatePresetsDropdown();
    this.updateKeypadForPuzzle();
    this.validateAndPreviewInput();

    const names = {
      cube2: '2×2 Pocket Cube',
      cube3: '3×3 Standard Cube',
      cube4: '4×4 Revenge Cube',
      fisher: 'Tony Fisher 45° Shape-Mod',
      mirror: 'Mirror / Bump Cube (Brushed Metallic)',
      mixup: 'WitEden & Oskar Mixup 3x3'
    };

    this.showToast(`Switched to: ${names[newType] || newType}`);
  }

  updateKeypadForPuzzle() {
    const sliceKeys = document.querySelectorAll('.key-btn[data-slice="true"]');
    sliceKeys.forEach(btn => {
      btn.disabled = (this.currentSize === 2);
      btn.style.opacity = this.currentSize === 2 ? '0.35' : '1.0';
    });

    // Show or hide Mixup 45° button row
    if (this.keypadRowMixup) {
      this.keypadRowMixup.style.display = (this.currentType === 'mixup') ? 'flex' : 'none';
    }
  }

  updateOrientationHUD(orientation, mode) {
    if (this.modeText) {
      this.modeText.textContent = (mode === 'relative') ? 'View-Relative' : 'Fixed WCA';
    }

    const faces = ['F', 'R', 'U', 'L', 'B', 'D'];
    faces.forEach(face => {
      const fData = orientation[face];
      const pill = this.hudPills[face];
      if (fData && pill) {
        if (pill.color) pill.color.textContent = fData.color;
        if (pill.dot) pill.dot.style.background = fData.colorHex;
      }
    });
  }

  validateAndPreviewInput() {
    const text = this.notationInput.value;
    const result = this.engine.parse(text);

    if (!text.trim()) {
      this.inputStatus.innerHTML = '<span class="status-hint">Enter moves separated by spaces (e.g. R U R\' U\')</span>';
      this.renderTimeline([]);
      this.btnRun.disabled = true;
      return;
    }

    if (!result.valid) {
      this.inputStatus.innerHTML = `<span class="status-error">⚠️ ${result.error}</span>`;
      this.btnRun.disabled = true;
      this.renderTimeline([]);
      return;
    }

    const count = result.moves.length;
    this.inputStatus.innerHTML = `<span class="status-success">✓ ${count} valid move${count === 1 ? '' : 's'} detected</span>`;
    this.btnRun.disabled = (count === 0);

    if (!this.isPlaying) {
      this.moveQueue = result.moves;
      this.currentStepIndex = 0;
      this.renderTimeline(this.moveQueue);
      this.updateProgress();
    }
  }

  renderTimeline(moves) {
    this.timelineContainer.innerHTML = '';
    if (!moves || moves.length === 0) {
      this.timelineContainer.innerHTML = '<div class="timeline-empty">Moves timeline will appear here...</div>';
      return;
    }

    moves.forEach((move, idx) => {
      const chip = document.createElement('div');
      chip.className = 'move-chip';
      chip.id = `move-chip-${idx}`;
      chip.textContent = move.raw;
      chip.title = `Move ${idx + 1}: ${move.name}`;

      if (idx < this.currentStepIndex) {
        chip.classList.add('completed');
      } else if (idx === this.currentStepIndex) {
        chip.classList.add('current');
      }

      chip.addEventListener('click', () => {
        if (!this.isPlaying) {
          this.jumpToStep(idx);
        }
      });

      this.timelineContainer.appendChild(chip);
    });
  }

  updateTimelineHighlights() {
    const chips = this.timelineContainer.querySelectorAll('.move-chip');
    chips.forEach((chip, idx) => {
      chip.classList.remove('completed', 'current', 'animating');
      if (idx < this.currentStepIndex) {
        chip.classList.add('completed');
      } else if (idx === this.currentStepIndex) {
        chip.classList.add('current');
        if (this.isPlaying) {
          chip.classList.add('animating');
        }
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
    this.updateProgress();
  }

  updateProgress() {
    const total = this.moveQueue.length;
    const current = this.currentStepIndex;
    const pct = total === 0 ? 0 : Math.round((current / total) * 100);

    if (this.progressFill) {
      this.progressFill.style.width = `${pct}%`;
    }
    if (this.progressText) {
      this.progressText.textContent = total === 0 ? '0 / 0' : `${current} / ${total} moves (${pct}%)`;
    }
  }

  startSequenceExecution() {
    const text = this.notationInput.value;
    const parsed = this.engine.parse(text);

    if (!parsed.valid || parsed.moves.length === 0) {
      this.showToast('Please enter a valid sequence of moves first.');
      return;
    }

    this.moveQueue = parsed.moves;
    this.currentStepIndex = 0;
    this.renderTimeline(this.moveQueue);
    this.resumeOrStartPlayback();
  }

  resumeOrStartPlayback() {
    if (this.cube.isAnimating) return;
    if (this.moveQueue.length === 0) {
      this.startSequenceExecution();
      return;
    }

    if (this.currentStepIndex >= this.moveQueue.length) {
      this.currentStepIndex = 0;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.updatePlayPauseButton();
    this.updateTimelineHighlights();
    this.runPlaybackLoop();
  }

  async runPlaybackLoop() {
    while (this.isPlaying && this.currentStepIndex < this.moveQueue.length) {
      const move = this.moveQueue[this.currentStepIndex];
      this.updateTimelineHighlights();

      try {
        const resolved = await this.cube.executeMove(move);
        this.recordMoveToHistory(move, resolved);
        this.currentStepIndex++;
        this.updateTimelineHighlights();
      } catch (err) {
        console.error('Error executing move:', err);
        this.pausePlayback();
        break;
      }
    }

    if (this.currentStepIndex >= this.moveQueue.length) {
      this.isPlaying = false;
      this.isPaused = false;
      this.updatePlayPauseButton();
      this.updateTimelineHighlights();
      this.showToast('Sequence finished!');
    }
  }

  recordMoveToHistory(move, resolved) {
    const snapshot = this.cube.saveSnapshot();
    const entry = {
      index: this.historyPointer + 1,
      raw: move.raw,
      name: move.name,
      targetColor: resolved ? resolved.targetColor : 'White',
      targetColorHex: resolved ? resolved.targetColorHex : '#F7F8FA',
      snapshot,
      timestamp: Date.now()
    };

    if (this.historyMode === 'branch') {
      if (this.historyPointer < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyPointer + 1);
      }
      this.history.push(entry);
      this.historyPointer = this.history.length - 1;
    } else {
      this.history.splice(this.historyPointer + 1, 0, entry);
      this.historyPointer++;
      for (let i = 0; i < this.history.length; i++) {
        this.history[i].index = i;
      }
    }

    this.renderChessHistory();
  }

  jumpToHistoryStep(index) {
    if (this.cube.isAnimating) return;
    if (index < 0 || index >= this.history.length) return;

    if (this.isPlaying) {
      this.pausePlayback();
    }

    const state = this.history[index];
    this.cube.restoreSnapshot(state.snapshot);
    this.historyPointer = index;

    this.updateChessHighlight();
    this.showToast(index === 0 ? 'Jumped to Solved State' : `Jumped to Move ${index}: ${state.raw}`);
  }

  renderChessHistory() {
    if (!this.chessTableBody) return;
    this.chessTableBody.innerHTML = '';

    const totalMoves = this.history.length - 1;
    if (this.headerHistoryCount) {
      this.headerHistoryCount.textContent = totalMoves;
    }
    if (this.historyStepBadge) {
      this.historyStepBadge.textContent = `Move ${this.historyPointer} / ${totalMoves}`;
    }

    for (let i = 1; i <= totalMoves; i += 2) {
      const moveNum = Math.ceil(i / 2);
      const moveA = this.history[i];
      const moveB = (i + 1 <= totalMoves) ? this.history[i + 1] : null;

      const row = document.createElement('div');
      row.className = 'chess-row';

      const numSpan = document.createElement('span');
      numSpan.className = 'chess-num';
      numSpan.textContent = `${moveNum}.`;
      row.appendChild(numSpan);

      const cellA = document.createElement('button');
      cellA.className = 'chess-cell';
      cellA.dataset.idx = i;
      cellA.innerHTML = `
        <span class="cell-dot" style="background:${moveA.targetColorHex};"></span>
        <span class="cell-notation">${moveA.raw}</span>
      `;
      cellA.addEventListener('click', () => this.jumpToHistoryStep(i));
      row.appendChild(cellA);

      if (moveB) {
        const cellB = document.createElement('button');
        cellB.className = 'chess-cell';
        cellB.dataset.idx = i + 1;
        cellB.innerHTML = `
          <span class="cell-dot" style="background:${moveB.targetColorHex};"></span>
          <span class="cell-notation">${moveB.raw}</span>
        `;
        cellB.addEventListener('click', () => this.jumpToHistoryStep(i + 1));
        row.appendChild(cellB);
      } else {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'chess-cell empty-cell';
        row.appendChild(emptyCell);
      }

      this.chessTableBody.appendChild(row);
    }

    this.updateChessHighlight();
  }

  updateChessHighlight() {
    const totalMoves = this.history.length - 1;
    if (this.historyStepBadge) {
      this.historyStepBadge.textContent = `Move ${this.historyPointer} / ${totalMoves}`;
    }

    if (this.chessRowStart) {
      this.chessRowStart.classList.toggle('active', this.historyPointer === 0);
    }

    const cells = this.chessTableBody ? this.chessTableBody.querySelectorAll('.chess-cell:not(.empty-cell)') : [];
    cells.forEach(cell => {
      const idx = parseInt(cell.dataset.idx, 10);
      cell.classList.remove('active-step', 'past-step', 'future-step');

      if (idx === this.historyPointer) {
        cell.classList.add('active-step');
        cell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (idx < this.historyPointer) {
        cell.classList.add('past-step');
      } else {
        cell.classList.add('future-step');
      }
    });
  }

  saveCurrentState(name) {
    const currentMovesStr = this.history.slice(1, this.historyPointer + 1).map(m => m.raw).join(' ');
    const stateName = name || `State at step ${this.historyPointer}`;

    const newState = {
      id: 'state_' + Date.now(),
      name: stateName,
      puzzleType: this.currentType,
      cubeSize: this.currentSize,
      stepIndex: this.historyPointer,
      notation: currentMovesStr || '(Solved Initial)',
      snapshot: this.cube.saveSnapshot(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.savedStates.unshift(newState);
    this.saveStatesToStorage();
    this.renderSavedStatesList();

    if (this.tabBtnStates) {
      this.tabBtnStates.click();
    }
    this.showToast(`Saved state: "${stateName}"`);
  }

  renderSavedStatesList() {
    if (!this.savedStatesList) return;
    this.savedStatesList.innerHTML = '';

    if (this.savedStatesCount) {
      this.savedStatesCount.textContent = this.savedStates.length;
    }

    if (this.savedStates.length === 0) {
      this.savedStatesList.innerHTML = '<div class="saved-states-empty">No saved states yet. Click "⭐ Save" to bookmark a position!</div>';
      return;
    }

    this.savedStates.forEach(st => {
      const card = document.createElement('div');
      card.className = 'state-item';

      const typeLabel = st.puzzleType || `${st.cubeSize}×${st.cubeSize}`;

      card.innerHTML = `
        <div class="state-item-header">
          <span class="state-item-name">${this.escapeHtml(st.name)}</span>
          <span class="state-item-size">${typeLabel}</span>
        </div>
        <div class="state-item-seq" title="${this.escapeHtml(st.notation)}">${this.escapeHtml(st.notation)}</div>
        <div class="state-item-meta">
          <span>Step ${st.stepIndex}</span>
          <span>${st.timestamp}</span>
        </div>
        <div class="state-item-actions">
          <button class="state-btn restore" data-id="${st.id}">⚡ Restore</button>
          <button class="state-btn copy" data-id="${st.id}">📋 Copy</button>
          <button class="state-btn delete" data-id="${st.id}">🗑️</button>
        </div>
      `;

      card.querySelector('.state-btn.restore').addEventListener('click', () => {
        this.restoreSavedState(st);
      });

      card.querySelector('.state-btn.copy').addEventListener('click', () => {
        navigator.clipboard.writeText(st.notation).then(() => {
          this.showToast(`Copied notation for "${st.name}"!`);
        });
      });

      card.querySelector('.state-btn.delete').addEventListener('click', () => {
        if (confirm(`Delete saved state "${st.name}"?`)) {
          this.deleteSavedState(st.id);
        }
      });

      this.savedStatesList.appendChild(card);
    });
  }

  restoreSavedState(state) {
    if (this.cube.isAnimating) return;

    const targetType = state.puzzleType || (state.cubeSize === 2 ? 'cube2' : (state.cubeSize === 4 ? 'cube4' : 'cube3'));
    if (targetType !== this.currentType || state.cubeSize !== this.currentSize) {
      this.currentSize = state.cubeSize;
      this.currentType = targetType;
      this.engine.setSize(state.cubeSize, targetType);
      this.cube.setSize(state.cubeSize, targetType);
      this.sizeButtons.forEach(b => {
        const isMatch = (b.dataset.type === targetType);
        b.classList.toggle('active', isMatch);
      });
      this.updatePresetsDropdown();
      this.updateKeypadForPuzzle();
    }

    this.cube.restoreSnapshot(state.snapshot);

    this.initHistory();
    if (state.notation && state.notation !== '(Solved Initial)') {
      const parsed = this.engine.parse(state.notation);
      if (parsed.valid) {
        parsed.moves.forEach(m => {
          this.history.push({
            index: this.history.length,
            raw: m.raw,
            name: m.name,
            targetColor: 'White',
            targetColorHex: '#F7F8FA',
            snapshot: state.snapshot,
            timestamp: Date.now()
          });
        });
        this.historyPointer = this.history.length - 1;
        this.notationInput.value = state.notation;
        this.validateAndPreviewInput();
      }
    }

    this.renderChessHistory();
    this.showToast(`Restored state: "${state.name}"`);
  }

  deleteSavedState(id) {
    this.savedStates = this.savedStates.filter(s => s.id !== id);
    this.saveStatesToStorage();
    this.renderSavedStatesList();
    this.showToast('Saved state deleted.');
  }

  exportStatesJSON() {
    if (this.savedStates.length === 0) {
      this.showToast('No saved states to export.');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.savedStates, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `cubesim_saved_states_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    this.showToast('Saved states exported to JSON file!');
  }

  handleImportStatesFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          this.savedStates = [...imported, ...this.savedStates];
          this.saveStatesToStorage();
          this.renderSavedStatesList();
          this.showToast(`Successfully imported ${imported.length} saved state(s)!`);
        } else {
          this.showToast('Invalid JSON file format.');
        }
      } catch (err) {
        console.error(err);
        this.showToast('Failed to parse JSON file.');
      }
      this.importStatesFile.value = '';
    };
    reader.readAsText(file);
  }

  loadSavedStatesFromStorage() {
    try {
      const raw = localStorage.getItem('cubesim_saved_states');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveStatesToStorage() {
    try {
      localStorage.setItem('cubesim_saved_states', JSON.stringify(this.savedStates));
    } catch (e) {
      console.warn('Storage limit reached or unavailable', e);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  pausePlayback() {
    this.isPlaying = false;
    this.isPaused = true;
    this.updatePlayPauseButton();
    this.updateTimelineHighlights();
  }

  stopPlayback() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentStepIndex = 0;
    this.updatePlayPauseButton();
    this.updateTimelineHighlights();
  }

  async stepNext() {
    if (this.cube.isAnimating) return;
    if (this.currentStepIndex >= this.moveQueue.length) {
      this.showToast('At the end of sequence.');
      return;
    }

    this.isPlaying = false;
    this.updatePlayPauseButton();

    const move = this.moveQueue[this.currentStepIndex];
    this.updateTimelineHighlights();

    try {
      const resolved = await this.cube.executeMove(move);
      this.recordMoveToHistory(move, resolved);
      this.currentStepIndex++;
      this.updateTimelineHighlights();
    } catch (err) {
      console.error(err);
    }
  }

  async stepPrev() {
    if (this.cube.isAnimating) return;
    if (this.currentStepIndex <= 0) {
      this.showToast('At the start of sequence.');
      return;
    }

    this.isPlaying = false;
    this.updatePlayPauseButton();

    this.currentStepIndex--;
    const forwardMove = this.moveQueue[this.currentStepIndex];
    
    const inverseRaw = this.engine.invertToken(forwardMove.raw);
    const inverseMove = this.engine.parseToken(inverseRaw);

    if (inverseMove) {
      try {
        const resolved = await this.cube.executeMove(inverseMove);
        this.recordMoveToHistory(inverseMove, resolved);
        this.updateTimelineHighlights();
      } catch (err) {
        console.error(err);
      }
    }
  }

  async jumpToStep(targetIndex) {
    if (this.cube.isAnimating || this.isPlaying) return;
    if (targetIndex === this.currentStepIndex) return;

    while (this.currentStepIndex < targetIndex) {
      await this.stepNext();
    }
    while (this.currentStepIndex > targetIndex) {
      await this.stepPrev();
    }
  }

  async executeScramble() {
    this.stopPlayback();
    const scrambleStr = this.engine.generateScramble();
    this.notationInput.value = scrambleStr;
    this.validateAndPreviewInput();

    const parsed = this.engine.parse(scrambleStr);
    if (!parsed.valid) return;

    const prevSpeed = this.cube.animationDuration;
    this.cube.setSpeed(75);

    this.moveQueue = parsed.moves;
    this.currentStepIndex = 0;
    this.isPlaying = true;
    this.updatePlayPauseButton();

    this.showToast(`Scrambling ${this.currentType.toUpperCase()}...`);
    await this.runPlaybackLoop();

    this.cube.setSpeed(prevSpeed);
  }

  updatePlayPauseButton() {
    if (!this.btnPlayPause) return;
    if (this.isPlaying) {
      this.btnPlayPause.innerHTML = '<span class="icon">⏸</span> Pause';
      this.btnPlayPause.classList.add('playing');
    } else {
      this.btnPlayPause.innerHTML = '<span class="icon">▶</span> Play';
      this.btnPlayPause.classList.remove('playing');
    }
  }

  showToast(msg) {
    const existing = document.querySelector('.toast-banner');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-banner';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  // =========================================================================
  // Physical Cube Rebuilder (3D Painter & 2D Net) Logic
  // =========================================================================
  openRebuilder() {
    if (!this.rebuilderModal) return;
    const typeNames = {
      cube2: '2×2 Pocket Cube',
      cube3: '3×3 Standard Cube',
      cube4: '4×4 Rubik\'s Revenge',
      mirror: '🪞 Mirror / Bump Cube',
      fisher: '🐟 Tony Fisher 45° Cube',
      mixup: '🔀 WitEden & Oskar Mixup 3×3'
    };
    if (this.rebuilderPuzzleTypePill) {
      this.rebuilderPuzzleTypePill.textContent = typeNames[this.currentType] || `${this.currentSize}×${this.currentSize}`;
    }

    const N = this.currentSize;
    if (!this.rebuilderNet || !this.rebuilderNet.U || this.rebuilderNet.U.length !== N * N) {
      this.rebuilderNet = this.cube.getFaceletMap();
    }

    this.renderRebuilderPalette();
    this.renderRebuilderNet();
    this.validateRebuilderNet();

    // Initialize 3D Painter if not created yet
    if (!this.rebuilder3DPainter && this.rebuilder3DCanvasWrap) {
      this.rebuilder3DPainter = new Rebuilder3DPainter(
        this.rebuilder3DCanvasWrap,
        (face, idx) => {
          if (!this.rebuilderNet) return;
          this.rebuilderNet[face][idx] = this.rebuilderActiveBrush;
          if (this.rebuilder3DPainter) {
            this.rebuilder3DPainter.updateFacelet(face, idx, this.rebuilderActiveBrush);
          }
          if (this.cubeUnfoldedNet) {
            const tile = this.cubeUnfoldedNet.querySelector(`.facelet-tile[data-face="${face}"][data-index="${idx}"]`);
            if (tile) {
              const th = this.cube ? this.cube.theme : {};
              tile.style.backgroundColor = th[this.rebuilderActiveBrush] || '#666';
            }
          }
          this.validateRebuilderNet();
        }
      );
    }

    if (this.rebuilder3DPainter) {
      this.rebuilder3DPainter.build(this.currentSize, this.cube ? this.cube.theme : null, this.rebuilderNet);
    }

    this.rebuilderModal.classList.remove('hidden');
    setTimeout(() => {
      if (this.rebuilder3DPainter) this.rebuilder3DPainter.resize();
    }, 60);
  }

  renderRebuilderPalette() {
    if (!this.rebuilderPalettePills) return;
    this.rebuilderPalettePills.innerHTML = '';

    const th = this.cube ? this.cube.theme : {
      U: '#F7F8FA', D: '#FFD500', F: '#009E48', B: '#0046AD', R: '#C41230', L: '#FF5500'
    };

    const paletteDefs = [
      { id: 'U', name: 'White (U)', hex: th.U || '#F7F8FA' },
      { id: 'D', name: 'Yellow (D)', hex: th.D || '#FFD500' },
      { id: 'F', name: 'Green (F)', hex: th.F || '#009E48' },
      { id: 'B', name: 'Blue (B)', hex: th.B || '#0046AD' },
      { id: 'R', name: 'Red (R)', hex: th.R || '#C41230' },
      { id: 'L', name: 'Orange (L)', hex: th.L || '#FF5500' }
    ];

    paletteDefs.forEach(p => {
      const btn = document.createElement('button');
      btn.className = `palette-brush-btn ${this.rebuilderActiveBrush === p.id ? 'active' : ''}`;
      btn.dataset.brush = p.id;
      btn.innerHTML = `
        <span class="swatch-dot" style="background: ${p.hex};"></span>
        <span>${p.name}</span>
        <span class="palette-count-badge" id="brush-count-${p.id}">0</span>
      `;
      btn.addEventListener('click', () => {
        this.rebuilderActiveBrush = p.id;
        this.rebuilderPalettePills.querySelectorAll('.palette-brush-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      this.rebuilderPalettePills.appendChild(btn);
    });
  }

  renderRebuilderNet() {
    if (!this.cubeUnfoldedNet) return;
    this.cubeUnfoldedNet.innerHTML = '';
    const N = this.currentSize;

    const th = this.cube ? this.cube.theme : {
      U: '#F7F8FA', D: '#FFD500', F: '#009E48', B: '#0046AD', R: '#C41230', L: '#FF5500'
    };

    const faceNames = {
      U: 'U (Top)',
      L: 'L (Left)',
      F: 'F (Front)',
      R: 'R (Right)',
      B: 'B (Back)',
      D: 'D (Bottom)'
    };

    const faces = ['U', 'L', 'F', 'R', 'B', 'D'];

    faces.forEach(face => {
      const card = document.createElement('div');
      card.className = 'net-face-card';
      card.dataset.face = face;

      const title = document.createElement('div');
      title.className = 'net-face-title';
      title.textContent = faceNames[face];
      card.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'facelet-grid';
      grid.style.gridTemplateColumns = `repeat(${N}, 26px)`;
      grid.style.gridTemplateRows = `repeat(${N}, 26px)`;

      for (let i = 0; i < N * N; i++) {
        const tile = document.createElement('div');
        tile.className = 'facelet-tile';
        tile.dataset.face = face;
        tile.dataset.index = i;

        const val = (this.rebuilderNet && this.rebuilderNet[face]) ? this.rebuilderNet[face][i] : face;
        tile.style.backgroundColor = th[val] || '#666';

        tile.addEventListener('click', () => {
          if (!this.rebuilderNet) return;
          this.rebuilderNet[face][i] = this.rebuilderActiveBrush;
          tile.style.backgroundColor = th[this.rebuilderActiveBrush] || '#666';
          if (this.rebuilder3DPainter) {
            this.rebuilder3DPainter.updateFacelet(face, i, this.rebuilderActiveBrush);
          }
          this.validateRebuilderNet();
        });

        grid.appendChild(tile);
      }

      card.appendChild(grid);
      this.cubeUnfoldedNet.appendChild(card);
    });
  }

  validateRebuilderNet() {
    if (!this.rebuilderNet) return false;
    const N = this.currentSize;
    const targetCount = N * N;
    const counts = { U: 0, D: 0, F: 0, B: 0, R: 0, L: 0 };

    for (const f of ['U', 'D', 'F', 'B', 'R', 'L']) {
      const arr = this.rebuilderNet[f] || [];
      for (const val of arr) {
        if (counts[val] !== undefined) counts[val]++;
      }
    }

    for (const f of ['U', 'D', 'F', 'B', 'R', 'L']) {
      const el = document.getElementById(`brush-count-${f}`);
      if (el) {
        const c = counts[f];
        el.textContent = `${c}/${targetCount}`;
        el.style.color = c === targetCount ? '#34d399' : (c > targetCount ? '#ef4444' : '#f59e0b');
      }
    }

    let isValid = true;
    const diffs = [];
    for (const f of ['U', 'D', 'F', 'B', 'R', 'L']) {
      if (counts[f] !== targetCount) {
        isValid = false;
        const diff = counts[f] - targetCount;
        diffs.push(`${f}: ${counts[f]}/${targetCount} (${diff > 0 ? '+' : ''}${diff})`);
      }
    }

    if (this.rebuilderStatusBanner && this.rebuilderStatusText) {
      if (isValid) {
        this.rebuilderStatusBanner.className = 'rebuilder-status-banner valid';
        this.rebuilderStatusBanner.querySelector('.status-icon').textContent = '✅';
        this.rebuilderStatusText.textContent = `Valid Cube State: exactly ${targetCount} facelets per color!`;
        if (this.rebuilderStatusDetails) {
          this.rebuilderStatusDetails.textContent = 'All faces mathematically balanced. Ready to apply to 3D and solve.';
        }
      } else {
        this.rebuilderStatusBanner.className = 'rebuilder-status-banner invalid';
        this.rebuilderStatusBanner.querySelector('.status-icon').textContent = '⚠️';
        this.rebuilderStatusText.textContent = `Imbalanced Stickers (each color requires ${targetCount} facelets)`;
        if (this.rebuilderStatusDetails) {
          this.rebuilderStatusDetails.textContent = diffs.join(' • ');
        }
      }
    }

    return isValid;
  }

  rebuilderReadFrom3D() {
    this.rebuilderNet = this.cube.getFaceletMap();
    this.renderRebuilderNet();
    this.validateRebuilderNet();
    if (this.rebuilder3DPainter) {
      this.rebuilder3DPainter.build(this.currentSize, this.cube ? this.cube.theme : null, this.rebuilderNet);
    }
    this.showToast('📥 Loaded current 3D cube stickers into 2D net!');
  }

  rebuilderResetSolved() {
    const N = this.currentSize;
    this.rebuilderNet = {
      U: Array(N * N).fill('U'),
      D: Array(N * N).fill('D'),
      F: Array(N * N).fill('F'),
      B: Array(N * N).fill('B'),
      R: Array(N * N).fill('R'),
      L: Array(N * N).fill('L')
    };
    this.renderRebuilderNet();
    this.validateRebuilderNet();
    if (this.rebuilder3DPainter) {
      this.rebuilder3DPainter.build(this.currentSize, this.cube ? this.cube.theme : null, this.rebuilderNet);
    }
    this.showToast('🔄 Net reset to solved cube pattern');
  }

  rebuilderClear() {
    const N = this.currentSize;
    this.rebuilderNet = {
      U: Array(N * N).fill('U'),
      D: Array(N * N).fill('U'),
      F: Array(N * N).fill('U'),
      B: Array(N * N).fill('U'),
      R: Array(N * N).fill('U'),
      L: Array(N * N).fill('U')
    };
    this.renderRebuilderNet();
    this.validateRebuilderNet();
    if (this.rebuilder3DPainter) {
      this.rebuilder3DPainter.build(this.currentSize, this.cube ? this.cube.theme : null, this.rebuilderNet);
    }
    this.showToast('🧹 Cleared net stickers to blank white');
  }

  rebuilderApplyTo3D(andOpenSolver = false) {
    if (!this.rebuilderNet) return;
    this.cube.applyFaceletMap(this.rebuilderNet);

    this.history = [{
      index: 0,
      raw: 'Rebuild',
      name: 'Physical Cube Reconstructed',
      targetColor: 'White',
      targetColorHex: this.cube ? this.cube.theme.U : '#F7F8FA',
      snapshot: this.cube.saveSnapshot(),
      timestamp: Date.now()
    }];
    this.historyPointer = 0;
    this.renderChessHistory();

    if (this.rebuilderModal) {
      this.rebuilderModal.classList.add('hidden');
    }

    this.showToast('🚀 Physical Cube net projected to 3D simulator!');

    if (andOpenSolver) {
      setTimeout(() => this.openSolverGuide(), 200);
    }
  }

  // =========================================================================
  // Instant Solve (Least Moves / Optimal Algorithm) Controller
  // =========================================================================
  openInstantSolve() {
    if (!this.instantSolveModal) return;

    const faceletMap = this.cube.getFaceletMap();
    const startTime = performance.now();
    const result = window.OptimalSolver.solve(this.currentType, faceletMap);
    const elapsed = Math.round(performance.now() - startTime);
    if (!result.timeMs) result.timeMs = elapsed;

    this.instantSolveResult = result;
    this.instantMoveIdx = 0;
    this.instantIsPlaying = false;
    this.updateInstantPlayButton();

    if (result.error) {
      if (this.instantMoveCount) this.instantMoveCount.textContent = '⚠️ Unsolvable State';
      if (this.instantSolveTime) this.instantSolveTime.textContent = `${result.timeMs}ms`;
      if (this.instantSolveMethod) this.instantSolveMethod.textContent = result.method || 'Validator';
      if (this.instantAlgorithmText) {
        this.instantAlgorithmText.innerHTML = `<span style="color: #ef4444; font-weight: 600;">Error:</span> ${result.error}<br><small style="color: #94a3b8; margin-top: 6px; display: inline-block;">Please check physical cube stickers in the 3D Rebuilder to correct parity or color count.</small>`;
      }
      if (this.instantEfficiencyText) {
        this.instantEfficiencyText.textContent = 'Invalid cube arrangement: check for twisted corners or flipped edges.';
      }
      if (this.instantTotalChips) this.instantTotalChips.textContent = '0';
      if (this.instantCurrentIdx) this.instantCurrentIdx.textContent = '0';
      if (this.instantMoveChips) this.instantMoveChips.innerHTML = '';
      this.instantSolveModal.classList.remove('hidden');
      return;
    }

    if (result.isSolved || result.moves.length === 0) {
      if (this.instantMoveCount) this.instantMoveCount.textContent = '🎉 Solved (0 Moves)';
      if (this.instantSolveTime) this.instantSolveTime.textContent = `${result.timeMs}ms`;
      if (this.instantSolveMethod) this.instantSolveMethod.textContent = result.method;
      if (this.instantAlgorithmText) {
        this.instantAlgorithmText.textContent = 'The puzzle is already in a solved state!';
      }
      if (this.instantEfficiencyText) {
        this.instantEfficiencyText.textContent = 'Zero moves needed. Enjoy the solved cube!';
      }
      if (this.instantTotalChips) this.instantTotalChips.textContent = '0';
      if (this.instantCurrentIdx) this.instantCurrentIdx.textContent = '0';
      if (this.instantMoveChips) this.instantMoveChips.innerHTML = '';
      this.instantSolveModal.classList.remove('hidden');
      return;
    }

    // Active optimal sequence
    if (this.instantMoveCount) {
      this.instantMoveCount.textContent = `⚡ ${result.moveCount} Moves (Optimal)`;
    }
    if (this.instantSolveTime) {
      this.instantSolveTime.textContent = `Found in ${result.timeMs}ms`;
    }
    if (this.instantSolveMethod) {
      this.instantSolveMethod.textContent = result.method;
    }
    if (this.instantAlgorithmText) {
      this.instantAlgorithmText.textContent = result.algorithm;
    }
    if (this.instantEfficiencyText) {
      if (this.currentType === 'cube2') {
        this.instantEfficiencyText.textContent = `God's Algorithm BFS guarantee: solved in exactly ${result.moveCount} moves (optimal half-turn metric).`;
      } else {
        this.instantEfficiencyText.textContent = `God's Algorithm efficiency: standard CFOP averages 55-60 moves; this Two-Phase optimal path takes only ${result.moveCount} moves (~65% move reduction).`;
      }
    }
    if (this.instantTotalChips) {
      this.instantTotalChips.textContent = `${result.moves.length}`;
    }

    this.renderInstantMoveChips();
    this.updateInstantChips();
    this.instantSolveModal.classList.remove('hidden');
  }

  renderInstantMoveChips() {
    if (!this.instantMoveChips || !this.instantSolveResult) return;
    this.instantMoveChips.innerHTML = '';

    this.instantSolveResult.moves.forEach((move, idx) => {
      const chip = document.createElement('button');
      chip.className = `move-chip ${idx === this.instantMoveIdx ? 'active' : ''}`;
      chip.textContent = move;
      chip.dataset.idx = idx;

      chip.addEventListener('click', async () => {
        if (this.instantIsPlaying) return;
        if (idx > this.instantMoveIdx) {
          while (this.instantMoveIdx < idx) {
            await this.instantStepNext();
          }
        } else if (idx < this.instantMoveIdx) {
          while (this.instantMoveIdx > idx) {
            await this.instantStepPrev();
          }
        }
      });

      this.instantMoveChips.appendChild(chip);
    });
  }

  updateInstantChips() {
    if (!this.instantMoveChips) return;
    const chips = this.instantMoveChips.querySelectorAll('.move-chip');
    chips.forEach((chip, idx) => {
      chip.classList.toggle('active', idx === this.instantMoveIdx);
      chip.classList.toggle('done', idx < this.instantMoveIdx);
    });
    if (this.instantCurrentIdx) {
      this.instantCurrentIdx.textContent = `${this.instantMoveIdx}`;
    }
    const activeChip = this.instantMoveChips.querySelector('.move-chip.active');
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  copyInstantAlgorithm() {
    if (!this.instantSolveResult || !this.instantSolveResult.algorithm) return;
    const text = this.instantSolveResult.algorithm;
    navigator.clipboard.writeText(text).then(() => {
      if (this.btnCopyInstantAlg) {
        const orig = this.btnCopyInstantAlg.innerHTML;
        this.btnCopyInstantAlg.innerHTML = '✅ Copied!';
        setTimeout(() => {
          if (this.btnCopyInstantAlg) this.btnCopyInstantAlg.innerHTML = orig;
        }, 2000);
      }
      this.showToast('📋 Copied optimal algorithm to clipboard!');
    }).catch(() => {
      this.showToast(`Algorithm: ${text}`);
    });
  }

  async instantStepNext() {
    if (!this.instantSolveResult || !this.instantSolveResult.moves) return;
    if (this.instantMoveIdx >= this.instantSolveResult.moves.length) {
      this.instantIsPlaying = false;
      this.updateInstantPlayButton();
      return;
    }

    const rawMove = this.instantSolveResult.moves[this.instantMoveIdx];
    const parsed = this.engine.parseMove(rawMove);
    if (parsed) {
      const sp = parseInt(this.instantSpeedSelect ? this.instantSpeedSelect.value : 200, 10);
      this.cube.setSpeed(sp);
      await this.cube.executeMove(parsed);
      this.recordMoveToHistory(parsed, { targetColor: 'Optimal', targetColorHex: '#f59e0b' });
    }

    this.instantMoveIdx++;
    this.updateInstantChips();

    if (this.instantMoveIdx >= this.instantSolveResult.moves.length) {
      this.instantIsPlaying = false;
      this.updateInstantPlayButton();
      this.showToast('🎉 Cube solved with optimal solution!');
    }
  }

  async instantStepPrev() {
    if (!this.instantSolveResult || !this.instantSolveResult.moves) return;
    if (this.instantMoveIdx <= 0) return;

    this.instantMoveIdx--;
    const rawMove = this.instantSolveResult.moves[this.instantMoveIdx];
    const invertedStr = this.invertMoveStr(rawMove);
    const parsed = this.engine.parseMove(invertedStr);
    if (parsed) {
      const sp = parseInt(this.instantSpeedSelect ? this.instantSpeedSelect.value : 200, 10);
      this.cube.setSpeed(sp);
      await this.cube.executeMove(parsed);
      this.recordMoveToHistory(parsed, { targetColor: 'Optimal Undo', targetColorHex: '#f59e0b' });
    }

    this.updateInstantChips();
  }

  async instantTogglePlay() {
    if (this.instantIsPlaying) {
      this.instantIsPlaying = false;
      this.updateInstantPlayButton();
      return;
    }

    if (!this.instantSolveResult || !this.instantSolveResult.moves) return;
    if (this.instantMoveIdx >= this.instantSolveResult.moves.length) {
      await this.instantReset();
    }

    this.instantIsPlaying = true;
    this.updateInstantPlayButton();

    while (this.instantIsPlaying && this.instantMoveIdx < this.instantSolveResult.moves.length) {
      await this.instantStepNext();
      if (this.instantMoveIdx < this.instantSolveResult.moves.length && this.instantIsPlaying) {
        const sp = parseInt(this.instantSpeedSelect ? this.instantSpeedSelect.value : 200, 10);
        const delay = Math.max(20, Math.floor(sp * 0.2));
        await new Promise(r => setTimeout(r, delay));
      }
    }

    this.instantIsPlaying = false;
    this.updateInstantPlayButton();
  }

  updateInstantPlayButton() {
    if (!this.btnInstantPlay) return;
    if (this.instantIsPlaying) {
      if (this.instantPlayIcon) this.instantPlayIcon.textContent = '⏸';
      if (this.instantPlayLabel) this.instantPlayLabel.textContent = 'Pause';
    } else {
      if (this.instantPlayIcon) this.instantPlayIcon.textContent = '▶';
      if (this.instantPlayLabel) this.instantPlayLabel.textContent = 'Animate Solve';
    }
  }

  async instantReset() {
    this.instantIsPlaying = false;
    this.updateInstantPlayButton();
    if (!this.instantSolveResult || !this.instantSolveResult.moves) return;

    const prevSpeed = this.cube.animationDuration;
    this.cube.setSpeed(60);
    while (this.instantMoveIdx > 0) {
      await this.instantStepPrev();
    }
    this.cube.setSpeed(prevSpeed);
  }

  async instantJumpToSolved() {
    this.instantIsPlaying = false;
    this.updateInstantPlayButton();
    if (!this.instantSolveResult || !this.instantSolveResult.moves) return;

    const prevSpeed = this.cube.animationDuration;
    this.cube.setSpeed(0);
    while (this.instantMoveIdx < this.instantSolveResult.moves.length) {
      await this.instantStepNext();
    }
    this.cube.setSpeed(prevSpeed);
    this.showToast('⚡ Instantly jumped to solved state!');
  }

  recordMoveInHistory(parsed, rawMove) {
    if (!parsed) return;
    this.recordMoveToHistory(parsed, { targetColor: 'Step', targetColorHex: '#10b981' });
  }

  // =========================================================================
  // Interactive Step-by-Step Solution Guide Controller
  // =========================================================================
  openSolverGuide() {
    if (!this.solverModal) return;

    const GuideDB = window.PUZZLE_GUIDES;
    const guideInfo = (GuideDB && GuideDB[this.currentType]) ? GuideDB[this.currentType] : (GuideDB ? GuideDB.cube3 : null);

    if (this.solverPuzzleBadge && guideInfo) {
      this.solverPuzzleBadge.textContent = `${guideInfo.title} (${guideInfo.difficulty})`;
    }

    this.solverStages = [];
    if (this.currentType === 'cube2') {
      const solver2 = new window.Cube2Solver();
      this.solverStages = solver2.generateGuide();
    } else if (this.currentType === 'cube3' || this.currentType === 'mirror' || this.currentType === 'fisher') {
      const faceletMap = this.cube.getFaceletMap();
      const vCube = window.VirtualCube.fromFaceletMap(faceletMap);
      const lbl = new window.LBLSolver(vCube);
      this.solverStages = lbl.solve();
    } else if (this.currentType === 'cube4') {
      this.solverStages = [
        {
          id: 'cube4_centers',
          title: 'Step 1: Solve 6 Center Blocks',
          badge: 'Centers',
          goal: 'Build 2×2 solid color center blocks on each of the 6 faces.',
          explanation: 'Form 1×2 center bars using inner slice turns (r, l, u, d) and pair them up. Standard color order: White opposite Yellow, Green opposite Blue, Red opposite Orange.',
          algReference: 'Slice Commutator: Rw U Rw\'',
          moves: ['Rw', 'U', "Rw'"],
          moveCount: 3
        },
        {
          id: 'cube4_edges',
          title: 'Step 2: Pair 12 Composite Edge Wings',
          badge: 'Edges',
          goal: 'Pair up the 24 edge wings into 12 composite edge pairs.',
          explanation: 'Find matching edge wings and place them in the front-left and front-right slots. Use slice-flip-slice commutators to pair them together without disturbing solved centers.',
          algReference: 'Uw\' (R U R\' F R\' F\' R) Uw',
          moves: ["Uw'", 'R', 'U', "R'", 'F', "R'", "F'", 'R', 'Uw'],
          moveCount: 9
        },
        {
          id: 'cube4_3x3',
          title: 'Step 3: 3×3 Reduction Solve',
          badge: '3×3 Stage',
          goal: 'With centers and edges paired, solve using standard 3×3 CFOP moves.',
          explanation: 'Treat outer slices like a standard 3×3: solve White Cross, F2L corner-edge pairs, and OLL.',
          algReference: 'Standard 3×3 CFOP',
          moves: ['R', 'U', "R'", 'U', 'R', 'U2', "R'"],
          moveCount: 7
        },
        {
          id: 'cube4_parity',
          title: 'Step 4: OLL & PLL Parity Resolution',
          badge: 'Parities',
          goal: 'Fix 4×4 specific parity states (single flipped edge or two swapped opposite edges).',
          explanation: 'If a single edge wing is inverted (impossible on 3×3), execute OLL Parity. If two opposite edges need to be swapped at the end, execute PLL Parity.',
          algReference: 'PLL Parity: 2R2 U2 2R2 Uw2 2R2 Uw2',
          moves: ['2R2', 'U2', '2R2', 'Uw2', '2R2', 'Uw2'],
          moveCount: 6
        }
      ];
    } else if (this.currentType === 'mixup') {
      this.solverStages = [
        {
          id: 'mixup_phase1',
          title: 'Phase 1: Shape Restoration (45° Slices)',
          badge: 'Shape Mod',
          goal: 'Return all tilted pieces back to standard cubic form using 45° slice commutators.',
          explanation: 'On the Mixup 3×3, 45° middle slice turns (M45, E45, S45) allow centers and edges to swap places. Restore cubic shape by pairing edges back into edge tracks.',
          algReference: 'M45 M45 U2 M45\' M45\' U2',
          moves: ['M45', 'M45', 'U2', "M45'", "M45'", 'U2'],
          moveCount: 6
        },
        {
          id: 'mixup_phase2',
          title: 'Phase 2: Center-Edge Orbit Routing',
          badge: 'Orbits',
          goal: 'Swap displaced centers out of edge slots and return each center to its face.',
          explanation: 'Once cubic shape is restored, some face centers may still sit in edge locations. Execute 45° commutators to route each center stone home.',
          algReference: 'M45 U2 M45\' U2',
          moves: ['M45', 'U2', "M45'", 'U2'],
          moveCount: 4
        },
        {
          id: 'mixup_phase3',
          title: 'Phase 3: Standard 3×3 Finish & Parity',
          badge: 'Finish',
          goal: 'Solve the remaining permutation using standard 3×3 layer-by-layer algorithms.',
          explanation: 'If an odd parity permutation appears on the last layer, perform a single M45 slice swap to flip permutation parity, then resolve.',
          algReference: 'R U R\' U R U2 R\'',
          moves: ['R', 'U', "R'", 'U', 'R', 'U2', "R'"],
          moveCount: 7
        }
      ];
    }

    let totalMoves = 0;
    this.solverStages.forEach(s => totalMoves += (s.moves ? s.moves.length : 0));
    if (this.solverTotalMoves) {
      this.solverTotalMoves.textContent = `${totalMoves} moves total (${this.solverStages.length} steps)`;
    }

    this.renderSolverStageTabs();
    this.renderSpecialPuzzleCoach(this.currentType);
    this.selectSolverStage(0);

    this.solverModal.classList.remove('hidden');
  }

  renderSolverStageTabs() {
    if (!this.solverStageTabs) return;
    this.solverStageTabs.innerHTML = '';

    this.solverStages.forEach((stage, idx) => {
      const btn = document.createElement('button');
      btn.className = `stage-tab-btn ${idx === this.solverActiveStageIdx ? 'active' : ''}`;
      btn.dataset.stageIdx = idx;
      btn.innerHTML = `
        <span>${stage.badge || `Step ${idx + 1}`}</span>
        <span class="stage-tab-count">(${stage.moves ? stage.moves.length : 0}m)</span>
      `;
      btn.addEventListener('click', () => {
        this.selectSolverStage(idx);
      });
      this.solverStageTabs.appendChild(btn);
    });
  }

  selectSolverStage(stageIdx) {
    if (stageIdx < 0 || stageIdx >= this.solverStages.length) return;
    this.solverActiveStageIdx = stageIdx;
    this.solverActiveMoveIdx = 0;
    this.solverIsPlaying = false;
    this.updateSolverPlayButton();

    if (this.solverStageTabs) {
      this.solverStageTabs.querySelectorAll('.stage-tab-btn').forEach((b, i) => {
        b.classList.toggle('active', i === stageIdx);
      });
    }

    const stage = this.solverStages[stageIdx];
    if (!stage) return;

    if (this.stageBadge) this.stageBadge.textContent = stage.badge || `Step ${stageIdx + 1}`;
    if (this.stageTitle) this.stageTitle.textContent = stage.title || '';
    if (this.stageAlgRef) this.stageAlgRef.innerHTML = `<code>${stage.algReference || 'Notation Guide'}</code>`;
    if (this.stageGoalText) this.stageGoalText.textContent = stage.goal || '';
    if (this.stageCoachText) this.stageCoachText.textContent = stage.explanation || '';
    if (this.stageMoveCount) this.stageMoveCount.textContent = stage.moves ? stage.moves.length : 0;

    this.renderStageMoveChips();
  }

  renderStageMoveChips() {
    if (!this.stageMovesChips) return;
    this.stageMovesChips.innerHTML = '';

    const stage = this.solverStages[this.solverActiveStageIdx];
    const moves = (stage && stage.moves) ? stage.moves : [];

    if (this.stageCurrentMoveIdx) this.stageCurrentMoveIdx.textContent = this.solverActiveMoveIdx;
    if (this.stageTotalMovesInStage) this.stageTotalMovesInStage.textContent = moves.length;

    if (moves.length === 0) {
      this.stageMovesChips.innerHTML = '<span style="font-size: 12px; color: var(--text-dim); padding: 4px;">No moves required for this stage (already aligned!)</span>';
      return;
    }

    moves.forEach((m, idx) => {
      const chip = document.createElement('button');
      chip.className = `move-chip ${idx === this.solverActiveMoveIdx ? 'active' : ''} ${idx < this.solverActiveMoveIdx ? 'done' : ''}`;
      chip.textContent = m;
      chip.dataset.idx = idx;

      chip.addEventListener('click', async () => {
        if (this.cube.isAnimating) return;
        while (this.solverActiveMoveIdx < idx) {
          await this.solverStepNext();
        }
      });

      this.stageMovesChips.appendChild(chip);
    });
  }

  updateStageChipsHighlight() {
    if (!this.stageMovesChips) return;
    const chips = this.stageMovesChips.querySelectorAll('.move-chip');
    chips.forEach((chip, idx) => {
      chip.classList.toggle('active', idx === this.solverActiveMoveIdx);
      chip.classList.toggle('done', idx < this.solverActiveMoveIdx);
    });

    const stage = this.solverStages[this.solverActiveStageIdx];
    const moves = (stage && stage.moves) ? stage.moves : [];
    if (this.stageCurrentMoveIdx) this.stageCurrentMoveIdx.textContent = this.solverActiveMoveIdx;
    if (this.stageTotalMovesInStage) this.stageTotalMovesInStage.textContent = moves.length;
  }

  async solverStepNext() {
    if (this.cube.isAnimating) return;
    const stage = this.solverStages[this.solverActiveStageIdx];
    if (!stage || !stage.moves) return;

    if (this.solverActiveMoveIdx >= stage.moves.length) {
      // Stage already completed!
      if (this.solverActiveStageIdx < this.solverStages.length - 1) {
        this.selectSolverStage(this.solverActiveStageIdx + 1);
      } else {
        this.showToast('🏆 Puzzle Solved! All stages complete.');
        this.solverIsPlaying = false;
        this.updateSolverPlayButton();
      }
      return;
    }

    const rawMove = stage.moves[this.solverActiveMoveIdx];
    const parsed = this.engine.parseMove(rawMove);
    if (parsed) {
      const sp = parseInt(this.solverSpeedSelect ? this.solverSpeedSelect.value : 250, 10);
      this.cube.setSpeed(sp);
      await this.cube.executeMove(parsed);
      this.recordMoveInHistory(parsed, rawMove);
    }

    this.solverActiveMoveIdx++;
    this.updateStageChipsHighlight();

    if (this.solverActiveMoveIdx >= stage.moves.length) {
      if (this.solverActiveStageIdx < this.solverStages.length - 1) {
        setTimeout(() => {
          if (this.solverIsPlaying) {
            this.selectSolverStage(this.solverActiveStageIdx + 1);
          }
        }, 150);
      } else {
        this.showToast('🏆 Puzzle Solved! All stages complete.');
        this.solverIsPlaying = false;
        this.updateSolverPlayButton();
      }
    }
  }

  async solverStepPrev() {
    if (this.cube.isAnimating) return;
    const stage = this.solverStages[this.solverActiveStageIdx];
    if (!stage || !stage.moves || this.solverActiveMoveIdx <= 0) return;

    this.solverActiveMoveIdx--;
    const rawMove = stage.moves[this.solverActiveMoveIdx];
    const invertedStr = this.invertMoveStr(rawMove);
    const parsed = this.engine.parseMove(invertedStr);

    if (parsed) {
      const sp = parseInt(this.solverSpeedSelect ? this.solverSpeedSelect.value : 250, 10);
      this.cube.setSpeed(sp);
      await this.cube.executeMove(parsed);
      this.recordMoveInHistory(parsed, invertedStr);
    }

    this.updateStageChipsHighlight();
  }

  invertMoveStr(m) {
    if (!m) return m;
    if (m.endsWith("2")) return m;
    if (m.endsWith("'")) return m.slice(0, -1);
    return m + "'";
  }

  async solverTogglePlay() {
    if (this.solverIsPlaying) {
      this.solverIsPlaying = false;
      this.updateSolverPlayButton();
      return;
    }

    this.solverIsPlaying = true;
    this.updateSolverPlayButton();

    while (this.solverIsPlaying) {
      const stage = this.solverStages[this.solverActiveStageIdx];
      if (!stage || !stage.moves) break;

      if (this.solverActiveMoveIdx >= stage.moves.length) {
        if (this.solverActiveStageIdx < this.solverStages.length - 1) {
          this.selectSolverStage(this.solverActiveStageIdx + 1);
          await new Promise(r => setTimeout(r, 200));
        } else {
          this.showToast('🏆 Solution Finished!');
          this.solverIsPlaying = false;
          this.updateSolverPlayButton();
          break;
        }
      }

      await this.solverStepNext();
      const delay = parseInt(this.solverSpeedSelect ? this.solverSpeedSelect.value : 250, 10);
      await new Promise(r => setTimeout(r, delay));
    }

    this.updateSolverPlayButton();
  }

  updateSolverPlayButton() {
    if (!this.btnSolverPlay) return;
    if (this.solverIsPlaying) {
      if (this.solverPlayIcon) this.solverPlayIcon.textContent = '⏸';
      if (this.solverPlayLabel) this.solverPlayLabel.textContent = 'Pause';
      this.btnSolverPlay.classList.add('playing');
    } else {
      if (this.solverPlayIcon) this.solverPlayIcon.textContent = '▶';
      if (this.solverPlayLabel) this.solverPlayLabel.textContent = 'Play Step';
      this.btnSolverPlay.classList.remove('playing');
    }
  }

  async solverResetCurrentStage() {
    if (this.cube.isAnimating) return;
    const stage = this.solverStages[this.solverActiveStageIdx];
    if (!stage || !stage.moves) return;

    this.solverIsPlaying = false;
    this.updateSolverPlayButton();

    while (this.solverActiveMoveIdx > 0) {
      await this.solverStepPrev();
    }
  }

  async solverAutoSolveAll() {
    if (this.solverIsPlaying) return;
    this.solverIsPlaying = true;
    this.updateSolverPlayButton();

    for (let sIdx = this.solverActiveStageIdx; sIdx < this.solverStages.length; sIdx++) {
      if (!this.solverIsPlaying) break;
      if (sIdx !== this.solverActiveStageIdx) {
        this.selectSolverStage(sIdx);
        await new Promise(r => setTimeout(r, 150));
      }

      const stage = this.solverStages[sIdx];
      while (this.solverActiveMoveIdx < stage.moves.length && this.solverIsPlaying) {
        await this.solverStepNext();
        const delay = parseInt(this.solverSpeedSelect ? this.solverSpeedSelect.value : 250, 10);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    this.solverIsPlaying = false;
    this.updateSolverPlayButton();
  }

  renderSpecialPuzzleCoach(type) {
    if (!this.coachTipsContainer) return;
    this.coachTipsContainer.innerHTML = '';

    const tips = {
      mirror: [
        {
          title: 'Layer Thickness Recognition',
          desc: 'Measure pieces by elevation: 0.65 (Thin/Yellow), 1.0 (Medium/Equatorial), 1.35 (Thick/White). Always start your cross on the thickest layer!',
          alg: null
        },
        {
          title: 'Flush Plane Verification',
          desc: 'A piece is placed with 100% orientation precision when all its outer sides create a flat, seamless plane with adjacent pieces with 0 ridges.',
          alg: null
        }
      ],
      fisher: [
        {
          title: 'Center 90° Rotation Parity',
          desc: 'Fisher centers have directional grains! Use this 4-move cycle repeated 5 times to rotate the top center 90° without disturbing anything else:',
          alg: "R U R' U R U R' U R U R' U R U R' U R U R' U"
        },
        {
          title: 'Edge-Corner Duality & False Solves',
          desc: 'Triangular corners can be flipped upside down without looking scrambled. If you get a single flipped edge on the last layer, pop out a middle edge and reinsert it flipped!',
          alg: null
        }
      ],
      mixup: [
        {
          title: '45° Slice Commutator (Shape Restoration)',
          desc: 'Execute this 45° commutator to interchange centers and edges and restore the standard cubic silhouette:',
          alg: "M45 M45 U2 M45' M45' U2"
        },
        {
          title: 'Center Orbit Routing',
          desc: 'Route centers back to their correct faces using slice commutators:',
          alg: "M45 U2 M45' U2"
        }
      ],
      cube4: [
        {
          title: '4×4 OLL Parity (1 Inverted Edge)',
          desc: 'Flips the front-top composite edge wing without disturbing centers:',
          alg: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"
        },
        {
          title: '4×4 PLL Parity (Opposite Edges Swap)',
          desc: 'Swaps the front and back composite edge pairs on the top layer:',
          alg: "2R2 U2 2R2 Uw2 2R2 Uw2"
        }
      ]
    };

    const puzzleTips = tips[type] || [
      {
        title: '3×3 Core Principle',
        desc: 'Centers are fixed mechanisms! White is always opposite Yellow, Green opposite Blue, Red opposite Orange.',
        alg: null
      },
      {
        title: 'Sexy Move Trigger (R U R\' U\')',
        desc: 'The fundamental 4-move building block used for inserting corners, orienting the yellow cross, and corner twists.',
        alg: "R U R' U'"
      }
    ];

    puzzleTips.forEach(t => {
      const card = document.createElement('div');
      card.className = 'coach-tip-card';

      let algButton = '';
      if (t.alg) {
        algButton = `<button class="btn-parity-run" data-alg="${t.alg}" title="Run algorithm live on 3D cube">▶ Run on Cube</button>`;
      }

      card.innerHTML = `
        <div class="coach-tip-header">
          <span class="coach-tip-title">⚡ ${t.title}</span>
          ${algButton}
        </div>
        <p class="coach-tip-body">${t.desc}</p>
      `;

      if (t.alg) {
        const btn = card.querySelector('.btn-parity-run');
        if (btn) {
          btn.addEventListener('click', async () => {
            this.showToast(`Executing: ${t.title}`);
            const prevSpeed = this.cube.animationDuration;
            this.cube.setSpeed(180);
            const tokens = t.alg.trim().split(/\s+/);
            for (const tk of tokens) {
              const parsed = this.engine.parseMove(tk);
              if (parsed) {
                await this.cube.executeMove(parsed);
                this.recordMoveInHistory(parsed, tk);
              }
            }
            this.cube.setSpeed(prevSpeed);
          });
        }
      }

      this.coachTipsContainer.appendChild(card);
    });
  }
}

if (typeof window !== 'undefined') {
  window.CubeApp = CubeApp;
  window.addEventListener('DOMContentLoaded', () => {
    window.cubeApp = new CubeApp();
  });
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CubeApp };
}
