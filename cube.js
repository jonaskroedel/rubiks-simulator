/**
 * Rubik's Cube 3D Simulation Engine using Three.js
 * Handles 2x2, 3x3, and 4x4 visual rendering, realistic materials,
 * smooth face rotations, camera controls, and dynamic view-relative notation.
 */

class RubiksCube3D {
  constructor(containerElement, initialSize = 3) {
    this.container = containerElement;
    this.size = initialSize;
    this.cubies = [];
    this.isAnimating = false;
    this.animationDuration = 220; // Default ms per move
    this.viewMode = 'relative'; // 'relative' (dynamic to camera view) or 'fixed' (standard WCA)

    this.onOrientationChangeCallback = null;
    this.lastOrientationKey = '';

    this.initThree();
    this.initTriads();
    this.initStickerMaterials();
    this.buildCube(this.size);
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initThree() {
    // Scene
    this.scene = new THREE.Scene();

    // Camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.updateCameraForSize(this.size);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Orbit Controls - strictly for rotating the camera/view around the cube
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false; // Keep the cube centered
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 22;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(12, 16, 14);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 40;
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xb0c4de, 0.45);
    dirLight2.position.set(-12, -14, -12);
    this.scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222233, 0.35);
    this.scene.add(hemiLight);

    // Cube group and pivot group
    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    this.pivotGroup = new THREE.Group();
    this.scene.add(this.pivotGroup);

