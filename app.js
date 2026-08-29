/**
 * Kártyás Jegyzetlap - Card Game Score Pad Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kartyas_jegyzetlap_data_v21';

  const calculateScreenRoundsCount = () => {
    const availableHeight = window.innerHeight - 100;
    const rows = Math.max(16, Math.floor(availableHeight / 46));
    return rows;
  };

  const initialRowCount = calculateScreenRoundsCount();

  let state = loadState() || {
    players: ['Név1', 'Név2', 'Név3', 'Név4'],
    playerBunkos: [[], [], [], []],
    gameType: 'snapszer',
    showSum: false,
    enableHandwriting: true,
    rounds: Array.from({ length: initialRowCount }, () => ['', '', '', ''])
  };

  if (!state.playerBunkos || state.playerBunkos.length !== state.players.length) {
    state.playerBunkos = state.players.map((_, i) => state.playerBunkos?.[i] || []);
  }
  if (!state.gameType) state.gameType = 'snapszer';
  if (state.enableHandwriting === undefined) state.enableHandwriting = true;

  if (state.rounds.length < initialRowCount) {
    while (state.rounds.length < initialRowCount) {
      state.rounds.push(state.players.map(() => ''));
    }
  }

  // DOM Elements
  const playerHeadersRow = document.getElementById('player-headers-row');
  const totalTbody = document.getElementById('total-tbody');
  const totalRow = document.getElementById('total-row');
  const roundsTbody = document.getElementById('rounds-tbody');
  
  const addPlayerBtn = document.getElementById('add-player-btn');
  const newSessionBtn = document.getElementById('new-session-btn');
  const resetTableBtn = document.getElementById('reset-table-btn');
  const reloadPageBtn = document.getElementById('reload-page-btn');

  // Settings Popover Elements
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPopover = document.getElementById('settings-popover');
  const toggleSumCheckbox = document.getElementById('toggle-sum-checkbox');
  const toggleHandwritingCheckbox = document.getElementById('toggle-handwriting-checkbox');
  const gameTypeSelect = document.getElementById('game-type-select');

  // Bunkó Modal Elements
  const bunkoModalBtn = document.getElementById('bunko-modal-btn');
  const bunkoModal = document.getElementById('bunko-modal');
  const closeBunkoBtn = document.getElementById('close-bunko-btn');
  const bunkoModalList = document.getElementById('bunko-modal-list');
  const confirmBunkoBtn = document.getElementById('confirm-bunko-btn');

  // Touchpad Drawer Elements
  const touchpadDrawer = document.getElementById('touchpad-drawer');
  const touchpadTargetLabel = document.getElementById('touchpad-target-label');
  const closeTouchpadBtn = document.getElementById('close-touchpad-btn');
  const tpCanvas = document.getElementById('touchpad-canvas');
  const tpNumpad = document.getElementById('touchpad-numpad');
  const recToast = document.getElementById('recognition-toast');
  
  let tpCtx = tpCanvas ? tpCanvas.getContext('2d') : null;
  let activeScoreInput = null;
  let selectedPlayerIndex = null;

  // SVG Generators for Bunkó icons
  const SVG_SIMA_BUNKO = `<svg viewBox="0 0 24 24" class="bunko-icon sima" title="Sima bunkó"><circle cx="12" cy="12" r="7.5" fill="#1e293b"/></svg>`;
  const SVG_SZOROS_BUNKO = `<svg viewBox="0 0 24 24" class="bunko-icon szoros" title="Szőrös bunkó"><circle cx="12" cy="12" r="5" fill="#1e293b"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round"/></svg>`;

  function isGameStarted() {
    return state.rounds.some(round => round.some(val => val !== '' && val !== null && val !== undefined));
  }

  // Initialize UI
  renderTable();
  updateSettingsUI();
  initTouchpadEngine();

  // Main Event Listeners
  addPlayerBtn.addEventListener('click', addPlayer);
  newSessionBtn.addEventListener('click', startNewSession);
  if (resetTableBtn) resetTableBtn.addEventListener('click', resetTableKeepNames);
  if (reloadPageBtn) {
    reloadPageBtn.addEventListener('click', () => window.location.reload(true));
  }

  // Settings Popover Toggle
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    updateSettingsUI();
    settingsPopover.classList.toggle('is-hidden');
  });

  document.addEventListener('click', (e) => {
    if (!settingsPopover.contains(e.target) && e.target !== settingsBtn) {
      settingsPopover.classList.add('is-hidden');
    }
  });

  toggleSumCheckbox.addEventListener('change', (e) => {
    state.showSum = e.target.checked;
    saveState();
    updateSumVisibility();
  });

  if (toggleHandwritingCheckbox) {
    toggleHandwritingCheckbox.addEventListener('change', (e) => {
      state.enableHandwriting = e.target.checked;
      saveState();
      renderRounds();
    });
  }

  gameTypeSelect.addEventListener('change', (e) => {
    state.gameType = e.target.value;
    const rowCount = calculateScreenRoundsCount();
    state.rounds = Array.from({ length: rowCount }, () => state.players.map(() => ''));
    state.playerBunkos = state.players.map(() => []);
    saveState();
    renderTable();
  });

  // Bunkó Modal Listeners
  bunkoModalBtn.addEventListener('click', openBunkoModal);
  closeBunkoBtn.addEventListener('click', closeBunkoModal);
  bunkoModal.addEventListener('click', (e) => {
    if (e.target === bunkoModal) closeBunkoModal();
  });
  if (confirmBunkoBtn) {
    confirmBunkoBtn.addEventListener('click', confirmBunkoSelection);
  }

  // Keyboard & Input delegates
  roundsTbody.addEventListener('keydown', handleCellKeyDown);
  roundsTbody.addEventListener('input', handleCellInput);

  /**
   * Render complete table
   */
  function renderTable() {
    renderHeaders();
    renderTotals();
    renderRounds();
    updateSumVisibility();
    updateGameTypeUI();
  }

  function updateSettingsUI() {
    toggleSumCheckbox.checked = state.showSum;
    if (toggleHandwritingCheckbox) {
      toggleHandwritingCheckbox.checked = state.enableHandwriting !== false;
    }
    gameTypeSelect.value = state.gameType || 'snapszer';
  }

  function updateGameTypeUI() {
    if (state.gameType === 'snapszer') {
      bunkoModalBtn.classList.remove('is-hidden');
    } else {
      bunkoModalBtn.classList.add('is-hidden');
    }
  }

  /**
   * Render Player Header Row
   */
  function renderHeaders() {
    playerHeadersRow.innerHTML = '';
    const gameStarted = isGameStarted();
    const canDelete = !gameStarted && state.players.length > 2;

    state.players.forEach((playerName, index) => {
      const th = document.createElement('th');
      th.className = 'player-header';
      th.dataset.playerIndex = index;

      const innerDiv = document.createElement('div');
      innerDiv.className = 'player-header-inner';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'player-name-input';
      input.value = playerName;
      input.placeholder = `Név${index + 1}`;
      input.addEventListener('change', (e) => updatePlayerName(index, e.target.value));
      input.addEventListener('focus', () => input.select());
      innerDiv.appendChild(input);

      const bunkos = state.playerBunkos[index] || [];
      if (bunkos.length > 0 && state.gameType === 'snapszer') {
        const badgesRow = document.createElement('div');
        badgesRow.className = 'player-badges-row';

        bunkos.forEach(type => {
          const span = document.createElement('span');
          span.innerHTML = type === 'szoros' ? SVG_SZOROS_BUNKO : SVG_SIMA_BUNKO;
          badgesRow.appendChild(span.firstChild);
        });

        innerDiv.appendChild(badgesRow);
      }

      if (canDelete) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-player-btn';
        removeBtn.innerHTML = '✕';
        removeBtn.title = 'Játékos törlése';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removePlayer(index);
        });
        innerDiv.appendChild(removeBtn);
      }

      th.appendChild(innerDiv);
      playerHeadersRow.appendChild(th);
    });
  }

  function renderTotals() {
    totalRow.innerHTML = '';
    const totals = calculateTotals();
    totals.forEach((sum) => {
      const td = document.createElement('td');
      td.className = 'total-cell';
      td.textContent = sum !== null ? sum : 0;
      totalRow.appendChild(td);
    });
  }

  function updateSumVisibility() {
    if (state.showSum) {
      totalTbody.classList.remove('is-hidden');
    } else {
      totalTbody.classList.add('is-hidden');
    }
  }

  function renderRounds() {
    roundsTbody.innerHTML = '';
    state.rounds.forEach((roundData, roundIdx) => {
      const tr = createRoundRow(roundIdx, roundData);
      roundsTbody.appendChild(tr);
    });
  }

  function createRoundRow(roundIdx, roundData) {
    const tr = document.createElement('tr');
    tr.className = 'round-row';
    tr.dataset.roundIndex = roundIdx;

    state.players.forEach((_, playerIdx) => {
      const td = document.createElement('td');
      td.className = 'score-cell';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'score-input';
      input.value = roundData[playerIdx] !== undefined ? roundData[playerIdx] : '';
      input.dataset.roundIndex = roundIdx;
      input.dataset.playerIndex = playerIdx;
      input.setAttribute('autocomplete', 'off');
      
      if (state.enableHandwriting !== false) {
        input.setAttribute('inputmode', 'none');
        input.setAttribute('readonly', 'readonly');
      } else {
        input.setAttribute('inputmode', 'decimal');
        input.removeAttribute('readonly');
      }

      input.addEventListener('click', (e) => {
        if (state.enableHandwriting !== false) {
          e.preventDefault();
          activeScoreInput = input;
          openTouchpadDrawer(playerIdx, roundIdx);
        }
      });

      input.addEventListener('focus', (e) => {
        activeScoreInput = input;
        if (state.enableHandwriting !== false) {
          openTouchpadDrawer(playerIdx, roundIdx);
        } else {
          input.select();
        }
      });

      td.appendChild(input);
      tr.appendChild(td);
    });

    return tr;
  }

  function handleCellInput(e) {
    if (!e.target.classList.contains('score-input')) return;

    const input = e.target;
    const roundIdx = parseInt(input.dataset.roundIndex, 10);
    const playerIdx = parseInt(input.dataset.playerIndex, 10);
    const wasGameStarted = isGameStarted();

    let val = input.value.trim();
    if (val !== '' && val !== '-' && isNaN(Number(val))) {
      const cleaned = val.replace(/[^0-9.-]/g, '');
      input.value = cleaned;
      val = cleaned;
    }

    state.rounds[roundIdx][playerIdx] = val;
    saveState();
    renderTotals();

    if (isGameStarted() !== wasGameStarted) {
      renderHeaders();
    }
  }

  function handleCellKeyDown(e) {
    if (!e.target.classList.contains('score-input')) return;

    const input = e.target;
    const currentRound = parseInt(input.dataset.roundIndex, 10);
    const currentPlayer = parseInt(input.dataset.playerIndex, 10);

    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentRound === state.rounds.length - 1) {
        appendEmptyRound(false);
      }
      focusCell(currentRound + 1, currentPlayer);
    } else if (e.key === 'ArrowDown') {
      if (currentRound < state.rounds.length - 1) {
        e.preventDefault();
        focusCell(currentRound + 1, currentPlayer);
      }
    } else if (e.key === 'ArrowUp') {
      if (currentRound > 0) {
        e.preventDefault();
        focusCell(currentRound - 1, currentPlayer);
      }
    } else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length) {
      if (currentPlayer < state.players.length - 1) {
        e.preventDefault();
        focusCell(currentRound, currentPlayer + 1);
      }
    } else if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
      if (currentPlayer > 0) {
        e.preventDefault();
        focusCell(currentRound, currentPlayer - 1);
      }
    }
  }

  function focusCell(roundIdx, playerIdx) {
    const targetInput = roundsTbody.querySelector(
      `input[data-round-index="${roundIdx}"][data-player-index="${playerIdx}"]`
    );
    if (targetInput) {
      activeScoreInput = targetInput;
      if (state.enableHandwriting !== false) {
        openTouchpadDrawer(playerIdx, roundIdx);
      } else {
        targetInput.focus();
        targetInput.select();
      }
    }
  }

  function calculateTotals() {
    return state.players.map((_, playerIdx) => {
      let sum = 0;
      let hasValue = false;
      state.rounds.forEach(round => {
        const val = round[playerIdx];
        if (val !== '' && val !== null && val !== undefined && !isNaN(Number(val))) {
          sum += Number(val);
          hasValue = true;
        }
      });
      return hasValue ? sum : 0;
    });
  }

  function addPlayer() {
    const newPlayerName = `Név${state.players.length + 1}`;
    state.players.push(newPlayerName);
    state.playerBunkos.push([]);
    state.rounds.forEach(round => round.push(''));
    saveState();
    renderTable();
  }

  function removePlayer(playerIdx) {
    if (state.players.length <= 2 || isGameStarted()) return;
    state.players.splice(playerIdx, 1);
    state.playerBunkos.splice(playerIdx, 1);
    state.rounds.forEach(round => round.splice(playerIdx, 1));
    saveState();
    renderTable();
  }

  function updatePlayerName(playerIdx, newName) {
    state.players[playerIdx] = newName.trim() || `Név${playerIdx + 1}`;
    saveState();
  }

  function appendEmptyRound(shouldFocus = true) {
    const emptyRound = state.players.map(() => '');
    state.rounds.push(emptyRound);
    const newRoundIndex = state.rounds.length - 1;
    const tr = createRoundRow(newRoundIndex, emptyRound);
    roundsTbody.appendChild(tr);
    saveState();
    if (shouldFocus) {
      focusCell(newRoundIndex, 0);
    }
  }

  /**
   * Bunkó Single-Select Modal Management
   */
  function openBunkoModal() {
    selectedPlayerIndex = null;
    renderBunkoSelectableList();
    bunkoModal.classList.remove('is-hidden');
  }

  function closeBunkoModal() {
    bunkoModal.classList.add('is-hidden');
  }

  function renderBunkoSelectableList() {
    bunkoModalList.innerHTML = '';
    state.players.forEach((name, playerIdx) => {
      const row = document.createElement('div');
      row.className = 'modal-player-selectable';
      if (selectedPlayerIndex === playerIdx) {
        row.classList.add('is-selected');
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'modal-player-name-text';
      nameSpan.textContent = name;

      const checkIcon = document.createElement('div');
      checkIcon.className = 'modal-player-check-icon';

      row.appendChild(nameSpan);
      row.appendChild(checkIcon);

      row.addEventListener('click', () => {
        if (selectedPlayerIndex === playerIdx) {
          selectedPlayerIndex = null;
        } else {
          selectedPlayerIndex = playerIdx;
        }
        renderBunkoSelectableList();
      });

      bunkoModalList.appendChild(row);
    });
  }

  function confirmBunkoSelection() {
    if (selectedPlayerIndex !== null) {
      const totals = calculateTotals();
      if (!state.playerBunkos[selectedPlayerIndex]) {
        state.playerBunkos[selectedPlayerIndex] = [];
      }
      const totalScore = totals[selectedPlayerIndex];
      if (totalScore === 0) {
        state.playerBunkos[selectedPlayerIndex].push('szoros');
      } else {
        state.playerBunkos[selectedPlayerIndex].push('sima');
      }
      saveState();
      renderHeaders();
    }
    closeBunkoModal();
  }

  function startNewSession() {
    const rowCount = calculateScreenRoundsCount();
    state.rounds = Array.from({ length: rowCount }, () => state.players.map(() => ''));
    saveState();
    renderTable();
  }

  function resetTableKeepNames() {
    const rowCount = calculateScreenRoundsCount();
    state.rounds = Array.from({ length: rowCount }, () => state.players.map(() => ''));
    state.playerBunkos = state.players.map(() => []);
    saveState();
    renderTable();
  }

  // ==========================================================================
  // HIGH-PRECISION STROKE RECOGNITION & MULTI-CHARACTER ENGINE
  // ==========================================================================
  let isDrawing = false;
  let currentStroke = [];
  let allStrokes = [];
  let strokeTimeout = null;

  function initTouchpadEngine() {
    if (!tpCanvas || !tpCtx) return;

    if (closeTouchpadBtn) {
      closeTouchpadBtn.addEventListener('click', closeTouchpadDrawer);
    }

    if (tpNumpad) {
      tpNumpad.addEventListener('click', (e) => {
        const btn = e.target.closest('.num-btn');
        if (!btn) return;
        const key = btn.dataset.key;
        handleNumpadKeyPress(key);
      });
    }

    tpCanvas.addEventListener('pointerdown', handleCanvasPointerDown);
    tpCanvas.addEventListener('pointermove', handleCanvasPointerMove);
    tpCanvas.addEventListener('pointerup', handleCanvasPointerUp);
    tpCanvas.addEventListener('pointercancel', handleCanvasPointerUp);
  }

  function openTouchpadDrawer(playerIdx, roundIdx) {
    if (state.enableHandwriting === false || !touchpadDrawer) return;

    const playerName = state.players[playerIdx] || `Játékos ${playerIdx + 1}`;
    if (touchpadTargetLabel) {
      touchpadTargetLabel.textContent = `${playerName} (Kör ${roundIdx + 1})`;
    }

    touchpadDrawer.classList.remove('is-hidden');
    resizeTouchpadCanvas();
  }

  function closeTouchpadDrawer() {
    if (touchpadDrawer) {
      touchpadDrawer.classList.add('is-hidden');
    }
  }

  function resizeTouchpadCanvas() {
    if (!tpCanvas) return;
    const container = tpCanvas.parentElement;
    tpCanvas.width = container.clientWidth;
    tpCanvas.height = container.clientHeight;
  }

  function handleNumpadKeyPress(key) {
    if (!activeScoreInput) return;

    if (key === 'backspace') {
      activeScoreInput.value = activeScoreInput.value.slice(0, -1);
    } else {
      activeScoreInput.value = (activeScoreInput.value || '') + key;
    }

    const event = new Event('input', { bubbles: true });
    activeScoreInput.dispatchEvent(event);
  }

  function handleCanvasPointerDown(e) {
    isDrawing = true;
    const rect = tpCanvas.getBoundingClientRect();
    currentStroke = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];

    if (strokeTimeout) {
      clearTimeout(strokeTimeout);
      strokeTimeout = null;
    }
  }

  function handleCanvasPointerMove(e) {
    if (!isDrawing) return;
    const rect = tpCanvas.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    currentStroke.push(pt);

    tpCtx.strokeStyle = '#60a5fa';
    tpCtx.lineWidth = 4;
    tpCtx.lineCap = 'round';
    tpCtx.lineJoin = 'round';

    const pts = currentStroke;
    if (pts.length > 1) {
      tpCtx.beginPath();
      tpCtx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      tpCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      tpCtx.stroke();
    }
  }

  function handleCanvasPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentStroke.length > 2) {
      allStrokes.push(currentStroke);
    }
    currentStroke = [];

    // Recognition window set to EXACTLY 500 ms!
    strokeTimeout = setTimeout(processHandwritingStrokes, 500);
  }

  /**
   * Group strokes spatially (left-to-right) or classify compound gestures
   */
  function processHandwritingStrokes() {
    if (allStrokes.length === 0) return;

    // Group strokes by horizontal position (separate sequential characters vs compound gestures)
    const characterGroups = groupStrokesSpatially(allStrokes);
    let fullResult = '';

    characterGroups.forEach(group => {
      const char = classifySingleOrCompoundGesture(group);
      if (char !== null) {
        fullResult += char;
      }
    });

    if (fullResult.length > 0 && activeScoreInput) {
      activeScoreInput.value = (activeScoreInput.value || '') + fullResult;
      const event = new Event('input', { bubbles: true });
      activeScoreInput.dispatchEvent(event);
      showRecognitionToast(`Felismerve: ${fullResult}`);
    }

    clearTouchpadCanvas();
  }

  function clearTouchpadCanvas() {
    allStrokes = [];
    if (tpCtx && tpCanvas) {
      tpCtx.clearRect(0, 0, tpCanvas.width, tpCanvas.height);
    }
  }

  function showRecognitionToast(text) {
    if (!recToast) return;
    recToast.textContent = text;
    recToast.classList.remove('is-hidden');
    setTimeout(() => {
      recToast.classList.add('is-hidden');
    }, 1200);
  }

  /**
   * Separate strokes into distinct left-to-right character groups
   */
  function groupStrokesSpatially(strokes) {
    if (strokes.length <= 1) return [strokes];

    // Compute bounding box for each stroke
    const strokeBoxes = strokes.map(st => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      st.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      return { stroke: st, minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
    });

    // Sort strokes by minX (left to right)
    strokeBoxes.sort((a, b) => a.minX - b.minX);

    const groups = [];
    let currentGroup = [strokeBoxes[0]];

    for (let i = 1; i < strokeBoxes.length; i++) {
      const prevBox = currentGroup[currentGroup.length - 1];
      const currBox = strokeBoxes[i];

      // Check spatial overlap: If strokes overlap horizontally or intersect, group them together
      const horizontalOverlap = !(currBox.minX > prevBox.maxX + 15 || prevBox.minX > currBox.maxX + 15);

      if (horizontalOverlap) {
        currentGroup.push(currBox);
      } else {
        groups.push(currentGroup.map(item => item.stroke));
        currentGroup = [currBox];
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup.map(item => item.stroke));
    }

    return groups;
  }

  /**
   * High-precision classifier for single stroke or compound strokes (0-9, +, -)
   */
  function classifySingleOrCompoundGesture(strokes) {
    const points = [];
    strokes.forEach(st => points.push(...st));
    if (points.length < 3) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let totalPathLength = 0;

    points.forEach((p, idx) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;

      if (idx > 0) {
        totalPathLength += Math.hypot(p.x - points[idx - 1].x, p.y - points[idx - 1].y);
      }
    });

    const width = Math.max(10, maxX - minX);
    const height = Math.max(10, maxY - minY);
    const aspectRatio = height / width;
    const numStrokes = strokes.length;

    const firstStroke = strokes[0];
    const startPt = firstStroke[0];
    const endPt = firstStroke[firstStroke.length - 1];

    const dxTotal = endPt.x - startPt.x;
    const dyTotal = endPt.y - startPt.y;

    const distStartEnd = Math.hypot(dxTotal, dyTotal);
    const closedRatio = distStartEnd / (totalPathLength || 1);
    const isClosedLoop = closedRatio < 0.38;

    // --- TWO-STROKE COMPOUND GESTURES (e.g. +, 4, 7, 5) ---
    if (numStrokes === 2) {
      const st1 = strokes[0], st2 = strokes[1];
      const dx1 = Math.abs(st1[st1.length - 1].x - st1[0].x);
      const dy1 = Math.abs(st1[st1.length - 1].y - st1[0].y);
      const dx2 = Math.abs(st2[st2.length - 1].x - st2[0].x);
      const dy2 = Math.abs(st2[st2.length - 1].y - st2[0].y);

      // Plus (+) -> 1 horizontal + 1 vertical stroke intersecting
      if ((dx1 > 1.4 * dy1 && dy2 > 1.4 * dx2) || (dy1 > 1.4 * dx1 && dx2 > 1.4 * dy2)) {
        return '+';
      }

      // Four (4) -> L-shape or angled strokes
      return '4';
    }

    // --- SINGLE-STROKE GESTURES ---

    // 1. MINUS (-) -> wide horizontal line
    if (width > 2.0 * height && Math.abs(dxTotal) > 1.8 * Math.abs(dyTotal)) {
      return '-';
    }

    // 2. ONE (1) -> tall vertical line, drawn downward
    if (height > 1.8 * width && Math.abs(dyTotal) > 1.6 * Math.abs(dxTotal) && dyTotal > 0 && closedRatio > 0.6) {
      return '1';
    }

    // 3. ZERO (0) -> closed loop, centered centroid
    if (isClosedLoop && aspectRatio >= 0.65 && aspectRatio <= 2.2) {
      return '0';
    }

    // 4. SIX (6) -> loop at bottom, starts high
    if (isClosedLoop && startPt.y < minY + height * 0.4) {
      return '6';
    }

    // 5. NINE (9) -> loop at top, ends low
    if (isClosedLoop && endPt.y > minY + height * 0.6) {
      return '9';
    }

    // 6. EIGHT (8) -> closed loop in middle / figure-8
    if (isClosedLoop) {
      return '8';
    }

    // 7. SEVEN (7) -> starts top-left, horizontal right, diagonal down-left
    if (startPt.x < minX + width * 0.45 && startPt.y < minY + height * 0.38 && endPt.y > minY + height * 0.6) {
      return '7';
    }

    // 8. TWO (2) -> starts top, curves right/down, ends bottom-right
    if (endPt.x > minX + width * 0.5 && endPt.y > minY + height * 0.7) {
      return '2';
    }

    // 9. THREE (3) -> double curve on right side, ends bottom-left/middle
    if (endPt.y > minY + height * 0.65) {
      return '3';
    }

    // 10. FIVE (5)
    if (startPt.x > minX + width * 0.5 && startPt.y < minY + height * 0.35) {
      return '5';
    }

    // General fallbacks
    if (aspectRatio > 1.6) return '1';
    if (aspectRatio < 0.55) return '-';
    return '5';
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('State save failed:', err);
    }
  }

  function loadState() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('State load failed:', err);
      return null;
    }
  }
});
