/*@CHUNK:crng0000:START*/
  // ========== DETERMINISTIC RANDOMNESS (seeded PRNG) ==========
  // Replaces seededRandom() everywhere in the simulation so that, given the
  // same seed, every match/season/tournament plays out identically. This is
  // a mulberry32 generator: fast, tiny, and good enough statistical quality
  // for gameplay purposes (not cryptographic).
  const RNG_STORAGE_KEY = 'apex_rng_seed';

  function _hashSeed(str) {
    // Turns any string (or number) into a 32-bit unsigned int seed.
    let h = 1779033703 ^ String(str).length;
    for (let i = 0; i < String(str).length; i++) {
      h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1;
  }

  function _defaultSeed() {
    try {
      const stored = localStorage.getItem(RNG_STORAGE_KEY);
      if (stored) return _hashSeed(stored);
    } catch (e) { /* localStorage unavailable (e.g. file://) — fall through */ }
    return 0x2f6e2b1;
  }

  let _rngSeed = _defaultSeed();

  function _mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let _rngFn = _mulberry32(_rngSeed);

  // Drop-in replacement for seededRandom() used throughout the simulation.
  function seededRandom() {
    return _rngFn();
  }

  // Re-seeds the generator. Accepts a number or a string (hashed to a number).
  // Call this before starting a match/season/tournament to reproduce it later.
  function setRngSeed(seed) {
    _rngSeed = typeof seed === 'number' ? (seed >>> 0) : _hashSeed(seed);
    _rngFn = _mulberry32(_rngSeed);
    try { localStorage.setItem(RNG_STORAGE_KEY, String(_rngSeed)); } catch (e) {}
    return _rngSeed;
  }

  function getRngSeed() {
    return _rngSeed;
  }
/*@CHUNK:crng0000:END*/

/*@CHUNK:crngcurve:START*/
  // ========== NON-LINEAR ATTRIBUTE IMPACT CURVE ==========
  // Every attribute-driven "edge" in the engine used to be a flat multiplier:
  // (rating - baseline) / span, scaled by a fixed weight. On a straight
  // line, every point of rating is worth exactly the same amount everywhere
  // on the scale — so the gap between an 80 and a 90 read as the same size
  // as the gap between a 90 and a 97, and a 97-rated attribute basically
  // felt like "80, but a bit more of the same multiplier" rather than
  // something genuinely elite.
  //
  // curvedStat() reshapes that: it measures how far a rating sits from a
  // roughly-average baseline, then raises that distance to a power > 1
  // before scaling it back down. Close to baseline, a few points barely
  // move the result (a 68 and a 72 in the same role really do play almost
  // identically). The further out a rating sits in either direction, the
  // more each additional point is worth, so a 97 reads as a clear tier
  // above a 90, which reads as a clear tier above an 80 — not just a
  // bigger number times the same flat rate. Returns a value in -1..1;
  // callers multiply by whatever weight they need for their own formula.
  // (power > 1 is deliberately "convex": it flattens the middle of the
  // scale and steepens the extremes — the opposite of a flat multiplier.)
  function curvedStat(value, baseline, span, power) {
    baseline = baseline != null ? baseline : 70;
    span = span != null ? span : (99 - baseline);
    power = power != null ? power : 1.6;
    if (!span) return 0;
    let raw = (value - baseline) / span;
    raw = Math.max(-1, Math.min(1, raw));
    return Math.sign(raw) * Math.pow(Math.abs(raw), power);
  }

  // Same curve, but returned as an "effective" rating back on the original
  // 1-99 scale instead of a -1..1 edge — a drop-in replacement for a raw
  // stat inside an existing weighted-average formula whose overall shape
  // shouldn't otherwise change. A 97 stays close to 97 (elite ratings are
  // barely compressed); an 80 reads closer to baseline than its raw number
  // suggests (a merely-good rating is worth less than a flat scale implies).
  function curvedAttr(value, baseline, span, power) {
    baseline = baseline != null ? baseline : 70;
    span = span != null ? span : (99 - baseline);
    return baseline + curvedStat(value, baseline, span, power) * span;
  }
/*@CHUNK:crngcurve:END*/

/*@CHUNK:cutil01:START*/

  // ========== SHARED UI PERFORMANCE HELPERS ==========
  // debounce(fn, wait) returns a wrapped version of fn that only actually
  // runs once calls stop arriving for `wait` ms — used on the search boxes
  // (players/teams/hospital/season/tournament) so filtering + re-rendering
  // a large list doesn't run on every single keystroke, which is what was
  // causing typing lag on those pages. Each call still records the latest
  // arguments immediately; only the expensive work is delayed.
  function debounce(fn, wait) {
    let t = null;
    return function debounced(...args) {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn.apply(this, args); }, wait);
    };
  }
/*@CHUNK:cutil01:END*/
