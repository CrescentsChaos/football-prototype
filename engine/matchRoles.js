/*@CHUNK:cmr01:START*/

  // ===================================================================
  // ======================== PRE-MATCH ROLES ===========================
  // ===================================================================
  // Assigns real, named players to key match/set-piece duties before
  // kickoff — captain, short/long free-kick takers, penalty taker, left/
  // right corner takers, and the trio of aerial targets sent forward for
  // the team's own corners. Computed once per side (from the starting XI)
  // right after squads are built, using the same expanded-attribute sheet
  // (xattr/hasSkill) every other gameplay hook reads from — every formula
  // below defaults to a neutral rating when a squad has no expanded data,
  // so nothing breaks for a non-enhanced team. Consumed by
  // resolveFreeKickRoutine(), resolveCorner(), the in-game/shootout
  // penalty pickers, and the pre-match lineup display, so the same named
  // player shows up on screen and actually gets sent to take the kick
  // instead of a fresh random pick every time.
/*@CHUNK:cmr01:END*/

/*@CHUNK:cmr02:START*/
  function _roleWeighted(p, weights) {
    if (!p) return -Infinity;
    let score = 0;
    for (const key in weights) score += xattr(p, key, 65) * weights[key];
    return score;
  }

  function _roleSkillBonus(p, skills, amount) {
    if (!p) return 0;
    amount = amount || 5;
    return skills.reduce((sum, s) => sum + (hasSkill(p, s) ? amount : 0), 0);
  }

  function _roleHeightScore(p) {
    const cm = (p && p.expandedAttrs && typeof p.expandedAttrs.height_cm === 'number') ? p.expandedAttrs.height_cm : 178;
    return Math.max(0, Math.min(100, (cm - 165) * 2.2));
  }

  function _roleFoot(p) {
    return (p && p.expandedAttrs && p.expandedAttrs.preferred_foot) || 'Right';
  }

  function _bestForRole(pool, scoreFn, excludeIds) {
    let best = null, bestScore = -Infinity;
    (pool || []).forEach((p) => {
      if (excludeIds && excludeIds.has(p.id)) return;
      const s = scoreFn(p);
      if (s > bestScore) { bestScore = s; best = p; }
    });
    return best;
  }

  // Shared attribute-weight/skill-bonus tables — the single source of
  // truth for both the auto-pick scoring below AND roleFitRating() (the
  // "how good is this player at this role" number shown per-player in the
  // Squad Builder's Match Roles panel), so the two never drift apart.
  // Captain isn't included here since its scoring isn't an attribute
  // blend (see roleFitRating's special case for it).
  const ROLE_ATTR_WEIGHTS = {
    shortFreeKick: { place_kick: 1.0, curl: 0.55, kick_pwr: 0.3, fin: 0.15, 'weak foot': 0.15 },
    longFreeKick: { place_kick: 1.0, curl: 0.55, kick_pwr: 0.55, lofted_pass: 0.3, 'weak foot': 0.15 },
    penalty: { place_kick: 1.0, fin: 0.5, kick_pwr: 0.35, curl: 0.2, 'weak foot': 0.15 },
    leftCorner: { place_kick: 1.0, curl: 0.55, lofted_pass: 0.4, kick_pwr: 0.2, 'weak foot': 0.15 },
    rightCorner: { place_kick: 1.0, curl: 0.55, lofted_pass: 0.4, kick_pwr: 0.2, 'weak foot': 0.15 },
    cornerAtk1: { head: 1.0, jmp: 0.7, phy_con: 0.6, off_awr: 0.35, fin: 0.25 },
    cornerAtk2: { head: 1.0, jmp: 0.7, phy_con: 0.6, off_awr: 0.35, fin: 0.25 },
    cornerAtk3: { head: 1.0, jmp: 0.7, phy_con: 0.6, off_awr: 0.35, fin: 0.25 }
  };
  const ROLE_SKILL_BONUSES = {
    shortFreeKick: ['Knuckle Shot', 'Dipping Shot', 'Chip Shot Control', 'First-time Shot'],
    longFreeKick: ['Long-range Curler', 'Blitz Curler', 'Long Range Shooting', 'Outside Curler'],
    penalty: ['Penalty Specialist'],
    leftCorner: ['Pinpoint Crossing', 'Edged Crossing'],
    rightCorner: ['Pinpoint Crossing', 'Edged Crossing'],
    cornerAtk1: ['Heading', 'Bullet Header', 'Aerial Superiority', 'Aerial Fort'],
    cornerAtk2: ['Heading', 'Bullet Header', 'Aerial Superiority', 'Aerial Fort'],
    cornerAtk3: ['Heading', 'Bullet Header', 'Aerial Superiority', 'Aerial Fort']
  };

  // "How good is this player at this role" — a single 1-99, FIFA-card-style
  // number combining the same attribute weights the auto-picker uses
  // (as a weighted average, so it stays on a familiar 0-100-ish scale
  // regardless of how many attributes feed a given role) with a small
  // flat bump for any of that role's bonus skills. Used purely for
  // display in the Squad Builder — assignMatchRoles()'s own scoring
  // above is unaffected by this normalization.
  function roleFitRating(p, roleKey) {
    if (!p) return null;
    if (roleKey === 'captain') {
      let score = Math.round(p.ovr || 70);
      if (hasSkill(p, 'Captaincy')) score = Math.min(99, score + 8);
      return Math.max(1, Math.min(99, score));
    }
    const weights = ROLE_ATTR_WEIGHTS[roleKey];
    if (!weights) return null;
    let sum = 0, wsum = 0;
    for (const key in weights) { sum += xattr(p, key, 65) * weights[key]; wsum += weights[key]; }
    const base = wsum ? sum / wsum : 0;
    const skills = ROLE_SKILL_BONUSES[roleKey] || [];
    const bonus = skills.reduce((s, sk) => s + (hasSkill(p, sk) ? 3 : 0), 0);
    return Math.max(1, Math.min(99, Math.round(base + bonus)));
  }

  // Computes and returns the full role set for one side (m.home / m.away)
  // straight from its starting XI. Called once per side at match start —
  // never mutates anything on the players themselves.
  function assignMatchRoles(side) {
    const squad = side && side.squad;
    const starting = (squad && squad.starting) || [];
    if (!starting.length) return null;
    const outfield = starting.filter((p) => (p.pos || [])[0] !== 'GK');
    const pool = outfield.length ? outfield : starting;

    // Manual overrides — set from the Squad Builder's Match Roles panel
    // (see sbSetRole()/saveSquadBuilder() in ui/teamUI.js) and carried on
    // squad.manualRoles as { roleKey: playerId }. Any role left unset (or
    // pointing at a player who isn't actually in the starting XI) simply
    // falls through to the same auto-pick logic as before. Corner-box
    // attackers are always auto-picked — there's no manual override for
    // those.
    // Team-level default roles — set from the Transfer Tool (team.roles,
    // e.g. { captain: playerId, shortFreeKick: playerId, ... }) and
    // persisted straight into teams.json. These act as a base default;
    // a per-squad manual override (squad.manualRoles, set from the Squad
    // Builder's Match Roles panel for this specific lineup) always wins
    // when both are set for the same role.
    const teamDefaults = (side && side.team && side.team.roles) || {};
    const manual = Object.assign({}, teamDefaults, (squad && squad.manualRoles) || {});
    const manualPick = (key) => {
      const id = manual[key];
      if (!id) return null;
      return starting.find((p) => p.id === id) || null;
    };

    // Captain — Captaincy is the deciding factor; overall ability is only
    // a tiebreaker when nobody (or several players) carry the trait.
    const captain = manualPick('captain')
      || _bestForRole(starting, (p) => (hasSkill(p, 'Captaincy') ? 500 : 0) + (p.ovr || 70));

    // Short Free Kick — closer-range direct effort: Set Piece Taking
    // leads, Curl/Kicking Power support it, Finishing and weak-foot
    // reliability round it out.
    const shortFreeKick = manualPick('shortFreeKick') || _bestForRole(pool, (p) =>
      _roleWeighted(p, ROLE_ATTR_WEIGHTS.shortFreeKick) + _roleSkillBonus(p, ROLE_SKILL_BONUSES.shortFreeKick, 4));

    // Long Free Kick — same base skill, but Kicking Power and Lofted Pass
    // matter more as the distance to goal grows.
    const longFreeKick = manualPick('longFreeKick') || _bestForRole(pool, (p) =>
      _roleWeighted(p, ROLE_ATTR_WEIGHTS.longFreeKick) + _roleSkillBonus(p, ROLE_SKILL_BONUSES.longFreeKick, 4));

    // Penalty — Set Piece Taking and Finishing lead, Kicking Power and
    // Curl help with placement, Penalty Specialist is a big flat edge.
    const penalty = manualPick('penalty') || _bestForRole(pool, (p) =>
      _roleWeighted(p, ROLE_ATTR_WEIGHTS.penalty)
      + _roleSkillBonus(p, ROLE_SKILL_BONUSES.penalty, 10)
      + _roleSkillBonus(p, ['Chip Shot Control'], 3)) || captain;

    // Corners — Set Piece Taking, Curl and Lofted Pass drive delivery
    // quality; foot preference nudges toward the swing each side naturally
    // produces (a right-footer for an in-swinging left corner, and a
    // left-footer for an in-swinging right corner).
    const cornerBase = (p) => _roleWeighted(p, ROLE_ATTR_WEIGHTS.leftCorner) + _roleSkillBonus(p, ROLE_SKILL_BONUSES.leftCorner, 4);
    const leftCorner = manualPick('leftCorner') || _bestForRole(pool, (p) => cornerBase(p) + (_roleFoot(p) === 'Right' ? 4 : -1));
    const rightCorner = manualPick('rightCorner') || _bestForRole(pool, (p) => cornerBase(p) + (_roleFoot(p) === 'Left' ? 4 : -1));

    // 3 corner-box attackers — the aerial targets pushed forward for the
    // team's own corners: Heading, Jump and Physical Contact lead, Height
    // and Offensive Awareness support, Finishing rounds it out since
    // these are usually the ones getting the actual shot. Each of the
    // three slots (cornerAtk1/2/3) can be manually assigned from the
    // Squad Builder same as any other role — a manual pick fills that
    // slot outright, and any slots left on auto are filled by the best
    // remaining eligible player, highest score first.
    const attackerScore = (p) => _roleWeighted(p, ROLE_ATTR_WEIGHTS.cornerAtk1)
      + _roleHeightScore(p) * 0.15
      + _roleSkillBonus(p, ROLE_SKILL_BONUSES.cornerAtk1, 5);
    const cornerAttackers = [null, null, null];
    const usedIds = new Set();
    ['cornerAtk1', 'cornerAtk2', 'cornerAtk3'].forEach((key, i) => {
      const mp = manualPick(key);
      if (mp && !usedIds.has(mp.id)) { cornerAttackers[i] = mp; usedIds.add(mp.id); }
    });
    for (let i = 0; i < 3; i++) {
      if (cornerAttackers[i]) continue;
      const pick = _bestForRole(pool, attackerScore, usedIds);
      if (!pick) continue;
      cornerAttackers[i] = pick;
      usedIds.add(pick.id);
    }
    const cornerAttackersFinal = cornerAttackers.filter(Boolean);

    return { captain, shortFreeKick, longFreeKick, penalty, leftCorner, rightCorner, cornerAttackers: cornerAttackersFinal };
  }
