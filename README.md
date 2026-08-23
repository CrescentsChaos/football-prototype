# APEX SIM — Football Simulator

**APEX SIM** is a feature-rich, browser-based football simulation platform built with vanilla HTML, CSS, and JavaScript. It provides a comprehensive football management and simulation experience, featuring a live 2D match engine, domestic league seasons, major international and club tournaments, career stat tracking, individual awards, and squad building.

---

## 🌟 Key Features

### 🏟️ Live Match Engine & Kick Off
* **Live Simulation:** Real-time match commentary feed, animated pitch visualizer, live statistics, and player match ratings.
* **Flexible Speeds:** Adjust simulation speed (Slow, Normal, Fast, Turbo) or perform an **Instant Result / Quick Sim**.
* **Custom Tactical Setup:** Choose formations, extra time, and penalty shootout rules, or randomly match up historic national or club teams.
* **Squad Builder:** Custom-assign starting slots and bench selections for any team with auto-fill options.

### 🏆 Tournaments
* **World Cup:** National teams compete through group stages and knockout brackets, tracking goals, assists, clean sheets, and player ratings throughout the tournament.
* **Champions League:** Top European club competition featuring league/group phase play and multi-legged knockout rounds leading to a single final.

### 📅 Multi-League Season Mode
* **Domestic Leagues:** Full double round-robin seasons across La Liga, Premier League, Serie A, Bundesliga, and Ligue 1.
* **European Qualification:** Top 4 clubs from each domestic league qualify for the following season's Champions League.
* **Multi-Year Progression:** Progress through multiple consecutive years with updated rosters, title winners, and qualification spots.

### 📊 Global Leaderboards & Individual Awards
* **Career & Global Stats:** Tracks all-time goals, assists, saves, clean sheets, interceptions, yellow/red cards, average ratings, and Man of the Match (MOTM) honors.
* **Prestigious Awards:** Automatic calculation and crowning of individual honors including:
  * **Ballon d'Or** & **Golden Boot**
  * **Puskás Award** & **Gerd Müller Award**
  * **Yashin Trophy** & **Defenders' Award**
  * **Manager of the Year**

### 📜 Roll of Honor & History
* Permanent history log keeping track of past team champions and individual award winners across all played seasons and tournaments, surviving season resets.

### 🔍 Team Database
* Browse comprehensive squad lists, player attributes, positions, overall ratings (OVR), kit colors, home stadiums, and manager details.

### 💾 Save Data Management
* Automatic LocalStorage saving with manual save option.
* **Export / Import:** Easily export your entire game save state as a `.json` file to backup or transfer your progress across devices.

---

## 📁 Repository Structure

```
.
├── index.html              # Main HTML markup and UI view definitions
├── styles.css              # Custom styling, dark theme, pitch layout & responsive UI
├── app.js                  # Main application logic, match engine, state & view controllers
├── teams.json              # Team database (national & club rosters, player stats, managers)
├── leagues.json            # Mapping of clubs to domestic leagues
├── player-attributes.json # Extended eFootball-style attributes, skills, and playstyles
├── managers.json           # Manager portrait mappings
├── players.json            # Player portrait mappings
├── trophies.json           # Trophy image mappings
└── assets/                 # Image assets
    ├── logos/              # Club and national team logos
    ├── portraits/          # Player portrait images
    ├── mportraits/         # Manager portrait images
    └── trophies/           # Trophy and award images
```

---

## 🎮 Getting Started

APEX SIM requires no build steps or heavy dependencies. It runs directly in any modern web browser.

### Running Locally

1. **Clone or download the repository:**
   ```bash
   git clone https://github.com/your-username/football-prototype.git
   cd football-prototype
   ```

2. **Serve using a local HTTP server** (recommended to allow proper loading of JSON assets):
   * **Node.js (npx):**
     ```bash
     npx serve .
     ```
   * **Python 3:**
     ```bash
     python3 -m http.server 8000
     ```
   * **VS Code:** Use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.

3. Open `http://localhost:8000` (or the provided local URL) in your browser.

> *Note:* APEX SIM includes embedded fallback data in `app.js` so core functionality works even if launched via `file://`, though serving over HTTP/HTTPS is recommended for full asset loading.

---

## 🛠️ Customization & Data Schema

You can extend APEX SIM by adding new teams, players, or leagues through the JSON data files:

* **Adding Teams (`teams.json`):** Add entries under `"national"` or `"club"` arrays with player positions (`GK`, `CB`, `CM`, `ST`, etc.), rating attributes (`ovr`, `att`, `def`, `phy`, `pac`, `tec`), and manager stats.
* **Configuring Leagues (`leagues.json`):** Map team names directly to league titles (`Premier League`, `La Liga`, etc.).
* **Expanded Player Attributes (`player-attributes.json`):** Provide detailed playstyles, weak foot usage, injury resistance, and granular skill traits per player ID.

---

## 📄 License

This project is open-source and available for prototyping, modification, and personal use.
