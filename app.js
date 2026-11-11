/**
 * Main Application Logic for Rubik's Cube Simulator
 * Coordinates UI, 3D Engine, Notation Parser, Playback Queue,
 * Chess-Style Move History, Saved States, and Cube Designer Studio.
 */

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
        { name: '45° Edge-Center Swap', seq: "M45 U2 M45' U2" },
        { name: 'Mixup 45° Trigger', seq: "M45 U M45' U'" },
        { name: 'Double Slice Mixup', seq: "M45 E45 M45' E45'" },
        { name: 'Super Mixup Shape-shift', seq: "M45 U M45' U' M45 U2 M45' U2" }
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
