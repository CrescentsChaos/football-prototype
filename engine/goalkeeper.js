/*@CHUNK:c0037:START*/
  // GK shot-stopping edge beyond the generic def/ovr/tec blend.
/*@CHUNK:c0037:END*/

/*@CHUNK:c0038:START*/
  function gkReflexEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    let edge = ((xattr(gk, 'gk_reflex', 75) - 75) / 100) * 0.5;
    if (hasSkill(gk, 'Acrobatic Clearance')) edge += 0.05;
    return edge;
  }
/*@CHUNK:c0038:END*/

/*@CHUNK:c0041:START*/
  function penGkEdge(gk) {
    if (!gk || !gk.expandedAttrs) return 0;
    let edge = ((xattr(gk, 'gk_awr', 75) - 75) / 100) * 0.15;
    if (hasSkill(gk, 'GK Penalty Saver')) edge += 0.10;
    return edge;
  }
/*@CHUNK:c0041:END*/

/*@CHUNK:c0175:START*/

/*@CHUNK:c0175:END*/

/*@CHUNK:c0176:START*/
  function sofascoreSave(gk, shooter, team, defTeam) {
    const foot = seededRandom() < 0.55 ? 'right footed' : 'left footed';
    const lines = [
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') ' + foot + ' shot from the centre of the box is saved in the centre of the goal by <span class="player">' + gk.name + '</span> (' + (defTeam.short||'') + ').',
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') ' + foot + ' shot from outside the box is saved in the bottom left corner by <span class="player">' + gk.name + '</span>.',
      'Attempt saved. <span class="player">' + shooter.name + '</span> (' + (team.short||'') + ') header from the centre of the box is saved in the top centre of the goal by <span class="player">' + gk.name + '</span>.',
      '<span class="player">' + gk.name + '</span> (' + (defTeam.short||'') + ') saves a ' + foot + ' shot from <span class="player">' + shooter.name + '</span> at full stretch.'
    ];
    return lines[Math.floor(seededRandom() * lines.length)];
  }
/*@CHUNK:c0176:END*/

/*@CHUNK:c0177:START*/


/*@CHUNK:c0177:END*/

/*@CHUNK:c0178:START*/
  function pickSaveDesc(gk, shooter) {
    const list = [
      `strong hands from <span class="player">${gk.name}</span> to push away a fierce drive`,
      `<span class="player">${gk.name}</span> dives full length to tip a curler around the post`,
      `reflex save — <span class="player">${gk.name}</span> blocks from point-blank range`,
      `<span class="player">${gk.name}</span> gets down quickly to hold a low shot`,
      `spectacular tip over from <span class="player">${gk.name}</span> as a rising shot threatens the top corner`,
      `<span class="player">${gk.name}</span> parries a knuckleball, then gathers at the second attempt`,
      `brave claim by <span class="player">${gk.name}</span> under pressure from the striker`
    ];
    return list[Math.floor(seededRandom() * list.length)];
  }
/*@CHUNK:c0178:END*/
