## 2025-03-02 - O(1) Team Lookup Optimization & Manifest Build Anti-Pattern
**Learning:**
1. Running `node build.js` strips code because `manifest.json` chunk entries do not include all functional code present in `dist/app.js`. Any source code changes in `data/teamDatabase.js` must also be directly applied to `dist/app.js` to prevent regressions.
2. `getTeam(id)` is called tens of thousands of times during simulations and UI renders. Replacing `allTeams.find(...)` with a cached Map (`_teamByIdMap`) invalidated on `allTeams` reference or length changes yields a ~95x speedup (from 1.37s down to 14.5ms for 500k lookups).
**Action:**
Always apply changes directly to both source files and `dist/app.js`, avoiding `node build.js` rebuilds unless `manifest.json` is synced.
