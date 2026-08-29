/**
 * Kártyás Jegyzetlap - Card Game Score Pad Application Logic (Snapszer, Rikiki, Általános)
 */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kartyas_jegyzetlap_data_v30';

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
    darkMode: false,
    lockedRowsCount: 0,
    separatorRowIndices: [],
    rounds: Array.from({ length: initialRowCount }, () => ['', '', '', ''])
  };

  if (!state.playerBunkos || state.playerBunkos.length !== state.players.length) {
    state.playerBunkos = state.players.map((_, i) => state.playerBunkos?.[i] || []);
  }
  if (!state.gameType) state.gameType = 'snapszer';
  if (state.darkMode === undefined) state.darkMode = false;
  if (state.lockedRowsCount === undefined) state.lockedRowsCount = 0;
  if (!state.separatorRowIndices) state.separatorRowIndices = [];

  if (state.rounds.length < initialRowCount) {
    while (state.rounds.length < initialRowCount) {
      state.rounds.push(createEmptyRoundArray());
    }
  }

  function createEmptyRoundArray() {
    return state.players.map(() => state.gameType === 'rikiki' ? { bid: '', score: '' } : '');
  }

  // DOM Elements
  const paperSheet = document.getElementById('paper-sheet');
  const tableWrapper = document.getElementById('table-wrapper');
  const playerHeadersRow = document.getElementById('player-headers-row');
  const totalBottomBar = document.getElementById('total-bottom-bar');
  const totalPaperContainer = document.getElementById('total-paper-container');
  const totalRow = document.getElementById('total-row');
  const roundsTbody = document.getElementById('rounds-tbody');
  
  const addPlayerBtn = document.getElementById('add-player-btn');
  const newSessionBtn = document.getElementById('new-session-btn');
  const resetTableBtn = document.getElementById('reset-table-btn');
  const reloadPageBtn = document.getElementById('reload-page-btn');

  // Settings Popover Elements
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPopover = document.getElementById('settings-popover');
  const toggleDarkCheckbox = document.getElementById('toggle-dark-checkbox');
  const toggleSumCheckbox = document.getElementById('toggle-sum-checkbox');
  const gameTypeSelect = document.getElementById('game-type-select');

  // Bunkó Modal Elements
  const bunkoModalBtn = document.getElementById('bunko-modal-btn');
  const bunkoModal = document.getElementById('bunko-modal');
  const closeBunkoBtn = document.getElementById('close-bunko-btn');
  const bunkoModalList = document.getElementById('bunko-modal-list');
  const confirmBunkoBtn = document.getElementById('confirm-bunko-btn');

  let selectedPlayerIndex = null;

  // SVG Generators for Bunkó icons
  const SVG_SIMA_BUNKO = `<svg viewBox="0 0 24 24" class="bunko-icon sima" title="Sima bunkó"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>`;
  const SVG_SZOROS_BUNKO = `<svg viewBox="0 0 24 24" class="bunko-icon szoros" title="Szőrös bunkó"><circle cx="12" cy="12" r="6.5" fill="currentColor"/><path d="M12 1.5v3.5 M12 19v3.5 M1.5 12h3.5 M19 12h3.5 M4.6 4.6l2.5 2.5 M16.9 16.9l2.5 2.5 M4.6 19.4l2.5-2.5 M16.9 7.1l2.5-2.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;

  function isGameStarted() {
    return state.rounds.some(round => round.some(val => {
      if (val === null || val === undefined) return false;
      if (typeof val === 'object') {
        return (val.bid !== '' && val.bid !== null && val.bid !== undefined) ||
               (val.score !== '' && val.score !== null && val.score !== undefined);
      }
      return val !== '';
    }));
  }

  // Synchronize horizontal scrolling between table wrapper and bottom sum bar
  if (tableWrapper && totalPaperContainer) {
    tableWrapper.addEventListener('scroll', () => {
      totalPaperContainer.scrollLeft = tableWrapper.scrollLeft;
    });
  }

  // Apply Theme
  applyTheme();

  // Initialize UI
  renderTable();
  updateSettingsUI();

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

  if (toggleDarkCheckbox) {
    toggleDarkCheckbox.addEventListener('change', (e) => {
      state.darkMode = e.target.checked;
      saveState();
      applyTheme();
    });
  }

  toggleSumCheckbox.addEventListener('change', (e) => {
    state.showSum = e.target.checked;
    saveState();
    updateSumVisibility();
  });

  gameTypeSelect.addEventListener('change', (e) => {
    state.gameType = e.target.value;
    const rowCount = calculateScreenRoundsCount();
    state.rounds = Array.from({ length: rowCount }, () => createEmptyRoundArray());
    state.playerBunkos = state.players.map(() => []);
    state.lockedRowsCount = 0;
    state.separatorRowIndices = [];
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

  function applyTheme() {
    if (state.darkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

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
    if (toggleDarkCheckbox) {
      toggleDarkCheckbox.checked = !!state.darkMode;
    }
    toggleSumCheckbox.checked = state.showSum;
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
    if (totalBottomBar) {
      if (state.showSum) {
        totalBottomBar.classList.remove('is-hidden');
        if (paperSheet) paperSheet.classList.add('has-bottom-sum');
      } else {
        totalBottomBar.classList.add('is-hidden');
        if (paperSheet) paperSheet.classList.remove('has-bottom-sum');
      }
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

    const isLockedRow = roundIdx < state.lockedRowsCount;
    const isSeparatorRow = state.separatorRowIndices.includes(roundIdx);

    if (isSeparatorRow) {
      tr.classList.add('round-separator-row');
    }

    state.players.forEach((_, playerIdx) => {
      const td = document.createElement('td');
      td.className = state.gameType === 'rikiki' ? 'score-cell score-cell-rikiki' : 'score-cell';

      const cellVal = roundData[playerIdx];

      if (state.gameType === 'rikiki') {
        // Dual sub-cell layout for Rikiki: Left (Bid) + Right (Actual Score)
        const cellGroup = document.createElement('div');
        cellGroup.className = 'rikiki-cell-group';

        const bidVal = (typeof cellVal === 'object' && cellVal !== null) ? (cellVal.bid || '') : '';
        const scoreVal = (typeof cellVal === 'object' && cellVal !== null) ? (cellVal.score || '') : (cellVal || '');

        // Left Sub-Cell: Vállalás / Bid memo
        const bidInput = document.createElement('input');
        bidInput.type = 'text';
        bidInput.inputMode = 'decimal';
        bidInput.className = 'rikiki-bid-input';
        bidInput.value = bidVal;
        bidInput.dataset.roundIndex = roundIdx;
        bidInput.dataset.playerIndex = playerIdx;
        bidInput.dataset.field = 'bid';
        bidInput.setAttribute('autocomplete', 'off');
        bidInput.setAttribute('title', 'Vállalt ütések');

        // Right Sub-Cell: Tényleges pontszám
        const scoreInput = document.createElement('input');
        scoreInput.type = 'text';
        scoreInput.inputMode = 'decimal';
        scoreInput.className = 'rikiki-score-input';
        scoreInput.value = scoreVal;
        scoreInput.dataset.roundIndex = roundIdx;
        scoreInput.dataset.playerIndex = playerIdx;
        scoreInput.dataset.field = 'score';
        scoreInput.setAttribute('autocomplete', 'off');
        scoreInput.setAttribute('title', 'Tényleges pontszám');

        if (isLockedRow) {
          bidInput.classList.add('is-locked');
          bidInput.setAttribute('readonly', 'readonly');
          bidInput.setAttribute('tabindex', '-1');

          scoreInput.classList.add('is-locked');
          scoreInput.setAttribute('readonly', 'readonly');
          scoreInput.setAttribute('tabindex', '-1');
        } else {
          bidInput.addEventListener('focus', () => bidInput.select());
          scoreInput.addEventListener('focus', () => scoreInput.select());
        }

        cellGroup.appendChild(bidInput);
        cellGroup.appendChild(scoreInput);
        td.appendChild(cellGroup);
      } else {
        // Standard single score input (Snapszer / Általános)
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.className = 'score-input';
        input.value = typeof cellVal === 'object' ? (cellVal.score || '') : (cellVal !== undefined ? cellVal : '');
        input.dataset.roundIndex = roundIdx;
        input.dataset.playerIndex = playerIdx;
        input.dataset.field = 'score';
        input.setAttribute('autocomplete', 'off');

        if (isLockedRow) {
          input.classList.add('is-locked');
          input.setAttribute('readonly', 'readonly');
          input.setAttribute('tabindex', '-1');
        } else {
          input.addEventListener('focus', () => input.select());
        }

        td.appendChild(input);
      }

      tr.appendChild(td);
    });

    return tr;
  }

  function handleCellInput(e) {
    const input = e.target;
    if (!input.classList.contains('score-input') && 
        !input.classList.contains('rikiki-bid-input') && 
        !input.classList.contains('rikiki-score-input')) {
      return;
    }

    const roundIdx = parseInt(input.dataset.roundIndex, 10);
    const playerIdx = parseInt(input.dataset.playerIndex, 10);
    const field = input.dataset.field || 'score';

    if (roundIdx < state.lockedRowsCount) return;

    const wasGameStarted = isGameStarted();

    let val = input.value.trim();
    if (val !== '' && val !== '-' && isNaN(Number(val))) {
      const cleaned = val.replace(/[^0-9.-]/g, '');
      input.value = cleaned;
      val = cleaned;
    }

    if (state.gameType === 'rikiki') {
      if (typeof state.rounds[roundIdx][playerIdx] !== 'object' || state.rounds[roundIdx][playerIdx] === null) {
        state.rounds[roundIdx][playerIdx] = { bid: '', score: '' };
      }
      state.rounds[roundIdx][playerIdx][field] = val;
    } else {
      state.rounds[roundIdx][playerIdx] = val;
    }

    saveState();
    renderTotals();

    if (isGameStarted() !== wasGameStarted) {
      renderHeaders();
    }
  }

  function handleCellKeyDown(e) {
    const input = e.target;
    if (!input.classList.contains('score-input') && 
        !input.classList.contains('rikiki-bid-input') && 
        !input.classList.contains('rikiki-score-input')) {
      return;
    }

    const currentRound = parseInt(input.dataset.roundIndex, 10);
    const currentPlayer = parseInt(input.dataset.playerIndex, 10);
    const field = input.dataset.field || 'score';

    if (e.key === 'Enter') {
      e.preventDefault();
      if (state.gameType === 'rikiki' && field === 'bid') {
        // Move from bid to score input of same player
        focusRikikiCell(currentRound, currentPlayer, 'score');
      } else {
        // Move to next round
        if (currentRound === state.rounds.length - 1) {
          appendEmptyRound(false);
        }
        focusCell(currentRound + 1, currentPlayer, true, state.gameType === 'rikiki' ? 'bid' : 'score');
      }
    } else if (e.key === 'ArrowDown') {
      if (currentRound < state.rounds.length - 1) {
        e.preventDefault();
        focusCell(currentRound + 1, currentPlayer, true, field);
      }
    } else if (e.key === 'ArrowUp') {
      if (currentRound > state.lockedRowsCount) {
        e.preventDefault();
        focusCell(currentRound - 1, currentPlayer, true, field);
      }
    } else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length) {
      if (state.gameType === 'rikiki' && field === 'bid') {
        e.preventDefault();
        focusRikikiCell(currentRound, currentPlayer, 'score');
      } else if (currentPlayer < state.players.length - 1) {
        e.preventDefault();
        focusCell(currentRound, currentPlayer + 1, true, state.gameType === 'rikiki' ? 'bid' : 'score');
      }
    } else if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
      if (state.gameType === 'rikiki' && field === 'score') {
        e.preventDefault();
        focusRikikiCell(currentRound, currentPlayer, 'bid');
      } else if (currentPlayer > 0) {
        e.preventDefault();
        focusCell(currentRound, currentPlayer - 1, true, state.gameType === 'rikiki' ? 'score' : 'score');
      }
    }
  }

  function focusCell(roundIdx, playerIdx, selectText = true, field = 'score') {
    if (state.gameType === 'rikiki') {
      focusRikikiCell(roundIdx, playerIdx, field, selectText);
    } else {
      const targetInput = roundsTbody.querySelector(
        `input[data-round-index="${roundIdx}"][data-player-index="${playerIdx}"]`
      );
      if (targetInput && !targetInput.classList.contains('is-locked')) {
        targetInput.focus();
        if (selectText) {
          targetInput.select();
        }
      }
    }
  }

  function focusRikikiCell(roundIdx, playerIdx, field = 'score', selectText = true) {
    const selector = field === 'bid' ? '.rikiki-bid-input' : '.rikiki-score-input';
    const targetInput = roundsTbody.querySelector(
      `input${selector}[data-round-index="${roundIdx}"][data-player-index="${playerIdx}"]`
    );
    if (targetInput && !targetInput.classList.contains('is-locked')) {
      targetInput.focus();
      if (selectText) {
        targetInput.select();
      }
    }
  }

  /**
   * Calculate totals exclusively for the ACTIVE session/round (from lockedRowsCount to end)
   */
  function calculateTotals() {
    const startRowIdx = state.lockedRowsCount || 0;
    return state.players.map((_, playerIdx) => {
      let sum = 0;
      let hasValue = false;
      for (let r = startRowIdx; r < state.rounds.length; r++) {
        const val = state.rounds[r][playerIdx];
        let numVal = null;

        if (val !== '' && val !== null && val !== undefined) {
          if (typeof val === 'object') {
            if (val.score !== '' && val.score !== null && !isNaN(Number(val.score))) {
              numVal = Number(val.score);
            }
          } else if (!isNaN(Number(val))) {
            numVal = Number(val);
          }
        }

        if (numVal !== null) {
          sum += numVal;
          hasValue = true;
        }
      }
      return hasValue ? sum : 0;
    });
  }

  function addPlayer() {
    const newPlayerName = `Név${state.players.length + 1}`;
    state.players.push(newPlayerName);
    state.playerBunkos.push([]);
    state.rounds.forEach(round => round.push(state.gameType === 'rikiki' ? { bid: '', score: '' } : ''));
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
    const emptyRound = createEmptyRoundArray();
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

  /**
   * Start New Round / Új kör 🔄
   */
  function startNewSession() {
    let lastScoredRowIdx = -1;
    for (let r = state.rounds.length - 1; r >= 0; r--) {
      const hasContent = state.rounds[r].some(val => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'object') return val.score !== '' || val.bid !== '';
        return val !== '';
      });
      if (hasContent) {
        lastScoredRowIdx = r;
        break;
      }
    }

    if (lastScoredRowIdx >= 0) {
      if (!state.separatorRowIndices.includes(lastScoredRowIdx)) {
        state.separatorRowIndices.push(lastScoredRowIdx);
      }
      state.lockedRowsCount = Math.max(state.lockedRowsCount, lastScoredRowIdx + 1);

      const activeRowsRemaining = state.rounds.length - state.lockedRowsCount;
      if (activeRowsRemaining < 8) {
        for (let i = 0; i < 8; i++) {
          state.rounds.push(createEmptyRoundArray());
        }
      }

      saveState();
      renderTable();
    }
  }

  function resetTableKeepNames() {
    const rowCount = calculateScreenRoundsCount();
    state.rounds = Array.from({ length: rowCount }, () => createEmptyRoundArray());
    state.playerBunkos = state.players.map(() => []);
    state.lockedRowsCount = 0;
    state.separatorRowIndices = [];
    saveState();
    renderTable();
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
