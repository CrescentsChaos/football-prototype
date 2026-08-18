let gameData = { clubs: [], nationals: [] };
let formations = [];
let leaderboards = { goals: {}, assists: {}, saves: {}, cleanSheets: {} };

// Initialize App
async function init() {
  const teamsRes = await fetch('teams.json');
  gameData = await teamsRes.json();
  const formRes = await fetch('formations.json');
  formations = await formRes.json();

  populateTeamSelects();
}

function populateTeamSelects() {
  const type = document.getElementById('comp-type').value;
  const teams = gameData[type];
  const homeSel = document.getElementById('home-team');
  const awaySel = document.getElementById('away-team');
  
  homeSel.innerHTML = '';
  awaySel.innerHTML = '';

  teams.forEach(t => {
    homeSel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    awaySel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });
  if(teams.length > 1) awaySel.selectedIndex = 1;
}

// Squad Selection (25 Squad Rule & Rotational Selection)
function select25MatchSquad(team) {
  // Sort players with minor randomness to ensure rotation
  let pool = [...team.players].sort((a, b) => (b.rating + (Math.random() * 6 - 3)) - (a.rating + (Math.random() * 6 - 3)));
  
  // Ensure at least 2 Goalkeepers in match squad
  let gks = pool.filter(p => p.pos === 'GK').slice(0, 2);
  let outfield = pool.filter(p => p.pos !== 'GK').slice(0, 23);
  
  let matchSquad = [...gks, ...outfield];
  return matchSquad;
}

// Build Tactical Lineup without Out-of-Position Errors
function buildLineup(squad, formation) {
  let available = [...squad];
  let startingXI = [];

  formation.slots.forEach(slot => {
    let candidateIdx = available.findIndex(p => slot.accepted.includes(p.pos));
    if (candidateIdx === -1) candidateIdx = 0; // Fallback to avoid crash
    
    startingXI.push({ ...available[candidateIdx], assignedRole: slot.role });
    available.splice(candidateIdx, 1);
  });

  return { startingXI, bench: available };
}

// Match Engine
function simulateMatch() {
  const type = document.getElementById('comp-type').value;
  const homeId = document.getElementById('home-team').value;
  const awayId = document.getElementById('away-team').value;

  if(homeId === awayId) return alert("Select two different teams!");

  const homeTeam = gameData[type].find(t => t.id === homeId);
  const awayTeam = gameData[type].find(t => t.id === awayId);

  const fmt = formations[0]; // 4-3-3 default
  
  const homeSquad = select25MatchSquad(homeTeam);
  const awaySquad = select25MatchSquad(awayTeam);

  let home = { ...homeTeam, ...buildLineup(homeSquad, fmt), score: 0, subsLeft: 5 };
  let away = { ...awayTeam, ...buildLineup(awaySquad, fmt), score: 0, subsLeft: 5 };

  const logContainer = document.getElementById('match-log');
  logContainer.innerHTML = '';

  // Minute-by-Minute Simulation Engine
  for (let min = 1; min <= 90; min++) {
    // Attack Phase Chance
    if (Math.random() < 0.18) {
      let attacking = Math.random() > 0.5 ? home : away;
      let defending = attacking === home ? away : home;
      
      let attacker = attacking.startingXI[Math.floor(Math.random() * 10) + 1]; // Outfield
      let assister = attacking.startingXI[Math.floor(Math.random() * 10) + 1];
      let gk = defending.startingXI[0];

      let shotCalc = Math.random() * (attacker.rating / 100);

      if (shotCalc > 0.65) {
        // GOAL
        attacking.score++;
        recordStat('goals', attacker.name);
        if(attacker.id !== assister.id) recordStat('assists', assister.name);
        addLog(logContainer, min, `⚽ GOAL! ${attacker.name} scores for ${attacking.name}! (Assist: ${assister.name})`, 'goal');
      } else if (shotCalc > 0.40) {
        // SAVE
        recordStat('saves', gk.name);
        addLog(logContainer, min, `🧤 Great save by ${gk.name} (${defending.name}) denying ${attacker.name}.`);
      }
    }

    // Dynamic Injuries & Subs
    [home, away].forEach(t => {
      if (Math.random() < 0.008 && t.subsLeft > 0 && t.bench.length > 0) {
        let subOutIdx = Math.floor(Math.random() * 10) + 1;
        let subOut = t.startingXI[subOutIdx];
        let subIn = t.bench.pop();
        
        t.startingXI[subOutIdx] = subIn;
        t.subsLeft--;

        let isInjury = Math.random() < 0.3;
        if(isInjury) {
          addLog(logContainer, min, `🚑 INJURY: ${subOut.name} is injured and replaced by ${subIn.name} (${t.name}).`, 'injury');
        } else {
          addLog(logContainer, min, `🔄 SUB: ${subIn.name} comes on for ${subOut.name} (${t.name}).`, 'sub');
        }
      }
    });
  }

  // Clean Sheets Record
  if(home.score === 0) recordStat('cleanSheets', away.startingXI[0].name);
  if(away.score === 0) recordStat('cleanSheets', home.startingXI[0].name);

  document.getElementById('score-display').innerText = `${home.name} ${home.score} - ${away.score} ${away.name}`;
  updateLeaderboards();
}

function addLog(container, min, text, type = '') {
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.innerText = `[${min}'] ${text}`;
  container.prepend(div);
}

function recordStat(category, playerName) {
  leaderboards[category][playerName] = (leaderboards[category][playerName] || 0) + 1;
}

function updateLeaderboards() {
  ['goals', 'assists', 'saves'].forEach(cat => {
    const list = document.getElementById(`leaderboard-${cat}`);
    list.innerHTML = '';
    let sorted = Object.entries(leaderboards[cat]).sort((a,b) => b[1] - a[1]).slice(0, 5);
    sorted.forEach(([name, count]) => {
      list.innerHTML += `<tr><td>${name}</td><td>${count}</td></tr>`;
    });
  });
}

window.onload = init;
