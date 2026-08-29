/**
 * Kártyás Jegyzetlap - Card Game Score Pad Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kartyas_jegyzetlap_data_v16';

  const calculateScreenRoundsCount = () => {
    const availableHeight = window.innerHeight - 100;
    const rows = Math.max(16, Math.floor(availableHeight / 46));
    return rows;
  };

  const initialRowCount = calculateScreenRoundsCount();

  let state = loadState() || {
    players: ['Név1', 'Név2', 'Név3', 'Név4'],
    playerBunkos: [[], [], [], []],
    gameType: 'snapszer', // 'snapszer' or 'general'
    showSum: false,
    rounds: Array.from({ length: initialRowCount }, () => ['', '', '', ''])
  };

  if (!state.playerBunkos || state.playerBunkos.length !== state.players.length) {
    state.playerBunkos = state.players.map((_, i) => state.playerBunkos?.[i] || []);
  }

  if (!state.gameType) {
    state.gameType = 'snapszer';
  }

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
  const gameTypeSelect = document.getElementById('game-type-select');

  // Bunkó Modal Elements
  const bunkoModalBtn = document.getElementById('bunko-modal-btn');
  const bunkoModal = document.getElementById('bunko-modal');
  const closeBunkoBtn = document.getElementById('close-bunko-btn');
  const bunkoModalList = document.getElementById('bunko-modal-list');
  const confirmBunkoBtn = document.getElementById('confirm-bunko-btn');

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

  // Main Event Listeners
  addPlayerBtn.addEventListener('click', addPlayer);
  newSessionBtn.addEventListener('click', startNewSession);
  if (resetTableBtn) {
    resetTableBtn.addEventListener('click', resetTableKeepNames);
  }
  if (reloadPageBtn) {
    reloadPageBtn.addEventListener('click', () => {
      window.location.reload(true);
    });
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

  // Game Type Change: Auto-clears table scores & bunkos for a fresh start!
  gameTypeSelect.addEventListener('change', (e) => {
    state.gameType = e.target.value;
    
    // Reset table scores and bunkos on game type change
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

      // Name Input with auto-select on focus
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'player-name-input';
      input.value = playerName;
      input.placeholder = `Név${index + 1}`;
      input.addEventListener('change', (e) => updatePlayerName(index, e.target.value));
      input.addEventListener('focus', () => input.select());
      innerDiv.appendChild(input);

      // Bunkó Badges Row (displayed directly UNDER player name)
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

      // Delete player X button (ONLY shown before game starts)
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
      input.addEventListener('focus', () => input.select());

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

  /**
   * Start New Round / Új kör
   */
  function startNewSession() {
    const rowCount = calculateScreenRoundsCount();
    state.rounds = Array.from({ length: rowCount }, () => state.players.map(() => ''));
    saveState();
    renderTable();
  }

  /**
   * Trash Icon Button Action: Reset Table & Bunkós, Keep Player Names!
   */
  function resetTableKeepNames() {
    const rowCount = calculateScreenRoundsCount();
    state.rounds = Array.from({ length: rowCount }, () => state.players.map(() => ''));
    state.playerBunkos = state.players.map(() => []);
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
