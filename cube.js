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

    // Solid materials for polygon shape-mods (Fisher Cube) to prevent UV stretch
    this.solidMaterials = {
      R: new THREE.MeshStandardMaterial({ color: new THREE.Color(th.R), roughness: rough, metalness: metal, side: THREE.DoubleSide }),
      L: new THREE.MeshStandardMaterial({ color: new THREE.Color(th.L), roughness: rough, metalness: metal, side: THREE.DoubleSide }),
      U: new THREE.MeshStandardMaterial({ color: new THREE.Color(th.U), roughness: rough, metalness: metal, side: THREE.DoubleSide }),
      D: new THREE.MeshStandardMaterial({ color: new THREE.Color(th.D), roughness: rough, metalness: metal, side: THREE.DoubleSide }),
      F: new THREE.MeshStandardMaterial({ color: new THREE.Color(th.F), roughness: rough, metalness: metal, side: THREE.DoubleSide }),
      B: new THREE.MeshStandardMaterial({ color: new THREE.Color(th.B), roughness: rough, metalness: metal, side: THREE.DoubleSide })
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

    const regDef = (typeof puzzleRegistry !== 'undefined') ? puzzleRegistry.get(type) : null;
    if (regDef && regDef.dimensions) {
      this.dimensions = { x: regDef.dimensions[0], y: regDef.dimensions[1], z: regDef.dimensions[2] };
    } else {
      this.dimensions = { x: size, y: size, z: size };
    }

    if (type === 'mirror' || (regDef && regDef.shapeModType === 'mirror')) {
      this.buildMirrorCube();
    } else if (type === 'fisher' || (regDef && regDef.shapeModType === 'fisher')) {
      this.buildFisherCube();
    } else if (type === 'mixup' || (regDef && regDef.shapeModType === 'mixup')) {
      this.buildMixupCube();
    } else if (regDef && (regDef.isCuboid || (regDef.dimensions && (regDef.dimensions[0] !== regDef.dimensions[1] || regDef.dimensions[1] !== regDef.dimensions[2])))) {
      this.buildCuboid(regDef.dimensions[0], regDef.dimensions[1], regDef.dimensions[2]);
    } else if (type === 'cube3x3x4') {
      this.buildCuboid(3, 4, 3);
    } else {
      this.buildStandardCube(size);
    }

    this.updateCameraForSize(size);
    this.checkOrientationUpdate(true);
  }

  /**
   * Builds an articulated N_x × N_y × N_z Cuboid (e.g. 3×3×4, 2×2×3, 3×3×5, etc.)
   */
  buildCuboid(Nx = 3, Ny = 4, Nz = 3) {
    this.dimensions = { x: Nx, y: Ny, z: Nz };
    this.size = Math.max(Nx, Ny, Nz);
    const cubieSize = 0.96;
    const spacing = 1.0;
    const offsetX = (Nx - 1) / 2;
    const offsetY = (Ny - 1) / 2;
    const offsetZ = (Nz - 1) / 2;
    const cubieGeo = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);

    for (let x = 0; x < Nx; x++) {
      for (let y = 0; y < Ny; y++) {
        for (let z = 0; z < Nz; z++) {
          const isExterior = (x === 0 || x === Nx - 1 || y === 0 || y === Ny - 1 || z === 0 || z === Nz - 1);
          if (!isExterior) continue;

          const mats = [
            x === Nx - 1 ? this.materials.R : this.materials.inner,
            x === 0      ? this.materials.L : this.materials.inner,
            y === Ny - 1 ? this.materials.U : this.materials.inner,
            y === 0      ? this.materials.D : this.materials.inner,
            z === Nz - 1 ? this.materials.F : this.materials.inner,
            z === 0      ? this.materials.B : this.materials.inner
          ];

          const cubie = new THREE.Mesh(cubieGeo, mats);
          cubie.castShadow = true;
          cubie.receiveShadow = true;

          cubie.position.set(
            (x - offsetX) * spacing,
            (y - offsetY) * spacing,
            (z - offsetZ) * spacing
          );

          cubie.userData = {
            initialX: x,
            initialY: y,
            initialZ: z,
            isCuboid: true,
            Nx, Ny, Nz,
            faceKeys: [
              x === Nx - 1 ? 'R' : null,
              x === 0      ? 'L' : null,
              y === Ny - 1 ? 'U' : null,
              y === 0      ? 'D' : null,
              z === Nz - 1 ? 'F' : null,
              z === 0      ? 'B' : null
            ]
          };

          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  /**
   * Builds Standard 2x2, 3x3, or 4x4 Cube
   */
  buildStandardCube(size) {
    const N = size;
    this.dimensions = { x: N, y: N, z: N };
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

          cubie.userData = {
            initialX: x,
            initialY: y,
            initialZ: z,
            faceKeys: [
              x === N - 1 ? 'R' : null,
              x === 0     ? 'L' : null,
              y === N - 1 ? 'U' : null,
              y === 0     ? 'D' : null,
              z === N - 1 ? 'F' : null,
              z === 0     ? 'B' : null
            ]
          };
          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  /**
   * Builds the Mirror / Bump Cube (Shape-mod with unequal layer thicknesses)
   * The middle layer is centered at (0, 0, 0) so the core mechanism rotation axes
   * pass cleanly through (0, 0, 0) without off-axis drift or piece collision.
   */
  buildMirrorCube() {
    this.size = 3;
    this.dimensions = { x: 3, y: 3, z: 3 };
    const Tx = [0.65, 1.0, 1.35];
    const Ty = [0.75, 1.0, 1.25];
    const Tz = [0.85, 1.0, 1.15];

    // Offsets centered so the middle slice is centered at (0, 0, 0)
    const Cx = [-0.5 - Tx[0] / 2, 0, 0.5 + Tx[2] / 2];
    const Cy = [-0.5 - Ty[0] / 2, 0, 0.5 + Ty[2] / 2];
    const Cz = [-0.5 - Tz[0] / 2, 0, 0.5 + Tz[2] / 2];

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
          cubie.userData = { 
            initialX: x, 
            initialY: y, 
            initialZ: z, 
            isMirror: true,
            faceKeys: [
              x === 2 ? 'R' : null,
              x === 0 ? 'L' : null,
              y === 2 ? 'U' : null,
              y === 0 ? 'D' : null,
              z === 2 ? 'F' : null,
              z === 0 ? 'B' : null
            ]
          };

          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  /**
   * Builds the Fisher Cube (Tony Fisher's 45° vertical shape-mod)
   * A mathematically exact, fully articulated 3x3 shape mod where outer
   * vertical faces are rotated 45° relative to the internal 3x3 cuts.
   */
  buildFisherCube() {
    this.size = 3;
    const L = 1.5 * Math.SQRT2; // ~2.12132

    const getFisherCellPolygon = (x0, z0) => {
      if (x0 === 0 && z0 === 0) {
        return [[-0.48, -0.48], [0.48, -0.48], [0.48, 0.48], [-0.48, 0.48]];
      }
      if (x0 === 1 && z0 === 0) {
        return [[-0.5, -0.5], [-0.5, 0.5], [L - 1.5, 0.5], [L - 1.0, 0], [L - 1.5, -0.5]];
      }
      if (x0 === -1 && z0 === 0) {
        return [[0.5, 0.5], [0.5, -0.5], [-(L - 1.5), -0.5], [-(L - 1.0), 0], [-(L - 1.5), 0.5]];
      }
      if (x0 === 0 && z0 === 1) {
        return [[-0.5, -0.5], [0.5, -0.5], [0.5, L - 1.5], [0, L - 1.0], [-0.5, L - 1.5]];
      }
      if (x0 === 0 && z0 === -1) {
        return [[0.5, 0.5], [-0.5, 0.5], [-0.5, -(L - 1.5)], [0, -(L - 1.0)], [0.5, -(L - 1.5)]];
      }
      if (x0 === 1 && z0 === 1) {
        return [[-0.5, -0.5], [L - 1.5, -0.5], [-0.5, L - 1.5]];
      }
      if (x0 === -1 && z0 === 1) {
        return [[0.5, -0.5], [0.5, L - 1.5], [-(L - 1.5), -0.5]];
      }
      if (x0 === -1 && z0 === -1) {
        return [[0.5, 0.5], [-(L - 1.5), 0.5], [0.5, -(L - 1.5)]];
      }
      if (x0 === 1 && z0 === -1) {
        return [[-0.5, 0.5], [-0.5, -(L - 1.5)], [L - 1.5, 0.5]];
      }
      return [];
    };

    const createPolygonShape = (pts, inset = 0) => {
      const shape = new THREE.Shape();
      if (pts.length < 3) return shape;
      if (inset === 0) {
        shape.moveTo(pts[0][0], -pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          shape.lineTo(pts[i][0], -pts[i][1]);
        }
        shape.closePath();
        return shape;
      }
      let cx = 0, cz = 0;
      for (const p of pts) { cx += p[0]; cz += p[1]; }
      cx /= pts.length; cz /= pts.length;
      const scale = Math.max(0.6, 1 - inset);
      shape.moveTo(cx + (pts[0][0] - cx) * scale, -(cz + (pts[0][1] - cz) * scale));
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(cx + (pts[i][0] - cx) * scale, -(cz + (pts[i][1] - cz) * scale));
      }
      shape.closePath();
      return shape;
    };

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const isExterior = (x !== 0 || y !== 0 || z !== 0);
          if (!isExterior) continue;

          const group = new THREE.Group();
          const pts = getFisherCellPolygon(x, z);

          // 1. Black speedcube body (depth 0.93 so stickers are cleanly proud)
          const bodyShape = createPolygonShape(pts, 0);
          const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
            depth: 0.93,
            bevelEnabled: false
          });
          bodyGeo.translate(0, 0, -0.465);
          bodyGeo.rotateX(-Math.PI / 2);

          const bodyMesh = new THREE.Mesh(bodyGeo, this.materials.inner);
          bodyMesh.castShadow = true;
          bodyMesh.receiveShadow = true;
          group.add(bodyMesh);

          // 2. Top sticker (U face) if y === 1
          if (y === 1) {
            const topShape = createPolygonShape(pts, 0.08);
            const topGeo = new THREE.ShapeGeometry(topShape);
            topGeo.rotateX(-Math.PI / 2);
            topGeo.translate(0, 0.485, 0);
            const topMesh = new THREE.Mesh(topGeo, this.solidMaterials.U);
            group.add(topMesh);
          }

          // 3. Bottom sticker (D face) if y === -1
          if (y === -1) {
            const botShape = createPolygonShape(pts, 0.08);
            const botGeo = new THREE.ShapeGeometry(botShape);
            botGeo.rotateX(-Math.PI / 2);
            botGeo.translate(0, -0.485, 0);
            const botMesh = new THREE.Mesh(botGeo, this.solidMaterials.D);
            group.add(botMesh);
          }

          // 4. Exterior vertical wall stickers
          for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const mx = x + (p1[0] + p2[0]) / 2;
            const mz = z + (p1[1] + p2[1]) / 2;

            let faceMat = null;
            let normal = null;
            if (Math.abs(mx + mz - L) < 0.02) {
              faceMat = this.solidMaterials.F; // Front-Right
              normal = [1 / Math.SQRT2, 1 / Math.SQRT2];
            } else if (Math.abs(mx - mz - L) < 0.02) {
              faceMat = this.solidMaterials.R; // Back-Right
              normal = [1 / Math.SQRT2, -1 / Math.SQRT2];
            } else if (Math.abs(-mx - mz - L) < 0.02) {
              faceMat = this.solidMaterials.B; // Back-Left
              normal = [-1 / Math.SQRT2, -1 / Math.SQRT2];
            } else if (Math.abs(-mx + mz - L) < 0.02) {
              faceMat = this.solidMaterials.L; // Front-Left
              normal = [-1 / Math.SQRT2, 1 / Math.SQRT2];
            }

            if (faceMat && normal) {
              const dx = p2[0] - p1[0];
              const dz = p2[1] - p1[1];
              const len = Math.sqrt(dx * dx + dz * dz);
              if (len > 0.05) {
                const margin = 0.035;
                const insetFactor = Math.min(0.2, margin / len);
                const s1x = p1[0] + dx * insetFactor;
                const s1z = p1[1] + dz * insetFactor;
                const s2x = p2[0] - dx * insetFactor;
                const s2z = p2[1] - dz * insetFactor;

                const wallOff = 0.015;
                const wallGeo = new THREE.BufferGeometry();
                const v1 = [s1x + normal[0] * wallOff, -0.44, s1z + normal[1] * wallOff];
                const v2 = [s2x + normal[0] * wallOff, -0.44, s2z + normal[1] * wallOff];
                const v3 = [s2x + normal[0] * wallOff,  0.44, s2z + normal[1] * wallOff];
                const v4 = [s1x + normal[0] * wallOff,  0.44, s1z + normal[1] * wallOff];

                const positions = new Float32Array([
                  v1[0], v1[1], v1[2],
                  v2[0], v2[1], v2[2],
                  v3[0], v3[1], v3[2],

                  v1[0], v1[1], v1[2],
                  v3[0], v3[1], v3[2],
                  v4[0], v4[1], v4[2]
                ]);
                wallGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                wallGeo.computeVertexNormals();

                const wallMesh = new THREE.Mesh(wallGeo, faceMat);
                group.add(wallMesh);
              }
            }
          }

          group.position.set(x * 1.0, y * 1.0, z * 1.0);
          group.userData = { 
            initialX: x + 1, 
            initialY: y + 1, 
            initialZ: z + 1, 
            isFisher: true,
            faceKeys: [
              x === 1  ? 'R' : null,
              x === -1 ? 'L' : null,
              y === 1  ? 'U' : null,
              y === -1 ? 'D' : null,
              z === 1  ? 'F' : null,
              z === -1 ? 'B' : null
            ]
          };

          this.cubeGroup.add(group);
          this.cubies.push(group);
        }
      }
    }
  }

  /**
   * Builds the WitEden & Oskar Mixup 3x3 (with authentic Oskar proportions)
   * The middle layer width M is equal to the diagonal of the edge stones (S * sqrt(2)),
   * ensuring that the square centers are as big as the diagonal of the edge pieces.
   */
  buildMixupCube() {
    this.size = 3;
    this.dimensions = { x: 3, y: 3, z: 3 };
    const S = 3.0 / (2 + Math.SQRT2); // ~0.8787 outer layer thickness
    const M = S * Math.SQRT2;         // ~1.2426 middle layer thickness (diagonal of S x S edge)
    const T = [S, M, S];
    const C = [-M / 2 - S / 2, 0, M / 2 + S / 2]; // [-1.0607, 0, 1.0607]
    const gap = 0.035;

    // Internal speedcube spherical core visible when 45° slices turn
    const coreGeo = new THREE.SphereGeometry(M * 0.72, 32, 32);
    const coreMesh = new THREE.Mesh(coreGeo, this.materials.inner);
    this.cubeGroup.add(coreMesh);

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          const isExterior = (x === 0 || x === 2 || y === 0 || y === 2 || z === 0 || z === 2);
          if (!isExterior) continue;

          const w = T[x] - gap;
          const h = T[y] - gap;
          const d = T[z] - gap;
          const cubieGeo = new THREE.BoxGeometry(w, h, d);

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

          cubie.position.set(C[x], C[y], C[z]);
          cubie.userData = { 
            initialX: x, 
            initialY: y, 
            initialZ: z, 
            isMixup: true,
            faceKeys: [
              x === 2 ? 'R' : null,
              x === 0 ? 'L' : null,
              y === 2 ? 'U' : null,
              y === 0 ? 'D' : null,
              z === 2 ? 'F' : null,
              z === 0 ? 'B' : null
            ]
          };

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

  getFaceletMap() {
    const Nx = this.dimensions ? this.dimensions.x : this.size;
    const Ny = this.dimensions ? this.dimensions.y : this.size;
    const Nz = this.dimensions ? this.dimensions.z : this.size;

    const faces = {
      U: Array(Nx * Nz).fill('U'),
      D: Array(Nx * Nz).fill('D'),
      F: Array(Nx * Ny).fill('F'),
      B: Array(Nx * Ny).fill('B'),
      L: Array(Nz * Ny).fill('L'),
      R: Array(Nz * Ny).fill('R')
    };

    const localNormals = [
      new THREE.Vector3(1, 0, 0),  // 0: +X (R)
      new THREE.Vector3(-1, 0, 0), // 1: -X (L)
      new THREE.Vector3(0, 1, 0),  // 2: +Y (U)
      new THREE.Vector3(0, -1, 0), // 3: -Y (D)
      new THREE.Vector3(0, 0, 1),  // 4: +Z (F)
      new THREE.Vector3(0, 0, -1)  // 5: -Z (B)
    ];

    const getGridCoord = (val, axis) => {
      if (this.puzzleType === 'mirror') {
        if (val < -0.45) return 0;
        if (val > 0.45) return 2;
        return 1;
      }
      if (this.puzzleType === 'mixup') {
        if (val < -0.5) return 0;
        if (val > 0.5) return 2;
        return 1;
      }
      if (this.puzzleType === 'fisher') {
        if (val < -0.45) return 0;
        if (val > 0.45) return 2;
        return 1;
      }
      const dim = axis === 'x' ? Nx : (axis === 'y' ? Ny : Nz);
      const off = (dim - 1) / 2;
      return Math.max(0, Math.min(dim - 1, Math.round(val + off)));
    };

    for (const cubie of this.cubies) {
      const faceKeys = cubie.userData ? cubie.userData.faceKeys : null;
      if (!faceKeys) continue;

      const gx = getGridCoord(cubie.position.x, 'x');
      const gy = getGridCoord(cubie.position.y, 'y');
      const gz = getGridCoord(cubie.position.z, 'z');

      for (let f = 0; f < 6; f++) {
        const val = faceKeys[f];
        if (!val) continue;

        const worldNormal = localNormals[f].clone().applyQuaternion(cubie.quaternion);

        let worldFace = null;
        if (worldNormal.y > 0.6) worldFace = 'U';
        else if (worldNormal.y < -0.6) worldFace = 'D';
        else if (worldNormal.z > 0.6) worldFace = 'F';
        else if (worldNormal.z < -0.6) worldFace = 'B';
        else if (worldNormal.x > 0.6) worldFace = 'R';
        else if (worldNormal.x < -0.6) worldFace = 'L';

        if (!worldFace) continue;

        let idx = 0;
        if (worldFace === 'U') {
          idx = gz * Nx + gx;
        } else if (worldFace === 'D') {
          idx = (Nz - 1 - gz) * Nx + gx;
        } else if (worldFace === 'F') {
          idx = (Ny - 1 - gy) * Nx + gx;
        } else if (worldFace === 'B') {
          idx = (Ny - 1 - gy) * Nx + (Nx - 1 - gx);
        } else if (worldFace === 'R') {
          idx = (Ny - 1 - gy) * Nz + (Nz - 1 - gz);
        } else if (worldFace === 'L') {
          idx = (Ny - 1 - gy) * Nz + gz;
        }

        if (faces[worldFace] && idx >= 0 && idx < faces[worldFace].length) {
          faces[worldFace][idx] = val;
        }
      }
    }

    return faces;
  }

  applyFaceletMap(map) {
    if (!map) return;
    const Nx = this.dimensions ? this.dimensions.x : this.size;
    const Ny = this.dimensions ? this.dimensions.y : this.size;
    const Nz = this.dimensions ? this.dimensions.z : this.size;
    const offsetX = (Nx - 1) / 2;
    const offsetY = (Ny - 1) / 2;
    const offsetZ = (Nz - 1) / 2;
    const spacing = 1.0;

    this.pivotGroup.rotation.set(0, 0, 0);
    this.isAnimating = false;

    const getMat = (code) => {
      if (this.materials[code]) return this.materials[code];
      return this.materials.U;
    };

    const Tx = [0.65, 1.0, 1.35];
    const Ty = [0.75, 1.0, 1.25];
    const Tz = [0.85, 1.0, 1.15];
    const Cx = [-0.5 - Tx[0] / 2, 0, 0.5 + Tx[2] / 2];
    const Cy = [-0.5 - Ty[0] / 2, 0, 0.5 + Ty[2] / 2];
    const Cz = [-0.5 - Tz[0] / 2, 0, 0.5 + Tz[2] / 2];

    const S = 3.0 / (2 + Math.SQRT2);
    const M = S * Math.SQRT2;
    const Cmix = [-M / 2 - S / 2, 0, M / 2 + S / 2];

    for (const cubie of this.cubies) {
      this.cubeGroup.attach(cubie);
      const initX = cubie.userData.initialX !== undefined ? cubie.userData.initialX : 1;
      const initY = cubie.userData.initialY !== undefined ? cubie.userData.initialY : 1;
      const initZ = cubie.userData.initialZ !== undefined ? cubie.userData.initialZ : 1;

      if (this.puzzleType === 'mirror') {
        cubie.position.set(Cx[initX], Cy[initY], Cz[initZ]);
      } else if (this.puzzleType === 'mixup') {
        cubie.position.set(Cmix[initX], Cmix[initY], Cmix[initZ]);
      } else if (this.puzzleType === 'fisher') {
        cubie.position.set((initX - 1) * 1.0, (initY - 1) * 1.0, (initZ - 1) * 1.0);
      } else {
        cubie.position.set((initX - offsetX) * spacing, (initY - offsetY) * spacing, (initZ - offsetZ) * spacing);
      }
      cubie.quaternion.set(0, 0, 0, 1);

      const isExterior = (initX === 0 || initX === Nx - 1 || initY === 0 || initY === Ny - 1 || initZ === 0 || initZ === Nz - 1);
      if (!isExterior) continue;

      const idxU = initZ * Nx + initX;
      const idxD = (Nz - 1 - initZ) * Nx + initX;
      const idxF = (Ny - 1 - initY) * Nx + initX;
      const idxB = (Ny - 1 - initY) * Nx + (Nx - 1 - initX);
      const idxR = (Ny - 1 - initY) * Nz + (Nz - 1 - initZ);
      const idxL = (Ny - 1 - initY) * Nz + initZ;

      const valR = initX === Nx - 1 ? (map.R && map.R[idxR] ? map.R[idxR] : 'R') : null;
      const valL = initX === 0      ? (map.L && map.L[idxL] ? map.L[idxL] : 'L') : null;
      const valU = initY === Ny - 1 ? (map.U && map.U[idxU] ? map.U[idxU] : 'U') : null;
      const valD = initY === 0      ? (map.D && map.D[idxD] ? map.D[idxD] : 'D') : null;
      const valF = initZ === Nz - 1 ? (map.F && map.F[idxF] ? map.F[idxF] : 'F') : null;
      const valB = initZ === 0      ? (map.B && map.B[idxB] ? map.B[idxB] : 'B') : null;

      cubie.userData.faceKeys = [valR, valL, valU, valD, valF, valB];

      if (Array.isArray(cubie.material)) {
        cubie.material = [
          valR ? getMat(valR) : this.materials.inner,
          valL ? getMat(valL) : this.materials.inner,
          valU ? getMat(valU) : this.materials.inner,
          valD ? getMat(valD) : this.materials.inner,
          valF ? getMat(valF) : this.materials.inner,
          valB ? getMat(valB) : this.materials.inner
        ];
      }
    }

    this.checkOrientationUpdate(true);
  }

  resolveMove(move) {
    const orientation = this.getCurrentOrientation();
    const mult = move.multiplier || 1;

    // Whole Cube Rotations (x, y, z)
    if (move.isRotation) {
      const base = move.baseLetter;
      let targetFace = orientation.R;
      if (base === 'x') targetFace = orientation.R;
      else if (base === 'y') targetFace = orientation.U;
      else if (base === 'z') targetFace = orientation.F;

      const axis = targetFace.axis;
      const dim = this.dimensions ? this.dimensions[axis] : this.size;
      const layers = Array.from({ length: dim }, (_, idx) => idx);
      const angle = (-targetFace.sign * (Math.PI / 2)) * mult;
      return { 
        axis, 
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

      const axis = targetFace.axis;
      const dim = this.dimensions ? this.dimensions[axis] : this.size;
      const layers = (dim === 3) ? [1] : (dim > 3 ? Array.from({ length: dim - 2 }, (_, i) => i + 1) : [0]);
      const angle = (-targetFace.sign * (Math.PI / 2)) * mult;
      return { 
        axis, 
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
    const dim = this.dimensions ? this.dimensions[axis] : this.size;
    const sign = targetFace.sign;
    const isHigh = (sign === 1);

    // On non-square faces of a cuboid (e.g. 3x4 faces on a 3x3x4), 90° turns are geometrically illegal.
    // Automatically enforce 180° turns (half-turns) to preserve cuboid integrity.
    if (this.dimensions) {
      let otherAxis1, otherAxis2;
      if (axis === 'x') { otherAxis1 = 'y'; otherAxis2 = 'z'; }
      else if (axis === 'y') { otherAxis1 = 'x'; otherAxis2 = 'z'; }
      else { otherAxis1 = 'x'; otherAxis2 = 'y'; }

      const d1 = this.dimensions[otherAxis1];
      const d2 = this.dimensions[otherAxis2];
      if (d1 !== d2) {
        mult = (mult % 2 === 0) ? mult : 2;
      }
    }

    const angle = (-sign * (Math.PI / 2)) * mult;

    let layers = [];
    if (move.layerPrefix !== null && move.layerPrefix !== undefined) {
      if (move.isWide) {
        const count = move.layerPrefix;
        for (let l = 0; l < count; l++) {
          layers.push(isHigh ? (dim - 1 - l) : l);
        }
      } else {
        const idx = move.layerPrefix - 1;
        layers = [isHigh ? (dim - 1 - idx) : idx];
      }
    } else if (move.isWide) {
      if (dim <= 2) {
        layers = [0, 1];
      } else {
        layers = isHigh ? [dim - 2, dim - 1] : [0, 1];
      }
    } else {
      layers = [isHigh ? (dim - 1) : 0];
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
    const dim = this.dimensions ? this.dimensions[axis] : this.size;
    const offset = (dim - 1) / 2;

    const selectedCubies = this.cubies.filter(cubie => {
      const coord = cubie.position[axis];
      let layerIdx = -1;

      if (this.puzzleType === 'mirror') {
        if (coord < -0.45) layerIdx = 0;
        else if (coord > 0.45) layerIdx = 2;
        else layerIdx = 1;
      } else if (this.puzzleType === 'mixup') {
        const cut = 0.55;
        if (coord < -cut) layerIdx = 0;
        else if (coord > cut) layerIdx = 2;
        else if (Math.abs(coord) < 0.25) layerIdx = 1;
        else layerIdx = -1; // tilted across cut
      } else {
        const idx = Math.round(coord + offset);
        if (Math.abs((idx - offset) - coord) < 0.4) {
          layerIdx = idx;
        }
      }

      return layers.includes(layerIdx);
    });

    // On Mixup 3x3, if a slice is at 45°, perpendicular face turns are mechanically bandaged
    if (this.puzzleType === 'mixup' && !rawMove.isSlice && !rawMove.isRotation && selectedCubies.length < 9) {
      throw new Error(`Face ${rawMove.face || ''} is blocked by a 45° slice! Complete the slice turn to 90° first.`);
    }

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

    const dims = this.dimensions || { x: this.size, y: this.size, z: this.size };
    const offX = (dims.x - 1) / 2;
    const offY = (dims.y - 1) / 2;
    const offZ = (dims.z - 1) / 2;

    selectedCubies.forEach(cubie => {
      this.cubeGroup.attach(cubie);

      if (this.puzzleType === 'mixup') {
        this.snapMixupPosition(cubie, axis);
      } else if (this.puzzleType === 'mirror') {
        // Snap mirror coordinates to exact layer centers to eliminate numerical drift
        const snapMirrorCoord = (val) => {
          const valid = [-1.175, -0.925, -0.875, -0.825, 0, 0.825, 0.875, 0.925, 1.175];
          let best = val, minDiff = Infinity;
          for (const v of valid) {
            const diff = Math.abs(val - v);
            if (diff < minDiff) { minDiff = diff; best = v; }
          }
          return minDiff < 0.15 ? best : val;
        };
        cubie.position.x = snapMirrorCoord(cubie.position.x);
        cubie.position.y = snapMirrorCoord(cubie.position.y);
        cubie.position.z = snapMirrorCoord(cubie.position.z);
      } else {
        cubie.position.x = Math.round(cubie.position.x + offX) - offX;
        cubie.position.y = Math.round(cubie.position.y + offY) - offY;
        cubie.position.z = Math.round(cubie.position.z + offZ) - offZ;
      }

      this.snapOrientation(cubie);
    });

    this.pivotGroup.rotation.set(0, 0, 0);
  }

  snapMixupPosition(cubie, axis) {
    let uKey, vKey;
    if (axis === 'x') { uKey = 'y'; vKey = 'z'; }
    else if (axis === 'y') { uKey = 'x'; vKey = 'z'; }
    else { uKey = 'x'; vKey = 'y'; }

    const u = cubie.position[uKey];
    const v = cubie.position[vKey];
    const r = Math.sqrt(u * u + v * v);
    if (r < 0.1) return;

    const S = 3.0 / (2 + Math.SQRT2);
    const M = S * Math.SQRT2;
    const Rc = M / 2 + S / 2;   // ~1.06066
    const Re = Rc * Math.SQRT2; // ~1.50

    // Target radius is either Rc (centers) or Re (edges)
    const targetR = Math.abs(r - Rc) < 0.22 ? Rc : (Math.abs(r - Re) < 0.22 ? Re : r);
    const theta = Math.atan2(v, u);
    const step = Math.PI / 4;
    const snappedTheta = Math.round(theta / step) * step;

    let su = targetR * Math.cos(snappedTheta);
    let sv = targetR * Math.sin(snappedTheta);

    if (Math.abs(su) < 0.04) su = 0;
    if (Math.abs(sv) < 0.04) sv = 0;
    if (Math.abs(su - Rc) < 0.04) su = Rc;
    if (Math.abs(su + Rc) < 0.04) su = -Rc;
    if (Math.abs(sv - Rc) < 0.04) sv = Rc;
    if (Math.abs(sv + Rc) < 0.04) sv = -Rc;

    cubie.position[uKey] = su;
    cubie.position[vKey] = sv;

    const axVal = cubie.position[axis];
    if (Math.abs(axVal) < 0.04) cubie.position[axis] = 0;
    else if (Math.abs(axVal - Rc) < 0.04) cubie.position[axis] = Rc;
    else if (Math.abs(axVal + Rc) < 0.04) cubie.position[axis] = -Rc;
  }

  snapOrientation(cubie) {
    // If Mixup puzzle, maintain exact rotation without gimbal distortion
    if (this.puzzleType === 'mixup') {
      cubie.quaternion.normalize();
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
