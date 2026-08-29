/**
 * Kártyás Jegyzetlap - Card Game Score Pad Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kartyas_jegyzetlap_data_v2';

  // Calculate default screen-filling round count (cell height ~44px)
  const calculateScreenRoundsCount = () => {
    const availableHeight = window.innerHeight - 100; // minus footer & header
    const rows = Math.max(16, Math.floor(availableHeight / 44));
    return rows;
  };

  const initialRowCount = calculateScreenRoundsCount();

  let state = loadState() || {
    players: ['Név 1', 'Név 2', 'Név 3', 'Név 4'],
    showSum: true,
    rounds: Array.from({ length: initialRowCount }, () => ['', '', '', ''])
  };

  // Ensure initial state has enough screen-filling rows
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
  const toggleSumBtn = document.getElementById('toggle-sum-btn');
  const sumStatusText = document.getElementById('sum-status-text');
  const resetBtn = document.getElementById('reset-btn');

  // Initialize UI
  renderTable();

  // Event Listeners
  addPlayerBtn.addEventListener('click', addPlayer);
  toggleSumBtn.addEventListener('click', toggleSum);
  resetBtn.addEventListener('click', resetGame);

  // Keyboard & Input delegates
  roundsTbody.addEventListener('keydown', handleCellKeyDown);
  roundsTbody.addEventListener('input', handleCellInput);

  /**
   * Render complete table based on state
   */
  function renderTable() {
    renderHeaders();
    renderTotals();
    renderRounds();
    updateSumVisibility();
  }

  /**
   * Render Player Header Row (No # column)
   */
  function renderHeaders() {
    playerHeadersRow.innerHTML = '';

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
      input.placeholder = `Játékos ${index + 1}`;
      input.addEventListener('change', (e) => updatePlayerName(index, e.target.value));

      innerDiv.appendChild(input);

      // Remove player button (only if more than 2 players)
      if (state.players.length > 2) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-player-btn';
        removeBtn.innerHTML = '✕';
        removeBtn.title = 'Játékos törlése';
        removeBtn.addEventListener('click', () => removePlayer(index));
        innerDiv.appendChild(removeBtn);
      }

      th.appendChild(innerDiv);
      playerHeadersRow.appendChild(th);
    });
  }

  /**
   * Render Totals Row
   */
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

  /**
   * Update Sum Row Visibility
   */
  function updateSumVisibility() {
    if (state.showSum) {
      totalTbody.classList.remove('is-hidden');
      sumStatusText.textContent = 'BE';
      toggleSumBtn.classList.add('active');
    } else {
      totalTbody.classList.add('is-hidden');
      sumStatusText.textContent = 'KI';
      toggleSumBtn.classList.remove('active');
    }
  }

  /**
   * Toggle Sum Row
   */
  function toggleSum() {
    state.showSum = !state.showSum;
    saveState();
    updateSumVisibility();
  }

  /**
   * Render Round Rows
   */
  function renderRounds() {
    roundsTbody.innerHTML = '';

    state.rounds.forEach((roundData, roundIdx) => {
      const tr = createRoundRow(roundIdx, roundData);
      roundsTbody.appendChild(tr);
    });
  }

  /**
   * Helper to create a single round TR element (No sorszámozás cell)
   */
  function createRoundRow(roundIdx, roundData) {
    const tr = document.createElement('tr');
    tr.className = 'round-row';
    tr.dataset.roundIndex = roundIdx;

    state.players.forEach((_, playerIdx) => {
      const td = document.createElement('td');
      td.className = 'score-cell';

      const input = document.createElement('input');
      input.type = 'text'; // Using text with inputmode decimal for touch numeric keyboard
      input.inputMode = 'decimal';
      input.className = 'score-input';
      input.value = roundData[playerIdx] !== undefined ? roundData[playerIdx] : '';
      input.dataset.roundIndex = roundIdx;
      input.dataset.playerIndex = playerIdx;
      input.setAttribute('autocomplete', 'off');
      // No placeholder '-' or '0'

      td.appendChild(input);
      tr.appendChild(td);
    });

    return tr;
  }

  /**
   * Handle Score Input Change
   */
  function handleCellInput(e) {
    if (!e.target.classList.contains('score-input')) return;

    const input = e.target;
    const roundIdx = parseInt(input.dataset.roundIndex, 10);
    const playerIdx = parseInt(input.dataset.playerIndex, 10);

    let val = input.value.trim();
    if (val !== '' && val !== '-' && isNaN(Number(val))) {
      const cleaned = val.replace(/[^0-9.-]/g, '');
      input.value = cleaned;
      val = cleaned;
    }

    state.rounds[roundIdx][playerIdx] = val;
    saveState();
    renderTotals();
  }

  /**
   * Handle Keyboard Navigation (Excel-like Enter & Arrow keys)
   */
  function handleCellKeyDown(e) {
    if (!e.target.classList.contains('score-input')) return;

    const input = e.target;
    const currentRound = parseInt(input.dataset.roundIndex, 10);
    const currentPlayer = parseInt(input.dataset.playerIndex, 10);

    if (e.key === 'Enter') {
      e.preventDefault();

      // If we are at the last row, dynamically append a new round row
      if (currentRound === state.rounds.length - 1) {
        appendEmptyRound(false);
      }

      // Move to same player, next round
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

  /**
   * Helper to set focus to specific grid input cell
   */
  function focusCell(roundIdx, playerIdx) {
    const targetInput = roundsTbody.querySelector(
      `input[data-round-index="${roundIdx}"][data-player-index="${playerIdx}"]`
    );
    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    }
  }

  /**
   * Calculate Total Scores per Player
   */
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

  /**
   * Add New Player Column
   */
  function addPlayer() {
    const newPlayerName = `Név ${state.players.length + 1}`;
    state.players.push(newPlayerName);
    
    state.rounds.forEach(round => round.push(''));

    saveState();
    renderTable();
  }

  /**
   * Remove Player Column
   */
  function removePlayer(playerIdx) {
    if (state.players.length <= 2) return;

    state.players.splice(playerIdx, 1);
    state.rounds.forEach(round => round.splice(playerIdx, 1));

    saveState();
    renderTable();
  }

  /**
   * Update Player Name
   */
  function updatePlayerName(playerIdx, newName) {
    state.players[playerIdx] = newName.trim() || `Játékos ${playerIdx + 1}`;
    saveState();
  }

  /**
   * Append Single Empty Round
   */
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
   * Reset Game (Clear all scores)
   */
  function resetGame() {
    if (confirm('Biztosan törölni szeretnéd az összes rögzített pontot?')) {
      const rowCount = calculateScreenRoundsCount();
      state.rounds = Array.from({ length: rowCount }, () => state.players.map(() => ''));
      saveState();
      renderTable();
    }
  }

  /**
   * Save State to LocalStorage
   */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('State save failed:', err);
    }
  }

  /**
   * Load State from LocalStorage
   */
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
