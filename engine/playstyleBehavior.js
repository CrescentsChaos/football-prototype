/*@CHUNK:cpsb01:START*/

  // ===== Playstyle behavior profiles ============================================
  // Internal behavioral parameters for each individual (eFootball-style)
  // playstyle tag — see PLAYSTYLE_DESCRIPTIONS in data/playerDatabase.js for
  // the canonical list of tag names this keys off of.
  //
  // These are NOT raw attribute values (that's what PLAYSTYLE_STAT_MODS /
  // PLAYSTYLE_KEY_ATTRS in data/playerDatabase.js already do — they nudge a
  // player's derived att/def/pac/phy/tec numbers). This table instead shapes
  // *decision-making and in-match behavior*: which actions a player reaches
  // for on the ball, how much of an edge specific styles give in shooting/
  // defending/goalkeeping situations, independent of the attribute sheet.
  // Two players with an identical attribute sheet but different playstyle
  // tags should play noticeably differently — that's what this file is for.
  //
  // Shape per style (every field optional — omit anything that shouldn't
  // move for that style):
  //   actions:  { <BALL_ACTIONS entry>: multiplier, ... }
  //             Read by playstyleActionMult() and applied in
  //             evaluateBallActions() (engine/decisionModel.js) — shapes the
  //             pass/dribble/carry/shoot/cross/throughball/backpass/switch/
  //             hold decision every time this player has the ball.
  //   finishingEdge, aerialEdge, penEdge, fkEdge, dribbleEdge:
  //             Flat additive edges read by playstyleEdgeSum() from the
  //             matching functions in engine/shooting.js.
  //   defChance, interceptBias:
  //             Flat additive edges read by playstyleEdgeSum() from
  //             defActionEdge() in engine/defending.js.
  //   gkReflexEdge, gkPositioningEdge:
  //             Flat additive edges read by playstyleEdgeSum() from
  //             gkReflexEdge()/gkPositioningEdge() in engine/goalkeeper.js —
  //             only meaningful for the two goalkeeper styles.
  //
  // A player can carry more than one tag; every field stacks (action
  // multipliers multiply together, edges sum), then playstyleActionMult()
  // clamps the compound multiplier to a sane [0.25, 2.5] range so a player
  // with several overlapping tags doesn't spiral into an absurd weight.
  const PLAYSTYLE_BEHAVIOR = {
    'Goal Poacher': {
      actions: { shoot: 1.35, hold: 1.25, dribble: 0.7, carry: 0.7 },
      finishingEdge: 0.03
    },
    'Fox in the Box': {
      actions: { shoot: 1.4, hold: 1.3, dribble: 0.6, carry: 0.6, cross: 0.8 },
      finishingEdge: 0.04,
      aerialEdge: 0.02
    },
    'Target Man': {
      actions: { hold: 1.4, dribble: 0.6, pass: 1.1 },
      aerialEdge: 0.1,
      finishingEdge: 0.01
    },
    'Deep-Lying Forward': {
      actions: { pass: 1.3, throughball: 1.6, hold: 1.1, shoot: 0.9 }
    },
    'Dummy Runner': {
      actions: { carry: 0.85, dribble: 1.05, hold: 0.8, shoot: 1.1 },
      dribbleEdge: 0.03,
      finishingEdge: 0.015
    },
    'Creative Playmaker': {
      actions: { throughball: 1.6, dribble: 1.15, pass: 1.1 },
      dribbleEdge: 0.02
    },
    'Hole Player': {
      actions: { pass: 1.1, throughball: 1.15, hold: 1.0, shoot: 1.15 },
      finishingEdge: 0.02
    },
    'Classic No. 10': {
      actions: { pass: 1.2, throughball: 1.6, cross: 0.9 },
      penEdge: 0.03,
      fkEdge: 0.03
    },
    'Prolific Winger': {
      actions: { cross: 1.5, dribble: 1.2 },
      dribbleEdge: 0.04
    },
    'Cross Specialist': {
      actions: { cross: 1.6, dribble: 0.9 },
      fkEdge: 0.02
    },
    'Roaming Flank': {
      actions: { carry: 1.15, throughball: 1.1, cross: 1.1 },
      dribbleEdge: 0.03
    },
    'Inside Forward': {
      actions: { dribble: 1.6, shoot: 1.2, cross: 0.7 },
      finishingEdge: 0.025,
      dribbleEdge: 0.04
    },
    'Box-to-Box': {
      actions: { carry: 1.3, dribble: 1.15, backpass: 0.85, hold: 0.85 },
      defChance: 0.005
    },
    'Destroyer': {
      actions: { backpass: 1.2, pass: 1.2, dribble: 0.6, throughball: 0.6, shoot: 0.6 },
      defChance: 0.012,
      interceptBias: 0.05,
      aerialEdge: 0.05
    },
    'Anchor Man': {
      actions: { backpass: 1.2, pass: 1.2, dribble: 0.6, throughball: 0.6, shoot: 0.6 },
      defChance: 0.008,
      interceptBias: 0.1,
      aerialEdge: 0.05
    },
    'Orchestrator': {
      actions: { pass: 1.25, switch: 1.25, dribble: 0.8, throughball: 1.3 },
      fkEdge: 0.02
    },
    'Build Up': {
      actions: { pass: 1.25, switch: 1.25, dribble: 0.8 },
      defChance: 0.005
    },
    'Extra Frontman': {
      actions: { carry: 1.2, cross: 1.2 },
      finishingEdge: 0.015
    },
    'Offensive Full-back': {
      actions: { carry: 1.2, cross: 1.2 }
    },
    'Defensive Full-back': {
      actions: { backpass: 1.15, pass: 1.1, cross: 0.8, carry: 0.85, dribble: 0.8 },
      defChance: 0.006,
      interceptBias: 0.04
    },
    'Full-back Finisher': {
      actions: { carry: 1.2, cross: 1.2, shoot: 1.1 },
      finishingEdge: 0.015
    },
    'Offensive Goalkeeper': {
      gkPositioningEdge: 0.02,
      gkReflexEdge: -0.01
    },
    'Defensive Goalkeeper': {
      gkReflexEdge: 0.02,
      gkPositioningEdge: -0.01
    },
    'Pass Disruptor': {
      actions: { backpass: 1.15, pass: 1.15, dribble: 0.65, throughball: 0.55, shoot: 0.6 },
      defChance: 0.006,
      interceptBias: 0.12
    },
    'Front Line Pressure': {
      actions: { shoot: 1.05, hold: 0.85, carry: 0.95, pass: 1.0 },
      defChance: 0.018,
      interceptBias: 0.02
    },
    'Attack Outlet': {
      actions: { shoot: 1.15, hold: 0.75, carry: 0.8, dribble: 0.8 },
      finishingEdge: 0.02
    },
    'High Line Master': {
      actions: { backpass: 1.1, pass: 1.15, dribble: 0.7, throughball: 0.6, shoot: 0.6 },
      defChance: 0.01,
      interceptBias: 0.07,
      aerialEdge: 0.04
    },
    'Covering Role': {
      actions: { backpass: 1.15, pass: 1.15, dribble: 0.65, throughball: 0.6, shoot: 0.6 },
      defChance: 0.009,
      interceptBias: 0.09
    },
    'Shadow Marker': {
      actions: { backpass: 1.15, pass: 1.1, dribble: 0.65, throughball: 0.55, shoot: 0.6 },
      defChance: 0.011,
      interceptBias: 0.1
    }
  };
