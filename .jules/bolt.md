## 2025-05-18 - Map Memoization for Frequent Entity Lookups
**Learning:** Entity lookups like `getTeam(id)` were performing $O(N)$ linear scans (`allTeams.find(...)`) thousands of times during match and season simulations. Standardizing lookups to use Map-based memoization with invalidation on array reference/length changes improves lookup speeds by ~20x.
**Action:** Always check frequently-called entity lookup functions in simulation/engine hot paths and convert linear array scans to Map-based memoized lookups.
