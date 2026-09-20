/*@CHUNK:c0093:START*/

/*@CHUNK:c0093:END*/

/*@CHUNK:c0094:START*/
  function updateTeamPreview(side) {
    const sel = document.getElementById(side + '-team');
    const el = document.getElementById(side + '-preview');
    if (!sel || !el) return;
    const team = getTeam(sel.value);
    if (!team) { el.innerHTML = ''; return; }
    const mgr = team.manager ? team.manager.name : '';
    const style = getManagerPlaystyle(team);
    const venueLine = side === 'home' ? `<div style="font-size:0.8rem;color:var(--text-muted)">🏟️ ${getStadium(team)}</div>` : '';
    const mgrLine = mgr ? `<div class="manager-name">${managerAvatarMark(team.manager, 20)} Manager: ${mgr}${style ? ' <span class="playstyle-tag">· ' + style + '</span>' : ''}</div>` : '';
    el.innerHTML = `<span class="team-flag">${teamMark(team, 32)}</span><div><div class="team-name">${team.name}</div>${mgrLine}<div style="font-size:0.8rem;color:var(--text-muted)">${(team.players||[]).length} players</div>${venueLine}</div>`;
    const formSel = document.getElementById(side + '-formation');
    if (formSel) {
      // If this side has a saved custom lineup for the currently-selected
      // team, keep the visible formation dropdown in sync with *that*
      // lineup's formation rather than overwriting it with the team's
      // computed default — otherwise the dropdown (which startMatch()
      // reads to decide whether the custom lineup still applies) silently
      // drifts away from what was actually saved in the Squad Builder,
      // and the custom lineup gets discarded at kickoff even though it
      // saved successfully.
      const custom = customLineups[side];
      formSel.value = (custom && custom._teamId === team.id) ? custom.formation : pickTeamFormation(team);
    }
  }
/*@CHUNK:c0094:END*/

/*@CHUNK:c0097:START*/

/*@CHUNK:c0097:END*/

