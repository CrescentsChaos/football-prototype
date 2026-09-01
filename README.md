⚽ Apex Football Simulator

A browser-based football simulation engine designed to simulate matches, players, teams, leagues, seasons, and international tournaments with a focus on realistic football logic and long-term statistical progression.

Apex isn't just a score generator. The simulation considers player attributes, formations, tactics, stamina, positioning, playstyles, substitutions, injuries, cards, and match situations to produce dynamic results.

---

✨ Features

🏟️ Match Simulation

The match engine simulates football through a multi-stage possession and chance-creation pipeline:

Zones → Movement → Passing → Duels → Transitions → Chance Creation → Shots → Goalkeeper

Player attributes and team tactics influence each stage of the match.

Matches can generate:

- ⚽ Goals
- 🅰️ Assists
- 🧤 Saves
- 🟨 Yellow cards
- 🟥 Red cards
- 🏥 Injuries
- ⭐ Player ratings
- 🏆 Man of the Match
- 🔄 Substitutions
- 📴 Offside decisions
- ⏱️ Minute-by-minute events
- 🎯 Penalties and set pieces
- 📋 Detailed match reports

---

🧠 Realistic Simulation Systems

🎲 Deterministic Randomness

The simulator uses a seeded Mulberry32 PRNG.

This means the same seed can reproduce the same match, season, or tournament — useful for debugging, testing, and replaying simulations.

setRngSeed("my-season");

---

📈 Non-Linear Player Attributes

Player attributes aren't treated as completely linear numbers.

The engine uses a curved attribute model where elite ratings have a greater impact than small differences around the average range.

For example:

«97-rated ability should feel meaningfully different from 90, rather than simply being 7 points better on a flat multiplier.»

The engine's "curvedStat()" system uses a configurable power curve for this purpose.

---

🫁 Fatigue & Stamina

Players gradually lose stamina throughout matches.

Fatigue depends on:

- Minutes played
- Stamina attribute
- Physical Contact
- Position
- Tactical intensity
- Player skills
- Captaincy
- Workload

High-intensity tactics such as pressing drain stamina faster, while defensive tactics conserve energy.

Stamina also directly affects in-match performance rather than only triggering substitutions.

Substitutes enter the match with fresh stamina.

---

🚩 Offside Engine

The simulator includes a spatial offside system rather than simply rolling a random probability.

It considers:

- Receiver position
- Defensive line
- Second-last defender
- Goalkeeper position
- Through balls
- Defensive touches
- Rebounds
- Formation positioning

The defensive line changes depending on how aggressively a team plays.

---

🧩 Tactical System

Teams don't simply receive a generic strength rating.

Tactics and team identity influence how matches are played.

Supported tactical identities include concepts such as:

- Possession
- Quick Counter
- Long Ball Counter
- Long Ball
- Out Wide
- Attacking football
- Defensive football
- Pressing

Opening tactics are influenced by the relative strength of both teams and their playstyle.

---

📐 Formations

The simulator supports a large collection of formations, including:

- 4-3-3
- 4-4-2
- 4-2-3-1
- 3-5-2
- 4-5-1
- 3-4-3
- 5-3-2
- 4-1-4-1
- 4-3-2-1
- 3-4-2-1
- 4-4-1-1
- 5-4-1
- 4-1-2-1-2 Diamond
- 4-2-2-2
- 3-1-4-2
- 4-1-3-2
- 4-3-3 False 9
- 4-3-3 Holding
- 4-3-3 Attack
- 4-2-3-1 Narrow
- 5-3-2 Attack
- 4-2-4
- 4-1-2-3

Formations have positional coordinates and shape-based defensive, midfield, and attacking characteristics.

The engine also normalizes different positional naming conventions such as:

CMF → CM
DMF → CDM
AMF → CAM
RMF → RM
LMF → LM
RWF → RW
LWF → LW
CF → ST
SS → CAM

This allows players from different data sources to work consistently inside the same tactical system.

---

🏆 Seasons & Competitions

Apex supports both individual matches and long-running competitions.

Domestic Leagues

Currently modeled competitions include:

- 🏴 Premier League
- 🇪🇸 La Liga
- 🇮🇹 Serie A
- 🇩🇪 Bundesliga
- 🇫🇷 Ligue 1

Domestic leagues use home-and-away round-robin seasons with league tables and champions.

---

🌍 International Competitions

Supported tournament formats include:

- FIFA World Cup
- UEFA European Championship
- Copa América
- Africa Cup of Nations
- AFC Asian Cup
- CONCACAF Gold Cup
- UEFA Nations League

Different competitions have their own group and knockout structures.

---

🏆 Club Competitions

The simulator also supports:

- UEFA Champions League
- FA Cup
- EFL Cup
- FA Community Shield
- Copa del Rey
- Supercopa de España
- DFB-Pokal
- DFL-Supercup
- Coppa Italia
- Supercoppa Italiana
- Coupe de France
- Trophée des Champions

The Champions League includes a league phase followed by playoffs, two-legged knockouts and a single final.

---

📅 Season Simulation

A season isn't just a collection of unrelated matches.

The simulator tracks a calendar with fixture congestion, including:

Saturday  → League
Tuesday   → Champions League
Saturday  → League
Tuesday   → Cup
Sunday    → League

This creates fixture congestion and influences squad rotation.

Managers can rotate their squads depending on the competition and importance of the fixture.

Different rotation profiles exist for league football, Champions League football and cup matches.

---

👤 Player System

Players can have detailed attributes, positions and gameplay characteristics.

The simulator supports:

