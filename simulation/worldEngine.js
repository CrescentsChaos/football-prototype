/*@CHUNK:c0360:START*/

/*@CHUNK:c0360:END*/

/*@CHUNK:c0361:START*/
  function startWorldCupTournament(selected) {
    let teams = shuffleArray([...selected]);
    const groupSize = 4;
    let numGroups = Math.floor(teams.length / groupSize);
    if (numGroups < 1) numGroups = 1;
    if (numGroups > 12) numGroups = 12;
    teams = teams.slice(0, numGroups * groupSize);
    if (teams.length < 4) { toast('Need at least 4 teams for groups'); return; }
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        name: String.fromCharCode(65 + i),
        teams: teams.slice(i * groupSize, (i + 1) * groupSize).map(t => ({
          team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
        }))
      });
    }
    tournament = { type: 'worldcup', format: 'groups', groups, knockout: [], stage: 'groups', fixtures: [], champion: null, playoff: [] };
    generateGroupFixtures();
    renderGroups();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Group Stage';
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<p style="color:var(--text-muted)">Knockout bracket appears after groups.</p>';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Round';
  }
/*@CHUNK:c0361:END*/