/*@CHUNK:cpsb01:END*/

/*@CHUNK:cpsb02:START*/
  // Every individual playstyle tag a player currently carries (see
  // player-attributes.json's "playstyle" array), or [] if this player
  // has no expanded attribute sheet / no tags at all.
  function playstyleTagsOf(p) {
    return (p && p.expandedAttrs && p.expandedAttrs.playstyle) || [];
  }

  // Lazily compute and cache playstyle action multipliers and edge sums
  // on p.expandedAttrs._psCache to avoid repeated array iterations and
  // object property lookups across hot simulation loops.
  function getPlaystyleCache(p) {
    if (!p || !p.expandedAttrs) return null;
    const tags = p.expandedAttrs.playstyle;
    if (!tags || !tags.length) return null;
    let cache = p.expandedAttrs._psCache;
    if (cache && cache.tagsRef === tags) return cache;

    const actionMults = {};
    const edgeSums = {};
    for (let i = 0; i < tags.length; i++) {
      const entry = PLAYSTYLE_BEHAVIOR[tags[i]];
      if (entry) {
        if (entry.actions) {
          for (const act in entry.actions) {
            actionMults[act] = (actionMults[act] || 1) * entry.actions[act];
          }
        }
        for (const k in entry) {
          if (k !== 'actions' && typeof entry[k] === 'number') {
            edgeSums[k] = (edgeSums[k] || 0) + entry[k];
          }
        }
      }
    }
    for (const act in actionMults) {
      actionMults[act] = Math.max(0.25, Math.min(2.5, actionMults[act]));
    }
    cache = { tagsRef: tags, actionMults, edgeSums };
    p.expandedAttrs._psCache = cache;
    return cache;
  }

  // Compound action-weight multiplier for one BALL_ACTIONS entry, folding
  // in every playstyle tag the player carries (multiplicative — two
  // overlapping tags that both boost, say, "cross" compound). Clamped to
  // keep a heavily-tagged player's weights from spiralling out of the
  // range the rest of evaluateBallActions() expects. Returns 1 (no-op)
  // for a player with no relevant tags.
  function playstyleActionMult(p, action) {
    const cache = getPlaystyleCache(p);
    if (!cache) return 1;
    return cache.actionMults[action] || 1;
  }

  // Flat additive edge for a named field (finishingEdge/aerialEdge/penEdge/
  // fkEdge/dribbleEdge/defChance/interceptBias/gkReflexEdge/
  // gkPositioningEdge), summed across every playstyle tag the player
  // carries. Returns 0 for a player with no relevant tags.
  function playstyleEdgeSum(p, field) {
    const cache = getPlaystyleCache(p);
    if (!cache) return 0;
    return cache.edgeSums[field] || 0;
  }
/*@CHUNK:cpsb02:END*/