/*@CHUNK:cmr02:END*/

/*@CHUNK:cmr03:START*/
  // Shared badge builder — given an already-resolved roles object (the
  // shape assignMatchRoles() returns: captain/penalty/shortFreeKick/
  // longFreeKick/leftCorner/rightCorner/cornerAttackers) and a player id,
  // returns the same captain-armband + set-piece-duty icon markup
  // regardless of where those roles came from. iconClass lets callers
  // pick the badge's positioning style: '.li-icon' (inline, for list
  // rows) or '.sb-role-ic' (absolute-positioned corner badge, for pitch
  // dots — see .sb-role-ic in styles.css).
  function roleBadgesForIds(roles, playerId, iconClass) {
    if (!roles || !playerId) return '';
    const cls = iconClass || 'li-icon';
    let out = '';
    if (roles.captain && roles.captain.id === playerId) out += `<span class="captain-armband" title="Captain">${emojiImg('captain', 'Captain')}</span>`;
    if (roles.penalty && roles.penalty.id === playerId) out += `<span class="${cls}" title="Penalty taker">${emojiImg('penalty_goal', 'Penalty taker')}</span>`;
    const isFk = (roles.shortFreeKick && roles.shortFreeKick.id === playerId) || (roles.longFreeKick && roles.longFreeKick.id === playerId);
    if (isFk) out += `<span class="${cls}" title="Free-kick taker">${emojiImg('freekick', 'Free-kick taker')}</span>`;
    const isLeftCk = roles.leftCorner && roles.leftCorner.id === playerId;
    const isRightCk = roles.rightCorner && roles.rightCorner.id === playerId;
    if (isLeftCk) out += `<span class="${cls}" title="Left corner taker">${emojiImg('left_corner', 'Left corner taker')}</span>`;
    if (isRightCk) out += `<span class="${cls}" title="Right corner taker">${emojiImg('right_corner', 'Right corner taker')}</span>`;
    const isCa = (roles.cornerAttackers || []).some((cp) => cp && cp.id === playerId);
    if (isCa) out += `<span class="${cls}" title="Corner-box attacker">${emojiImg('corner_attacker', 'Corner-box attacker')}</span>`;
    return out;
  }

  // Small HTML badges for the lineup list — captain armband plus icons for
  // whichever set-piece duties this player has been assigned for their
  // side. Purely cosmetic/read-only; safe to call for any player on the
  // sheet, starter or sub.
  function roleBadgesHTML(p, side) {
    const m = currentMatch;
    const roles = m && m[side] && m[side].roles;
    if (!roles || !p) return '';
    return roleBadgesForIds(roles, p.id, 'li-icon');
  }

  // Same badges, but for a squad that isn't part of an in-progress match —
  // takes a roles object computed on demand (assignMatchRoles() fed a
  // lightweight fake "side", same pattern as sbEffectiveRoles() in
  // ui/teamUI.js) instead of reading currentMatch. Used by the Teams tab
  // lineup viewer (renderTeamLineupPitchHTML()) so its pitch dots carry
  // the same role icons as the Squad Builder's formation editor and an
  // actual kickoff, without needing a live match to source them from.
  function roleBadgesForPreview(roles, playerId) {
    return roleBadgesForIds(roles, playerId, 'sb-role-ic');
  }

  // Shared "who's actually the team's dedicated aerial outlet" check —
  // meant to be used everywhere a cross, free-kick delivery, long throw,
  // or long goal-kick punt has to decide who it's most likely to find in
  // the box. Previously only resolveCorner() (engine/shooting.js) applied
  // a boost like this; every other delivery type weighted purely on raw
  // aerial attributes, so a strong CF could out-weigh the team's actual
  // designated targets on, say, a free-kick delivery or a long throw,
  // even though those are the same players tactically pushed forward and
  // stationed in the box for exactly this kind of ball. Same 1.35x
  // resolveCorner already used — not a guarantee (any delivery into a
  // crowded box is still a scramble), just a meaningful nudge toward
  // whoever's actually posted there instead of whoever merely has the
  // highest heading stat on the sheet.
  function aerialTargetBoost(team, playerId) {
    const targets = (team && team.roles && team.roles.cornerAttackers) || [];
    return targets.some((p) => p && p.id === playerId) ? 1.35 : 1;
  }
/*@CHUNK:cmr03:END*/