/*@CHUNK:c0098:START*/
  // How hard the "recently started" rotation penalty bites, and how
  // protected a squad's core spine is from it, depending on the
  // competition. League football sees the heaviest week-to-week rotation
  // (fixture congestion managed domestically); "group tournament" football
  // (Champions League league phase, World Cup/standalone tournament groups
  // and knockouts) sees managers overwhelmingly send out their strongest
  // XI; a domestic cup (once available) would see the heaviest rotation of
  // all, giving fringe players and squad depth their minutes first.
  const ROTATION_PROFILES = {
    league: { decay: 0.2,  penalty: 3.5, rand: 2.5, coreProtect: 0.55 },
    ucl:    { decay: 0.35, penalty: 1.0, rand: 1.0, coreProtect: 0.9 },
    cup:    { decay: 0.15, penalty: 5.5, rand: 3.5, coreProtect: 0.15 }
  };

  // Infers which rotation profile applies to whatever match is about to be
  // built, from the global sim context, so most call sites don't need to
  // know or pass it explicitly. A standalone tournament (World Cup /
  // Champions League tournament mode) is always "group tournament"
  // football; inside a Season, only the Champions League competition
  // counts as one — every domestic league fixture rotates on the heavier
  // "league" profile.
  function inferRotationProfile() {
    if (typeof tournament !== 'undefined' && tournament) return 'ucl';
    if (typeof currentSeasonComp !== 'undefined' && currentSeasonComp && currentSeasonComp.key === 'ucl') return 'ucl';
    return 'league';
  }

  // The tactical "core" of a squad — the first-choice keeper plus the
  // highest-OVR outfield players, a rough proxy for the spine a manager
  // builds their team around (first-choice centre-back pairing, defensive
  // mid, main striker, etc). Core players are much less affected by the
  // rotation penalty below regardless of competition, and are almost never
  // rotated out for important "group tournament" fixtures.
  function computeCoreIds(allPlayers) {
    const core = new Set();
    const gks = allPlayers.filter(p => (p.pos || [])[0] === 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    if (gks[0]) core.add(gks[0].id);
    const outfield = allPlayers.filter(p => (p.pos || [])[0] !== 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    outfield.slice(0, 6).forEach(p => core.add(p.id));
    return core;
  }

  function buildSquad(team, formationKey, rotationProfile) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const allPlayers = team.players || [];
    const prof = ROTATION_PROFILES[rotationProfile || inferRotationProfile()] || ROTATION_PROFILES.league;
    const coreIds = computeCoreIds(allPlayers);

    // Soft squad rotation: every player carries a small "recently started"
    // counter that decays a bit each match. Selection score below docks
    // players who've started often lately, so the exact same XI doesn't
    // take the pitch match after match — while still keeping OVR as the
    // dominant factor, so rotation favors genuinely close alternatives
    // rather than randomly benching your best player. How hard that bites,
    // and how protected the squad's core is from it, depends on the
    // competition (see ROTATION_PROFILES above).
    allPlayers.forEach(p => { p._recentStarts = Math.max(0, (p._recentStarts || 0) - prof.decay); });
    // Current run of form (engine/form.js liveRating) also weighs on
    // selection, not just rotation/OVR — a player who's genuinely out of
    // form is a weaker pick than his raw OVR alone suggests, so a manager
    // leans toward a same-position alternative who's in better form when
    // one is actually available. This is a soft nudge, not a hard bench:
    // it only tips a genuinely close call, so a clearly-superior player
    // in poor form still starts over a much weaker one in great form.
    const FORM_SELECTION_PENALTY = { A: 0, B: 0, C: 0.5, D: 2.5, E: 5.5 };
    // A genuinely elite player (high OVR) shouldn't be able to spiral out of
    // the XI just because a rough scoring/rating patch dropped his liveRating
    // — real managers keep playing a world-class player through a slump far
    // more readily than a squad player. This scales the flat form penalty
    // down the higher a player's OVR is, so a 90+ OVR player barely feels a
    // bad-form dip while an average player still gets rotated for one
    // normally. Purely a selection-time nudge — doesn't touch liveRating,
    // in-match ability, or anything else.
    const eliteFormProtect = (ovr) => ovr >= 90 ? 0.4 : ovr >= 85 ? 0.65 : ovr >= 80 ? 0.85 : 1;
    const score = (p) => {
      const protect = coreIds.has(p.id) ? prof.coreProtect : 1;
      if (typeof ensurePlayerConditionProfile === 'function') ensurePlayerConditionProfile(p);
      const formPenalty = (FORM_SELECTION_PENALTY[p.liveRating] || 0) * eliteFormProtect(p.ovr || 70);
      return (p.ovr || 70) - (p._recentStarts || 0) * prof.penalty * protect - formPenalty + (seededRandom() * prof.rand - prof.rand / 2);
    };

    let players = shuffleArray(allPlayers.filter(p => !isPlayerInjured(p.id) && !isPlayerSuspended(p.id)));
    if (players.length < 11) {
      // Emergency: allow injured/suspended if roster too thin
      players = players.concat(shuffleArray(allPlayers.filter(p => isPlayerInjured(p.id) || isPlayerSuspended(p.id))));
    }

    const used = new Set();
    const slotOf = new Map(); // slot index -> player

    // Pass 1 — a player's FIRST-listed position is their real position and
    // always gets first claim on a matching slot, ahead of anyone who's
    // merely compatible with it. This stops, e.g., a CB who's also listed
    // as RB-compatible from being slotted in at CB ahead of a natural RB
    // just because formation slots happen to be processed in that order.
    formation.slots.forEach((slot, i) => {
      const candidates = players.filter(p => !used.has(p.id) && (p.pos || [])[0] === slot)
        .sort((a, b) => score(b) - score(a));
      if (candidates.length) {
        used.add(candidates[0].id);
        slotOf.set(i, candidates[0]);
      }
    });

    // Pass 2 — only for slots still empty after pass 1 (this formation has
    // no natural fit available). Fill from compatible secondary positions,
    // preferring whoever's closest to a natural fit (lower index in their
    // own pos list) before falling back to plain selection score. A player
    // whose primary position never got a slot in pass 1, and who isn't
    // needed here either, simply stays unused — i.e., benched — rather
    // than being forced out of position to make up the numbers.
    formation.slots.forEach((slot, i) => {
      if (slotOf.has(i)) return;
      const candidates = players.filter(p => !used.has(p.id) && canPlay(p, slot))
        .sort((a, b) => {
          const aIdx = (a.pos || []).indexOf(slot);
          const bIdx = (b.pos || []).indexOf(slot);
          const aRank = aIdx === -1 ? 99 : aIdx;
          const bRank = bIdx === -1 ? 99 : bIdx;
          if (aRank !== bRank) return aRank - bRank;
          return score(b) - score(a);
        });
      if (candidates.length) {
        used.add(candidates[0].id);
        slotOf.set(i, candidates[0]);
      }
    });

    const starting = [];
    formation.slots.forEach((slot, i) => {
      const p = slotOf.get(i);
      if (p) starting.push({ ...p, slot, isStarter: true });
    });

    // Fallback fill if the squad is too thin to fill every slot even via
    // pass 2 — field whoever's left regardless of position, so we always
    // put out 11 players.
    while (starting.length < 11) {
      const leftover = players.find(p => !used.has(p.id));
      if (!leftover) break;
      used.add(leftover.id);
      starting.push({ ...leftover, slot: (leftover.pos || ['CM'])[0], isStarter: true });
    }

    const remaining = players.filter(p => !used.has(p.id)).sort((a, b) => score(b) - score(a));
    const subs = [];
    for (let i = 0; i < remaining.length && (starting.length + subs.length) < 25; i++) {
      subs.push({ ...remaining[i], slot: (remaining[i].pos || ['CM'])[0], isStarter: false });
    }

    // Whoever actually started is now less likely to start again straight
    // away next match (see rotation decay/score above).
    // Capped rather than left to accumulate freely: the decay above only
    // ever removes a flat prof.decay (0.15-0.35) per match, while this used
    // to add a full +1 every time a player started — for anyone who starts
    // most matches (which a genuine world-class player, by definition,
    // does) that's a net gain every match with no equilibrium, so
    // _recentStarts climbed without bound over a season/tournament run
    // (40+ after 200 matches in testing). Multiplied by prof.penalty, that
    // eventually buried even a 95+ OVR core player's score under a rotation
    // penalty far larger than any real ability gap, benching him more often
    // than not — exactly backwards from the "light nudge" this system is
    // meant to be. Capping at REC_STARTS_CAP lets the value settle at a
    // stable ceiling for an ever-present starter instead of growing
    // forever, while still fully preserving the differences between
    // ROTATION_PROFILES (a harsher profile's larger `penalty`/smaller
    // `coreProtect` still bites harder at the same capped counter value).
    const REC_STARTS_CAP = 3;
    starting.forEach(sp => {
      const orig = allPlayers.find(x => x.id === sp.id);
      if (orig) orig._recentStarts = Math.min(REC_STARTS_CAP, (orig._recentStarts || 0) + 1);
    });

    const _seen = new Set();
    const _st = [];
    for (const p of starting) { if (_seen.has(p.id)) continue; _seen.add(p.id); _st.push(p); }
    const _su = [];
    for (const p of subs) { if (_seen.has(p.id)) continue; _seen.add(p.id); _su.push(p); }
    return { starting: _st, subs: _su, formation: formationKey, all: [..._st, ..._su], rotationProfile: rotationProfile || inferRotationProfile() };
  }
/*@CHUNK:c0098:END*/

/*@CHUNK:c0099:START*/

/*@CHUNK:c0099:END*/

/*@CHUNK:c0100:START*/
  // A player is eligible for a slot only if that slot is genuinely one of
  // their own listed positions (already canonicalized by normalizePlayerPos
  // — see js/state.js — so naming variants like CMF/DMF/RWF are handled
  // there as true "alternate spelling of the same position" cases, not
  // here). This used to also consult POS_COMPAT, a table of tactically
  // *adjacent* but genuinely different positions (RB counted as
  // RWB/RM-compatible, CB counted as CDM-compatible, ST counted as
  // RW/LW-compatible, etc.) — which meant a player could be selected or
  // subbed into a real position they don't actually play (a pure
  // centre-back at CDM, a pure striker out on the wing) just because the
  // two positions were deemed "close enough". Positional eligibility
  // should come only from what the player's own data says he plays, not
  // from a general tactical-similarity table, so that table no longer
  // factors in here.
  function canPlay(player, slot) {
    const positions = player.pos || [];
    return positions.includes(slot);
  }
/*@CHUNK:c0100:END*/

/*@CHUNK:c0101:START*/

/*@CHUNK:c0101:END*/

/*@CHUNK:c0102:START*/
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
/*@CHUNK:c0102:END*/

/*@CHUNK:c0103:START*/

  // ===================================================================
  // ===================== SQUAD BUILDER (full page) =====================
  // ===================================================================
  // The Squad Builder is a dedicated full-page lineup/formation editor
  // (view-squadbuilder in index.html), opened per-side from the Match
  // Setup screen. sbDraft below is the in-progress editing state for
  // whichever side (home/away) is currently open; it is discarded on
  // close/save. customLineups[side] is the *saved* result — a squad
  // object (same shape buildSquad() returns) plus manualRoles/
  // customCoords — consumed by startMatch() in engine/matchEngine.js
  // exactly like an auto-built squad, so nothing downstream needs to
  // know a lineup was hand-built.
  let customLineups = { home: null, away: null };
  let sbSide = null;
  let sbDraft = null;
  // Active pointer-drag (player) / coordinate-drag (formation marker) —
  // module-level so the document-level pointermove/pointerup listeners
  // added in sbGrab()/sbCoordMove-family can find them.
  let sbDrag = null;
  let sbCoordDrag = null;
  let sbGhostEl = null;

/*@CHUNK:c0103:END*/

/*@CHUNK:c0104:START*/
  function onFormationChange(side) {
    if (customLineups[side]) customLineups[side] = null;
  }
/*@CHUNK:c0104:END*/

/*@CHUNK:c0105:START*/
  // Finds where a player currently sits in the in-progress draft — a
  // starting slot, the bench, or (implicitly) the reserves, since reserve
  // players aren't tracked in any set of their own; anyone not in slots
  // or bench simply *is* a reserve. Returns a small "location" object in
  // the same shape sbGrab()/sbPlacePlayer() pass around everywhere.
  function sbLocateInDraft(playerId) {
    for (const k in sbDraft.slots) {
      if (sbDraft.slots[k] === playerId) return { kind: 'slot', id: playerId, slotIdx: +k };
    }
    if (sbDraft.bench.has(playerId)) return { kind: 'bench', id: playerId };
    return { kind: 'reserve', id: playerId };
  }

  // The single move operation behind every interaction in the builder —
  // dragging, tapping-to-place, and the fallback slot picker all funnel
  // through here. Moving a player onto an occupied starting slot swaps
  // the two (the displaced starter lands wherever the incoming player
  // came from — their old slot, the bench, or the bench if they were a
  // reserve, since a starter can never be left with nowhere to go).
  // Moving onto the bench or into reserves just detaches them from
  // wherever they were.
  function sbPlacePlayer(source, destKind, destSlotIdx) {
    if (!sbDraft || !source || !source.id) return;
    if (destKind === 'slot' && source.kind === 'slot' && source.slotIdx === destSlotIdx) return;
    if (destKind === 'bench' && source.kind === 'bench') return;
    if (destKind === 'reserve' && source.kind === 'reserve') return;

    if (destKind === 'bench' && !sbDraft.bench.has(source.id) && sbDraft.bench.size >= 14) {
      toast('Max 14 substitutes');
      return;
    }

    // Detach the moving player from their current spot first.
    if (source.kind === 'slot') delete sbDraft.slots[source.slotIdx];
    if (source.kind === 'bench') sbDraft.bench.delete(source.id);

    if (destKind === 'slot') {
      const occupantId = sbDraft.slots[destSlotIdx];
      if (occupantId && occupantId !== source.id) {
        if (source.kind === 'slot') sbDraft.slots[source.slotIdx] = occupantId; // swap
        else sbDraft.bench.add(occupantId); // displaced starter goes to the bench
      }
      sbDraft.slots[destSlotIdx] = source.id;
      sbDraft.bench.delete(source.id);
    } else if (destKind === 'bench') {
      sbDraft.bench.add(source.id);
    }
    // destKind === 'reserve': already detached above, nothing further to do.
  }

  // One-tap alternatives to dragging a chip between the Substitutes and
  // Reserves lists — same underlying move as a drag/drop onto that zone,
  // just addressable directly from a button on the chip itself. No-ops
  // quietly (via sbPlacePlayer's own guards) if the player is already
  // where they're being asked to go, or the bench is already full.
  function sbMoveToReserve(playerId) {
    if (!sbDraft) return;
    const source = sbLocateInDraft(playerId);
    sbPlacePlayer(source, 'reserve');
    sbDraft.selected = null;
    renderSquadBuilderUI();
  }

  function sbMoveToBench(playerId) {
    if (!sbDraft) return;
    const source = sbLocateInDraft(playerId);
    sbPlacePlayer(source, 'bench');
    sbDraft.selected = null;
    renderSquadBuilderUI();
  }
/*@CHUNK:c0105:END*/

/*@CHUNK:c0106:START*/
  function openSquadBuilder(side) {
    try {
      sbSide = side;
      const teamSel = document.getElementById(side + '-team');
      const formSel = document.getElementById(side + '-formation');
      const teamId = teamSel && teamSel.value;
      const team = getTeam(teamId);
      if (!team) { toast('Select a team first'); return; }

      // Prefer whatever formation this side's saved custom lineup actually
      // used (if it's for this same team) over the visible dropdown value —
      // this is what lets a saved custom formation survive even if the
      // dropdown display ever falls out of sync for any reason.
      const savedForTeam = (customLineups[side] && customLineups[side]._teamId === team.id) ? customLineups[side] : null;
      const formKey = (savedForTeam && savedForTeam.formation) || (formSel && formSel.value) || '4-3-3';

      const formation = FORMATIONS[formKey] || FORMATIONS['4-3-3'];
      const players = [];
      const seenP = new Set();
      (team.players || []).forEach(p => {
        if (p && p.id && !seenP.has(p.id)) { seenP.add(p.id); players.push(p); }
      });

      let slots = {};
      let bench = new Set();
      // Seed the Match Roles panel with this team's persisted default
      // roles (team.roles, set from the Transfer Tool and saved into
      // teams.json) — a saved lineup's own manualRoles (below) still wins
      // for any role it explicitly sets.
      let roles = Object.assign({}, team.roles || {});
      let coords = formation.coords.map(c => c.slice());
      let slotRoles = {};
      const saved = customLineups[side];
      if (saved && saved.formation === formKey && saved._teamId === team.id) {
        saved.starting.forEach((p, i) => { slots[i] = p.id; });
        (saved.subs || []).forEach(p => bench.add(p.id));
        roles = Object.assign({}, roles, saved.manualRoles || {});
        if (saved.customCoords) coords = saved.customCoords.map(c => c.slice());
        if (saved.customSlotRoles) slotRoles = Object.assign({}, saved.customSlotRoles);
      } else {
        const auto = buildSquad(team, formKey);
        auto.starting.forEach((p, i) => { slots[i] = p.id; });
        (auto.subs || []).slice(0, 9).forEach(p => bench.add(p.id));
      }

      sbDraft = { side, team, formation: formKey, slots, bench, roles, players, coords, slotRoles, editMode: 'lineup', selected: null };
      switchView('squadbuilder');
      const titleEl = document.getElementById('sb-page-title');
      if (titleEl) titleEl.textContent = (side === 'home' ? 'HOME' : 'AWAY') + ' · ' + team.name;
      sbSwitchTab('bench');
      renderFormationSelect();
      renderSquadBuilderUI();
    } catch (err) {
      console.error(err);
      toast('Squad builder error: ' + (err && err.message ? err.message : err));
    }
  }
/*@CHUNK:c0106:END*/

/*@CHUNK:c0107:START*/
  // Lets the person hop between editing the home and away lineups without
  // leaving the page — re-runs openSquadBuilder() for the other side,
  // picking up its own saved/auto lineup exactly as opening it fresh
  // would. Any unsaved change on the side being left behind is dropped,
  // same as tapping Cancel.
  function sbSwitchSide() {
    if (!sbDraft) return;
    openSquadBuilder(sbDraft.side === 'home' ? 'away' : 'home');
  }

  function sbSwitchTab(tab) {
    document.querySelectorAll('.sb-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.sbTab === tab); });
    document.querySelectorAll('.sb-tab-panel').forEach(function(p) { p.style.display = 'none'; });
    const panel = document.getElementById('sb-tab-' + tab);
    if (panel) panel.style.display = 'block';
  }
/*@CHUNK:c0107:END*/

/*@CHUNK:c0108:START*/
  function getUsedInDraft() {
    const used = new Set(Object.values(sbDraft.slots).filter(Boolean));
    sbDraft.bench.forEach(function(id) { used.add(id); });
    return used;
  }
/*@CHUNK:c0108:END*/

/*@CHUNK:c0109:START*/
  function renderSquadBuilderSideButtons() {
    if (!sbDraft) return;
    const hb = document.getElementById('sb-side-home-btn');
    const ab = document.getElementById('sb-side-away-btn');
    if (hb) hb.classList.toggle('sb-side-active', sbDraft.side === 'home');
    if (ab) ab.classList.toggle('sb-side-active', sbDraft.side === 'away');
  }

  function renderFormationSelect() {
    const sel = document.getElementById('sb-formation-select');
    if (!sel || !sbDraft) return;
    sel.innerHTML = Object.keys(FORMATIONS).map(function(f) {
      return '<option value="' + f + '">' + FORMATIONS[f].name + '</option>';
    }).join('');
    sel.value = sbDraft.formation;
  }
/*@CHUNK:c0109:END*/

/*@CHUNK:c0110:START*/
  // Master re-render for the whole page — called after essentially every
  // interaction (drop, tap-to-place, role change, formation swap). The
  // squad involved is small (~25 players) so a full re-render is cheap;
  // the one hot path that isn't re-rendered on every tick is dragging
  // itself (see sbDragMove/sbCoordMove, which move elements directly).
  function renderSquadBuilderUI() {
    if (!sbDraft) return;
    sbDraft._eff = sbEffectiveRoles();
    renderSquadBuilderSideButtons();

    const editBtn = document.getElementById('sb-edit-mode-btn');
    if (editBtn) editBtn.textContent = sbDraft.editMode === 'formation' ? '✓ Done Editing Shape' : '✥ Edit Formation Shape';
    const pitchEl = document.getElementById('sb-pitch');
    if (pitchEl) pitchEl.classList.toggle('sb-pitch-edit', sbDraft.editMode === 'formation');
    const hint = document.getElementById('sb-hint');
    if (hint) {
      hint.textContent = sbDraft.editMode === 'formation'
        ? 'Drag the position markers to reshape your formation, then tap "Done Editing Shape".'
        : 'Drag a player onto the pitch, bench or reserves to place them — or tap a player, then tap where they should go.';
    }

    renderSquadBuilderPitch();

    const benchEl = document.getElementById('sb-bench-list');
    if (benchEl) benchEl.innerHTML = renderSquadBuilderBenchHTML();
    const resEl = document.getElementById('sb-reserves-list');
    if (resEl) resEl.innerHTML = renderSquadBuilderReserveHTML();
    const rolesEl = document.getElementById('sb-roles');
    if (rolesEl) rolesEl.innerHTML = renderSquadBuilderRolesHTML();

    const countsEl = document.getElementById('sb-counts');
    if (countsEl) {
      const starters = Object.values(sbDraft.slots).filter(Boolean).length;
      countsEl.textContent = starters + '/11 starting · ' + sbDraft.bench.size + ' subs · ' +
        (sbDraft.players.length - starters - sbDraft.bench.size) + ' reserve';
    }
    const benchTabBtn = document.querySelector('.sb-tab[data-sb-tab="bench"]');
    if (benchTabBtn) benchTabBtn.textContent = 'Substitutes (' + sbDraft.bench.size + ')';
  }
/*@CHUNK:c0110:END*/

/*@CHUNK:c0111:START*/
  // Draws the interactive pitch — same visual language (mini-pitch,
  // player-dot-style markers) as the live match pitch in
  // ui/matchUI.js::renderPitch(), so what you build here is recognizably
  // "the same pitch" you'll see once the match kicks off. In lineup mode
  // each dot is a player (or an empty "+" placeholder); in formation-edit
  // mode every dot becomes a draggable position marker labelled by its
  // slot code, regardless of whether it currently has a player on it.
  function renderSquadBuilderPitch() {
    if (!sbDraft) return;
    const el = document.getElementById('sb-pitch');
    if (!el) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const baseSlots = formation.slots;
    const team = sbDraft.team;
    const primary = team.color || '#1a237e';
    const secondary = team.secondary || '#ffffff';
    const editMode = sbDraft.editMode === 'formation';

    let dots = '';
    baseSlots.forEach(function(baseSlot, idx) {
      // The slot's *effective* role — its own manually-picked alternate
      // (e.g. a CM tapped into playing CAM) if one's been set, otherwise
      // the formation's default code for this position.
      const slot = sbEffectiveSlotCode(idx);
      const c = sbDraft.coords[idx] || formation.coords[idx] || [50, 50];
      const x = c[0], y = c[1];
      const pid = sbDraft.slots[idx];
      const p = pid ? sbDraft.players.find(function(pp) { return pp.id === pid; }) : null;
      const filled = !!p;
      const isSelected = !editMode && sbDraft.selected && sbDraft.selected.kind === 'slot' && sbDraft.selected.slotIdx === idx;
      const roleTag = (!editMode && p) ? sbRoleTagHTML(p.id) : '';
      const avatar = editMode ? '<span class="sb-dot-slot-code">' + baseSlot + '</span>'
        : (p ? playerAvatarMark(p) : '<span class="sb-dot-plus">+</span>');
      // Empty slots show the position code once (as the name line only) —
      // previously both dot-num and dot-name were set to the same slot
      // string, which rendered the position name twice back-to-back
      // (e.g. "CAMCAM").
      const label = editMode ? ''
        : '<span class="dot-label"><span class="dot-num">' + (p ? (p.num || '?') : '') + '</span>' +
          '<span class="dot-name">' + (p ? abbreviateName(p.name) : slot) + '</span></span>';
      // Position code shown above the dot, same badge style as the
      // jersey number below it. Skipped in edit-mode, where the dot's
      // own avatar already displays the slot code front and center.
      const posLabel = editMode ? '' : '<span class="dot-pos">' + slot + '</span>';
      const emptyTapHandler = (!filled && !editMode) ? ' onclick="App.sbEmptySlotTap(' + idx + ')"' : '';
      // Small tappable badge showing the slot's current role code — lets
      // you tap CM to switch it to CAM/CDM etc without disturbing the
      // player-select/drag tap already bound to the rest of the dot.
      // Only rendered where there's actually more than one sensible
      // alternative (a GK or CB slot has nowhere sensible to go).
      const alts = POS_ROLE_ALTS[baseSlot] || [baseSlot];
      const roleBadge = (!editMode && alts.length > 1)
        ? '<span class="sb-slot-role-badge' + (slot !== baseSlot ? ' changed' : '') + '"' +
          ' title="Change position role" onpointerdown="event.stopPropagation()"' +
          ' onclick="event.stopPropagation();App.openSlotRolePicker(' + idx + ')">' + slot + '</span>'
        : '';
      dots += '<div id="sb-dot-' + idx + '" class="sb-dot' + (filled ? ' filled' : '') + (isSelected ? ' selected' : '') + (editMode ? ' edit-mode' : '') + '"' +
        ' data-sb-drop="slot" data-slot-idx="' + idx + '"' +
        ' style="left:' + x + '%;top:' + y + '%;background:' + primary + ';border-color:' + secondary + '"' +
        ' onpointerdown="event.stopPropagation();App.sbGrab(event,\'slot\',' + idx + ')"' + emptyTapHandler + '>' +
        '<span class="dot-avatar">' + avatar + '</span>' + roleTag + roleBadge + posLabel + label +
        '</div>';
    });
    el.innerHTML = '<div class="pitch-label">' + teamMark(team, 16) + ' ' + (team.short || team.name) + ' · ' + formation.name + '</div>' + dots;
  }
/*@CHUNK:c0111:END*/
/*@CHUNK:c0111b:START*/
  // Resolves slot idx -> its currently-active position code: the manual
  // override in sbDraft.slotRoles if one was picked, else the formation's
  // own default for that slot. Centralized here so every consumer of "what
  // position is this slot" (rendering, the player-eligibility picker, and
  // what actually gets saved/played) agrees with each other.
  function sbEffectiveSlotCode(idx) {
    if (!sbDraft) return null;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const base = formation.slots[idx];
    const override = sbDraft.slotRoles && sbDraft.slotRoles[idx];
    return (override && (POS_ROLE_ALTS[base] || []).includes(override)) ? override : base;
  }

  // Opens the same picker panel used for choosing a player, but filled
  // with this slot's sensible role alternatives instead (see
  // POS_ROLE_ALTS) — tapping the little position badge on a pitch dot.
  function openSlotRolePicker(idx) {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const base = formation.slots[idx];
    const alts = POS_ROLE_ALTS[base] || [base];
    if (alts.length < 2) return;
    const current = sbEffectiveSlotCode(idx);
    let picker = document.getElementById('sb-picker');
    if (!picker) return;
    picker.style.display = 'block';
    picker.innerHTML = '<div class="sb-picker-head"><strong>Position Role</strong>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="App.closeSlotPicker()">Close</button></div>' +
      '<div class="sb-picker-list">' + alts.map(function(code) {
        const name = POS_ROLE_NAMES[code] || code;
        return '<button type="button" class="sb-picker-item' + (code === current ? ' selected' : '') + '"' +
          ' onclick="App.setSquadSlotRole(' + idx + ',\'' + code + '\')">' +
          '<span class="sb-bench-num">' + code + '</span>' +
          '<span class="sb-bench-name">' + name + '</span>' +
          (code === base ? '<span class="sb-bench-meta">default</span>' : '<span class="sb-bench-meta">alt role</span>') +
          '</button>';
      }).join('') + '</div>';
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Applies a role change to a slot. Switching a slot's role can leave
  // its current occupant no longer eligible there (e.g. CM -> CAM is
  // fine for most central mids, but not for a pure CDM specialist) — if
  // so, they're bumped back to the bench rather than left illegally
  // filling a position they can't actually play, same as a formation
  // change does.
  function setSquadSlotRole(idx, code) {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const base = formation.slots[idx];
    if (code === base) { delete sbDraft.slotRoles[idx]; }
    else { sbDraft.slotRoles[idx] = code; }
    const pid = sbDraft.slots[idx];
    if (pid) {
      const p = sbDraft.players.find(function(x) { return x.id === pid; });
      if (p && !canPlay(p, code)) {
        delete sbDraft.slots[idx];
        if (sbDraft.bench.size < 14) sbDraft.bench.add(pid);
      }
    }
    closeSlotPicker();
    renderSquadBuilderUI();
  }
/*@CHUNK:c0111b:END*/

/*@CHUNK:c0112:START*/
  function openSlotPicker(index) {
    if (!sbDraft) return;
    const slot = sbEffectiveSlotCode(index);
    const used = getUsedInDraft();
    const selected = sbDraft.slots[index] || '';
    const list = sbDraft.players
      .filter(function(p) { return !used.has(p.id) || p.id === selected; })
      .sort(function(a, b) {
        const aFit = (a.pos || []).includes(slot) ? 1 : 0;
        const bFit = (b.pos || []).includes(slot) ? 1 : 0;
        if (bFit !== aFit) return bFit - aFit;
        return (b.ovr || 70) - (a.ovr || 70);
      });
    let picker = document.getElementById('sb-picker');
    if (!picker) return;
    picker.style.display = 'block';
    picker.innerHTML = '<div class="sb-picker-head"><strong>Select ' + slot + '</strong>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="App.closeSlotPicker()">Close</button></div>' +
      '<div class="sb-picker-list">' + list.map(function(p) {
        const fit = (p.pos || []).includes(slot);
        return '<button type="button" class="sb-picker-item' + (p.id === selected ? ' selected' : '') + '" onclick="App.setSquadSlot(' + index + ',\'' + p.id + '\')">' +
          '<span class="sb-bench-num">' + (p.num || '?') + '</span>' +
          '<span class="sb-bench-name">' + p.name + '</span>' +
          '<span class="sb-bench-meta">' + ((p.pos || [])[0] || '') + ' · ' + p.ovr + (fit ? ' · fit' : '') + '</span></button>';
      }).join('') + '</div>';
    picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
/*@CHUNK:c0112:END*/

/*@CHUNK:c0113:START*/
  // Combines manual overrides (sbDraft.roles) with the same auto-pick
  // logic the match engine itself uses (assignMatchRoles(), fed a
  // lightweight fake "side" built from the current starting XI) so what
  // shows here — badge on the pitch, "Auto — <name>" hint in the roles
  // panel — is always exactly what would happen if the role were left on
  // Auto. Recomputed once per render and cached on sbDraft._eff.
  function sbEffectiveRoles() {
    if (!sbDraft) return null;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const startersArr = formation.slots.map(function(slot, i) {
      const id = sbDraft.slots[i];
      const p = id ? sbDraft.players.find(function(x) { return x.id === id; }) : null;
      return p ? Object.assign({}, p, { slot: sbEffectiveSlotCode(i) }) : null;
    }).filter(Boolean);
    const auto = startersArr.length ? assignMatchRoles({ squad: { starting: startersArr } }) : null;
    const pick = function(key) {
      const manualId = (sbDraft.roles || {})[key];
      if (manualId) {
        const mp = startersArr.find(function(p) { return p.id === manualId; });
        if (mp) return mp;
      }
      return auto ? auto[key] : null;
    };
    // The 3 corner-box attackers aren't a single named field on `auto` —
    // they're auto.cornerAttackers[0..2] — but otherwise follow the exact
    // same manual-override-then-auto-fallback pattern as every other role.
    const pickCornerAtk = function(idx) {
      const key = 'cornerAtk' + (idx + 1);
      const manualId = (sbDraft.roles || {})[key];
      if (manualId) {
        const mp = startersArr.find(function(p) { return p.id === manualId; });
        if (mp) return mp;
      }
      return (auto && auto.cornerAttackers) ? (auto.cornerAttackers[idx] || null) : null;
    };
    return {
      captain: pick('captain'), penalty: pick('penalty'),
      shortFreeKick: pick('shortFreeKick'), longFreeKick: pick('longFreeKick'),
      leftCorner: pick('leftCorner'), rightCorner: pick('rightCorner'),
      cornerAtk1: pickCornerAtk(0), cornerAtk2: pickCornerAtk(1), cornerAtk3: pickCornerAtk(2),
      auto: auto, startersArr: startersArr
    };
  }

  function sbRoleTagHTML(playerId) {
    const eff = sbDraft && sbDraft._eff;
    if (!eff) return '';
    let out = '';
    if (eff.captain && eff.captain.id === playerId) out += `<span class="captain-armband" title="Captain">${emojiImg('captain', 'Captain')}</span>`;
    if (eff.penalty && eff.penalty.id === playerId) out += `<span class="sb-role-ic" title="Penalty taker">${emojiImg('penalty_goal', 'Penalty taker')}</span>`;
    const isFk = (eff.shortFreeKick && eff.shortFreeKick.id === playerId) || (eff.longFreeKick && eff.longFreeKick.id === playerId);
    if (isFk) out += `<span class="sb-role-ic" title="Free-kick taker">${emojiImg('freekick', 'Free-kick taker')}</span>`;
    const isLeftCk = eff.leftCorner && eff.leftCorner.id === playerId;
    const isRightCk = eff.rightCorner && eff.rightCorner.id === playerId;
    if (isLeftCk) out += `<span class="sb-role-ic" title="Left corner taker">${emojiImg('left_corner', 'Left corner taker')}</span>`;
    if (isRightCk) out += `<span class="sb-role-ic" title="Right corner taker">${emojiImg('right_corner', 'Right corner taker')}</span>`;
    const isCa = [eff.cornerAtk1, eff.cornerAtk2, eff.cornerAtk3].some(function(p) { return p && p.id === playerId; });
    if (isCa) out += `<span class="sb-role-ic" title="Corner-box attacker">${emojiImg('corner_attacker', 'Corner-box attacker')}</span>`;
    return out;
  }
/*@CHUNK:c0113:END*/

/*@CHUNK:c0114:START*/
  function closeSlotPicker() {
    const picker = document.getElementById('sb-picker');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
  }
/*@CHUNK:c0114:END*/

/*@CHUNK:c0115:START*/
  function sbChipRowHTML(p, kind) {
    const isSel = sbDraft.selected && sbDraft.selected.id === p.id;
    const inj = isPlayerInjured(p.id);
    const susp = isPlayerSuspended(p.id);
    // Bench <-> reserve rows also get a one-tap move button as a
    // drag-and-drop alternative — same move sbPlacePlayer() already does
    // for a drop, just reachable without a pointer drag.
    let moveBtn = '';
    if (kind === 'bench') {
      moveBtn = '<button type="button" class="sb-chip-move" title="Move to reserves"' +
        ' onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();App.sbMoveToReserve(\'' + p.id + '\')">Reserve ⇩</button>';
    } else if (kind === 'reserve') {
      moveBtn = '<button type="button" class="sb-chip-move" title="Move to substitutes"' +
        ' onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();App.sbMoveToBench(\'' + p.id + '\')">Sub ⇧</button>';
    }
    return '<div class="sb-chip' + (isSel ? ' selected' : '') + '"' +
      ' onpointerdown="event.stopPropagation();App.sbGrab(event,\'' + kind + '\',\'' + p.id + '\')">' +
      '<span class="sb-chip-num">' + (p.num || '?') + '</span>' +
      '<span class="sb-chip-name">' + p.name + (inj ? ' 🩹' : '') + (susp ? ' ' + emojiImg('red_card', 'Suspended') : '') + '</span>' +
      '<span class="sb-chip-meta">' + ((p.pos || [])[0] || '') + ' · ' + p.ovr + '</span>' +
      sbRoleTagHTML(p.id) + moveBtn +
      '</div>';
  }

  function renderSquadBuilderBenchHTML() {
    const starterIds = new Set(Object.values(sbDraft.slots).filter(Boolean));
    const benchArr = sbDraft.players.filter(function(p) { return sbDraft.bench.has(p.id) && !starterIds.has(p.id); });
    benchArr.sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
    if (!benchArr.length) return '<p class="sb-empty-hint">Drag starters here to bench them, or drag a reserve up.</p>';
    return benchArr.map(function(p) { return sbChipRowHTML(p, 'bench'); }).join('');
  }

  function renderSquadBuilderReserveHTML() {
    const starterIds = new Set(Object.values(sbDraft.slots).filter(Boolean));
    const reserveArr = sbDraft.players.filter(function(p) { return !starterIds.has(p.id) && !sbDraft.bench.has(p.id); });
    reserveArr.sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
    if (!reserveArr.length) return '<p class="sb-empty-hint">Everyone is in the matchday squad.</p>';
    return reserveArr.map(function(p) { return sbChipRowHTML(p, 'reserve'); }).join('');
  }
/*@CHUNK:c0115:END*/

/*@CHUNK:c0116:START*/
  function setSquadSlot(index, playerId) {
    if (!sbDraft) return;
    if (!playerId) {
      delete sbDraft.slots[index];
    } else {
      const source = sbLocateInDraft(playerId);
      sbPlacePlayer(source, 'slot', index);
    }
    closeSlotPicker();
    renderSquadBuilderUI();
  }
/*@CHUNK:c0116:END*/

/*@CHUNK:c0117:START*/
  function renderSquadBuilderRolesHTML() {
    if (!sbDraft || !sbDraft._eff) return '';
    const eff = sbDraft._eff;
    const starters = eff.startersArr;
    const roleDefs = [
      ['captain', 'Captain'], ['penalty', 'Penalty Taker'],
      ['shortFreeKick', 'Short Free-Kick'], ['longFreeKick', 'Long Free-Kick'],
      ['leftCorner', 'Left Corner'], ['rightCorner', 'Right Corner'],
      ['cornerAtk1', 'Corner Attacker 1'], ['cornerAtk2', 'Corner Attacker 2'], ['cornerAtk3', 'Corner Attacker 3']
    ];
    if (!starters.length) return '<p class="sb-empty-hint">Fill your starting XI to assign match roles.</p>';
    return roleDefs.map(function(def) {
      const key = def[0], label = def[1];
      // The 3 corner-box attacker slots aren't a named field on eff — read
      // them from eff.cornerAtk1/2/3 (computed in sbEffectiveRoles) same
      // as every other role for display purposes.
      const autoP = (key.indexOf('cornerAtk') === 0)
        ? (eff.auto && eff.auto.cornerAttackers && eff.auto.cornerAttackers[+key.slice(-1) - 1])
        : (eff.auto && eff.auto[key]);
      // Each option shows a 1-99 "fit" rating for that role next to the
      // player's name — the same scoring the auto-pick above uses, so the
      // number you see is exactly why the auto pick is who it is.
      const opts = starters.map(function(p) {
        const rating = roleFitRating(p, key);
        return '<option value="' + p.id + '"' + ((sbDraft.roles || {})[key] === p.id ? ' selected' : '') + '>' +
          p.name + (rating != null ? ' — ' + rating : '') + '</option>';
      }).join('');
      const autoRating = autoP ? roleFitRating(autoP, key) : null;
      return '<div class="sb-role-row"><label>' + label + '</label>' +
        '<select onchange="App.sbSetRole(\'' + key + '\', this.value)">' +
        '<option value="">Auto' + (autoP ? ' — ' + autoP.name + (autoRating != null ? ' (' + autoRating + ')' : '') : '') + '</option>' + opts +
        '</select></div>';
    }).join('');
  }

  function sbSetRole(key, playerId) {
    if (!sbDraft) return;
    if (!sbDraft.roles) sbDraft.roles = {};
    sbDraft.roles[key] = playerId || '';
    renderSquadBuilderUI();
  }
/*@CHUNK:c0117:END*/

/*@CHUNK:c0118:START*/
  // Tapping empty pitch/bench/reserve space when a player is already
  // "selected" (tap-to-place, the touch-friendly alternative to
  // dragging) drops them there. With nothing selected it's a no-op —
  // dropping onto a filled slot to trigger a swap is handled by sbGrab's
  // tap branch instead, since that needs to know *which* player was
  // tapped.
  function sbZoneGrab(e, zoneKind) {
    if (!sbDraft || !sbDraft.selected) return;
    sbPlacePlayer(sbDraft.selected, zoneKind);
    sbDraft.selected = null;
    renderSquadBuilderUI();
  }

  function sbEmptySlotTap(idx) {
    if (!sbDraft) return;
    if (sbDraft.selected) {
      sbPlacePlayer(sbDraft.selected, 'slot', idx);
      sbDraft.selected = null;
      renderSquadBuilderUI();
    } else {
      openSlotPicker(idx);
    }
  }
/*@CHUNK:c0118:END*/

/*@CHUNK:c0119:START*/
  // Pointer-based drag & drop, unified for mouse, touch and pen (Pointer
  // Events). A press-without-moving-far is treated as a *tap* instead of
  // a drag — see sbDragEnd() — which is what powers the
  // tap-a-player/tap-a-destination placement flow on phones where a true
  // drag gesture is fiddlier. In formation-edit mode, grabbing a pitch
  // dot drags its *coordinates* instead (see sbCoordMove/sbCoordUp).
  function sbGrab(e, kind, idOrIdx) {
    if (!sbDraft) return;
    if (kind === 'slot' && sbDraft.editMode === 'formation') {
      e.preventDefault();
      const pitchEl = document.getElementById('sb-pitch');
      if (!pitchEl) return;
      sbCoordDrag = { slotIdx: idOrIdx, pitchEl: pitchEl };
      document.addEventListener('pointermove', sbCoordMove);
      document.addEventListener('pointerup', sbCoordUp, { once: true });
      return;
    }
    const id = kind === 'slot' ? sbDraft.slots[idOrIdx] : idOrIdx;
    if (!id) return;
    const slotIdx = kind === 'slot' ? idOrIdx : undefined;
    e.preventDefault();
    const p = sbDraft.players.find(function(x) { return x.id === id; });
    if (!p) return;
    sbDrag = { kind: kind, id: id, slotIdx: slotIdx, x0: e.clientX, y0: e.clientY, moved: false, player: p };
    document.addEventListener('pointermove', sbDragMove);
    document.addEventListener('pointerup', sbDragEnd, { once: true });
  }

  function sbDragMove(e) {
    if (!sbDrag) return;
    const dx = e.clientX - sbDrag.x0, dy = e.clientY - sbDrag.y0;
    if (!sbDrag.moved && Math.hypot(dx, dy) > 10) {
      sbDrag.moved = true;
      sbCreateGhost(sbDrag.player);
      document.querySelectorAll('[data-sb-drop]').forEach(function(z) { z.classList.add('sb-dz-active'); });
    }
    if (sbDrag.moved) sbMoveGhost(e.clientX, e.clientY);
  }

  function sbDragEnd(e) {
    document.removeEventListener('pointermove', sbDragMove);
    document.querySelectorAll('[data-sb-drop]').forEach(function(z) { z.classList.remove('sb-dz-active'); });
    if (!sbDrag) return;
    const drag = sbDrag; sbDrag = null;
    sbRemoveGhost();
    if (drag.moved) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const zoneEl = target && target.closest ? target.closest('[data-sb-drop]') : null;
      if (zoneEl) {
        const zk = zoneEl.getAttribute('data-sb-drop');
        if (zk === 'slot') sbPlacePlayer(drag, 'slot', +zoneEl.getAttribute('data-slot-idx'));
        else sbPlacePlayer(drag, zk);
      }
      sbDraft.selected = null;
    } else if (sbDraft.selected && sbDraft.selected.id === drag.id) {
      sbDraft.selected = null; // tapping the already-selected chip deselects it
    } else if (sbDraft.selected) {
      sbPlacePlayer(sbDraft.selected, drag.kind, drag.slotIdx); // tap-to-place onto this chip's spot (swap)
      sbDraft.selected = null;
    } else {
      sbDraft.selected = { kind: drag.kind, id: drag.id, slotIdx: drag.slotIdx }; // first tap: select
    }
    renderSquadBuilderUI();
  }
/*@CHUNK:c0119:END*/

/*@CHUNK:c0120:START*/
  function autoFillSquadBuilder() {
    if (!sbDraft) return;
    const auto = buildSquad(sbDraft.team, sbDraft.formation);
    sbDraft.slots = {};
    auto.starting.forEach(function(p, i) { sbDraft.slots[i] = p.id; });
    sbDraft.bench = new Set(auto.subs.slice(0, 9).map(function(p) { return p.id; }));
    sbDraft.selected = null;
    renderSquadBuilderUI();
    toast('Best XI auto-filled');
  }
/*@CHUNK:c0120:END*/

/*@CHUNK:c0121:START*/
  // Formation-edit-mode dragging — moves a slot's coordinates rather than
  // a player. Updates the dot's inline position directly on every
  // pointermove (cheap DOM write) instead of going through the full
  // renderSquadBuilderUI() re-render, so reshaping the formation feels
  // smooth; the full re-render only happens once, on release.
  function sbCoordMove(e) {
    if (!sbCoordDrag) return;
    const rect = sbCoordDrag.pitchEl.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(4, Math.min(96, x));
    y = Math.max(4, Math.min(96, y));
    sbDraft.coords[sbCoordDrag.slotIdx] = [x, y];
    const dot = document.getElementById('sb-dot-' + sbCoordDrag.slotIdx);
    if (dot) { dot.style.left = x + '%'; dot.style.top = y + '%'; }
  }

  function sbCoordUp() {
    document.removeEventListener('pointermove', sbCoordMove);
    sbCoordDrag = null;
  }

  function sbCreateGhost(p) {
    sbRemoveGhost();
    const g = document.createElement('div');
    g.className = 'sb-drag-ghost';
    g.innerHTML = '<span class="sb-chip-num">' + (p.num || '?') + '</span><span>' + p.name + '</span>';
    document.body.appendChild(g);
    sbGhostEl = g;
  }

  function sbMoveGhost(x, y) {
    if (sbGhostEl) { sbGhostEl.style.left = x + 'px'; sbGhostEl.style.top = y + 'px'; }
  }

  function sbRemoveGhost() {
    if (sbGhostEl) { sbGhostEl.remove(); sbGhostEl = null; }
  }
/*@CHUNK:c0121:END*/

/*@CHUNK:c0122:START*/
  function saveSquadBuilder() {
    if (!sbDraft || !sbSide) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const starting = [];
    const used = new Set();
    for (let i = 0; i < formation.slots.length; i++) {
      const id = sbDraft.slots[i];
      if (!id || used.has(id)) { toast('Fill every starting slot with unique players'); return; }
      const p = sbDraft.players.find(function(x) { return x.id === id; });
      if (!p) continue;
      used.add(id);
      starting.push(Object.assign({}, p, { slot: sbEffectiveSlotCode(i), isStarter: true }));
    }
    if (starting.length < 11) { toast('Need 11 unique starters'); return; }
    const subs = [];
    sbDraft.bench.forEach(function(id) {
      if (used.has(id)) return;
      const p = sbDraft.players.find(function(x) { return x.id === id; });
      if (p) {
        used.add(id);
        subs.push(Object.assign({}, p, { slot: (p.pos || ['CM'])[0], isStarter: false }));
      }
    });
    const manualRoles = {};
    Object.keys(sbDraft.roles || {}).forEach(function(k) {
      const v = sbDraft.roles[k];
      if (v && starting.some(function(p) { return p.id === v; })) manualRoles[k] = v;
    });
    customLineups[sbSide] = {
      starting: starting, subs: subs, formation: sbDraft.formation,
      all: starting.concat(subs), _teamId: sbDraft.team.id,
      manualRoles: manualRoles, customCoords: sbDraft.coords.map(function(c) { return c.slice(); }),
      customSlotRoles: Object.assign({}, sbDraft.slotRoles)
    };
    // Capture the side before closeSquadBuilder() clears the module-level
    // sbSide/sbDraft — calling updateTeamPreview(sbSide) *after* close used
    // to run it with sbSide already null, which made it silently no-op and
    // leave the home/away formation dropdown showing its old value even
    // though the new formation had just been saved successfully.
    const savedSide = sbSide;
    toast((savedSide === 'home' ? 'Home' : 'Away') + ' lineup saved (' + starting.length + '+' + subs.length + ')');
    closeSquadBuilder();
    updateTeamPreview(savedSide);
  }
/*@CHUNK:c0122:END*/

/*@CHUNK:c0123:START*/
  // Switching to a different preset formation tries to keep your current
  // starters on the pitch — each new slot claims the best-fitting player
  // still unclaimed (exact position first, then anyone compatible, then
  // highest OVR), same greedy approach engine/tactics.js::
  // changeFormationLive() uses for an in-match reshape. Anyone the new
  // shape has no room for drops to the bench rather than falling out of
  // the squad entirely.
  //
  // A shape change (e.g. 4-1-3-2 -> 4-3-3) doesn't always have an exact
  // like-for-like replacement among the current XI for every new slot —
  // e.g. going from one holding mid to none, or from two strikers to one
  // plus two wide forwards. Any slot the first pass can't fill from the
  // current starters gets a second pass pulling the best remaining fit
  // from the rest of the squad (bench first, then reserves), with a final
  // fallback that fields *someone* regardless of position so a formation
  // switch never quietly leaves a starting slot empty (which used to make
  // saveSquadBuilder() reject the whole save with no clear reason why).
  function sbSelectFormationPreset(key) {
    if (!sbDraft || !FORMATIONS[key]) return;
    const newFormation = FORMATIONS[key];
    const currentStarters = [];
    Object.keys(sbDraft.slots).forEach(function(k) {
      const id = sbDraft.slots[k];
      const p = sbDraft.players.find(function(x) { return x.id === id; });
      if (p) currentStarters.push(p);
    });
    const used = new Set();
    const newAssign = {};
    newFormation.slots.forEach(function(slot, i) {
      const cand = currentStarters.filter(function(p) { return !used.has(p.id) && canPlay(p, slot); })
        .sort(function(a, b) {
          const aFit = (a.pos || []).includes(slot) ? 1 : 0;
          const bFit = (b.pos || []).includes(slot) ? 1 : 0;
          if (bFit !== aFit) return bFit - aFit;
          return (b.ovr || 0) - (a.ovr || 0);
        });
      if (cand[0]) { used.add(cand[0].id); newAssign[i] = cand[0].id; }
    });
    currentStarters.forEach(function(p) {
      if (!used.has(p.id)) sbDraft.bench.add(p.id);
    });

    // Second pass: any new slot still empty gets filled from the rest of
    // the squad — bench (currently-named subs) before pure reserves, since
    // a bench spot signals "in the matchday 25 on purpose" more than an
    // untouched reserve does.
    const pool = sbDraft.players.filter(function(p) { return !used.has(p.id); })
      .sort(function(a, b) {
        const aBench = sbDraft.bench.has(a.id) ? 1 : 0;
        const bBench = sbDraft.bench.has(b.id) ? 1 : 0;
        if (bBench !== aBench) return bBench - aBench;
        return (b.ovr || 0) - (a.ovr || 0);
      });
    newFormation.slots.forEach(function(slot, i) {
      if (newAssign[i]) return;
      let pick = pool.find(function(p) { return !used.has(p.id) && (p.pos || []).includes(slot); });
      if (!pick) pick = pool.find(function(p) { return !used.has(p.id) && canPlay(p, slot); });
      if (!pick) pick = pool.find(function(p) { return !used.has(p.id); }); // fallback: fill with anyone left
      if (pick) { used.add(pick.id); newAssign[i] = pick.id; sbDraft.bench.delete(pick.id); }
    });

    sbDraft.formation = key;
    sbDraft.slots = newAssign;
    sbDraft.coords = newFormation.coords.map(function(c) { return c.slice(); });
    // A new formation shape means slot index 3 in the old shape isn't the
    // same physical position as slot index 3 in the new one — any manual
    // CM->CAM style role tweaks would silently apply to the wrong slot, so
    // start the new shape with its own default roles.
    sbDraft.slotRoles = {};
    sbDraft.selected = null;
    renderFormationSelect();
    renderSquadBuilderUI();
  }
/*@CHUNK:c0123:END*/

/*@CHUNK:c0124:START*/
  function closeSquadBuilder() {
    sbDraft = null;
    sbSide = null;
    closeSlotPicker();
    switchView('match');
  }
/*@CHUNK:c0124:END*/

/*@CHUNK:c0125:START*/
  function sbToggleEditMode() {
    if (!sbDraft) return;
    sbDraft.editMode = sbDraft.editMode === 'formation' ? 'lineup' : 'formation';
    sbDraft.selected = null;
    renderSquadBuilderUI();
  }

  function sbResetFormationShape() {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    sbDraft.coords = formation.coords.map(function(c) { return c.slice(); });
    renderSquadBuilderUI();
    toast('Formation shape reset');
  }

  // Exports the current draft's formation shape — slot codes (including
  // any per-slot role overrides from setSquadSlotRole) and marker
  // coordinates (including any reshaping done in "Edit Formation Shape"
  // mode) — as a downloadable snippet in the exact object shape the
  // built-in FORMATIONS table (js/state.js) uses, so it can be pasted in
  // by hand as a new named entry and picked up by build.js on the next
  // build. This only ever reads sbDraft; it doesn't save/mutate anything.
  function sbExportFormation() {
    if (!sbDraft) return;
    const formation = FORMATIONS[sbDraft.formation] || FORMATIONS['4-3-3'];
    const slots = formation.slots.map(function(_, idx) { return sbEffectiveSlotCode(idx); });
    const coords = sbDraft.coords.map(function(c) {
      const x = Math.round(((c && c[0]) || 0) * 10) / 10;
      const y = Math.round(((c && c[1]) || 0) * 10) / 10;
      return [x, y];
    });
    const baseName = (formation.name || sbDraft.formation) + ' (Custom)';
    const key = 'custom-' + String(sbDraft.formation).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + Date.now().toString(36).slice(-5);
    const slotsStr = slots.map(function(s) { return "'" + s + "'"; }).join(', ');
    const coordsStr = coords.map(function(c) { return '[' + c[0] + ',' + c[1] + ']'; }).join(',');
    const snippet =
      '// Paste this as a new entry inside the FORMATIONS object in js/state.js,\n' +
      '// then run `node build.js` to fold it into dist/app.js.\n' +
      "  '" + key + "': { name: '" + baseName.replace(/'/g, "\\'") + "', slots: [" + slotsStr + '],\n' +
      '    coords: [' + coordsStr + '] },\n';
    try {
      const blob = new Blob([snippet], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = key + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
      toast('Formation exported — paste it into FORMATIONS in js/state.js');
    } catch (e) {
      toast('Export failed: ' + (e && e.message ? e.message : e));
    }
  }
/*@CHUNK:c0125:END*/

/*@CHUNK:c0126:START*/
  function dedupeSquad(sq) {
    const seen = new Set();
    const starting = [];
    (sq.starting || []).forEach(function(p) {
      if (!p || !p.id || seen.has(p.id)) return;
      seen.add(p.id); starting.push(p);
    });
    const subs = [];
    (sq.subs || []).forEach(function(p) {
      if (!p || !p.id || seen.has(p.id)) return;
      seen.add(p.id); subs.push(p);
    });
    return Object.assign({}, sq, { starting: starting, subs: subs, all: starting.concat(subs) });
  }
/*@CHUNK:c0126:END*/

/*@CHUNK:c0450:START*/

  let teamsFilter = 'all';
  let teamsSearch = '';
  let teamsSort = 'name';
  let tourTeamsSearch = '';
  let tourTeamsSort = 'name';
  let tourTeamsLeagueFilter = 'all';   // 'all' | one of DOMESTIC_LEAGUES | 'other'
  let tourTeamsRatingFilter = 'all';   // 'all' | 'elite' | 'great' | 'good' | 'dev' — see ovrTierMatches()
  // Authoritative record of which teams are checked for the tournament,
  // independent of the current search filter. renderTournamentTeamSelect()
  // only ever renders the pool matching the *current* search text, so a
  // team checked before a search narrows the list would otherwise vanish
  // from the DOM entirely — reading "which teams are checked" back off
  // the DOM after that (the old approach) permanently forgets it, since
  // its checkbox no longer exists to read. Tracking selection here instead
  // means a team stays selected across searches until explicitly
  // unchecked, deselected, or the format/pool changes.
  let tourSelectedTeamIds = new Set();
  // Which tournamentType tourSelectedTeamIds currently belongs to — lets
  // selectTournamentFormat() (below) tell a genuine format switch (pool of
  // eligible teams actually changed, selection should reset) apart from
  // just re-entering the Tournament tab with the same format still active
  // (selection should be left exactly as the person set it). Restored
  // from storage in loadPersistedGameState() (simulation/seasonEngine.js)
  // alongside tourSelectedTeamIds itself, so a hard refresh doesn't lose a
  // manually-trimmed selection (e.g. 36 of 48 eligible teams).
  let tourSelectedTeamIdsType = null;

/*@CHUNK:c0450:END*/

/*@CHUNK:c0451:START*/
  function teamAvgOvr(t) {
    const ps = t.players || [];
    if (!ps.length) return 0;
    return ps.reduce((s, p) => s + (p.ovr || 70), 0) / ps.length;
  }
/*@CHUNK:c0451:END*/

/*@CHUNK:c0452:START*/

  let teamsLeagueFilter = 'all';   // 'all' | one of DOMESTIC_LEAGUES | 'other'
  let teamsRatingFilter = 'all';   // 'all' | 'elite' | 'great' | 'good' | 'dev' — see ovrTierMatches() (js/state.js)

  // The five domestic leagues teams.json/leagues.json both know about — used
  // to build the Teams tab's League filter. National teams, and any club not
  // currently in one of these five (older/other-season squads, cup-only
  // entries), fall into the 'other' bucket rather than being hidden.
  const DOMESTIC_LEAGUES = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];

/*@CHUNK:c0452:END*/

/*@CHUNK:c0453:START*/
  function filterTeams(type) {
    teamsFilter = type || 'all';
    renderTeamsList();
  }
/*@CHUNK:c0453:END*/

/*@CHUNK:c0454:START*/
  function filterTeamsLeague(league) {
    teamsLeagueFilter = league || 'all';
    renderTeamsList();
  }
/*@CHUNK:c0454:END*/

/*@CHUNK:c0455:START*/
  // Debounced — the full team pool can run into the hundreds once every
  // league/competition is loaded, and renderTeamsList() does a full
  // innerHTML rebuild, so filtering + re-rendering on every single
  // keystroke was a real source of typing lag on this page.
  const _debouncedRenderTeamsList = debounce(renderTeamsList, 150);
  function searchTeams(q) {
    teamsSearch = (q || '').trim().toLowerCase();
    _debouncedRenderTeamsList();
  }
/*@CHUNK:c0455:END*/

/*@CHUNK:c0456:START*/
  function filterTeamsRating(tier) {
    teamsRatingFilter = tier || 'all';
    renderTeamsList();
  }
/*@CHUNK:c0456:END*/

/*@CHUNK:c0457:START*/
  function sortTeams(mode) {
    teamsSort = mode || 'name';
    renderTeamsList();
  }
/*@CHUNK:c0457:END*/

/*@CHUNK:c0458:START*/

/*@CHUNK:c0458:END*/

/*@CHUNK:c0459:START*/
  function getFilteredTeamsList() {
    let list = allTeams;
    if (teamsFilter === 'national') list = teamsData.national || [];
    if (teamsFilter === 'club') list = teamsData.club || [];
    if (teamsLeagueFilter !== 'all') {
      // Reuses getLeagueTeamPool() (simulation/seasonEngine.js) — the same
      // name-matching Season Calendar auto-fill relies on — so "Premier
      // League" here means exactly the clubs Season Calendar would offer.
      if (teamsLeagueFilter === 'other') {
        const known = new Set();
        DOMESTIC_LEAGUES.forEach(name => getLeagueTeamPool(name).forEach(t => known.add(t.id)));
        list = list.filter(t => !known.has(t.id));
      } else {
        const ids = new Set(getLeagueTeamPool(teamsLeagueFilter).map(t => t.id));
        list = list.filter(t => ids.has(t.id));
      }
    }
    if (teamsRatingFilter !== 'all') {
      list = list.filter(t => ovrTierMatches(teamAvgOvr(t), teamsRatingFilter));
    }
    if (teamsSearch) {
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(teamsSearch) ||
        (t.short || '').toLowerCase().includes(teamsSearch) ||
        ((t.manager && t.manager.name) || '').toLowerCase().includes(teamsSearch)
      );
    }
    list = [...list];
    if (teamsSort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (teamsSort === 'ovr') list.sort((a, b) => teamAvgOvr(b) - teamAvgOvr(a));
    else if (teamsSort === 'players') list.sort((a, b) => (b.players || []).length - (a.players || []).length);
    else if (teamsSort === 'flag') list.sort((a, b) => (a.flag || '').localeCompare(b.flag || '') || (a.name || '').localeCompare(b.name || ''));
    return list;
  }
/*@CHUNK:c0459:END*/

/*@CHUNK:c0460:START*/

/*@CHUNK:c0460:END*/

/*@CHUNK:c0461:START*/
  function renderTeamsList() {
    const list = getFilteredTeamsList();
    const el = document.getElementById('teams-list');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No teams match your search.</p></div>';
      return;
    }
    el.innerHTML = list.map(t => {
      const ovr = teamAvgOvr(t).toFixed(0);
      const primary = t.color || '#d4af37';
      const formKey = pickTeamFormation(t);
      const formName = (FORMATIONS[formKey] && FORMATIONS[formKey].name) || formKey;
      return `<div class="team-check" style="cursor:pointer;border-left:3px solid ${primary}" onclick="App.showTeamProfile('${t.id}')">
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <span style="font-size:1.5rem">${teamMark(t, 32)}</span>
          <div style="flex:1;min-width:0">
            <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</strong>
            <div style="font-size:0.75rem;color:var(--text-2)">${(t.players || []).length} players · ${t.short || ''} · ${formName}</div>
            <div style="font-size:0.7rem;color:var(--gold);display:flex;align-items:center;gap:4px">${t.manager && t.manager.name ? managerAvatarMark(t.manager, 16) : ''}${(t.manager && t.manager.name) || ''} · ${getManagerPlaystyle(t)}</div>
          </div>
          <button type="button" class="lineup-btn" title="View lineup" aria-label="View ${t.name} lineup" onclick="event.stopPropagation();App.showTeamLineup('${t.id}')">🧩</button>
          <span class="player-ovr">${ovr}</span>
        </div>
      </div>`;
    }).join('');
  }
/*@CHUNK:c0461:END*/

/*@CHUNK:tlu001:START*/

  // ========== TEAM LINEUP VIEWER (Teams tab) ==========
  // Shows a team's best XI laid out on the same pitch visual used for live
  // matches (.mini-pitch/.team-pitch + .player-dot markers), without
  // needing an actual match in progress. Builds a fresh best-XI via
  // buildSquad() using the team's own preferred formation (pickTeamFormation)
  // so the shape and starters match what a match kickoff would auto-select.
  function renderTeamLineupPitchHTML(team) {
    const formKey = pickTeamFormation(team);
    const form = FORMATIONS[formKey] || FORMATIONS['4-3-3'];
    const squad = buildSquad(team, formKey);
    const coords = form.coords || [];
    const slots = form.slots || [];
    const primary = team.color || '#1a237e';
    const secondary = team.secondary || '#ffffff';

    // Same 3-pass slot-assignment algorithm as drawTeam() in
    // ui/matchUI.js (the kickoff/live-match pitch), rather than the
    // single-pass index lookup this used to do. buildSquad() compacts its
    // `starting` array — a formation slot nobody on the roster is even
    // loosely eligible for (no natural fit AND no canPlay() alternate; see
    // buildSquad() above) is dropped entirely rather than left as a gap,
    // then padded back to 11 by appending whichever players were left
    // over, tagged with THEIR OWN position rather than the slot that's
    // actually still empty. Once that happens, `starting[i]` no longer
    // lines up with `slots[i]`, and looking players up by array index
    // (falling back to "just grab the next unused starter" the moment the
    // index/slot-code lookup both miss) was pulling in whichever leftover
    // happened to be unused yet — a reserve full-back or keeper — and
    // drawing them at a completely unrelated pitch spot (e.g. up front at
    // ST) instead of near the gap they were actually filling in for. This
    // instead only ever falls back to "next remaining player" once every
    // slot's had a fair shot at an exact/loose positional match, exactly
    // like the live-match pitch does, so the two views agree.
    const pool = squad.starting || [];
    const assigned = new Set();
    const slotPlayers = [];
    slots.forEach((slot, idx) => {
      const pick = pool.find(p => !assigned.has(p.id) && p.slot === slot);
      if (pick) { assigned.add(pick.id); slotPlayers[idx] = pick; }
    });
    slots.forEach((slot, idx) => {
      if (slotPlayers[idx]) return;
      let pick = pool.find(p => !assigned.has(p.id) && (p.pos || []).includes(slot));
      if (!pick) pick = pool.find(p => !assigned.has(p.id) && canPlay(p, slot));
      if (!pick) pick = pool.find(p => !assigned.has(p.id));
      if (pick) { assigned.add(pick.id); slotPlayers[idx] = pick; }
    });
    pool.forEach(p => {
      if (assigned.has(p.id)) return;
      const empty = slots.findIndex((_, i) => !slotPlayers[i]);
      if (empty >= 0) { slotPlayers[empty] = p; assigned.add(p.id); }
    });

    // Captain armband + set-piece duty badges — same roles a kickoff would
    // assign, computed fresh from this preview XI (see roleBadgesForPreview()
    // / assignMatchRoles() in engine/matchRoles.js) since there's no live
    // match here to read them off of. Must pass `team` here (same as
    // matchEngine.js does for a real kickoff) so this team's persisted
    // default roles (team.roles, set from the Transfer Tool) are honored —
    // without it, assignMatchRoles() had no side.team to read those
    // defaults from and silently fell back to a pure auto-pick, which
    // could name a completely different captain/kicker than an actual
    // match with this team would.
    const previewRoles = pool.length ? assignMatchRoles({ team: team, squad: { starting: pool } }) : null;

    const used = [];
    let dots = '';
    slotPlayers.forEach((p, idx) => {
      if (!p) return;
      const c = coords[idx] || [50, 50];
      let x = c[0], y = c[1];
      if (idx !== 0) {
        for (let t = 0; t < 8; t++) {
          const hit = used.find(u => Math.hypot((u.x - x) * 1.5, u.y - y) < 16);
          if (!hit) break;
          const dir = (x - 50) >= 0 ? 1 : -1;
          x += dir * 4;
          x = Math.max(8, Math.min(92, x));
        }
        used.push({ x, y });
      }
      const roleBadges = roleBadgesForPreview(previewRoles, p.id);
      dots += `<div class="player-dot" style="left:${x}%;top:${y}%;background:${primary};border:2px solid ${secondary}">
        <span class="dot-pos">${slots[idx] || ''}</span>
        <span class="dot-avatar">${playerAvatarMark(p)}</span>${roleBadges}
        <span class="dot-label"><span class="dot-num">${p.num || ''}</span><span class="dot-name">${playerNameHTML(p, abbreviateName(p.name))}</span></span>
      </div>`;
    });

    const mgrStyle = getManagerPlaystyle(team);
    const mgrDot = team.manager && team.manager.name
      ? `<div class="player-dot manager-dot" style="left:9%;top:11%">
        <span class="dot-avatar">${managerAvatarMark(team.manager, 46)}</span>
        <span class="dot-label"><span class="dot-name">${team.manager.name}${mgrStyle ? ' · ' + mgrStyle : ''}</span></span>
      </div>` : '';
    return `<div class="mini-pitch team-pitch">
      <div class="pitch-label">${teamMark(team, 16)} ${team.short || team.name} · ${form.name}</div>
      ${dots}
      ${mgrDot}
    </div>`;
  }

  function showTeamLineup(teamId) {
    const team = getTeam(teamId);
    if (!team) { toast('Team not found'); return; }
    const modal = document.getElementById('lineup-modal');
    const content = document.getElementById('lineup-modal-content');
    if (!modal || !content) return;
    content.innerHTML = `
      <div class="card-title" style="display:flex;align-items:center;gap:8px">${teamMark(team, 22)} ${team.name} — Lineup</div>
      <div class="pitch-wrap">${renderTeamLineupPitchHTML(team)}</div>
    `;
    modal.classList.add('active');
  }
/*@CHUNK:tlu001:END*/

/*@CHUNK:c0462:START*/

/*@CHUNK:c0462:END*/

/*@CHUNK:c0463:START*/
  // Debounced: the club pool can run to a few hundred teams (all five
  // domestic leagues' worth once selected), and renderTournamentTeamSelect()
  // does a full innerHTML rebuild plus re-attaches two listeners per team —
  // doing that on every single keystroke was the main source of typing lag
  // in the tournament team search. Waiting a beat after typing stops keeps
  // the search feeling instant without re-rendering on every keypress.
  let _tourSearchDebounceTimer = null;
  function searchTournamentTeams(q) {
    const value = (q || '').trim().toLowerCase();
    clearTimeout(_tourSearchDebounceTimer);
    _tourSearchDebounceTimer = setTimeout(() => {
      tourTeamsSearch = value;
      renderTournamentTeamSelect();
    }, 160);
  }
/*@CHUNK:c0463:END*/

/*@CHUNK:c0463b:START*/
  // Sort/League/Rating filters for the Tournament tab's team picker — same
  // controls as the Teams tab (sortTeams/filterTeamsLeague/filterTeamsRating
  // above), reused here so people can narrow a large eligible pool (e.g.
  // World Cup's 48+ national teams, or Champions League's few hundred
  // clubs) down to the teams they actually want, instead of only being able
  // to search by name.
  function sortTournamentTeams(mode) {
    tourTeamsSort = mode || 'name';
    renderTournamentTeamSelect();
  }

  function filterTournamentTeamsLeague(league) {
    tourTeamsLeagueFilter = league || 'all';
    renderTournamentTeamSelect();
  }

  function filterTournamentTeamsRating(tier) {
    tourTeamsRatingFilter = tier || 'all';
    renderTournamentTeamSelect();
  }
/*@CHUNK:c0463b:END*/

/*@CHUNK:c0596:START*/

/*@CHUNK:c0596:END*/

/*@CHUNK:c0597:START*/
  function goToSquadBuilder() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    window._tourFixtureIdx = null;
    window._uclFixtureIdx = null;
    window._koRoundIdx = null;
    window._koMatchIdx = null;
    window._fromTournament = false;
    window._seasonFixture = null;
    window._backTarget = null;
    currentSeasonComp = null;
    toast('Pick teams & formations, then Kick Off. Lineups are auto-built by formation.');
  }
/*@CHUNK:c0597:END*/

/*@CHUNK:ctml01:START*/

  // ========== TEAM MATCH LOG ==========
  // teamMatchLog[teamId] -> array of entries, newest first, capped per
  // team so persisted save size stays bounded. Populated at full-time for
  // both sides — see recordTeamMatchLog() in engine/matchEngine.js.
  //
  // Current entries are compact arrays: [opponentTeamId, competition,
  // scoreFor, scoreAgainst]. Opponent name/short/logo/flag are looked up
  // from opponentTeamId via getTeam(), and the W/D/L result tag is derived
  // from scoreFor vs scoreAgainst, instead of persisting all of that on
  // every entry (see readTeamLogEntry()).
  //
  // Saves made before this format change still have plain objects
  // ({opponent, opponentShort, opponentLogo, opponentFlag, competition,
  // scoreFor, scoreAgainst, result}) sitting in the 30-entry cap — those
  // age out naturally as new matches are recorded, and readTeamLogEntry()
  // understands both shapes in the meantime so old saves keep rendering.
  let teamMatchLog = {};

/*@CHUNK:ctml01:END*/

/*@CHUNK:ctml01b:START*/

  const TML_OPP = 0, TML_COMP = 1, TML_FOR = 2, TML_AGAINST = 3;

  // Normalizes one teamMatchLog entry (new compact array OR legacy
  // object) into a plain object the renderer can use uniformly.
  function readTeamLogEntry(e) {
    if (Array.isArray(e)) {
      const opp = getTeam(e[TML_OPP]);
      const scoreFor = e[TML_FOR], scoreAgainst = e[TML_AGAINST];
      return {
        opponentShort: (opp && (opp.short || opp.name)) || '—',
        opponentLogo: opp ? opp.logo : null,
        opponentFlag: opp ? opp.flag : null,
        competition: e[TML_COMP],
        scoreFor: scoreFor,
        scoreAgainst: scoreAgainst,
        result: scoreFor > scoreAgainst ? 'W' : scoreFor < scoreAgainst ? 'L' : 'D'
      };
    }
    // Legacy object-shaped entry from a pre-format-change save.
    return {
      opponentShort: e.opponentShort || e.opponent || '—',
      opponentLogo: e.opponentLogo,
      opponentFlag: e.opponentFlag,
      competition: e.competition,
      scoreFor: e.scoreFor,
      scoreAgainst: e.scoreAgainst,
      result: e.result
    };
  }

/*@CHUNK:ctml01b:END*/

/*@CHUNK:ctml02:START*/

  // Renders a team's recent-results log (last 10) with a colored W/D/L tag
  // per row and the opponent's logo + abbreviation. Shares the same
  // "Match Log" look as renderPlayerMatchLogHTML in ui/playersUI.js, and is
  // dropped straight into the team profile modal — see showTeamProfile()
  // in ui/playerUI.js.
  function renderTeamMatchLogHTML(teamId) {
    const log = teamMatchLog[teamId] || [];
    if (!log.length) return '';
    const resultClass = { W: 'result-w', D: 'result-d', L: 'result-l' };
    const rows = log.slice(0, 10).map(raw => {
      const e = readTeamLogEntry(raw);
      const oppMark = teamMark({ logo: e.opponentLogo, flag: e.opponentFlag }, 18);
      return `<div class="team-log-row">
        <span class="result-tag ${resultClass[e.result] || 'result-d'}">${e.result}</span>
        <span class="tlr-opp">${oppMark}<span class="tlr-opp-abbr">${e.opponentShort}</span></span>
        <span class="tlr-score">${e.scoreFor}-${e.scoreAgainst}</span>
        <span class="tlr-comp">${e.competition || ''}</span>
      </div>`;
    }).join('');
    return `<div class="card-title" style="margin-top:14px">Match Log <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem">(last ${Math.min(log.length, 10)})</span></div>
      <div class="match-log-wrap">${rows}</div>`;
  }

/*@CHUNK:ctml02:END*/
