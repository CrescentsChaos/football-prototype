## 2026-08-25 - Player-to-Team Lookups Cache
**Learning:** In APEX SIM, `findPlayerTeams(playerId)` is called repeatedly whenever stat buckets or leaderboards are updated during match/season simulation. Uncached, it performs linear scans across 250+ teams and ~5,800 players.
**Action:** Memoizing `findPlayerTeams` with a `Map` cache reduces repeated affiliation lookups to O(1) constant time, eliminating thousands of redundant array iterations per matchday.
