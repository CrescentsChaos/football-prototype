## 2026-08-31 - Memoizing Player Team Affiliation Lookups
**Learning:** `findPlayerTeams(playerId)` executes multiple linear array scans through `teamsData.national`, `teamsData.club`, and `allTeams` to find a player's national and club team. Calling this function repeatedly during stat recording, leaderboard rendering, and season processing incurs an $O(\text{players} \times \text{teams} \times \text{roster\_size})$ bottleneck.
**Action:** Use a `Map` memoization cache (`_playerTeamsCache`) to store `{ national, club }` per `playerId`, turning subsequent lookups into $O(1)$ operations.
