/*@CHUNK:c0062:START*/

/*@CHUNK:c0062:END*/

/*@CHUNK:c0063:START*/
  function populateTeamSelects() {
    const home = document.getElementById('home-team');
    const away = document.getElementById('away-team');
    if (!home || !away) return;
    home.innerHTML = ''; away.innerHTML = '';
    const groups = [
      { label: 'National Teams', teams: teamsData.national || [] },
      { label: 'Club Teams', teams: teamsData.club || [] }
    ];
    groups.forEach(g => {
      if (!g.teams.length) return;
      const og1 = document.createElement('optgroup'); og1.label = g.label;
      const og2 = document.createElement('optgroup'); og2.label = g.label;
      g.teams.forEach(t => {
        og1.appendChild(new Option((t.flag || '') + ' ' + t.name, t.id));
        og2.appendChild(new Option((t.flag || '') + ' ' + t.name, t.id));
      });
      home.appendChild(og1); away.appendChild(og2);
    });
    if ((teamsData.national || []).length > 1) {
      home.value = teamsData.national[0].id;
      away.value = teamsData.national[1].id;
    } else if (allTeams.length > 1) {
      home.value = allTeams[0].id;
      away.value = allTeams[1].id;
    }
    updateTeamPreview('home');
    updateTeamPreview('away');
  }
/*@CHUNK:c0063:END*/

/*@CHUNK:c0064:START*/

/*@CHUNK:c0064:END*/

/*@CHUNK:c0065:START*/
  function populateFormations() {
    ['home-formation', 'away-formation'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      Object.keys(FORMATIONS).forEach(k => sel.appendChild(new Option(FORMATIONS[k].name, k)));
      sel.value = '4-3-3';
    });
  }
/*@CHUNK:c0065:END*/

/*@CHUNK:c0066:START*/

/*@CHUNK:c0066:END*/

/*@CHUNK:c0067:START*/
  function getTeam(id) { return allTeams.find(t => t.id === id); }

/*@CHUNK:c0067:END*/

/*@CHUNK:c0068:START*/
  // Every match is played at the home team's stadium. Falls back to Wembley
  // Stadium whenever a team in teams.json doesn't define its own "stadium".
/*@CHUNK:c0068:END*/

/*@CHUNK:c0069:START*/
  function getStadium(team) { return (team && team.stadium) ? team.stadium : 'Wembley Stadium'; }

/*@CHUNK:c0069:END*/