    // Soft floor shadow disc
    this.initShadowFloor();
  }

  /**
   * Pre-generates the 24 valid right-handed orthogonal triads
   * for mapping view orientation to cube axes.
   */
  initTriads() {
    this.faceDefinitions = [
      { id: '+X', color: 'Red',    colorHex: '#C41230', vec: new THREE.Vector3(1, 0, 0),  axis: 'x', sign: 1 },
      { id: '-X', color: 'Orange', colorHex: '#FF5500', vec: new THREE.Vector3(-1, 0, 0), axis: 'x', sign: -1 },
      { id: '+Y', color: 'White',  colorHex: '#F7F8FA', vec: new THREE.Vector3(0, 1, 0),  axis: 'y', sign: 1 },
      { id: '-Y', color: 'Yellow', colorHex: '#FFD500', vec: new THREE.Vector3(0, -1, 0), axis: 'y', sign: -1 },
      { id: '+Z', color: 'Green',  colorHex: '#009E48', vec: new THREE.Vector3(0, 0, 1),  axis: 'z', sign: 1 },
      { id: '-Z', color: 'Blue',   colorHex: '#0046AD', vec: new THREE.Vector3(0, 0, -1), axis: 'z', sign: -1 }
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
            U: u,
            D: d,
            F: f,
            B: b,
            R: r,
            L: l,
            key: `${f.id}_${r.id}_${u.id}`
          });
        }
      }
    }
  }

  /**
   * Computes the current view-relative orientation triad based on camera orientation
   */
  getCurrentOrientation() {
    if (this.viewMode === 'fixed') {
      // Fixed standard WCA orientation:
      // F = +Z (Green), B = -Z (Blue), R = +X (Red), L = -X (Orange), U = +Y (White), D = -Y (Yellow)
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

    // Camera vectors in world coordinates
    const camFront = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion); // points from target to camera
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

    let bestTriad = this.triads[0];
    let maxScore = -99999;

    for (let i = 0; i < this.triads.length; i++) {
      const t = this.triads[i];
      // Weighted alignment score:
      // F should face camera (camFront)
      // U should point to screen top (camUp)
      // R should point to screen right (camRight)
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
    const dist = distMap[size] || 8.0;
    this.camera.position.set(dist * 0.75, dist * 0.65, dist * 0.95);
    this.camera.lookAt(0, 0, 0);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
    if (this.shadowMesh) {
      this.shadowMesh.position.y = - (size * 0.5 + 1.2);
      const scale = size / 3;
      this.shadowMesh.scale.set(scale, scale, 1);
    }
  }

  createStickerTexture(fillColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Dark black plastic border
    ctx.fillStyle = '#121316';
    ctx.fillRect(0, 0, 256, 256);

    // Inner rounded sticker
    const pad = 16;
    const size = 256 - pad * 2;
    const rad = 24;

    ctx.beginPath();
    ctx.roundRect(pad, pad, size, size, rad);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Subtle gloss / bevel reflection on top edge
    const glossGrad = ctx.createLinearGradient(pad, pad, pad, pad + size * 0.45);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = glossGrad;
    ctx.fill();

    // Subtle dark border outline for depth
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = 4;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  initStickerMaterials() {
    const colors = {
      R: '#C41230', // Right: Red
      L: '#FF5500', // Left: Orange
      U: '#F7F8FA', // Up: White
      D: '#FFD500', // Down: Yellow
      F: '#009E48', // Front: Green
      B: '#0046AD'  // Back: Blue
    };

    this.materials = {
      R: new THREE.MeshStandardMaterial({
        map: this.createStickerTexture(colors.R),
        roughness: 0.28,
        metalness: 0.04
      }),
      L: new THREE.MeshStandardMaterial({
        map: this.createStickerTexture(colors.L),
        roughness: 0.28,
        metalness: 0.04
      }),
      U: new THREE.MeshStandardMaterial({
        map: this.createStickerTexture(colors.U),
        roughness: 0.28,
        metalness: 0.04
      }),
      D: new THREE.MeshStandardMaterial({
        map: this.createStickerTexture(colors.D),
        roughness: 0.28,
        metalness: 0.04
      }),
      F: new THREE.MeshStandardMaterial({
        map: this.createStickerTexture(colors.F),
        roughness: 0.28,
        metalness: 0.04
      }),
      B: new THREE.MeshStandardMaterial({
        map: this.createStickerTexture(colors.B),
        roughness: 0.28,
        metalness: 0.04
      }),
      inner: new THREE.MeshStandardMaterial({
        color: 0x121316,
        roughness: 0.85,
        metalness: 0.02
      })
    };
  }

  buildCube(size) {
    this.size = size;

    while (this.cubeGroup.children.length > 0) {
      const obj = this.cubeGroup.children[0];
      this.cubeGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }
    this.cubies = [];

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
            x === N - 1 ? this.materials.R : this.materials.inner, // +X: Right
            x === 0     ? this.materials.L : this.materials.inner, // -X: Left
            y === N - 1 ? this.materials.U : this.materials.inner, // +Y: Up
            y === 0     ? this.materials.D : this.materials.inner, // -Y: Down
            z === N - 1 ? this.materials.F : this.materials.inner, // +Z: Front
            z === 0     ? this.materials.B : this.materials.inner  // -Z: Back
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

    this.updateCameraForSize(size);
    this.checkOrientationUpdate(true);
  }

  reset() {
    this.buildCube(this.size);
  }

  /**
   * Captures an exact snapshot of the positions and orientations of all cubies
   */
  saveSnapshot() {
    return this.cubies.map(cubie => ({
      pos: { x: cubie.position.x, y: cubie.position.y, z: cubie.position.z },
      quat: { x: cubie.quaternion.x, y: cubie.quaternion.y, z: cubie.quaternion.z, w: cubie.quaternion.w }
    }));
  }

  /**
   * Instantly restores all cubies to a previously saved snapshot
   */
  restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.length !== this.cubies.length) {
      return false;
    }

    // Ensure pivot is clean and cubies belong to cubeGroup
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

  setSize(newSize) {
    if (newSize === this.size) return;
    this.buildCube(newSize);
  }

  setSpeed(durationMs) {
    this.animationDuration = durationMs;
  }

  /**
   * Resolves a semantic move into the physical axis, layers, and angle
   * based on the current view orientation (relative vs fixed).
   */
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

    // Slice Moves (M, E, S)
    if (move.isSlice) {
      const base = move.baseLetter;
      let targetFace = orientation.L;
      if (base === 'M') targetFace = orientation.L; // M follows L
      else if (base === 'E') targetFace = orientation.D; // E follows D
      else if (base === 'S') targetFace = orientation.F; // S follows F

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

  /**
   * Executes a parsed move dynamically resolved to current camera orientation.
   */
  async executeMove(rawMove) {
    if (this.isAnimating) {
      throw new Error('Another move is currently animating.');
    }

    // Dynamically resolve physical rotation parameters from camera view
    const resolved = this.resolveMove(rawMove);
    const { axis, layers, angle } = resolved;
    const N = this.size;
    const offset = (N - 1) / 2;
    const threshold = 0.25;

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

      cubie.position.x = Math.round(cubie.position.x + offset) - offset;
      cubie.position.y = Math.round(cubie.position.y + offset) - offset;
      cubie.position.z = Math.round(cubie.position.z + offset) - offset;

      this.snapOrientation(cubie);
    });

    this.pivotGroup.rotation.set(0, 0, 0);
  }

  snapOrientation(cubie) {
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
    const dist = distMap[this.size] || 8.0;

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
