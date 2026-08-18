let gameData = { clubs: [], nationals: [] };
let formations = [];
let simInterval = null;
let currentMinute = 0;
let homeState = null;
let awayState = null;

let leaderboards = { goals: {}, assists: {}, saves: {}, cleanSheets: {} };

async function init() {
  const tRes = await fetch('teams.json');
  gameData = await tRes.json();
  const fRes = await fetch('formations.json');
  formations = await fRes.json();

  setupTeams();
}

function setupTeams() {
  const type = document.getElementById('comp-type').value;
  const teams = gameData[type];
  const hSel = document.getElementById('home-team');
  const aSel = document.getElementById('away-team');

  hSel.innerHTML = '';
  aSel.innerHTML = '';

  teams.forEach(t => {
    hSel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    aSel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });

  if (teams.length > 1) aSel.selectedIndex = 1;
  renderTacticalBoards();
}

// Squad & Lineup Builders
function select25MatchSquad(team) {
  let pool = [...team.players].sort((a, b) => (b.rating + (Math.random() * 8 - 4)) - (a.rating + (Math.random() * 8 - 4)));
  let gks = pool.filter(p => p.pos === 'GK').slice(0, 2);
  let outfield = pool.filter(p => p.pos !== 'GK').slice(0, 23);
  return [...gks, ...outfield];
}

function buildTacticalLineup(squad, fmt) {
  let available = [...squad];
  let startingXI = [];

  fmt.slots.forEach(slot => {
    let idx = available.findIndex(p => slot.accepted.includes(p.pos));
    if (idx === -1) idx = 0;
    startingXI.push({ ...available[idx], role: slot.role });
    available.splice(idx, 1);
  });

  return { startingXI, bench: available };
}

function renderTacticalBoards() {
  if (simInterval) return; // Don't override during match

  const type = document.getElementById('comp-type').value;
  const hId = document.getElementById('home-team').value;
  const aId = document.getElementById('away-team').value;

  const hTeam = gameData[type].find(t => t.id === hId);
  const aTeam = gameData[type].find(t => t.id === aId);

  const fmt = formations[0];

  homeState = { ...hTeam, ...buildTacticalLineup(select25MatchSquad(hTeam), fmt), score: 0, subsLeft: 5 };
  awayState = { ...aTeam, ...buildTacticalLineup(select25MatchSquad(aTeam), fmt), score: 0, subsLeft: 5 };

  document.getElementById('home-title').innerText = homeState.name;
  document.getElementById('away-title').innerText = awayState.name;

  renderBoard('home-tactics', homeState);
  renderBoard('away-tactics', awayState);
}

function renderBoard(elementId, teamObj) {
  let html = `<h4>${teamObj.name} (4-3-3)</h4><strong style="font-size:0.8rem; color:var(--accent-gold);">STARTING XI</strong><div class="player-list">`;
  
  teamObj.startingXI.forEach(p => {
    html += `<div class="player-tag"><span>${p.name}</span><span class="pos">${p.role}</span></div>`;
  });

  html += `</div><strong style="font-size:0.8rem; color:var(--text-muted); margin-top:8px; display:block;">BENCH (MATCH DAY)</strong><div class="player-list">`;
  
  teamObj.bench.slice(0, 6).forEach(p => {
    html += `<div class="player-tag"><span>${p.name}</span><span class="pos">${p.pos}</span></div>`;
  });

  html += `</div>`;
  document.getElementById(elementId).innerHTML = html;
}

// Live Gradual Simulation
function startGradualSimulation() {
  if (simInterval) return;

  const startBtn = document.getElementById('btn-start');
  startBtn.disabled = true;
  startBtn.style.opacity = '0.5';

  currentMinute = 0;
  document.getElementById('match-feed').innerHTML = '';
  document.getElementById('status-badge').innerText = 'Match in Progress...';

  simInterval = setInterval(() => {
    currentMinute++;
    document.getElementById('match-clock').innerText = `${currentMinute}'`;

    processMatchMinute(currentMinute);

    if (currentMinute >= 90) {
      clearInterval(simInterval);
      simInterval = null;
      document.getElementById('status-badge').innerText = 'Full Time';
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      finalizeMatchStats();
    }
  }, 120); // Ticks every 120ms for smooth live action
}

