/**
 * Rubik's Cube 3D Simulation Engine using Three.js
 * Supports 2x2, 3x3, 4x4, Fisher Cube (Tony Fisher 45° shape-mod),
 * Mirror / Bump Cube (asymmetric shape-mod), and WitEden & Oskar Mixup 3x3 (45° slice turns).
 * Includes complete Cube Designer and Theme Customizer.
 */

class RubiksCube3D {
  constructor(containerElement, initialSize = 3, initialType = 'cube3') {
    this.container = containerElement;
    this.size = initialSize;
    this.puzzleType = initialType; // 'cube2', 'cube3', 'cube4', 'fisher', 'mirror', 'mixup'
    this.cubies = [];
    this.isAnimating = false;
    this.animationDuration = 220;
    this.viewMode = 'relative';

    this.onOrientationChangeCallback = null;
    this.lastOrientationKey = '';

    // Active Theme / Designer Configuration
    this.theme = this.loadThemeFromStorage() || {
      name: 'WCA Classic',
      U: '#F7F8FA', // White
      D: '#FFD500', // Yellow
      F: '#009E48', // Green
      B: '#0046AD', // Blue
      R: '#C41230', // Red
      L: '#FF5500', // Orange
      body: '#121316', // Core plastic
      radius: 24,
      padding: 16,
      roughness: 0.28,
      metalness: 0.04
    };

    this.initThree();
    this.initTriads();
    this.initStickerMaterials();
    this.buildPuzzle(this.size, this.puzzleType);
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initThree() {
    this.scene = new THREE.Scene();

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.updateCameraForSize(this.size);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 24;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(12, 16, 14);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xb0c4de, 0.45);
    dirLight2.position.set(-12, -14, -12);
    this.scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222233, 0.35);
    this.scene.add(hemiLight);

    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    this.pivotGroup = new THREE.Group();
    this.scene.add(this.pivotGroup);

