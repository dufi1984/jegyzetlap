/**
 * Kártyás Jegyzetlap - Card Game Score Pad Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kartyas_jegyzetlap_data_v6';

  const calculateScreenRoundsCount = () => {
    const availableHeight = window.innerHeight - 100;
    const rows = Math.max(16, Math.floor(availableHeight / 46));
    return rows;
  };

  const initialRowCount = calculateScreenRoundsCount();

  let state = loadState() || {
    players: ['Név 1', 'Név 2', 'Név 3', 'Név 4'],
    playerBunkos: [[], [], [], []],
    showSum: false,
    rounds: Array.from({ length: initialRowCount }, () => ['', '', '', ''])
  };

  if (!state.playerBunkos || state.playerBunkos.length !== state.players.length) {
    state.playerBunkos = state.players.map((_, i) => state.playerBunkos?.[i] || []);
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
  const toggleSumBtn = document.getElementById('toggle-sum-btn');
  const sumStatusText = document.getElementById('sum-status-text');
  const resetBtn = document.getElementById('reset-btn');

  // Modal Elements
  const bunkoModalBtn = document.getElementById('bunko-modal-btn');
  const bunkoModal = document.getElementById('bunko-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const bunkoModalList = document.getElementById('bunko-modal-list');
  const confirmBunkoBtn = document.getElementById('confirm-bunko-btn');

  // Selected player indices in modal
  let selectedPlayerIndices = new Set();

  // SVG Generators for Sima Bunkó and Szőrös Bunkó
  const SVG_SIMA_BUNKO = `<svg viewBox="0 0 24 24" class="bunko-icon sima" title="Sima bunkó"><circle cx="12" cy="12" r="7.5" fill="#1e293b"/></svg>`;
  const SVG_SZOROS_BUNKO = `<svg viewBox="0 0 24 24" class="bunko-icon szoros" title="Szőrös bunkó"><circle cx="12" cy="12" r="5" fill="#1e293b"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round"/></svg>`;

  // Initialize UI
  renderTable();

  // Event Listeners
  addPlayerBtn.addEventListener('click', addPlayer);
  newSessionBtn.addEventListener('click', startNewSession);
  toggleSumBtn.addEventListener('click', toggleSum);
  resetBtn.addEventListener('click', resetFullGame);

  bunkoModalBtn.addEventListener('click', openBunkoModal);
  closeModalBtn.addEventListener('click', closeBunkoModal);
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
  }

  /**
   * Render Player Header Row with Right-Floating Bunkó Badges
   */
  function renderHeaders() {
    playerHeadersRow.innerHTML = '';

    state.players.forEach((playerName, index) => {
      const th = document.createElement('th');
      th.className = 'player-header';
      th.dataset.playerIndex = index;

      const innerDiv = document.createElement('div');
      innerDiv.className = 'player-header-inner';

      if (state.players.length > 2) {
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

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'player-name-input';
      input.value = playerName;
      input.placeholder = `Játékos ${index + 1}`;
      input.addEventListener('change', (e) => updatePlayerName(index, e.target.value));

      innerDiv.appendChild(input);

      // Bunkó Badges Row (floating on right edge)
      const bunkos = state.playerBunkos[index] || [];
      if (bunkos.length > 0) {
        const badgesRow = document.createElement('div');
        badgesRow.className = 'player-badges-row';
        badgesRow.title = 'Kattints ide a Bunkók kezeléséhez!';
        badgesRow.addEventListener('click', openBunkoModal);

        bunkos.forEach(type => {
          const span = document.createElement('span');
          span.innerHTML = type === 'szoros' ? SVG_SZOROS_BUNKO : SVG_SIMA_BUNKO;
          badgesRow.appendChild(span.firstChild);
        });

        innerDiv.appendChild(badgesRow);
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
    const newPlayerName = `Név ${state.players.length + 1}`;
    state.players.push(newPlayerName);
    state.playerBunkos.push([]);
    state.rounds.forEach(round => round.push(''));
    saveState();
    renderTable();
  }

  function removePlayer(playerIdx) {
    if (state.players.length <= 2) return;
    state.players.splice(playerIdx, 1);
    state.playerBunkos.splice(playerIdx, 1);
    state.rounds.forEach(round => round.splice(playerIdx, 1));
    saveState();
    renderTable();
  }

  function updatePlayerName(playerIdx, newName) {
    state.players[playerIdx] = newName.trim() || `Játékos ${playerIdx + 1}`;
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
   * Simplified Bunkó Modal Management
   */
  function openBunkoModal() {
    selectedPlayerIndices.clear();
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
      if (selectedPlayerIndices.has(playerIdx)) {
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
        if (selectedPlayerIndices.has(playerIdx)) {
          selectedPlayerIndices.delete(playerIdx);
          row.classList.remove('is-selected');
        } else {
          selectedPlayerIndices.add(playerIdx);
          row.classList.add('is-selected');
        }
      });

      bunkoModalList.appendChild(row);
    });
  }

  /**
   * Confirm Bunkó Selection: Automatically awards Szőrös Bunkó if total == 0, else Sima Bunkó
   */
  function confirmBunkoSelection() {
    if (selectedPlayerIndices.size > 0) {
      const totals = calculateTotals();

      selectedPlayerIndices.forEach(playerIdx => {
        if (!state.playerBunkos[playerIdx]) {
          state.playerBunkos[playerIdx] = [];
        }
        
        // Automatic detection: if player total score in session is 0, give Szőrös Bunkó!
        const totalScore = totals[playerIdx];
        if (totalScore === 0) {
          state.playerBunkos[playerIdx].push('szoros');
        } else {
          state.playerBunkos[playerIdx].push('sima');
        }
      });

      saveState();
      renderHeaders();
    }

    closeBunkoModal();
  }

  /**
   * Start New Session (Clears score table inputs, PRESERVES player bunkós and names)
   */
  function startNewSession() {
    if (confirm('Új menet indítása: A rögzített pontok törlődnek az új fordulóhoz, de a játékosok BUNKÓI megmaradnak. Folytatod?')) {
      const rowCount = calculateScreenRoundsCount();
      state.rounds = Array.from({ length: rowCount }, () => state.players.map(() => ''));
      saveState();
      renderTable();
    }
  }

  /**
   * Full Game Reset (Clears scores AND bunkós)
   */
  function resetFullGame() {
    if (confirm('Új teljes játék: Minden pont ÉS az összes BUNKÓ is törlésre kerül. Folytatod?')) {
      const rowCount = calculateScreenRoundsCount();
      state.rounds = Array.from({ length: rowCount }, () => state.players.map(() => ''));
      state.playerBunkos = state.players.map(() => []);
      saveState();
      renderTable();
    }
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