function processMatchMinute(min) {
  // Chance of Match Action
  if (Math.random() < 0.20) {
    let attacking = Math.random() > 0.5 ? homeState : awayState;
    let defending = attacking === homeState ? awayState : homeState;

    let attacker = attacking.startingXI[Math.floor(Math.random() * 10) + 1];
    let assister = attacking.startingXI[Math.floor(Math.random() * 10) + 1];
    let gk = defending.startingXI[0];

    let roll = Math.random() * (attacker.rating / 100);

    if (roll > 0.64) {
      attacking.score++;
      recordStat('goals', attacker.name);
      if (attacker.id !== assister.id) recordStat('assists', assister.name);
      
      updateScoreDisplay();
      addLog(min, ` GOAL! ${attacker.name} strikes for ${attacking.name}! (Assist: ${assister.name})`, 'goal');
    } else if (roll > 0.42) {
      recordStat('saves', gk.name);
      addLog(min, ` SAVE! ${gk.name} (${defending.name}) denies a shot from ${attacker.name}.`, 'save');
    }
  }

  // Dynamic Injuries & Substitutions
  [homeState, awayState].forEach(team => {
    if (Math.random() < 0.009 && team.subsLeft > 0 && team.bench.length > 0) {
      let subOutIdx = Math.floor(Math.random() * 10) + 1;
      let subOut = team.startingXI[subOutIdx];
      let subIn = team.bench.pop();

      team.startingXI[subOutIdx] = subIn;
      team.subsLeft--;

      let isInjury = Math.random() < 0.25;
      if (isInjury) {
        addLog(min, ` INJURY: ${subOut.name} is injured and replaced by ${subIn.name} (${team.name}).`, 'injury');
      } else {
        addLog(min, ` SUB: ${subIn.name} comes on for ${subOut.name} (${team.name}).`, 'sub');
      }
      
      // Update Tactical board live
      renderBoard(team === homeState ? 'home-tactics' : 'away-tactics', team);
    }
  });
}

function updateScoreDisplay() {
  document.getElementById('score-display').innerText = `${homeState.score} - ${awayState.score}`;
}

function addLog(min, text, type = '') {
  const feed = document.getElementById('match-feed');
  const div = document.createElement('div');
  div.className = `feed-item ${type}`;
  div.innerText = `[${min}'] ${text}`;
  feed.prepend(div);
}

function recordStat(cat, name) {
  leaderboards[cat][name] = (leaderboards[cat][name] || 0) + 1;
  updateLeaderboards();
}

function finalizeMatchStats() {
  if (homeState.score === 0) recordStat('cleanSheets', awayState.startingXI[0].name);
  if (awayState.score === 0) recordStat('cleanSheets', homeState.startingXI[0].name);
}

function updateLeaderboards() {
  ['goals', 'assists', 'saves'].forEach(cat => {
    const list = document.getElementById(`board-${cat}`);
    list.innerHTML = '';
    let sorted = Object.entries(leaderboards[cat]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sorted.forEach(([name, val]) => {
      list.innerHTML += `<tr><td>${name}</td><td><strong>${val}</strong></td></tr>`;
    });
  });
}

function resetMatchData() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-start').style.opacity = '1';
  document.getElementById('match-clock').innerText = "00'";
  document.getElementById('score-display').innerText = '0 - 0';
  document.getElementById('match-feed').innerHTML = '';
  document.getElementById('status-badge').innerText = 'Ready for Kickoff';

  renderTacticalBoards();
}

window.onload = init;
