/**
 * Kártyás Jegyzetlap - Card Game Score Pad Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kartyas_jegyzetlap_data_v17';

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
  const paperSheet = document.getElementById('paper-sheet');
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

  // Handwriting Canvas Elements
  const hwCanvas = document.getElementById('handwriting-canvas');
  const recToast = document.getElementById('recognition-toast');
  let hwCtx = hwCanvas ? hwCanvas.getContext('2d') : null;

  let activeScoreInput = null;
  let selectedPlayerIndex = null;

  // SVG Generators for Bunkó icons
  const SVG_SIMA_BUNKO = `<svg viewBox="0 0 24 24" class="bunko-icon sima" title="Sima bunkó"><circle cx="12" cy="12" r="7.5" fill="#1e293b"/></svg>`;
  const SVG_SZOROS_BUNKO = `<svg viewBox="0 0 24 24" class="bunko-icon szoros" title="Szőrös bunkó"><circle cx="12" cy="12" r="5" fill="#1e293b"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round"/></svg>`;

  function isGameStarted() {
    return state.rounds.some(round => round.some(val => val !== '' && val !== null && val !== undefined));
  }

  // Initialize UI
  renderTable();
  updateSettingsUI();
  initHandwritingCanvas();

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
      updateHandwritingCanvasVisibility();
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
      input.inputMode = 'decimal';
      input.className = 'score-input';
      input.value = roundData[playerIdx] !== undefined ? roundData[playerIdx] : '';
      input.dataset.roundIndex = roundIdx;
      input.dataset.playerIndex = playerIdx;
      input.setAttribute('autocomplete', 'off');
      
      input.addEventListener('focus', () => {
        activeScoreInput = input;
        input.select();
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
      targetInput.focus();
      targetInput.select();
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
  // HANDWRITING GESTURE RECOGNIZER & TOUCHPAD ENGINE (Digits 0-9, +, -)
  // ==========================================================================
  let isDrawing = false;
  let currentStroke = [];
  let allStrokes = [];
  let strokeTimeout = null;

  function initHandwritingCanvas() {
    if (!hwCanvas || !hwCtx) return;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    updateHandwritingCanvasVisibility();

    // Pointer events (works for mouse, touch, and stylus/pencil!)
    hwCanvas.addEventListener('pointerdown', handlePointerDown);
    hwCanvas.addEventListener('pointermove', handlePointerMove);
    hwCanvas.addEventListener('pointerup', handlePointerUp);
    hwCanvas.addEventListener('pointercancel', handlePointerUp);
  }

  function updateHandwritingCanvasVisibility() {
    if (!hwCanvas) return;
    if (state.enableHandwriting !== false) {
      hwCanvas.classList.remove('is-hidden');
    } else {
      hwCanvas.classList.add('is-hidden');
    }
  }

  function resizeCanvas() {
    if (!hwCanvas || !paperSheet) return;
    hwCanvas.width = paperSheet.clientWidth;
    hwCanvas.height = paperSheet.clientHeight;
  }

  function handlePointerDown(e) {
    if (state.enableHandwriting === false) return;
    isDrawing = true;
    currentStroke = [{ x: e.clientX, y: e.clientY }];

    if (strokeTimeout) {
      clearTimeout(strokeTimeout);
      strokeTimeout = null;
    }

    // Determine target cell under touch if none active
    const targetElement = document.elementFromPoint(e.clientX, e.clientY);
    if (targetElement && targetElement.classList.contains('score-input')) {
      activeScoreInput = targetElement;
      activeScoreInput.focus();
    }
  }

  function handlePointerMove(e) {
    if (!isDrawing || state.enableHandwriting === false) return;
    const pt = { x: e.clientX, y: e.clientY };
    currentStroke.push(pt);

    // Draw ink line on canvas
    hwCtx.strokeStyle = '#2563eb';
    hwCtx.lineWidth = 4;
    hwCtx.lineCap = 'round';
    hwCtx.lineJoin = 'round';

    const pts = currentStroke;
    if (pts.length > 1) {
      hwCtx.beginPath();
      hwCtx.moveTo(pts[pts.length - 2].x - hwCanvas.getBoundingClientRect().left, pts[pts.length - 2].y - hwCanvas.getBoundingClientRect().top);
      hwCtx.lineTo(pts[pts.length - 1].x - hwCanvas.getBoundingClientRect().left, pts[pts.length - 1].y - hwCanvas.getBoundingClientRect().top);
      hwCtx.stroke();
    }
  }

  function handlePointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentStroke.length > 2) {
      allStrokes.push(currentStroke);
    }
    currentStroke = [];

    // Set timeout to process complete gesture (450ms stroke completion window)
    strokeTimeout = setTimeout(processHandwritingStrokes, 450);
  }

  /**
   * Process drawn strokes & recognize Digits (0-9, +, -)
   */
  function processHandwritingStrokes() {
    if (allStrokes.length === 0) return;

    const recognizedChar = classifyGesture(allStrokes);

    if (recognizedChar !== null) {
      // Find active or default to last focused cell
      if (!activeScoreInput) {
        activeScoreInput = roundsTbody.querySelector('input.score-input');
      }

      if (activeScoreInput) {
        // Append recognized digit/symbol
        activeScoreInput.value = (activeScoreInput.value || '') + recognizedChar;
        
        // Trigger input event for live sum calculations & state save
        const event = new Event('input', { bubbles: true });
        activeScoreInput.dispatchEvent(event);

        showRecognitionToast(`Felismerve: ${recognizedChar}`);
      }
    }

    // Clear canvas
    clearCanvas();
  }

  function clearCanvas() {
    allStrokes = [];
    if (hwCtx && hwCanvas) {
      hwCtx.clearRect(0, 0, hwCanvas.width, hwCanvas.height);
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
   * Lightweight Stroke Classifier for Digits 0-9, +, -
   */
  function classifyGesture(strokes) {
    // Combine all points across strokes
    const points = [];
    strokes.forEach(st => points.push(...st));

    if (points.length < 4) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const width = Math.max(10, maxX - minX);
    const height = Math.max(10, maxY - minY);
    const aspectRatio = height / width;
    const numStrokes = strokes.length;

    const firstStroke = strokes[0];
    const startPt = firstStroke[0];
    const endPt = firstStroke[firstStroke.length - 1];

    const dx = endPt.x - startPt.x;
    const dy = endPt.y - startPt.y;

    const distStartEnd = Math.hypot(dx, dy);
    const diagonal = Math.hypot(width, height);
    const isClosedLoop = distStartEnd < 0.38 * diagonal;

    // 1. Check for Minus (-) -> 1 horizontal stroke
    if (numStrokes === 1 && width > 2.2 * height && Math.abs(dx) > Math.abs(dy)) {
      return '-';
    }

    // 2. Check for Plus (+) -> 2 strokes intersecting OR cross gesture
    if (numStrokes === 2) {
      const st1 = strokes[0], st2 = strokes[1];
      const dx1 = Math.abs(st1[st1.length - 1].x - st1[0].x);
      const dy1 = Math.abs(st1[st1.length - 1].y - st1[0].y);
      const dx2 = Math.abs(st2[st2.length - 1].x - st2[0].x);
      const dy2 = Math.abs(st2[st2.length - 1].y - st2[0].y);

      if ((dx1 > dy1 && dy2 > dx2) || (dy1 > dx1 && dx2 > dy2)) {
        return '+';
      }
    }

    // 3. Check for One (1) -> 1 stroke, tall vertical
    if (numStrokes === 1 && height > 2.0 * width && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      return '1';
    }

    // 4. Check for Zero (0) -> 1 stroke, closed loop
    if (numStrokes === 1 && isClosedLoop && aspectRatio >= 0.7 && aspectRatio <= 2.5) {
      return '0';
    }

    // 5. Check for Seven (7) -> starts top left, goes right, then diagonal down
    if (numStrokes === 1 && startPt.x < minX + width * 0.4 && startPt.y < minY + height * 0.4) {
      if (endPt.y > minY + height * 0.6) {
        return '7';
      }
    }

    // 6. Check for Four (4) -> 2 strokes or unistroke angled L
    if (numStrokes === 2) {
      return '4';
    }

    // 7. Feature heuristics for 2, 3, 5, 6, 8, 9 based on midpoints & start/end
    if (isClosedLoop) {
      // If closed loop near top -> 9, if closed loop near bottom -> 6
      const loopCenterY = (startPt.y + endPt.y) / 2;
      if (loopCenterY < minY + height * 0.5) return '9';
      return '6';
    }

    // Fallback classification based on Y-ends
    if (endPt.x > minX + width * 0.6 && endPt.y > minY + height * 0.6) {
      return '2';
    }
    if (endPt.y < minY + height * 0.5 && dy > 0) {
      return '3';
    }

    // Default fallback digit guess based on stroke count
    return numStrokes === 1 ? '5' : '8';
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