- Player ratings
- Positions
- Playstyles
- Skills
- Club teams
- National teams
- Player portraits
- Match ratings
- Goals
- Assists
- Saves
- Tackles
- Interceptions
- Cards
- Clean sheets
- Man of the Match awards
- Tournament statistics
- Career history

The Players interface is optimized for large datasets and can handle thousands of players using lazy rendering rather than putting the entire player database into the DOM at once.

---

🏥 Injuries

The simulator contains a dedicated injury system with different injury types and severities.

Examples include:

- Muscle cramps
- Ankle sprains
- Knee knocks
- Dead legs
- Concussion protocol
- Hamstring strains
- Calf strains
- Groin strains
- Thigh strains
- Back spasms
- Shoulder injuries
- Fractured metatarsals
- MCL injuries
- Rib fractures
- Facial fractures
- Hip flexor tears
- ACL tears
- Achilles ruptures
- Tibia/fibula fractures

Injuries can have different recovery periods and are tracked across subsequent matches.

---

📊 Statistics & Records

The simulator tracks extensive statistics across matches and competitions.

Player Statistics

- Goals
- Assists
- Saves
- Clean sheets
- Yellow cards
- Red cards
- MOTM awards
- Ratings
- Tackles
- Interceptions
- Big-game performances

Competition-specific statistics are also maintained, allowing leagues and tournaments to have their own leaderboards.

---

🥇 Awards & Trophy Cabinet

The simulator records team and individual achievements.

Awards include:

- 🥇 Golden Boot
- ⚽ Golden Ball
- 🧤 Golden Glove
- 🧼 Clean Sheet King
- 🅰️ Top Assists
- ⭐ Most MOTM
- 📊 Best Average Rating
- 🏆 League titles
- 🏆 Champions League titles
- 👔 Manager awards

Awards are persisted and can appear in team and player history.

The simulator also contains a Ballon d'Or ranking system used both interactively and when archiving completed seasons.

---

🧑‍💼 Managers

Managers are represented as part of team identity.

Manager data can include:

- Manager name
- Manager rating
- Portrait
- Tactical identity
- Team success
- Manager of the Season awards

Managers can receive awards when their team wins major competitions.

---

💾 Data & Assets

The application is designed around external data files while also providing embedded fallbacks for browser compatibility.

Potential data sources include:

teams.json
leagues.json
players.json
player-attributes.json
trophies.json
injury.json
managers.json

Assets can include:

assets/
├── portraits/
├── mportraits/
├── trophies/
└── images/

The application can work even when opened directly through "file://" by embedding important fallback data inside the JavaScript application.

---

⚡ Performance

Apex is designed to handle large football databases.

Performance techniques include:

- Debounced search
- Lazy player rendering
- Cached player lists
- Bounded DOM rendering
- Cached formation calculations
- In-memory team data
- Deterministic simulation
- Lightweight match reports

Search inputs are debounced so large lists don't re-render on every keystroke.

---

🛠️ Technology

The project is primarily a browser-based JavaScript application.

Core

- HTML
- CSS
- JavaScript
- JSON

Architecture

UI
 │
 ├── Players
 ├── Teams
 ├── Matches
 ├── Seasons
 ├── Tournaments
 ├── History
 ├── Awards
 └── Hospital
       │
       ▼
Simulation Engine
       │
       ├── Tactical System
       ├── Match Engine
       ├── Player Attributes
       ├── Fatigue
       ├── Injuries
       ├── Offside
       ├── Substitutions
       └── Statistics

---

🚀 Running Locally

Clone the repository:

git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY

Then open the website through a local HTTP server.

For example:

python3 -m http.server 8000

Open:

http://localhost:8000

«Using a local server is recommended because browsers restrict some JSON/file operations when an HTML file is opened directly through "file://".»

---

🎮 Basic Usage

1. Choose Teams

Select two teams from the available club or national-team database.

2. Configure Tactics

Choose:

- Formation
- Players
- Tactical approach
- Squad options

3. Start the Match

The engine simulates the match minute by minute.

4. Review the Match

After the match you can inspect:

- Score
- Goals
- Assists
- Cards
- Injuries
- Saves
- Player ratings
- MOTM
- Match events

5. Start a Season

Select clubs for the available domestic leagues and begin a new season.

The simulator handles fixtures, standings, statistics and awards automatically.

6. Run Tournaments

Create tournament simulations using national or club teams and watch the competition progress through its configured format.

---

🧪 Simulation Philosophy

Apex aims to make football simulation feel contextual rather than purely statistical.

A team's strength alone should not determine the result.

Instead, the engine attempts to combine:

Player Quality
      +
Player Attributes
      +
Formation
      +
Tactics
      +
Playstyle
      +
Fatigue
      +
Squad Rotation
      +
Match Context
      +
Randomness
      ↓
Match Outcome

This allows weaker teams to produce surprises while still giving stronger teams a meaningful advantage.

---

🔮 Future Development

Possible future improvements include:

- Transfer market
- Player development
- Player aging
- Retirements
- Youth academies
- Manager career system
- Club finances
- Transfers and loans
- More domestic leagues
- Continental competitions
- Dynamic team form
- Tactical instructions
- More detailed match analytics
- xG/xA
- Possession statistics
- Passing networks
- Heatmaps
- Career records
- Historical databases
- Save/load career files
- Multiplayer / online leagues

---

📜 Project Status

🚧 Active Development

Apex Football Simulator is an evolving project. The simulation engine, competition formats, player systems and UI are continuously being expanded and refined.

---

❤️ Credits

Built as a passion project for football simulation, tactical experimentation and creating alternate football histories.

Simulate. Compete. Rewrite football history.

⚽ Apex Football Simulator