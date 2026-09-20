/*@CHUNK:csp01:START*/

  // ===================================================================
  // ======================== SPATIAL MODEL =============================
  // ===================================================================
  // A shared, reusable layer of positional metrics for the possession
  // pipeline (engine/possession.js), defending (engine/defending.js), and
  // chance creation (engine/passing.js) — built on top of the SAME
  // coordinate convention the offside engine already established
  // (engine/offside.js's playerAdvancement()/defensiveLineContext()):
  // every on-pitch player has an (x,y) implied by their formation slot
  // (FORMATIONS[key].coords — js/state.js), collapsed to a 0-1
  // "advancement" value (0 = own goal, 1 = opponent's goal) that's
  // directly comparable between the two sides.
  //
  // This does NOT replace the existing 3-thirds x 3-channels zone
  // pipeline — it sits alongside it and answers questions the zone
  // labels alone can't: how deep/high the defensive line actually is,
  // how compact a back line is against its own midfield, how tightly a
  // specific marker is actually goal-side of the carrier, and whether a
  // zone is currently a numbers-up or numbers-down situation for the
  // side on the ball. Existing callers (defensivePressure(), chance
  // creation) fold these in as extra inputs to their existing rolls,
  // rather than as new independent dice.
  //
  // Nothing here is simulated frame-by-frame; it's recomputed cheaply
  // from each side's current on-pitch XI whenever a caller asks, which
  // matches the granularity (once or twice per minute, at zone
  // transitions) the rest of the possession pipeline already runs at.
  /*@CHUNK:csp01:END*/

  /*@CHUNK:csp02:START*/
  // On-pitch outfield players (goalkeeper excluded) for one side of the
  // current match, with their formation key attached to each lookup site
  // rather than assumed globally — same pattern as
  // offside.js::defensiveLineContext().
  function onPitchOutfield(sideKey) {
    const m = currentMatch;
    if (!m) return [];
    const teamSide = m[sideKey];
    if (!teamSide) return [];
    const ids = sideKey === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const all = (teamSide.squad && teamSide.squad.all) || [];
    return (ids || [])
      .map((id) => all.find((p) => p.id === id))
      .filter((p) => p && (p.slot || (p.pos || [])[0]) !== 'GK');
  }
  /*@CHUNK:csp02:END*/

  /*@CHUNK:csp02b:START*/
  // Shared line/channel helpers. POS_LINE (js/state.js) reports a
  // player's nominal line as 'FWD', not 'ATT' — normalizedLine() maps
  // that onto the DEF/MID/ATT vocabulary the rest of this module (and
  // the zone system's own third labels) use, and folds GK in as DEF so
  // an outfield-only caller never has to special-case it.
  const LINE_ORDER = { DEF: 0, MID: 1, ATT: 2 };
  function normalizedLine(p) {
    const line = lineOf(p);
    if (line === 'FWD') return 'ATT';
    if (line === 'GK') return 'DEF';
    return line;
  }
  // Which side of the pitch a slot naturally occupies, straight off its
  // name (RB/RM/RW/RWB -> 'R', LB/LM/LW/LWB -> 'L', everything else,
  // including every central slot, -> 'C') — the same convention the
  // formation slot codes already follow everywhere else in the engine.
  function naturalChannelOf(slot) {
    if (/^R/.test(slot)) return 'R';
    if (/^L/.test(slot)) return 'L';
    return 'C';
  }
  /*@CHUNK:csp02b:END*/

  /*@CHUNK:csp02c:START*/
  // ===== Shared pitch frame =====
  // Every formation coordinate (FORMATIONS[key].coords, or a hand-built
  // squad.customCoords shape) is written in the OWNING side's own frame:
  // that side attacks "up" the page, its own goal line sits at y~92, and
  // x=0 is its own left touchline. That's ideal for drawing one team on
  // its own mini-pitch and useless for measuring anything BETWEEN the two
  // teams — an away CB and a home ST both read as "y~75 / y~18".
  //
  // toSharedFrame() puts both teams on ONE 0-100 x 0-100 pitch by taking
  // the home side's frame as the reference (untouched) and rotating the
  // away side 180 degrees onto it: x' = 100 - x, y' = 100 - y. After that
  // the home side defends the high-y end and attacks toward y=0, the away
  // side defends the low-y end and attacks toward y=100, and a plain
  // Euclidean distance between any two players (or a player and the ball)
  // means what it says.
  const PITCH_MAX = 100;
  function toSharedFrame(sideKey, x, y) {
    return sideKey === 'away' ? { x: PITCH_MAX - x, y: PITCH_MAX - y } : { x: x, y: y };
  }

  // Shared-frame position of every on-pitch player on one side, keyed by
  // player id. Formation slot codes repeat (two CBs, two CMs, two STs), so
  // a plain formation.slots.indexOf(slot) would give BOTH centre-backs the
  // first CB's x — harmless for the y-only advancement maths elsewhere in
  // this file, but wrong the moment x matters. Players are therefore
  // dealt into slot INDEXES the same way the pitch view does it
  // (ui/matchUI.js::renderPitch, "Pass 1/Pass 2"): a player's own recorded
  // .slot claims the first still-free slot of that code, then leftover
  // slots fall back to secondary position / canPlay() / whoever is left.
  // A hand-built shape (squad.customCoords) is honoured just like the
  // pitch view honours it.
  function sidePitchLayout(sideKey) {
    const m = currentMatch;
    const squad = m && m[sideKey] && m[sideKey].squad;
    if (!squad) return {};
    const form = FORMATIONS[squad.formation] || FORMATIONS['4-3-3'];
    const coords = squad.customCoords || form.coords || [];
    const slots = form.slots || [];
    const ids = (sideKey === 'home' ? m.homeOnPitch : m.awayOnPitch) || [];
    const all = squad.all || [];
    const players = ids.map((id) => all.find((p) => p.id === id)).filter(Boolean);
    const bySlot = [];
    const used = new Set();
    const claim = (idx, p) => { used.add(p.id); bySlot[idx] = p; };
    slots.forEach((slot, idx) => {
      const p = players.find((q) => !used.has(q.id) && q.slot === slot);
      if (p) claim(idx, p);
    });
    slots.forEach((slot, idx) => {
      if (bySlot[idx]) return;
      const p = players.find((q) => !used.has(q.id) && (q.pos || []).includes(slot))
        || players.find((q) => !used.has(q.id) && canPlay(q, slot))
        || players.find((q) => !used.has(q.id));
      if (p) claim(idx, p);
    });
    const layout = {};
    bySlot.forEach((p, idx) => {
      const c = coords[idx] || [50, 50];
      layout[p.id] = toSharedFrame(sideKey, c[0], c[1]);
    });
    return layout;
  }

  // {x, y} of one on-pitch player in the shared frame, or null if they
  // aren't on the pitch (bench, sent off) or there is no live match.
  function playerPitchPos(p) {
    const ctx = playerSideData(p);
    if (!ctx) return null;
    return sidePitchLayout(ctx.sideKey)[p.id] || null;
  }

  // Accepts either a player object or an already-resolved shared-frame
  // {x, y} point (e.g. m.ballPos) so the geometry helpers below take both.
  function toPitchPoint(o) {
    if (!o) return null;
    if (typeof o.x === 'number' && typeof o.y === 'number') return o;
    return playerPitchPos(o);
  }

  // ===== Ball position =====
  // A {third, channel} zone resolved to a point: the CENTRE of that zone
  // in the possessing side's own frame (thirds of the 0-100 pitch, own
  // goal at y=100 / attacking end at y=0, L = low x), then run through
  // toSharedFrame() so it lands in the same frame as the players.
  const ZONE_CENTER_Y = { DEF: 83.3, MID: 50, ATT: 16.7 };
  const ZONE_CENTER_X = { L: 16.7, C: 50, R: 83.3 };
  function ballPointForZone(sideKey, third, channel) {
    const y = ZONE_CENTER_Y[third];
    const x = ZONE_CENTER_X[channel];
    return toSharedFrame(sideKey, x != null ? x : 50, y != null ? y : 50);
  }

  // The one place m.ballZone is written. ballZone keeps its exact old
  // shape (ui/matchUI.js::computeDynamicPosition reads it), and ballPos is
  // the same information as a shared-frame point.
  function setBallZone(sideKey, third, channel) {
    const m = currentMatch;
    if (!m) return;
    m.ballZone = { side: sideKey, third: third, channel: channel };
    m.ballPos = ballPointForZone(sideKey, third, channel);
  }
  /*@CHUNK:csp02c:END*/

  /*@CHUNK:csp03:START*/
  // Average advancement (own-frame, per playerAdvancement() in
  // offside.js) of each of a side's three tactical lines right now, from
  // whoever is actually on the pitch — not the formation's static
  // template. Falls back to a neutral, evenly-spaced shape if a line is
  // empty (e.g. a back-three system has no natural "wide" DEF body).
  function teamLineAdvancements(sideKey) {
    const m = currentMatch;
    const teamSide = m && m[sideKey];
    const formationKey = teamSide && teamSide.squad && teamSide.squad.formation;
    const groups = { DEF: [], MID: [], ATT: [] };
    onPitchOutfield(sideKey).forEach((p) => {
      const line = normalizedLine(p);
      (groups[line] || groups.MID).push(playerAdvancement(p, formationKey));
    });
    const avg = (arr, fallback) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback);
    return {
      DEF: avg(groups.DEF, 0.18),
      MID: avg(groups.MID, 0.5),
      ATT: avg(groups.ATT, 0.82)
    };
  }
  /*@CHUNK:csp03:END*/

  /*@CHUNK:csp04:START*/
  // Defensive line height in the same universal "shared" units offside.js
  // already computes (higher = further up the pitch, comparable between
  // sides) — a thin wrapper so callers outside offside.js don't need to
  // know its internal lineShared/lineAdv naming.
  function defensiveLineHeight(sideKey) {
    const m = currentMatch;
    const teamSide = m && m[sideKey];
    if (!teamSide) return 0.3;
    return defensiveLineContext(teamSide, sideKey).lineShared;
  }
  /*@CHUNK:csp04:END*/

  /*@CHUNK:csp05:START*/
  // How compact a side's back line is against its own midfield right now
  // (own-frame advancement gap between the two lines) — a small gap is a
  // team defending as a coordinated, compact block; a large one means
  // real space for an attacker to run into between the lines. Bounded to
  // a sane range so a temporarily empty line can't return a nonsense
  // (near-zero or negative) gap.
  function lineCompactness(sideKey) {
    const lines = teamLineAdvancements(sideKey);
    return Math.max(0.08, Math.min(0.75, lines.MID - lines.DEF));
  }
  /*@CHUNK:csp05:END*/

  /*@CHUNK:csp06:START*/
  // Real marking distance between a ball carrier and the marker sent to
  // close them down: the straight-line (Euclidean) distance between the
  // two players' positions on the shared 0-100 x 0-100 pitch (see
  // toSharedFrame() above), so it's in pitch-percent units and counts the
  // sideways gap as well as the vertical one. It used to be only the
  // vertical gap between the two players' advancement values, i.e. a
  // marker standing on the far touchline read as "tight" as long as he
  // was on the right line. Falls back to a neutral 30 when either player
  // has no position (not on the pitch / no live match).
  function markingDistance(carrier, marker) {
    const a = toPitchPoint(carrier), b = toPitchPoint(marker);
    if (!a || !b) return 30;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  /*@CHUNK:csp06:END*/

  /*@CHUNK:csp06b:START*/
  // Shortest distance from point p to the SEGMENT a-b (not the infinite
  // line through it): p is projected onto a-b, the projection is clamped
  // to the segment's ends, and the distance is measured to that clamped
  // point. A point beyond either end is therefore measured to that end
  // rather than to an imaginary extension of the line.
  function pointToSegmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  // A defender within this many pitch-percent units of the pass line is
  // close enough to get a foot/body on it.
  const LANE_BLOCK_RADIUS = 4;

  // Is the straight passing lane from `from` to `to` free of defenders?
  // `from` / `to` / each entry of `defenders` may be a player object or a
  // shared-frame {x, y} point. A defender blocks the lane when his
  // distance to the from->to SEGMENT is under `laneRadius`, which (per
  // pointToSegmentDistance) includes one standing right on the passer or
  // the receiver. Anyone without a position is ignored; with nothing to
  // go on the lane is reported open.
  function passingLaneOpen(from, to, defenders, laneRadius) {
    const a = toPitchPoint(from), b = toPitchPoint(to);
    if (!a || !b) return true;
    const radius = laneRadius == null ? LANE_BLOCK_RADIUS : laneRadius;
    return !(defenders || []).some((d) => {
      const pt = toPitchPoint(d);
      return pt && pointToSegmentDistance(pt, a, b) < radius;
    });
  }
  /*@CHUNK:csp06b:END*/

  /*@CHUNK:csp06c:START*/
  // How wide an angle (radians) a defender's body blocks off from the
  // passer's view of the pitch behind him: the visual angle a disc of
  // `bodyRadius` subtends at the ball, 2 * asin(r / d). It is widest when
  // the defender is right on the ball (capped at PI once he is within one
  // body radius of it) and shrinks with distance. `ball` is a shared-frame
  // {x, y} point (m.ballPos) or a player; if omitted, the live ball is used.
  const DEFENDER_BODY_RADIUS = 1;
  function coverShadow(defender, ball, bodyRadius) {
    const d = toPitchPoint(defender);
    const b = toPitchPoint(ball || (currentMatch && currentMatch.ballPos));
    if (!d || !b) return 0;
    const r = bodyRadius == null ? DEFENDER_BODY_RADIUS : bodyRadius;
    const dist = Math.hypot(d.x - b.x, d.y - b.y);
    if (dist <= r) return Math.PI;
    return 2 * Math.asin(r / dist);
  }
  /*@CHUNK:csp06c:END*/

  /*@CHUNK:csp07:START*/
  // How much of a given on-pitch player's attention is actually in a
  // given zone right now — a soft, continuous read instead of "is this
  // slot on the zone's eligible-position list" (ZONE_POS_MAP), which
  // only ever reflects a player's TYPICAL role and can't see a fullback
  // who's pushed forward on the overlap while the rest of his back line
  // holds. Built from: how far the zone's third sits from the player's
  // own tactical line, how well the zone's channel matches the side of
  // the pitch his slot naturally plays, then adjusted by the team's
  // current tactical stance and manager DNA — overlaps/width specifically
  // push a wide defender's presence further up the pitch than his line
  // alone would suggest, positionalFreedom loosens everyone's positional
  // discipline in general. Returns roughly 0.04-1, never exactly 0, since
  // nobody's presence anywhere is truly impossible, just unlikely.
  function zonePresence(player, zoneKey, sideKey) {
    const m = currentMatch;
    const [zThird, zChannel] = zoneKey.split('_');
    const slot = player.slot || (player.pos || [])[0] || 'CM';
    const pLine = normalizedLine(player);
    const lineDist = Math.abs((LINE_ORDER[zThird] != null ? LINE_ORDER[zThird] : 1)
      - (LINE_ORDER[pLine] != null ? LINE_ORDER[pLine] : 1));
    let lineWeight = lineDist === 0 ? 1 : lineDist === 1 ? 0.35 : 0.08;

    const natChannel = naturalChannelOf(slot);
    let channelWeight = natChannel === zChannel ? 1 : (natChannel === 'C' || zChannel === 'C') ? 0.5 : 0.12;

    const teamSide = m && m[sideKey];
    const dna = teamSide ? getManagerDNA(teamSide.team) : null;
    if (dna) {
      // A genuinely fluid side doesn't stay in its lanes — loosen both
      // penalties toward "could be anywhere" as positional freedom rises.
      lineWeight = lineWeight + (1 - lineWeight) * dna.positionalFreedom * 0.4;
      channelWeight = channelWeight + (1 - channelWeight) * dna.positionalFreedom * 0.3;

      // The overlapping-fullback case a static list can't see: a wide
      // defender specifically trying to occupy a MORE ADVANCED zone on
      // his own natural side gets a direct presence bonus from the
      // manager's overlap/width DNA. Never applied dropping back, so it
      // can't inflate his presence in his own defensive third.
      const isWideDefender = slot === 'RB' || slot === 'LB' || slot === 'RWB' || slot === 'LWB';
      if (isWideDefender && LINE_ORDER[zThird] > LINE_ORDER.DEF && natChannel === zChannel) {
        lineWeight += (dna.overlaps - 0.5) * 0.5 + (dna.width - 0.5) * 0.25;
      }

      // Overall attacking/defensive stance shifts the whole side's
      // weight toward or away from advanced zones — the same directional
      // effect the pitch view's own live dot-shifting already models
      // (ui/matchUI.js::computeDynamicPosition), just feeding zone
      // presence here instead of a rendered position.
      const tac = (m.tactics && m.tactics[sideKey]) || 'balanced';
      const advanceBias = tac === 'attack' ? 0.12 : tac === 'press' ? 0.06 : tac === 'defend' ? -0.12 : 0;
      if (advanceBias !== 0) {
        const towardAdvanced = LINE_ORDER[zThird] > LINE_ORDER[pLine];
        lineWeight += towardAdvanced ? advanceBias : -advanceBias * 0.6;
      }
    }

    return Math.max(0.04, Math.min(1, lineWeight * channelWeight));
  }

  // Summed zone presence across each side's on-pitch XI, attacking side
  // in the zone as given, defending side in its mirrored (same physical
  // area) zone — a positive result is a genuine attacking overload
  // there, negative is the defence outnumbering the attack. Same
  // signature as before, so existing callers (decisionModel.js,
  // possession.js) don't need to change, just get a truer number.
  function localOverload(attackingSide, defendingSide, zoneKey) {
    const defZoneKey = mirrorZoneKey(zoneKey);
    const attPresence = onPitchOutfield(attackingSide)
      .reduce((sum, p) => sum + zonePresence(p, zoneKey, attackingSide), 0);
    const defPresence = onPitchOutfield(defendingSide)
      .reduce((sum, p) => sum + zonePresence(p, defZoneKey, defendingSide), 0);
    return attPresence - defPresence;
  }
  /*@CHUNK:csp07:END*/

  /*@CHUNK:csp08:START*/
  // Which vertical band of the pitch a player's formation slot sits in
  // right now — wide, half-space, or central — read straight off the
  // formation's own x-coordinates rather than a fixed per-position
  // assumption (a back-three's wide centre-back and a back-four's
  // winger can both be "wide" or not depending on the actual shape).
  function halfSpaceOf(p) {
    const ctx = playerSideData(p);
    if (!ctx) return 'central';
    const formationKey = ctx.side.squad && ctx.side.squad.formation;
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const slot = p.slot || (p.pos || [])[0] || 'CM';
    const idx = formation.slots.indexOf(slot);
    const x = (formation.coords[idx >= 0 ? idx : 0] || [50, 50])[0];
    if (x < 20 || x > 80) return x < 20 ? 'wideLeft' : 'wideRight';
    if (x < 40 || x > 60) return x < 40 ? 'halfSpaceLeft' : 'halfSpaceRight';
    return 'central';
  }
  /*@CHUNK:csp08:END*/

  /*@CHUNK:csp09:START*/
  // A single ready-made chance-quality adjustment for the final-third
  // decision in passing.js::resolveChanceCreation() — a high, stretched
  // defensive line (high defensiveLineHeight, wide lineCompactness gap)
  // genuinely creates more/better through-ball and cutback opportunities
  // than a deep, compact block, independent of either side's raw
  // attributes. Centered near 0 for an average mid-block so it nudges
  // the existing roll rather than dominating it.
  function chanceSpaceBonus(defendingSide) {
    const height = defensiveLineHeight(defendingSide); // ~0-1, higher = defensive line pushed up
    const gap = lineCompactness(defendingSide);         // ~0.08-0.75, higher = more stretched
    const bonus = (height - 0.32) * 0.05 + (gap - 0.25) * 0.06;
    return Math.max(-0.05, Math.min(0.08, bonus));
  }
  /*@CHUNK:csp09:END*/
