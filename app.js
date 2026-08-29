/**
 * Kártyás Jegyzetlap - Card Game Score Pad Application Logic (Snapszer, Rikiki, Fekete macska, Általános)
 */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kartyas_jegyzetlap_state_v7';
  const THEME_KEY = 'kartyas_jegyzetlap_theme';

  const calculateScreenRoundsCount = () => {
    const availableHeight = window.innerHeight - 100;
    const rows = Math.max(16, Math.floor(availableHeight / 46));
    return rows;
  };

  const initialRowCount = calculateScreenRoundsCount();

  const savedTheme = localStorage.getItem(THEME_KEY);
  const isDarkFromStorage = savedTheme === 'dark';

  let state = loadState() || {
    players: ['Név1', 'Név2', 'Név3', 'Név4'],
    playerBunkos: [[], [], [], []],
    gameType: 'snapszer',
    showSum: false,
    darkMode: isDarkFromStorage,
    lockedRowsCount: 0,
    separatorRowIndices: [],
    rikikiBaseScore: 10,
    rikikiTrickValue: 2,
    rounds: Array.from({ length: initialRowCount }, () => ['', '', '', ''])
  };

  if (!state.playerBunkos || state.playerBunkos.length !== state.players.length) {
    state.playerBunkos = state.players.map((_, i) => state.playerBunkos?.[i] || []);
  }
  if (!state.gameType) state.gameType = 'snapszer';
  if (savedTheme) {
    state.darkMode = isDarkFromStorage;
  }
  if (state.lockedRowsCount === undefined) state.lockedRowsCount = 0;
  if (!state.separatorRowIndices) state.separatorRowIndices = [];
  if (state.rikikiBaseScore === undefined) state.rikikiBaseScore = 10;
  if (state.rikikiTrickValue === undefined) state.rikikiTrickValue = 2;

  // Default Szumma to true in Rikiki & Fekete macska mode
  if ((state.gameType === 'rikiki' || state.gameType === 'fekete_macska') && state.showSum === undefined) {
    state.showSum = true;
  }

  if (state.rounds.length < initialRowCount) {
    while (state.rounds.length < initialRowCount) {
      state.rounds.push(createEmptyRoundArray());
    }
  }

  function createEmptyRoundArray() {
    return state.players.map(() => state.gameType === 'rikiki' ? { bid: '', tricks: '', score: '' } : '');
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
  const rikikiSettingsGroup = document.getElementById('rikiki-settings-group');
  const rikikiBaseScoreInput = document.getElementById('rikiki-base-score-input');
  const rikikiTrickValueInput = document.getElementById('rikiki-trick-value-input');

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

  /**
   * Calculate Rikiki score based on contract bid vs actual tricks
   */
  function calculateRikikiScore(bidVal, tricksVal) {
    if (bidVal === '' || tricksVal === '' || bidVal === null || tricksVal === null || bidVal === undefined || tricksVal === undefined) {
      return '';
    }
    const b = parseInt(bidVal, 10);
    const t = parseInt(tricksVal, 10);
    if (isNaN(b) || isNaN(t)) return '';

    const baseScore = Number(state.rikikiBaseScore ?? 10);
    const trickVal = Number(state.rikikiTrickValue ?? 2);

    if (b === t) {
      return baseScore + (t * trickVal);
    } else {
      const diff = Math.abs(b - t);
      return -(diff * trickVal);
    }
  }

  function isGameStarted() {
    return state.rounds.some(round => round.some(val => {
      if (val === null || val === undefined) return false;
      if (typeof val === 'object') {
        return (val.bid !== '' && val.bid !== null && val.bid !== undefined) ||
               (val.tricks !== '' && val.tricks !== null && val.tricks !== undefined) ||
               (val.score !== '' && val.score !== null && val.score !== undefined);
      }
      return val !== '';
    }));
  }

  /**
   * Helper for Fekete macska: finds the highest round index that should be unlocked.
   */
  function getFirstIncompleteRoundIndex() {
    for (let r = 0; r < state.rounds.length; r++) {
      let sum = 0;
      let isComplete = true;
      for (let p = 0; p < state.players.length; p++) {
        const val = state.rounds[r][p];
        if (val === '' || val === null || val === undefined) {
          isComplete = false;
        } else if (!isNaN(Number(val))) {
          sum += Number(val);
        }
      }
      if (!isComplete && sum !== 26) {
        return r;
      }
    }
    return state.rounds.length - 1;
  }

  // Synchronize horizontal scrolling between table wrapper and bottom sum bar
  if (tableWrapper && totalPaperContainer) {
    tableWrapper.addEventListener('scroll', () => {
      totalPaperContainer.scrollLeft = tableWrapper.scrollLeft;
    });
  }

  // Apply Theme immediately
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
      try {
        localStorage.setItem(THEME_KEY, state.darkMode ? 'dark' : 'light');
      } catch (err) {}
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

    if (state.gameType === 'rikiki' || state.gameType === 'fekete_macska') {
      state.showSum = true;
    }

    const rowCount = calculateScreenRoundsCount();
    state.rounds = Array.from({ length: rowCount }, () => createEmptyRoundArray());
    state.playerBunkos = state.players.map(() => []);
    state.lockedRowsCount = 0;
    state.separatorRowIndices = [];
    saveState();
    renderTable();
    updateSettingsUI();
  });

  // Rikiki Score Rules Config Listeners
  if (rikikiBaseScoreInput) {
    rikikiBaseScoreInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.rikikiBaseScore = isNaN(val) ? 10 : val;
      recalculateAllRikikiScores();
      saveState();
      renderTable();
    });
  }

  if (rikikiTrickValueInput) {
    rikikiTrickValueInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.rikikiTrickValue = isNaN(val) ? 2 : val;
      recalculateAllRikikiScores();
      saveState();
      renderTable();
    });
  }

  function recalculateAllRikikiScores() {
    if (state.gameType !== 'rikiki') return;
    state.rounds.forEach(round => {
      round.forEach(cell => {
        if (typeof cell === 'object' && cell !== null) {
          cell.score = calculateRikikiScore(cell.bid, cell.tricks);
        }
      });
    });
  }

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
      document.documentElement.classList.add('dark-theme');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
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

    if (rikikiBaseScoreInput) {
      rikikiBaseScoreInput.value = state.rikikiBaseScore ?? 10;
    }
    if (rikikiTrickValueInput) {
      rikikiTrickValueInput.value = state.rikikiTrickValue ?? 2;
    }

    if (rikikiSettingsGroup) {
      if (state.gameType === 'rikiki') {
        rikikiSettingsGroup.classList.remove('is-hidden');
      } else {
        rikikiSettingsGroup.classList.add('is-hidden');
      }
    }
  }

  function updateGameTypeUI() {
    // Bunkó button is only available in Snapszer
    if (state.gameType === 'snapszer') {
      bunkoModalBtn.classList.remove('is-hidden');
    } else {
      bunkoModalBtn.classList.add('is-hidden');
    }

    // Új kör button is only needed in Snapszer & General
    if (state.gameType === 'snapszer' || state.gameType === 'general') {
      newSessionBtn.classList.remove('is-hidden');
    } else {
      newSessionBtn.classList.add('is-hidden');
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
    const firstIncompleteRow = state.gameType === 'fekete_macska' ? getFirstIncompleteRoundIndex() : null;

    state.rounds.forEach((roundData, roundIdx) => {
      const tr = createRoundRow(roundIdx, roundData, firstIncompleteRow);
      roundsTbody.appendChild(tr);
    });
  }

  function createRoundRow(roundIdx, roundData, firstIncompleteRow = null) {
    const tr = document.createElement('tr');
    tr.className = 'round-row';
    tr.dataset.roundIndex = roundIdx;

    let isLockedRow = false;
    if (state.gameType === 'fekete_macska') {
      isLockedRow = firstIncompleteRow !== null && roundIdx > firstIncompleteRow;

      // Only mark danger if all cells in this row are entered AND sum != 26, OR if sum > 26
      let rSum = 0;
      let filledCount = 0;
      roundData.forEach(cVal => {
        if (cVal !== '' && cVal !== null && cVal !== undefined && !isNaN(Number(cVal))) {
          rSum += Number(cVal);
          filledCount++;
        }
      });
      const isFull = filledCount === state.players.length;
      if ((isFull && rSum !== 26) || rSum > 26) {
        tr.classList.add('row-danger');
      }
    } else {
      isLockedRow = roundIdx < state.lockedRowsCount;
    }

    const isSeparatorRow = state.separatorRowIndices.includes(roundIdx);

    // 5-Round separator guideline for tracking card deals
    if ((roundIdx + 1) % 5 === 0) {
      tr.classList.add('five-round-separator');
    }

    if (isSeparatorRow) {
      tr.classList.add('round-separator-row');
    }

    state.players.forEach((_, playerIdx) => {
      const td = document.createElement('td');
      td.className = state.gameType === 'rikiki' ? 'score-cell score-cell-rikiki' : 'score-cell';

      const cellVal = roundData[playerIdx];

      if (state.gameType === 'rikiki') {
        // 3 Sub-Cell layout for Rikiki: 1. Bid (~31%), 2. Tricks (~31%), 3. Calculated Score (~38%)
        const cellGroup = document.createElement('div');
        cellGroup.className = 'rikiki-cell-group';

        const bidVal = (typeof cellVal === 'object' && cellVal !== null) ? (cellVal.bid || '') : '';
        const tricksVal = (typeof cellVal === 'object' && cellVal !== null) ? (cellVal.tricks || '') : '';
        const scoreVal = (typeof cellVal === 'object' && cellVal !== null) 
          ? (cellVal.score !== undefined && cellVal.score !== '' ? cellVal.score : calculateRikikiScore(bidVal, tricksVal))
          : (cellVal || '');

        // 1. Vállalás (Bid) memo input
        const bidInput = document.createElement('input');
        bidInput.type = 'text';
        bidInput.inputMode = 'numeric';
        bidInput.className = 'rikiki-bid-input';
        bidInput.value = bidVal;
        bidInput.dataset.roundIndex = roundIdx;
        bidInput.dataset.playerIndex = playerIdx;
        bidInput.dataset.field = 'bid';
        bidInput.setAttribute('autocomplete', 'off');
        bidInput.setAttribute('title', 'Vállalt ütések');

        // 2. Tényleges ütések (Tricks) memo input
        const tricksInput = document.createElement('input');
        tricksInput.type = 'text';
        tricksInput.inputMode = 'numeric';
        tricksInput.className = 'rikiki-tricks-input';
        tricksInput.value = tricksVal;
        tricksInput.dataset.roundIndex = roundIdx;
        tricksInput.dataset.playerIndex = playerIdx;
        tricksInput.dataset.field = 'tricks';
        tricksInput.setAttribute('autocomplete', 'off');
        tricksInput.setAttribute('title', 'Tényleges ütések száma');

        // 3. Kiszámolt pontszám (Auto calculated score display)
        const scoreDisplay = document.createElement('div');
        scoreDisplay.className = 'rikiki-score-display';
        scoreDisplay.dataset.roundIndex = roundIdx;
        scoreDisplay.dataset.playerIndex = playerIdx;
        scoreDisplay.textContent = scoreVal !== '' && scoreVal !== null ? scoreVal : '';
        if (typeof scoreVal === 'number' && scoreVal < 0) {
          scoreDisplay.classList.add('is-negative');
        }

        if (isLockedRow) {
          bidInput.classList.add('is-locked');
          bidInput.setAttribute('readonly', 'readonly');
          bidInput.setAttribute('tabindex', '-1');

          tricksInput.classList.add('is-locked');
          tricksInput.setAttribute('readonly', 'readonly');
          tricksInput.setAttribute('tabindex', '-1');

          scoreDisplay.classList.add('is-locked');
        } else {
          bidInput.addEventListener('focus', () => bidInput.select());
          tricksInput.addEventListener('focus', () => tricksInput.select());
        }

        cellGroup.appendChild(bidInput);
        cellGroup.appendChild(tricksInput);
        cellGroup.appendChild(scoreDisplay);
        td.appendChild(cellGroup);
      } else {
        // Standard single score input (Snapszer / Fekete macska / Általános)
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
        !input.classList.contains('rikiki-tricks-input')) {
      return;
    }

    const roundIdx = parseInt(input.dataset.roundIndex, 10);
    const playerIdx = parseInt(input.dataset.playerIndex, 10);
    const field = input.dataset.field || 'score';

    if (input.classList.contains('is-locked')) return;

    const wasGameStarted = isGameStarted();

    let val = input.value.trim();
    if (val !== '' && val !== '-' && isNaN(Number(val))) {
      const cleaned = val.replace(/[^0-9.-]/g, '');
      input.value = cleaned;
      val = cleaned;
    }

    if (state.gameType === 'rikiki') {
      if (typeof state.rounds[roundIdx][playerIdx] !== 'object' || state.rounds[roundIdx][playerIdx] === null) {
        state.rounds[roundIdx][playerIdx] = { bid: '', tricks: '', score: '' };
      }
      state.rounds[roundIdx][playerIdx][field] = val;

      // Auto-calculate score from bid & tricks
      const currentCell = state.rounds[roundIdx][playerIdx];
      const autoScore = calculateRikikiScore(currentCell.bid, currentCell.tricks);
      currentCell.score = autoScore;

      // Update DOM score display instantly without re-creating inputs!
      const scoreDisplay = roundsTbody.querySelector(
        `.rikiki-score-display[data-round-index="${roundIdx}"][data-player-index="${playerIdx}"]`
      );
      if (scoreDisplay) {
        scoreDisplay.textContent = autoScore !== '' && autoScore !== null ? autoScore : '';
        if (typeof autoScore === 'number' && autoScore < 0) {
          scoreDisplay.classList.add('is-negative');
        } else {
          scoreDisplay.classList.remove('is-negative');
        }
      }
    } else if (state.gameType === 'fekete_macska') {
      state.rounds[roundIdx][playerIdx] = val;

      // 1. Calculate sum and count remaining empty cells
      let currentSum = 0;
      let enteredCount = 0;
      const emptyIndices = [];

      state.rounds[roundIdx].forEach((cVal, pIdx) => {
        if (cVal !== '' && cVal !== null && cVal !== undefined && !isNaN(Number(cVal))) {
          currentSum += Number(cVal);
          enteredCount++;
        } else {
          emptyIndices.push(pIdx);
        }
      });

      // 2. If row sum is already 26 and user is NOT typing empty in current cell, fill other empty cells with 0
      if (currentSum === 26 && emptyIndices.length > 0 && val !== '') {
        emptyIndices.forEach(pIdx => {
          if (pIdx !== playerIdx) {
            state.rounds[roundIdx][pIdx] = '0';
            const cellInput = roundsTbody.querySelector(
              `input[data-round-index="${roundIdx}"][data-player-index="${pIdx}"]`
            );
            if (cellInput) cellInput.value = '0';
          }
        });
        emptyIndices.length = 0;
        enteredCount = state.players.length;
      }
      // 3. If exactly 1 OTHER cell remains empty (i.e. NOT the one the user is currently editing) and currentSum <= 26
      else if (emptyIndices.length === 1 && emptyIndices[0] !== playerIdx && currentSum <= 26 && enteredCount === state.players.length - 1) {
        const remainingPlayerIdx = emptyIndices[0];
        const remainingVal = String(26 - currentSum);
        state.rounds[roundIdx][remainingPlayerIdx] = remainingVal;

        const cellInput = roundsTbody.querySelector(
          `input[data-round-index="${roundIdx}"][data-player-index="${remainingPlayerIdx}"]`
        );
        if (cellInput) cellInput.value = remainingVal;

        currentSum = 26;
        emptyIndices.length = 0;
        enteredCount = state.players.length;
      }

      // 4. Update Danger highlight ONLY if all cells are filled and sum != 26, OR if sum > 26
      const isRowFull = (enteredCount === state.players.length);
      const isInvalid = (isRowFull && currentSum !== 26) || (currentSum > 26);

      const tr = roundsTbody.querySelector(`tr.round-row[data-round-index="${roundIdx}"]`);
      if (tr) {
        if (isInvalid) {
          tr.classList.add('row-danger');
        } else {
          tr.classList.remove('row-danger');
        }
      }

      // 5. If row sum is 26 (completed), seamlessly unlock the next row!
      if (currentSum === 26) {
        const nextRoundIdx = roundIdx + 1;
        if (nextRoundIdx < state.rounds.length) {
          const nextRowInputs = roundsTbody.querySelectorAll(
            `input[data-round-index="${nextRoundIdx}"]`
          );
          nextRowInputs.forEach(inp => {
            inp.classList.remove('is-locked');
            inp.removeAttribute('readonly');
            inp.removeAttribute('tabindex');
          });
        } else {
          appendEmptyRound(false);
        }
      }
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
        !input.classList.contains('rikiki-tricks-input')) {
      return;
    }

    const currentRound = parseInt(input.dataset.roundIndex, 10);
    const currentPlayer = parseInt(input.dataset.playerIndex, 10);
    const field = input.dataset.field || 'score';

    if (e.key === 'Enter') {
      e.preventDefault();
      if (state.gameType === 'rikiki') {
        if (field === 'bid') {
          focusRikikiCell(currentRound, currentPlayer, 'tricks');
        } else {
          if (currentRound === state.rounds.length - 1) {
            appendEmptyRound(false);
          }
          focusCell(currentRound + 1, currentPlayer, true, 'bid');
        }
      } else {
        if (currentRound === state.rounds.length - 1) {
          appendEmptyRound(false);
        }
        focusCell(currentRound + 1, currentPlayer, true, 'score');
      }
    } else if (e.key === 'ArrowDown') {
      if (currentRound < state.rounds.length - 1) {
        e.preventDefault();
        focusCell(currentRound + 1, currentPlayer, true, field);
      }
    } else if (e.key === 'ArrowUp') {
      if (currentRound > 0) {
        e.preventDefault();
        focusCell(currentRound - 1, currentPlayer, true, field);
      }
    } else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length) {
      if (state.gameType === 'rikiki' && field === 'bid') {
        e.preventDefault();
        focusRikikiCell(currentRound, currentPlayer, 'tricks');
      } else if (currentPlayer < state.players.length - 1) {
        e.preventDefault();
        focusCell(currentRound, currentPlayer + 1, true, state.gameType === 'rikiki' ? 'bid' : 'score');
      }
    } else if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
      if (state.gameType === 'rikiki' && field === 'tricks') {
        e.preventDefault();
        focusRikikiCell(currentRound, currentPlayer, 'bid');
      } else if (currentPlayer > 0) {
        e.preventDefault();
        focusCell(currentRound, currentPlayer - 1, true, state.gameType === 'rikiki' ? 'tricks' : 'score');
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

  function focusRikikiCell(roundIdx, playerIdx, field = 'bid', selectText = true) {
    const selector = field === 'tricks' ? '.rikiki-tricks-input' : '.rikiki-bid-input';
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
   * Calculate totals (active session / overall for Rikiki and Fekete macska)
   */
  function calculateTotals() {
    const startRowIdx = (state.gameType === 'snapszer' || state.gameType === 'general')
      ? (state.lockedRowsCount || 0)
      : 0;

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
    state.rounds.forEach(round => round.push(state.gameType === 'rikiki' ? { bid: '', tricks: '', score: '' } : ''));
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
        if (typeof val === 'object') return val.score !== '' || val.bid !== '' || val.tricks !== '';
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
