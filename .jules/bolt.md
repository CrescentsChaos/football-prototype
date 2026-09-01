## 2026-09-01 - Memoizing skill checks and team OVR averages

**Learning:** `hasSkill()` is a hot-path function executed dozens of times per match tick across tactical, set piece, passing, and shooting evaluations. Performing string regex normalization and array iterations on every call created significant CPU overhead (685ms for 200k checks). Lazily caching normalized skill sets (`_skillSet`) on player objects and string key maps (`_canonSkillCache`) reduced execution time by 97.8% (~45x speedup). Additionally, `teamAvgOvr()` was called on every comparison during team list sorting, so caching `_avgOvr` on team objects provided a 5.7x speedup for sorting.

**Action:** When working with player skills or team aggregate stats in simulation and UI loops, always leverage cached Set lookups or memoized properties instead of repeating array operations and string transformations.
