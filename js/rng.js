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