    this.initShadowFloor();
  }

  initTriads() {
    this.faceDefinitions = [
      { id: '+X', color: 'Red',    colorHex: this.theme.R, vec: new THREE.Vector3(1, 0, 0),  axis: 'x', sign: 1 },
      { id: '-X', color: 'Orange', colorHex: this.theme.L, vec: new THREE.Vector3(-1, 0, 0), axis: 'x', sign: -1 },
      { id: '+Y', color: 'White',  colorHex: this.theme.U, vec: new THREE.Vector3(0, 1, 0),  axis: 'y', sign: 1 },
      { id: '-Y', color: 'Yellow', colorHex: this.theme.D, vec: new THREE.Vector3(0, -1, 0), axis: 'y', sign: -1 },
      { id: '+Z', color: 'Green',  colorHex: this.theme.F, vec: new THREE.Vector3(0, 0, 1),  axis: 'z', sign: 1 },
      { id: '-Z', color: 'Blue',   colorHex: this.theme.B, vec: new THREE.Vector3(0, 0, -1), axis: 'z', sign: -1 }
    ];

    this.triads = [];
    for (const u of this.faceDefinitions) {
      for (const f of this.faceDefinitions) {
        if (u.vec.dot(f.vec) === 0) {
          const rVec = new THREE.Vector3().crossVectors(u.vec, f.vec);
          const r = this.faceDefinitions.find(a => a.vec.x === rVec.x && a.vec.y === rVec.y && a.vec.z === rVec.z);
          const d = this.faceDefinitions.find(a => a.vec.x === -u.vec.x && a.vec.y === -u.vec.y && a.vec.z === -u.vec.z);
          const b = this.faceDefinitions.find(a => a.vec.x === -f.vec.x && a.vec.y === -f.vec.y && a.vec.z === -f.vec.z);
          const l = this.faceDefinitions.find(a => a.vec.x === -r.vec.x && a.vec.y === -r.vec.y && a.vec.z === -r.vec.z);

          this.triads.push({
            U: u, D: d, F: f, B: b, R: r, L: l,
            key: `${f.id}_${r.id}_${u.id}`
          });
        }
      }
    }
  }

  getCurrentOrientation() {
    if (this.viewMode === 'fixed') {
      return {
        U: this.faceDefinitions.find(f => f.id === '+Y'),
        D: this.faceDefinitions.find(f => f.id === '-Y'),
        F: this.faceDefinitions.find(f => f.id === '+Z'),
        B: this.faceDefinitions.find(f => f.id === '-Z'),
        R: this.faceDefinitions.find(f => f.id === '+X'),
        L: this.faceDefinitions.find(f => f.id === '-X'),
        key: '+Z_+X_+Y'
      };
    }

    const camFront = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

    let bestTriad = this.triads[0];
    let maxScore = -99999;

    for (let i = 0; i < this.triads.length; i++) {
      const t = this.triads[i];
      const score = (t.F.vec.dot(camFront) * 1.5) +
                    (t.U.vec.dot(camUp) * 1.2) +
                    (t.R.vec.dot(camRight) * 1.0);

      if (score > maxScore) {
        maxScore = score;
        bestTriad = t;
      }
    }

    return bestTriad;
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.checkOrientationUpdate(true);
  }

  setOnOrientationChange(callback) {
    this.onOrientationChangeCallback = callback;
    this.checkOrientationUpdate(true);
  }

  checkOrientationUpdate(force = false) {
    const current = this.getCurrentOrientation();
    if (force || current.key !== this.lastOrientationKey) {
      this.lastOrientationKey = current.key;
      if (this.onOrientationChangeCallback) {
        this.onOrientationChangeCallback(current, this.viewMode);
      }
    }
  }

  initShadowFloor() {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const ctx = shadowCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const shadowGeo = new THREE.PlaneGeometry(8, 8);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shadowCanvas),
      transparent: true,
      depthWrite: false
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = -2.8;
    this.scene.add(this.shadowMesh);
  }

  updateCameraForSize(size) {
    const distMap = { 2: 6.2, 3: 7.8, 4: 9.6 };
    let dist = distMap[size] || 8.0;
    if (this.puzzleType === 'mirror' || this.puzzleType === 'fisher') {
      dist = 8.5;
    }
    this.camera.position.set(dist * 0.75, dist * 0.65, dist * 0.95);
    this.camera.lookAt(0, 0, 0);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
    if (this.shadowMesh) {
      this.shadowMesh.position.y = - (size * 0.5 + 1.25);
      const scale = size / 3;
      this.shadowMesh.scale.set(scale, scale, 1);
    }
  }

  /**
   * Generates realistic speedcube sticker textures using HTML5 canvas
   */
  createStickerTexture(fillColor, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const bodyColor = options.body || this.theme.body || '#121316';
    const pad = options.padding !== undefined ? options.padding : this.theme.padding;
    const rad = options.radius !== undefined ? options.radius : this.theme.radius;
    const size = 256 - pad * 2;

    // Body plastic border
    ctx.fillStyle = bodyColor;
    ctx.fillRect(0, 0, 256, 256);

    // Inner rounded sticker
    ctx.beginPath();
    ctx.roundRect(pad, pad, size, size, Math.max(0, rad));
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Subtle bevel reflection on top edge
    const glossGrad = ctx.createLinearGradient(pad, pad, pad, pad + size * 0.45);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = glossGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = 4;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  initStickerMaterials() {
    const th = this.theme;
    const rough = th.roughness !== undefined ? th.roughness : 0.28;
    const metal = th.metalness !== undefined ? th.metalness : 0.04;

    this.materials = {
      R: new THREE.MeshStandardMaterial({ map: this.createStickerTexture(th.R), roughness: rough, metalness: metal }),
      L: new THREE.MeshStandardMaterial({ map: this.createStickerTexture(th.L), roughness: rough, metalness: metal }),
      U: new THREE.MeshStandardMaterial({ map: this.createStickerTexture(th.U), roughness: rough, metalness: metal }),
      D: new THREE.MeshStandardMaterial({ map: this.createStickerTexture(th.D), roughness: rough, metalness: metal }),
      F: new THREE.MeshStandardMaterial({ map: this.createStickerTexture(th.F), roughness: rough, metalness: metal }),
      B: new THREE.MeshStandardMaterial({ map: this.createStickerTexture(th.B), roughness: rough, metalness: metal }),
      inner: new THREE.MeshStandardMaterial({ color: new THREE.Color(th.body), roughness: 0.85, metalness: 0.02 })
    };

    // Mirror Cube Brushed Metallic Material
    this.materials.mirror = new THREE.MeshStandardMaterial({
      color: 0xdde2ea,
      roughness: 0.18,
      metalness: 0.88
    });
  }

  /**
   * Re-applies a custom theme from Cube Designer
   */
  applyTheme(newTheme) {
    this.theme = Object.assign(this.theme, newTheme);
    this.saveThemeToStorage();
    this.initTriads();
    this.initStickerMaterials();

    // Refresh materials on existing cubies
    if (this.puzzleType === 'mirror') {
      const col = new THREE.Color(this.theme.U || '#dde2ea');
      this.materials.mirror.color.copy(col);
    } else {
      this.buildPuzzle(this.size, this.puzzleType);
    }

    this.checkOrientationUpdate(true);
  }

  saveThemeToStorage() {
    try {
      localStorage.setItem('cubesim_theme', JSON.stringify(this.theme));
    } catch (e) {
      console.warn(e);
    }
  }

  loadThemeFromStorage() {
    try {
      const raw = localStorage.getItem('cubesim_theme');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Main builder that dispatches to specific puzzle generator
   */
  buildPuzzle(size, type = 'cube3') {
    this.size = size;
    this.puzzleType = type;

    while (this.cubeGroup.children.length > 0) {
      const obj = this.cubeGroup.children[0];
      this.cubeGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }
    this.cubies = [];

    if (type === 'mirror') {
      this.buildMirrorCube();
    } else if (type === 'fisher') {
      this.buildFisherCube();
    } else if (type === 'mixup') {
      this.buildMixupCube();
    } else {
      this.buildStandardCube(size);
    }

    this.updateCameraForSize(size);
    this.checkOrientationUpdate(true);
  }

  /**
   * Builds Standard 2x2, 3x3, or 4x4 Cube
   */
  buildStandardCube(size) {
    const N = size;
    const cubieSize = 0.96;
    const spacing = 1.0;
    const offset = (N - 1) / 2;
    const cubieGeo = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);

    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          const isExterior = (x === 0 || x === N - 1 || y === 0 || y === N - 1 || z === 0 || z === N - 1);
          if (!isExterior) continue;

          const mats = [
            x === N - 1 ? this.materials.R : this.materials.inner,
            x === 0     ? this.materials.L : this.materials.inner,
            y === N - 1 ? this.materials.U : this.materials.inner,
            y === 0     ? this.materials.D : this.materials.inner,
            z === N - 1 ? this.materials.F : this.materials.inner,
            z === 0     ? this.materials.B : this.materials.inner
          ];

          const cubie = new THREE.Mesh(cubieGeo, mats);
          cubie.castShadow = true;
          cubie.receiveShadow = true;

          cubie.position.set(
            (x - offset) * spacing,
            (y - offset) * spacing,
            (z - offset) * spacing
          );

          cubie.userData = { initialX: x, initialY: y, initialZ: z };
          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  /**
   * Builds the Mirror / Bump Cube (Shape-mod with unequal layer thicknesses)
   */
  buildMirrorCube() {
    this.size = 3;
    const Tx = [0.65, 1.0, 1.35];
    const Ty = [0.75, 1.0, 1.25];
    const Tz = [0.85, 1.0, 1.15];

    // Offsets to center the full 3.0 cube at (0, 0, 0)
    const Cx = [-1.5 + 0.325, -1.5 + 0.65 + 0.5, -1.5 + 1.65 + 0.675];
    const Cy = [-1.5 + 0.375, -1.5 + 0.75 + 0.5, -1.5 + 1.75 + 0.625];
    const Cz = [-1.5 + 0.425, -1.5 + 0.85 + 0.5, -1.5 + 1.85 + 0.575];

    const mirrorMat = this.materials.mirror;

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          const isExterior = (x === 0 || x === 2 || y === 0 || y === 2 || z === 0 || z === 2);
          if (!isExterior) continue;

          const w = Tx[x] - 0.04;
          const h = Ty[y] - 0.04;
          const d = Tz[z] - 0.04;
          const geo = new THREE.BoxGeometry(w, h, d);

          const cubie = new THREE.Mesh(geo, mirrorMat);
          cubie.castShadow = true;
          cubie.receiveShadow = true;

          cubie.position.set(Cx[x], Cy[y], Cz[z]);
          cubie.userData = { initialX: x, initialY: y, initialZ: z, isMirror: true };

          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  /**
   * Builds the Fisher Cube (Tony Fisher's 45° vertical shape-mod)
   */
  buildFisherCube() {
    this.size = 3;
    const L = 1.5 * Math.SQRT2; // ~2.1213
    const h = 0.5;

    // Build the 9 XZ-plane 2D polygon cross sections
    const getPolygonForCell = (i, k) => {
      const shape = new THREE.Shape();

      if (i === 0 && k === 0) {
        // Center: square
        shape.moveTo(-h, -h);
        shape.lineTo(h, -h);
        shape.lineTo(h, h);
        shape.lineTo(-h, h);
        shape.closePath();
      } else if (i === 1 && k === 0) {
        // Right edge (pentagon corner pointing along +X)
        shape.moveTo(h, -h);
        shape.lineTo(h, h);
        shape.lineTo(L - h, h);
        shape.lineTo(L, 0);
        shape.lineTo(L - h, -h);
        shape.closePath();
      } else if (i === -1 && k === 0) {
        // Left edge (pentagon corner pointing along -X)
        shape.moveTo(-h, h);
        shape.lineTo(-h, -h);
        shape.lineTo(-L + h, -h);
        shape.lineTo(-L, 0);
        shape.lineTo(-L + h, h);
        shape.closePath();
      } else if (i === 0 && k === 1) {
        // Front edge (pentagon corner pointing along +Z)
        shape.moveTo(-h, h);
        shape.lineTo(h, h);
        shape.lineTo(h, L - h);
        shape.lineTo(0, L);
        shape.lineTo(-h, L - h);
        shape.closePath();
      } else if (i === 0 && k === -1) {
        // Back edge (pentagon corner pointing along -Z)
        shape.moveTo(h, -h);
        shape.lineTo(-h, -h);
        shape.lineTo(-h, -L + h);
        shape.lineTo(0, -L);
        shape.lineTo(h, -L + h);
        shape.closePath();
      } else if (i === 1 && k === 1) {
        // Corner (1, 1): right triangle with flat diagonal exterior
        shape.moveTo(h, h);
        shape.lineTo(L - h, h);
        shape.lineTo(h, L - h);
        shape.closePath();
      } else if (i === -1 && k === 1) {
        // Corner (-1, 1)
        shape.moveTo(-h, h);
        shape.lineTo(-h, L - h);
        shape.lineTo(-L + h, h);
        shape.closePath();
      } else if (i === -1 && k === -1) {
        // Corner (-1, -1)
        shape.moveTo(-h, -h);
        shape.lineTo(-L + h, -h);
        shape.lineTo(-h, -L + h);
        shape.closePath();
      } else if (i === 1 && k === -1) {
        // Corner (1, -1)
        shape.moveTo(h, -h);
        shape.lineTo(h, -L + h);
        shape.lineTo(L - h, -h);
        shape.closePath();
      }
      return shape;
    };

    const extrudeSettings = {
      depth: 0.96,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02
    };

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const isExterior = (x !== 0 || y !== 0 || z !== 0);
          if (!isExterior) continue;

          const polyShape = getPolygonForCell(x, z);
          const geo = new THREE.ExtrudeGeometry(polyShape, extrudeSettings);
          // Rotate extrusion to align depth with Y axis
          geo.center();

          // Appropriate materials for top/bottom vs sides
          const mats = [
            (y === 1) ? this.materials.U : (y === -1 ? this.materials.D : this.materials.inner),
            (x === 1) ? this.materials.R : (x === -1 ? this.materials.L : (z === 1 ? this.materials.F : this.materials.B))
          ];

          const cubie = new THREE.Mesh(geo, mats);
          cubie.castShadow = true;
          cubie.receiveShadow = true;

          // Position at y layer
          cubie.position.set(0, y * 1.0, 0);
          cubie.userData = { initialX: x + 1, initialY: y + 1, initialZ: z + 1, isFisher: true };

          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  /**
   * Builds the WitEden & Oskar Mixup 3x3 (Chamfered pieces enabling 45° slice swaps)
   */
  buildMixupCube() {
    this.size = 3;
    const cubieSize = 0.96;
    const spacing = 1.0;
    const offset = 1;
    const cubieGeo = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          const isExterior = (x === 0 || x === 2 || y === 0 || y === 2 || z === 0 || z === 2);
          if (!isExterior) continue;

          const mats = [
            x === 2 ? this.materials.R : this.materials.inner,
            x === 0 ? this.materials.L : this.materials.inner,
            y === 2 ? this.materials.U : this.materials.inner,
            y === 0 ? this.materials.D : this.materials.inner,
            z === 2 ? this.materials.F : this.materials.inner,
            z === 0 ? this.materials.B : this.materials.inner
          ];

          const cubie = new THREE.Mesh(cubieGeo, mats);
          cubie.castShadow = true;
          cubie.receiveShadow = true;

          cubie.position.set(
            (x - offset) * spacing,
            (y - offset) * spacing,
            (z - offset) * spacing
          );

          cubie.userData = { initialX: x, initialY: y, initialZ: z, isMixup: true };
          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  reset() {
    this.buildPuzzle(this.size, this.puzzleType);
  }

  setSize(newSize, puzzleType = 'cube3') {
    this.size = newSize;
    this.puzzleType = puzzleType;
    this.buildPuzzle(newSize, puzzleType);
  }

  setSpeed(durationMs) {
    this.animationDuration = durationMs;
  }

  saveSnapshot() {
    return this.cubies.map(cubie => ({
      pos: { x: cubie.position.x, y: cubie.position.y, z: cubie.position.z },
      quat: { x: cubie.quaternion.x, y: cubie.quaternion.y, z: cubie.quaternion.z, w: cubie.quaternion.w }
    }));
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.length !== this.cubies.length) {
      return false;
    }

    this.pivotGroup.rotation.set(0, 0, 0);
    this.isAnimating = false;

    for (let i = 0; i < this.cubies.length; i++) {
      const cubie = this.cubies[i];
      const data = snapshot[i];

      this.cubeGroup.attach(cubie);
      cubie.position.set(data.pos.x, data.pos.y, data.pos.z);
      cubie.quaternion.set(data.quat.x, data.quat.y, data.quat.z, data.quat.w);
      this.snapOrientation(cubie);
    }

    this.checkOrientationUpdate(true);
    return true;
  }

  resolveMove(move) {
    const orientation = this.getCurrentOrientation();
    const N = this.size;
    const mult = move.multiplier || 1;

    // Whole Cube Rotations (x, y, z)
    if (move.isRotation) {
      const base = move.baseLetter;
      let targetFace = orientation.R;
      if (base === 'x') targetFace = orientation.R;
      else if (base === 'y') targetFace = orientation.U;
      else if (base === 'z') targetFace = orientation.F;

      const layers = Array.from({ length: N }, (_, idx) => idx);
      const angle = (-targetFace.sign * (Math.PI / 2)) * mult;
      return { 
        axis: targetFace.axis, 
        layers, 
        angle, 
        targetColor: targetFace.color, 
        targetColorHex: targetFace.colorHex 
      };
    }

    // Slice Moves (M, E, S) - supports 45° (mult = 0.5) for Mixup Cube!
    if (move.isSlice) {
      const base = move.baseLetter;
      let targetFace = orientation.L;
      if (base === 'M') targetFace = orientation.L;
      else if (base === 'E') targetFace = orientation.D;
      else if (base === 'S') targetFace = orientation.F;

      const layers = (N === 3) ? [1] : [1, 2];
      const angle = (-targetFace.sign * (Math.PI / 2)) * mult;
      return { 
        axis: targetFace.axis, 
        layers, 
        angle, 
        targetColor: targetFace.color, 
        targetColorHex: targetFace.colorHex 
      };
    }

    // Standard Face & Wide Moves (U, D, L, R, F, B)
    const faceLetter = move.face;
    const targetFace = orientation[faceLetter];
    if (!targetFace) {
      throw new Error(`Unknown face letter: ${faceLetter}`);
    }

    const axis = targetFace.axis;
    const sign = targetFace.sign;
    const isHigh = (sign === 1);
    const angle = (-sign * (Math.PI / 2)) * mult;

    let layers = [];
    if (move.layerPrefix !== null && move.layerPrefix !== undefined) {
      if (move.isWide) {
        const count = move.layerPrefix;
        for (let l = 0; l < count; l++) {
          layers.push(isHigh ? (N - 1 - l) : l);
        }
      } else {
        const idx = move.layerPrefix - 1;
        layers = [isHigh ? (N - 1 - idx) : idx];
      }
    } else if (move.isWide) {
      if (N === 2) {
        layers = [0, 1];
      } else {
        layers = isHigh ? [N - 2, N - 1] : [0, 1];
      }
    } else {
      layers = [isHigh ? (N - 1) : 0];
    }

    layers.sort((a, b) => a - b);
    return { 
      axis, 
      layers, 
      angle, 
      targetColor: targetFace.color, 
      targetColorHex: targetFace.colorHex 
    };
  }

  async executeMove(rawMove) {
    if (this.isAnimating) {
      throw new Error('Another move is currently animating.');
    }

    const resolved = this.resolveMove(rawMove);
    const { axis, layers, angle } = resolved;
    const N = this.size;
    const offset = (N - 1) / 2;
    const threshold = 0.35; // slightly wider threshold for shape-mods

    const selectedCubies = this.cubies.filter(cubie => {
      const coord = cubie.position[axis];
      const layerIdx = Math.round(coord + offset);
      return layers.includes(layerIdx) && Math.abs((layerIdx - offset) - coord) < threshold;
    });

    if (selectedCubies.length === 0) {
      return resolved;
    }

    this.isAnimating = true;

    this.pivotGroup.rotation.set(0, 0, 0);
    this.pivotGroup.position.set(0, 0, 0);
    this.pivotGroup.scale.set(1, 1, 1);
    this.pivotGroup.updateMatrixWorld(true);

    selectedCubies.forEach(cubie => {
      this.pivotGroup.attach(cubie);
    });

    if (this.animationDuration <= 5) {
      this.pivotGroup.rotation[axis] = angle;
      this.finalizeMove(selectedCubies, axis);
      this.isAnimating = false;
      return resolved;
    }

    return new Promise(resolve => {
      const startTime = performance.now();
      const duration = this.animationDuration;

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1.0);

        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        this.pivotGroup.rotation[axis] = angle * ease;

        if (progress < 1.0) {
          requestAnimationFrame(step);
        } else {
          this.pivotGroup.rotation[axis] = angle;
          this.finalizeMove(selectedCubies, axis);
          this.isAnimating = false;
          resolve(resolved);
        }
      };

      requestAnimationFrame(step);
    });
  }

  finalizeMove(selectedCubies, axis) {
    this.pivotGroup.updateMatrixWorld(true);

    const N = this.size;
    const offset = (N - 1) / 2;

    selectedCubies.forEach(cubie => {
      this.cubeGroup.attach(cubie);

      // Snap coordinates (Mirror and Fisher cubes preserve their relative offsets)
      if (!cubie.userData.isMirror && !cubie.userData.isFisher) {
        cubie.position.x = Math.round(cubie.position.x + offset) - offset;
        cubie.position.y = Math.round(cubie.position.y + offset) - offset;
        cubie.position.z = Math.round(cubie.position.z + offset) - offset;
      }

      this.snapOrientation(cubie);
    });

    this.pivotGroup.rotation.set(0, 0, 0);
  }

  snapOrientation(cubie) {
    // If Mixup puzzle, allow 45° snapping
    if (this.puzzleType === 'mixup') {
      const euler = new THREE.Euler().setFromQuaternion(cubie.quaternion, 'XYZ');
      const snapAngle = (a) => Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      euler.x = snapAngle(euler.x);
      euler.y = snapAngle(euler.y);
      euler.z = snapAngle(euler.z);
      cubie.quaternion.setFromEuler(euler);
      return;
    }

    const mat = new THREE.Matrix4().makeRotationFromQuaternion(cubie.quaternion);
    const e = mat.elements;

    const xVec = new THREE.Vector3(e[0], e[1], e[2]);
    const yVec = new THREE.Vector3(e[4], e[5], e[6]);

    const snapVector = (v) => {
      const ax = Math.abs(v.x);
      const ay = Math.abs(v.y);
      const az = Math.abs(v.z);
      if (ax >= ay && ax >= az) {
        return new THREE.Vector3(Math.sign(v.x) || 1, 0, 0);
      } else if (ay >= ax && ay >= az) {
        return new THREE.Vector3(0, Math.sign(v.y) || 1, 0);
      } else {
        return new THREE.Vector3(0, 0, Math.sign(v.z) || 1);
      }
    };

    const snappedX = snapVector(xVec);
    const dot = yVec.dot(snappedX);
    yVec.sub(snappedX.clone().multiplyScalar(dot));
    const snappedY = snapVector(yVec);
    const snappedZ = new THREE.Vector3().crossVectors(snappedX, snappedY);

    const snappedMat = new THREE.Matrix4().makeBasis(snappedX, snappedY, snappedZ);
    cubie.quaternion.setFromRotationMatrix(snappedMat);
  }

  setCameraPreset(preset) {
    const distMap = { 2: 6.2, 3: 7.8, 4: 9.6 };
    let dist = distMap[this.size] || 8.0;
    if (this.puzzleType === 'mirror' || this.puzzleType === 'fisher') {
      dist = 8.5;
    }

    const targets = {
      isometric: { x: dist * 0.75, y: dist * 0.65, z: dist * 0.95 },
      front:     { x: 0,           y: 0,           z: dist },
      back:      { x: 0,           y: 0,           z: -dist },
      top:       { x: 0,           y: dist,        z: 0.001 },
      bottom:    { x: 0,           y: -dist,       z: 0.001 },
      right:     { x: dist,        y: 0,           z: 0 },
      left:      { x: -dist,       y: 0,           z: 0 }
    };

    const targetPos = targets[preset] || targets.isometric;
    this.animateCameraTo(targetPos);
  }

  animateCameraTo(targetPos) {
    const startPos = this.camera.position.clone();
    const startTime = performance.now();
    const duration = 350;

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1.0);
      const ease = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        this.camera.position.set(targetPos.x, targetPos.y, targetPos.z);
        this.controls.update();
        this.checkOrientationUpdate(true);
      }
    };
    requestAnimationFrame(step);
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.checkOrientationUpdate();
    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof window !== 'undefined') {
  window.RubiksCube3D = RubiksCube3D;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RubiksCube3D };
}
